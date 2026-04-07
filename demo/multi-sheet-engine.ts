import * as fs from 'fs';
import * as path from 'path';
const axios = require('axios');
import {
  registerRowMapping,
  markLeadAsSent,
  markLeadAsFailed,
  SheetWriteConfig
} from './sheets-writeback';
import {
  fetchFromGoogleSheetsAPI
} from './google-sheets-api';

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SHEET OUTBOUND DM ENGINE - FLEXIBLE 4-COLUMN SUPPORT
// ─────────────────────────────────────────────────────────────────────────────

interface SheetConfig {
  sheetId: string;
  sessionId: string;
  spreadsheetId: string;
  sheetName: string;
}

interface SheetLead {
  rowIndex: number;
  number: string;
  name: string;
  category: 'clinic' | 'hotel';
  message?: string;
  status: 'pending' | 'sent' | 'failed';
}

interface SheetMetrics {
  sentToday: number;
  lastResetTime: number;
  failedLeads: SheetLead[];
  lastPollTime: number;
}

interface ColumnMapping {
  numberIdx: number;
  nameIdx: number;
  messageIdx: number;
  statusIdx: number;
  categoryIdx: number;
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    sheetId: 'sheet1',
    sessionId: '9155604591',
    spreadsheetId: '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
    sheetName: 'Leads_9155604591'
  }
];

const DAILY_LIMIT = 100;
const POLL_INTERVAL = 2 * 60 * 1000;
const SEND_DELAY_MIN = 45 * 1000;
const SEND_DELAY_MAX = 75 * 1000;

const sheetMetrics: Record<string, SheetMetrics> = {};
const activeNumbers = new Set<string>();

function initSheetMetrics(sheetId: string) {
  if (!sheetMetrics[sheetId]) {
    sheetMetrics[sheetId] = {
      sentToday: 0,
      lastResetTime: Date.now(),
      failedLeads: [],
      lastPollTime: Date.now()
    };
  }
}

function checkAndResetDailyLimit(sheetId: string) {
  const metrics = sheetMetrics[sheetId];
  const now = Date.now();
  const hoursPassed = (now - metrics.lastResetTime) / (1000 * 60 * 60);
  
  if (hoursPassed >= 24) {
    console.log(`[SHEET] ${sheetId} daily limit reset (was ${metrics.sentToday}/100)`);
    metrics.sentToday = 0;
    metrics.lastResetTime = now;
  }
}

function autoDetectCategory(message: string): 'clinic' | 'hotel' {
  const msg = (message || '').toLowerCase();
  
  if (msg.includes('clinic') || msg.includes('doctor') || msg.includes('patient') || msg.includes('dental') || msg.includes('hospital')) {
    console.log('[SHEET] Category auto-detected: clinic (from message)');
    return 'clinic';
  }
  
  if (msg.includes('hotel') || msg.includes('booking') || msg.includes('resort') || msg.includes('lodge') || msg.includes('guest')) {
    console.log('[SHEET] Category auto-detected: hotel (from message)');
    return 'hotel';
  }
  
  console.log('[SHEET] Category auto-detected: clinic (default)');
  return 'clinic';
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  console.log('[SHEET] === COLUMN MAPPING ===');
  
  let numberIdx = headers.indexOf('number');
  if (numberIdx === -1) {
    numberIdx = headers.indexOf('phone');
    if (numberIdx !== -1) {
      console.log(`[SHEET] Mapped phone to number (column index: ${numberIdx})`);
    }
  } else {
    console.log(`[SHEET] Using number column (column index: ${numberIdx})`);
  }
  
  const nameIdx = headers.indexOf('name');
  if (nameIdx !== -1) {
    console.log(`[SHEET] Found name column (column index: ${nameIdx})`);
  }
  
  const messageIdx = headers.indexOf('message');
  if (messageIdx !== -1) {
    console.log(`[SHEET] Found message column (column index: ${messageIdx})`);
  }
  
  const statusIdx = headers.indexOf('status');
  if (statusIdx !== -1) {
    console.log(`[SHEET] Found status column (column index: ${statusIdx})`);
  }
  
  const categoryIdx = headers.indexOf('category');
  if (categoryIdx !== -1) {
    console.log(`[SHEET] Found category column (column index: ${categoryIdx})`);
  } else {
    console.log('[SHEET] Category column not found - will auto-detect from message');
  }
  
  return {
    numberIdx,
    nameIdx,
    messageIdx,
    statusIdx,
    categoryIdx
  };
}

