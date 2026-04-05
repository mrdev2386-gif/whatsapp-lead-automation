import { Client } from '@open-wa/wa-automate';
import type { ChatId } from '@open-wa/wa-automate';
import * as fs from 'fs';
import * as path from 'path';
const axios = require('axios');
import {
  registerRowMapping,
  markLeadAsSent,
  markLeadAsFailed,
  SheetWriteConfig
} from './sheets-writeback';

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SHEET OUTBOUND DM ENGINE
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

const SHEET_CONFIGS: SheetConfig[] = [
  {
    sheetId: 'sheet1',
    sessionId: '9155604591',
    spreadsheetId: '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
    sheetName: 'Sheet1'
  },
  {
    sheetId: 'sheet2',
    sessionId: '9508310294',
    spreadsheetId: '10YUi0tNUpj4GqaCf2-ZWyJ9APiizb6JDrNry5dSzv20',
    sheetName: 'Sheet1'
  },
  {
    sheetId: 'sheet3',
    sessionId: '6299261088',
    spreadsheetId: '1stbRPi4uffSHCMzQEcMVxf5f5w47kDYSVYYkG6YX874',
    sheetName: 'Sheet1'
  }
];

const DAILY_LIMIT = 100;
const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes
const SEND_DELAY = 60 * 1000; // 60 seconds between sends

// Per-sheet metrics storage
const sheetMetrics: Record<string, SheetMetrics> = {};

// Initialize metrics for each sheet
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

// Reset daily counter if 24 hours have passed
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

