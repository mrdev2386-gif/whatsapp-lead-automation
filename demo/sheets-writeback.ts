import * as fs from 'fs';
import * as path from 'path';
const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SHEETS WRITE-BACK SYSTEM (Production-Safe)
// ─────────────────────────────────────────────────────────────────────────────

interface SheetWriteConfig {
  spreadsheetId: string;
  sheetName: string;
  apiKey?: string;
  serviceAccountKey?: any;
}

interface RowMapping {
  chatId: string;
  sheetId: string;
  rowIndex: number;
  phoneNumber: string;
  lastUpdateTime: number;
}

interface UpdateResult {
  success: boolean;
  rowIndex: number;
  status: 'sent' | 'failed';
  error?: string;
  retryCount: number;
}

// In-memory mapping: chatId → row metadata
const rowMappings: Record<string, RowMapping> = {};

// Persistent mapping file for restart safety
const MAPPING_FILE = path.join(process.cwd(), 'wa-sheet-mappings.json');

// Load mappings from disk
function loadMappings(): void {
  try {
    if (fs.existsSync(MAPPING_FILE)) {
      const data = fs.readFileSync(MAPPING_FILE, 'utf8');
      Object.assign(rowMappings, JSON.parse(data));
      console.log(`[SHEET WRITEBACK] Loaded ${Object.keys(rowMappings).length} row mappings`);
    }
  } catch (err: any) {
    console.error(`[SHEET WRITEBACK] Failed to load mappings:`, err.message);
  }
}

// Save mappings to disk
function saveMappings(): void {
  try {
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(rowMappings, null, 2), 'utf8');
  } catch (err: any) {
    console.error(`[SHEET WRITEBACK] Failed to save mappings:`, err.message);
  }
}

// Register a lead with its row information
function registerRowMapping(
  chatId: string,
  sheetId: string,
  rowIndex: number,
  phoneNumber: string
): void {
  rowMappings[chatId] = {
    chatId,
    sheetId,
    rowIndex,
    phoneNumber,
    lastUpdateTime: Date.now()
  };
  saveMappings();
  console.log(`[SHEET WRITEBACK] Registered ${chatId} → row ${rowIndex} (sheet: ${sheetId})`);
}

// Get row mapping for a chat
function getRowMapping(chatId: string): RowMapping | null {
  return rowMappings[chatId] || null;
}