function validateRequiredColumns(mapping: ColumnMapping, sheetId: string): boolean {
  const required = [
    { name: 'phone/number', idx: mapping.numberIdx },
    { name: 'name', idx: mapping.nameIdx },
    { name: 'message', idx: mapping.messageIdx },
    { name: 'status', idx: mapping.statusIdx }
  ];
  
  const missing = required.filter((col: any) => col.idx === -1);
  
  if (missing.length > 0) {
    console.error(`[SHEET] ${sheetId} Missing required columns: ${missing.map((m: any) => m.name).join(', ')}`);
    return false;
  }
  
  console.log(`[SHEET] ${sheetId} All required columns found`);
  return true;
}

async function fetchLeadsFromSheet(config: SheetConfig): Promise<SheetLead[]> {
  try {
    console.log(`[FETCH] Fetching sheet: ${config.sheetName}`);
    console.log(`[SHEET] ${config.sheetId} === GOOGLE SHEETS API FETCH ===`);
    console.log(`[SHEET] ${config.sheetId} Spreadsheet ID: ${config.spreadsheetId}`);
    console.log(`[SHEET] ${config.sheetId} Sheet Name: ${config.sheetName}`);
    
    // 🔥 REPLACED: CSV export with native Google Sheets API
    const sheetData = await fetchFromGoogleSheetsAPI(config.spreadsheetId, config.sheetName);
    
    if (sheetData.rows.length === 0) {
      console.log(`[SHEET] ${config.sheetId} No data rows found`);
      return [];
    }

    const headers = sheetData.headers;
    console.log(`[SHEET] ${config.sheetId} Headers: ${headers.join(', ')}`);
    
    const mapping = detectColumnMapping(headers);
    
    if (!validateRequiredColumns(mapping, config.sheetId)) {
      return [];
    }

    const leads: SheetLead[] = [];
    let pendingCount = 0;
    let skippedCount = 0;
    let invalidNumberCount = 0;
    let autoDetectedCategoryCount = 0;

    for (let i = 0; i < sheetData.rows.length; i++) {
      const row = sheetData.rows[i];
      
      // Get values using mapped indices
      const statusKey = headers[mapping.statusIdx];
      const numberKey = headers[mapping.numberIdx];
      const nameKey = headers[mapping.nameIdx];
      const messageKey = headers[mapping.messageIdx];
      const categoryKey = mapping.categoryIdx !== -1 ? headers[mapping.categoryIdx] : null;
      
      const rawStatus = row[statusKey] || '';
      const status = rawStatus.trim().toLowerCase();
      const normalizedStatus = status === '' ? 'pending' : status;
      
      console.log(`[SHEET] ${config.sheetId} Row ${i + 2}: status="${rawStatus}" -> normalized="${normalizedStatus}"`);
      
      if (normalizedStatus !== 'pending') {
        skippedCount++;
        continue;
      }
      
      pendingCount++;

      const rawNumber = row[numberKey] || '';
      const number = rawNumber.replace(/[^0-9]/g, '');
      
      if (!number) {
        console.warn(`[SHEET] ${config.sheetId} Row ${i + 2}: Invalid number "${rawNumber}" - skipping`);
        invalidNumberCount++;
        continue;
      }
      
      let formattedNumber = number;
      if (!number.startsWith('91') && number.length === 10) {
        formattedNumber = '91' + number;
        console.log(`[SHEET] ${config.sheetId} Row ${i + 2}: Auto-formatted number ${number} -> ${formattedNumber}`);
      }
      
      if (formattedNumber.length < 10) {
        console.warn(`[SHEET] ${config.sheetId} Row ${i + 2}: Number too short "${formattedNumber}" - skipping`);
        invalidNumberCount++;
        continue;
      }

      const name = (row[nameKey] || 'Sir').trim();
      const message = messageKey ? (row[messageKey] || '').trim() : '';

      let category: 'clinic' | 'hotel' = 'clinic';
      
      if (categoryKey) {
        const rawCategory = row[categoryKey] || '';
        const detectedCategory = rawCategory.trim().toLowerCase();
        
        if (detectedCategory === 'clinic' || detectedCategory === 'hotel') {
          category = detectedCategory as 'clinic' | 'hotel';
          console.log(`[SHEET] ${config.sheetId} Row ${i + 2}: Category from column: ${category}`);
        } else {
          console.log(`[SHEET] ${config.sheetId} Row ${i + 2}: Invalid category "${rawCategory}" - auto-detecting from message`);
          category = autoDetectCategory(message);
          autoDetectedCategoryCount++;
        }
      } else {
        category = autoDetectCategory(message);
        autoDetectedCategoryCount++;
      }

      leads.push({
        rowIndex: i + 2,
        number: formattedNumber,
        name,
        category,
        message: message || undefined,
        status: 'pending'
      });
      
      console.log(`[SHEET] ${config.sheetId} Row ${i + 2}: Valid lead - ${formattedNumber} (${name}, ${category})`);
    }

    console.log(`[SHEET] ${config.sheetId} === SHEET READ SUMMARY ===`);
    console.log(`[SHEET] ${config.sheetId} Total rows: ${sheetData.rows.length}`);
    console.log(`[SHEET] ${config.sheetId} Pending rows: ${pendingCount}`);
    console.log(`[SHEET] ${config.sheetId} Valid leads: ${leads.length}`);
    console.log(`[SHEET] ${config.sheetId} Skipped (non-pending): ${skippedCount}`);
    console.log(`[SHEET] ${config.sheetId} Invalid numbers: ${invalidNumberCount}`);
    console.log(`[SHEET] ${config.sheetId} Auto-detected categories: ${autoDetectedCategoryCount}`);
    
    if (leads.length === 0 && pendingCount > 0) {
      console.warn(`[SHEET] ${config.sheetId} Found ${pendingCount} pending rows but 0 valid leads!`);
    }

    return leads;
  } catch (err: any) {
    console.error(`[SHEET] ${config.sheetId} Fetch error:`, err.message);
    return [];
  }
}