// Fetch leads from Google Sheets CSV export
async function fetchLeadsFromSheet(config: SheetConfig): Promise<SheetLead[]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv`;
    const response = await axios.get(csvUrl, { timeout: 10000 });
    
    if (typeof response.data !== 'string') {
      console.error(`[SHEET] ${config.sheetId} Invalid response format`);
      return [];
    }

    const lines = response.data.split(/\r?\n/).filter((line: string) => line.trim());
    if (lines.length < 2) {
      console.log(`[SHEET] ${config.sheetId} No leads found`);
      return [];
    }

    const headers = lines[0].toLowerCase().split(',').map((h: string) => h.trim());
    const numberIdx = headers.indexOf('number');
    const nameIdx = headers.indexOf('name');
    const categoryIdx = headers.indexOf('category');
    const statusIdx = headers.indexOf('status');

    if (numberIdx === -1 || categoryIdx === -1 || statusIdx === -1) {
      console.error(`[SHEET] ${config.sheetId} Missing required columns`);
      return [];
    }

    const leads: SheetLead[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim());
      const status = values[statusIdx]?.toLowerCase() || 'pending';
      
      // ONLY process pending leads
      if (status !== 'pending') continue;

      const number = values[numberIdx]?.replace(/\D/g, '');
      const category = values[categoryIdx]?.toLowerCase();

      if (number && (category === 'clinic' || category === 'hotel')) {
        leads.push({
          rowIndex: i + 1, // Google Sheets row number (1-indexed)
          number,
          name: values[nameIdx] || 'Sir',
          category: category as 'clinic' | 'hotel',
          message: values[headers.indexOf('message')] || undefined,
          status: 'pending'
        });
      }
    }

    console.log(`[SHEET] ${config.sheetId} Fetched ${leads.length} pending leads`);
    return leads;
  } catch (err: any) {
    console.error(`[SHEET] ${config.sheetId} Fetch error:`, err.message);
    return [];
  }
}

// Update lead status in Google Sheets via API
async function updateLeadStatusInSheet(
  config: SheetConfig,
  lead: SheetLead,
  newStatus: 'sent' | 'failed',
  chatId: string
): Promise<boolean> {
  try {
    // Register row mapping for future updates
    registerRowMapping(chatId, config.sheetId, lead.rowIndex, lead.number);
    
    // Prepare write-back config
    const writeConfig: SheetWriteConfig = {
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY
    };

    // Only update if API key is configured
    if (!writeConfig.apiKey) {
      console.log(`[SHEET] ${config.sheetId} No API key - skipping write-back for ${lead.number}`);
      return true; // Don't fail, just skip
    }

    // Mark as sent or failed
    if (newStatus === 'sent') {
      return await markLeadAsSent(writeConfig, chatId);
    } else {
      return await markLeadAsFailed(writeConfig, chatId);
    }
  } catch (err: any) {
    console.error(`[SHEET] ${config.sheetId} Update error:`, err.message);
    return false;
  }
}

// Get message template based on category
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

// Main outbound engine - processes one sheet
async function processSheetOutreach(
  client: Client,
  config: SheetConfig,
  sendSafeFunc: (chatId: string, text: string) => Promise<boolean>
): Promise<void> {
  const sheetId = config.sheetId;
  initSheetMetrics(sheetId);
  checkAndResetDailyLimit(sheetId);

  const metrics = sheetMetrics[sheetId];

  // Check if daily limit reached
  if (metrics.sentToday >= DAILY_LIMIT) {
    console.log(`[SHEET] ${sheetId} Daily limit reached (${metrics.sentToday}/${DAILY_LIMIT})`);
    return;
  }

  // Fetch pending leads
  const leads = await fetchLeadsFromSheet(config);
  
  if (leads.length === 0) {
    console.log(`[SHEET] ${sheetId} No pending leads`);
    return;
  }

  console.log(`[SHEET] ${sheetId} Start processing ${leads.length} leads`);

  for (const lead of leads) {
    // Check daily limit before each send
    if (metrics.sentToday >= DAILY_LIMIT) {
      console.log(`[SHEET] ${sheetId} Limit reached (${metrics.sentToday}/${DAILY_LIMIT})`);
      break;
    }

    const chatId = `${lead.number}@c.us`;
    const message = lead.message || getMessageTemplate(lead.category, lead.name);

    try {
      console.log(`[SHEET] ${sheetId} Sending to ${lead.number}`);
      
      // Use sendSafe to ensure proper delivery tracking
      const success = await sendSafeFunc(chatId, message);

      if (success) {
        // Update sheet status to 'sent' (with write-back)
        const chatId = `${lead.number}@c.us`;
        const updated = await updateLeadStatusInSheet(config, lead, 'sent', chatId);
        if (updated) {
          metrics.sentToday += 1;
          console.log(`[SHEET] ${sheetId} Sent to ${lead.number} (${metrics.sentToday}/${DAILY_LIMIT})`);
        }
      } else {
        // Mark as failed in sheet
        const chatId = `${lead.number}@c.us`;
        await updateLeadStatusInSheet(config, lead, 'failed', chatId);
        metrics.failedLeads.push(lead);
        console.log(`[SHEET] ${sheetId} Failed to send to ${lead.number}`);
      }

      // Wait 60 seconds before next send
      await new Promise(res => setTimeout(res, SEND_DELAY));
    } catch (err: any) {
      console.error(`[SHEET] ${sheetId} Error sending to ${lead.number}:`, err.message);
      metrics.failedLeads.push(lead);
    }
  }

  console.log(`[SHEET] ${sheetId} Completed (sent: ${metrics.sentToday}/${DAILY_LIMIT})`);
}

// Auto-polling engine - runs every 2 minutes
async function startAutoPolling(
  clients: Record<string, Client>,
  sendSafeFunc: (sessionId: string, chatId: string, text: string) => Promise<boolean>
): Promise<void> {
  console.log('[SHEET] Auto-polling engine started (2-minute interval)');

  setInterval(async () => {
    for (const config of SHEET_CONFIGS) {
      const client = clients[config.sessionId];
      if (!client) {
        console.warn(`[SHEET] ${config.sheetId} Client not found for session ${config.sessionId}`);
        continue;
      }

      try {
        // Wrap sendSafeFunc to include sessionId
        const wrappedSendSafe = (chatId: string, text: string) =>
          sendSafeFunc(config.sessionId, chatId, text);

        await processSheetOutreach(client, config, wrappedSendSafe);
      } catch (err: any) {
        console.error(`[SHEET] ${config.sheetId} Polling error:`, err.message);
      }
    }
  }, POLL_INTERVAL);
}

// Get sheet metrics for monitoring
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

  // Return all metrics
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
  SHEET_CONFIGS,
  DAILY_LIMIT,
  POLL_INTERVAL,
  SEND_DELAY,
  initSheetMetrics,
  checkAndResetDailyLimit,
  fetchLeadsFromSheet,
  updateLeadStatusInSheet,
  getMessageTemplate,
  processSheetOutreach,
  startAutoPolling,
  getSheetMetrics
};