// Verify row still exists and is pending before updating
async function verifyRowStatus(
  config: SheetWriteConfig,
  rowIndex: number
): Promise<boolean> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv`;
    const response = await axios.get(csvUrl, { timeout: 10000 });
    
    if (typeof response.data !== 'string') return false;

    const lines = response.data.split(/\r?\n/).filter((line: string) => line.trim());
    if (lines.length <= rowIndex) return false;

    const headers = lines[0].toLowerCase().split(',').map((h: string) => h.trim());
    const statusIdx = headers.indexOf('status');
    
    if (statusIdx === -1) return false;

    const values = lines[rowIndex].split(',').map((v: string) => v.trim());
    const currentStatus = values[statusIdx]?.toLowerCase() || '';
    
    // Only update if still pending
    return currentStatus === 'pending';
  } catch (err: any) {
    console.error(`[SHEET WRITEBACK] Verification failed:`, err.message);
    return false;
  }
}

// Update lead status in Google Sheets via API
// Uses Google Sheets API v4 with proper authentication
async function updateLeadStatusInSheet(
  config: SheetWriteConfig,
  rowIndex: number,
  newStatus: 'sent' | 'failed',
  retryCount: number = 0
): Promise<UpdateResult> {
  const maxRetries = 3;
  const retryDelays = [2000, 5000, 10000]; // 2s, 5s, 10s

  try {
    // CRITICAL: Verify row still exists and is pending
    const isValid = await verifyRowStatus(config, rowIndex);
    if (!isValid) {
      console.log(`[SHEET UPDATE] Row ${rowIndex} no longer pending or doesn't exist`);
      return {
        success: false,
        rowIndex,
        status: newStatus,
        error: 'Row not pending',
        retryCount
      };
    }

    // Construct update request for Google Sheets API
    // Format: Sheet1!C{rowIndex} = status column
    const range = `${config.sheetName}!C${rowIndex}`;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}?key=${config.apiKey}`;

    const response = await axios.put(
      updateUrl,
      {
        values: [[newStatus]],
        majorDimension: 'ROWS'
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.status === 200) {
      console.log(`[SHEET UPDATE] Updated row ${rowIndex} → ${newStatus}`);
      return {
        success: true,
        rowIndex,
        status: newStatus,
        retryCount
      };
    }

    throw new Error(`Unexpected status: ${response.status}`);
  } catch (err: any) {
    console.error(`[SHEET UPDATE ERROR] Attempt ${retryCount + 1}/${maxRetries + 1}:`, err.message);

    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delay = retryDelays[retryCount];
      console.log(`[SHEET RETRY] Retrying in ${delay}ms...`);
      
      await new Promise(res => setTimeout(res, delay));
      return updateLeadStatusInSheet(config, rowIndex, newStatus, retryCount + 1);
    }

    // All retries exhausted
    console.error(`[SHEET UPDATE ERROR] Failed after ${maxRetries + 1} attempts for row ${rowIndex}`);
    return {
      success: false,
      rowIndex,
      status: newStatus,
      error: err.message,
      retryCount: maxRetries + 1
    };
  }
}

// Batch update multiple rows (respects API quota)
async function batchUpdateLeadStatus(
  config: SheetWriteConfig,
  updates: Array<{ rowIndex: number; status: 'sent' | 'failed' }>
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  
  // Process updates sequentially to avoid API quota issues
  for (const update of updates) {
    const result = await updateLeadStatusInSheet(config, update.rowIndex, update.status);
    results.push(result);
    
    // Small delay between API calls
    await new Promise(res => setTimeout(res, 500));
  }

  return results;
}

// Mark lead as sent after successful delivery
async function markLeadAsSent(
  config: SheetWriteConfig,
  chatId: string
): Promise<boolean> {
  const mapping = getRowMapping(chatId);
  if (!mapping) {
    console.log(`[SHEET UPDATE] No mapping found for ${chatId}`);
    return false;
  }

  const result = await updateLeadStatusInSheet(config, mapping.rowIndex, 'sent');
  
  if (result.success) {
    console.log(`[SHEET UPDATE] ${chatId} marked as sent`);
    return true;
  }

  // Keep status as pending if update fails - will retry in next cycle
  console.error(`[SHEET UPDATE] Failed to mark ${chatId} as sent`);
  return false;
}

// Mark lead as failed after delivery failure
async function markLeadAsFailed(
  config: SheetWriteConfig,
  chatId: string
): Promise<boolean> {
  const mapping = getRowMapping(chatId);
  if (!mapping) {
    console.log(`[SHEET UPDATE] No mapping found for ${chatId}`);
    return false;
  }

  const result = await updateLeadStatusInSheet(config, mapping.rowIndex, 'failed');
  
  if (result.success) {
    console.log(`[SHEET UPDATE] ${chatId} marked as failed`);
    return true;
  }

  // Keep status as pending if update fails
  console.error(`[SHEET UPDATE] Failed to mark ${chatId} as failed`);
  return false;
}

// Clean up old mappings (older than 7 days)
function cleanupOldMappings(): void {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let cleaned = 0;

  for (const [chatId, mapping] of Object.entries(rowMappings)) {
    if (now - mapping.lastUpdateTime > sevenDaysMs) {
      delete rowMappings[chatId];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    saveMappings();
    console.log(`[SHEET WRITEBACK] Cleaned up ${cleaned} old mappings`);
  }
}

// Run cleanup every 24 hours
setInterval(cleanupOldMappings, 24 * 60 * 60 * 1000);

// Initialize on startup
loadMappings();

export {
  SheetWriteConfig,
  RowMapping,
  UpdateResult,
  registerRowMapping,
  getRowMapping,
  updateLeadStatusInSheet,
  batchUpdateLeadStatus,
  markLeadAsSent,
  markLeadAsFailed,
  verifyRowStatus,
  cleanupOldMappings,
  loadMappings,
  saveMappings
};