async function updateLeadStatusInSheet(
  config: SheetConfig,
  lead: SheetLead,
  newStatus: 'processing' | 'sent' | 'failed',
  chatId: string
): Promise<boolean> {
  try {
    registerRowMapping(chatId, config.sheetId, lead.rowIndex, lead.number);
    
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbyGQGsrMyikfoPfAQ9axpgGMoun9_Q06nWqz8QBe1-5B47j6qQnO_y8Ptq0oCKgXVg3/exec';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        rowIndex: lead.rowIndex,
        status: newStatus
      })
    });

    if (response.ok) {
      console.log(`[SHEET] ${config.sheetId} [${lead.number}] Status: ${newStatus}`);
      return true;
    } else {
      console.warn(`[SHEET] ${config.sheetId} [${lead.number}] Webhook returned ${response.status}`);
      return false;
    }
  } catch (err: any) {
    console.error(`[SHEET] ${config.sheetId} [${lead.number}] Webhook error:`, err.message);
    return false;
  }
}

function getMessageTemplate(category: 'clinic' | 'hotel', name: string): string {
  const templates = {
    clinic: [
      `Hi ${name},\n\nI came across your clinic.\n\nI can help increase patient inquiries with a custom system.\n\nWould you like to see a demo?`,
      `Hello ${name},\n\nI saw your clinic online and noticed you might need help with patient bookings.\n\nWe create patient acquisition systems.\n\nCan I show you how it works?`,
      `Hi ${name},\n\nDo you want more patient inquiries for your clinic?\n\nI can set up a custom system for you.\n\nShall I share a quick demo?`
    ],
    hotel: [
      `Hi ${name},\n\nI noticed your hotel online.\n\nI can help increase your direct bookings with a custom system.\n\nCan I share a quick demo?`,
      `Hello ${name},\n\nI saw your hotel and thought I could help you get more direct guests.\n\nWe build custom booking systems that work.\n\nWould you like to see a demo?`,
      `Hi ${name},\n\nAre you looking to increase direct bookings for your hotel?\n\nI can build a personalized system for you.\n\nShall I explain the idea?`
    ]
  };

  const variants = templates[category];
  const index = Math.floor(Math.random() * variants.length);
  return variants[index];
}

async function processSheetOutreach(
  client: any,
  config: SheetConfig,
  sendSafeFunc: (chatId: string, text: string) => Promise<boolean>
): Promise<void> {
  console.log(`[ENGINE] Processing all sheets...`);
  const sheetId = config.sheetId;
  initSheetMetrics(sheetId);
  checkAndResetDailyLimit(sheetId);

  const metrics = sheetMetrics[sheetId];

  if (metrics.sentToday >= DAILY_LIMIT) {
    console.log(`[SHEET] ${sheetId} Daily limit reached (${metrics.sentToday}/${DAILY_LIMIT})`);
    return;
  }

  const leads = await fetchLeadsFromSheet(config);
  
  if (leads.length === 0) {
    console.log(`[SHEET] ${sheetId} No pending leads`);
    return;
  }

  console.log(`[SHEET] ${sheetId} Processing ${leads.length} leads`);

  for (const lead of leads) {
    // HARD VALIDATION
    if (!lead.number || lead.number.length < 10 || lead.status !== 'pending') {
      console.warn(`[SHEET] ${sheetId} [${lead.number}] Invalid lead - skipping`);
      continue;
    }

    if (metrics.sentToday >= DAILY_LIMIT) {
      console.log(`[SHEET] ${sheetId} Daily limit reached (${metrics.sentToday}/${DAILY_LIMIT})`);
      break;
    }

    // MEMORY LOCK - Prevent duplicate sends
    if (activeNumbers.has(lead.number)) {
      console.log(`[SHEET] ${sheetId} [${lead.number}] Already processing - skipping`);
      continue;
    }
    activeNumbers.add(lead.number);

    const chatId = `${lead.number}@c.us`;
    const message = lead.message || getMessageTemplate(lead.category, lead.name);

    try {
      // PROCESSING STATUS - Mark as processing before send
      await updateLeadStatusInSheet(config, lead, 'processing', chatId);
      console.log(`[SHEET] ${sheetId} [${lead.number}] Sending → ${lead.name} (${lead.category})`);
      
      const success = await sendSafeFunc(chatId, message);

      if (success) {
        // Mark as sent
        await updateLeadStatusInSheet(config, lead, 'sent', chatId);
        metrics.sentToday += 1;
        console.log(`[SHEET] ${sheetId} [${lead.number}] ✓ SENT (${metrics.sentToday}/${DAILY_LIMIT})`);
      } else {
        // Mark as failed
        await updateLeadStatusInSheet(config, lead, 'failed', chatId);
        metrics.failedLeads.push(lead);
        console.log(`[SHEET] ${sheetId} [${lead.number}] ✗ FAILED`);
      }

      // RANDOM DELAY - Anti-ban behavior (45-75 seconds)
      const randomDelay = SEND_DELAY_MIN + Math.random() * (SEND_DELAY_MAX - SEND_DELAY_MIN);
      await new Promise(res => setTimeout(res, randomDelay));
    } catch (err: any) {
      console.error(`[SHEET] ${sheetId} [${lead.number}] Error:`, err.message);
      await updateLeadStatusInSheet(config, lead, 'failed', chatId);
      metrics.failedLeads.push(lead);
    } finally {
      // MEMORY LOCK - Release after processing
      activeNumbers.delete(lead.number);
    }
  }

  console.log(`[SHEET] ${sheetId} Cycle complete (sent: ${metrics.sentToday}/${DAILY_LIMIT})`);
}

async function runAllSheets(
  clients: Record<string, any>,
  sendSafeFunc: (sessionId: string, chatId: string, text: string) => Promise<boolean>
): Promise<void> {
  // All sheets use the single active session (first available client)
  const [activeSessionId, activeClient] = Object.entries(clients)[0] || [];
  if (!activeClient) {
    console.warn('[SHEET] No active client available, skipping poll cycle');
    return;
  }

  for (const config of SHEET_CONFIGS) {
    try {
      const wrappedSendSafe = (chatId: string, text: string) =>
        sendSafeFunc(activeSessionId, chatId, text);
      await processSheetOutreach(activeClient, config, wrappedSendSafe);
    } catch (err: any) {
      console.error(`[SHEET] ${config.sheetId} Polling error:`, err.message);
    }
  }
}

async function startAutoPolling(
  clients: Record<string, any>,
  sendSafeFunc: (sessionId: string, chatId: string, text: string) => Promise<boolean>
): Promise<void> {
  console.log('[ENGINE] Loop started');
  console.log('[SHEET] Engine started (2-minute polling)');

  // PRODUCTION LOOP - Replace setInterval with safe while loop
  while (true) {
    try {
      console.log('[ENGINE] Processing all sheets...');
      await runAllSheets(clients, sendSafeFunc);
    } catch (err: any) {
      console.error('[SHEET] Engine error:', err.message);
    }

    // Wait 2 minutes before next cycle
    await new Promise(res => setTimeout(res, POLL_INTERVAL));
  }
}

function getSheetMetrics(sheetId?: string): Record<string, any> {
  if (sheetId) {
    const metrics = sheetMetrics[sheetId];
    return metrics ? {
      sheetId,
      sentToday: metrics.sentToday,
      dailyLimit: DAILY_LIMIT,
      failedCount: metrics.failedLeads.length,
      lastReset: new Date(metrics.lastResetTime).toISOString()
    } : {};
  }

  const allMetrics: Record<string, any> = {};
  for (const [sheetId, metrics] of Object.entries(sheetMetrics)) {
    allMetrics[sheetId] = {
      sentToday: metrics.sentToday,
      dailyLimit: DAILY_LIMIT,
      failedCount: metrics.failedLeads.length,
      lastReset: new Date(metrics.lastResetTime).toISOString()
    };
  }
  return allMetrics;
}

export {
  SheetConfig,
  SheetLead,
  SheetMetrics,
  ColumnMapping,
  SHEET_CONFIGS,
  DAILY_LIMIT,
  POLL_INTERVAL,
  SEND_DELAY_MIN,
  SEND_DELAY_MAX,
  initSheetMetrics,
  checkAndResetDailyLimit,
  fetchLeadsFromSheet,
  updateLeadStatusInSheet,
  getMessageTemplate,
  processSheetOutreach,
  runAllSheets,
  startAutoPolling,
  getSheetMetrics,
  detectColumnMapping,
  validateRequiredColumns,
  autoDetectCategory
};
