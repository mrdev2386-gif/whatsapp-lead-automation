console.log("[BOOT] Script started");

// 🔥 GLOBAL DUPLICATE MESSAGE TRACKER
const lastMessageMap = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION RESILIENCE: Memory watchdog + crash handlers
// ─────────────────────────────────────────────────────────────────────────────
const MAX_MEMORY_MB = 450;
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[MEMORY] Used: ${used.toFixed(2)} MB`);
  if (used > MAX_MEMORY_MB) {
    console.error('❌ MEMORY LIMIT EXCEEDED. Restarting...');
    process.exit(1);
  }
}, 10000);

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
  process.exit(1);
});

import { create, Client, ev, Message, MessageTypes } from '@open-wa/wa-automate';
import type { ChatId } from '@open-wa/wa-automate';
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const getPort = require('get-port');
const { OpenAI } = require('openai');
import { Analytics } from './analytics';
import {
  SHEET_CONFIGS,
  processSheetOutreach,
  startAutoPolling,
  getSheetMetrics
} from './multi-sheet-engine';
import {
  registerOutboundLead,
  isOutboundLead,
  processOutboundReply,
  shouldPrioritizeOutboundReply
} from './outbound-integration';

console.log("[BOOT] Modules loaded successfully");

let globalClient: Client;
let server: any;
let analytics: Analytics;
const express = require('express');
const app = express();
app.use(express.json({ limit: '200mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// Priority: CLI Arg > Environment Variable > Default
const argSession = process.argv.find(arg => arg.startsWith('--session='));
const SESSION_ID = (argSession ? argSession.split('=')[1] : process.env.SESSION_ID) || "9155604591";

console.log(`[BOOT] Initializing session: ${SESSION_ID}`);

// Ensure isolation folder exists
const SESSION_DIR = path.join(process.cwd(), `wa-${SESSION_ID}`);
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

dotenv.config(); // Root .env (common keys like OPENAI_API_KEY)
// Also try to load from session-specific .env if it exists
const sessionEnv = path.join(SESSION_DIR, '.env');
if (fs.existsSync(sessionEnv)) {
  dotenv.config({ path: sessionEnv, override: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// PORT MAPPING
// ─────────────────────────────────────────────────────────────────────────────
function getPortForSession(sessionId: string): number {
  // Simple deterministic port mapping: last 4 digits of sessionId + offset 8000
  // If not a number, fallback to get-port random
  const numericId = parseInt(sessionId.replace(/\D/g, '').slice(-4));
  if (isNaN(numericId)) return 8080;
  return 8000 + (numericId % 1000);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY is missing from environment variables.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || "918073539824@c.us";
const SHEET_URL = process.env.SHEET_URL || '';
const SENT_LEADS_FILE = path.join(SESSION_DIR, 'sentLeads.json');
const LEADS_FILE = path.join(SESSION_DIR, 'leads.json');

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage =
  | 'new'
  | 'interested'
  | 'qualified'
  | 'asked_interest'    // internal
  | 'demo_sent'         // internal
  | 'negotiating'       // internal
  | 'confirm_start'     // internal
  | 'closing'           // internal (before conversion)
  | 'rejected'          // final
  | 'converted';        // final (converted lead)

type Category = 'hotel' | 'clinic' | 'website' | 'automation' | 'unknown';

interface UserState {
  stage: Stage;
  category: Category;
  lastInteraction: number;
  lastSentMsg: string;
  lastReplies: string[];
  currentFAQFlowId: string | null;
  currentFAQStep: number;
  humanEscalated: boolean;
  deepQuestionsCount: number;
  language: 'en' | 'hi' | 'unknown';
  score: number;
  followUpDay: number;
  lastLoggedStage: string;
  lastLoggedScore: number;
  priority: boolean;
  messagesCount: number;
  lastIntent: string;
  intentCount: number;
  status: 'ACTIVE' | 'DEAD';
  categoryDetectedFromHistory: boolean;
  shortReplyCount: number;
  followUpCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT STATE STORE
// ─────────────────────────────────────────────────────────────────────────────

const STATE_FILE = path.join(SESSION_DIR, 'state.json');
let userState: Record<string, UserState> = {};

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      userState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log(`[SESSION ${SESSION_ID}] State loaded (${Object.keys(userState).length} users)`);
    } catch (e) {
      console.error(`[SESSION ${SESSION_ID}] Failed to load state:`, e);
      userState = {};
    }
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(userState, null, 2), 'utf8');
  } catch (e) {
    console.error(`[SESSION ${SESSION_ID}] Failed to save state:`, e);
  }
}

function getUser(chatId: string): UserState {
  if (!userState[chatId]) {
    userState[chatId] = {
      stage: 'new',
      category: 'unknown',
      lastInteraction: Date.now(),
      lastSentMsg: '',
      lastReplies: [],
      currentFAQFlowId: null,
      currentFAQStep: 0,
      humanEscalated: false,
      deepQuestionsCount: 0,
      language: 'unknown',
      score: 0,
      followUpDay: 0,
      lastLoggedStage: '',
      lastLoggedScore: -1,
      priority: false,
      messagesCount: 0,
      lastIntent: '',
      intentCount: 0,
      status: 'ACTIVE',
      categoryDetectedFromHistory: false,
      shortReplyCount: 0,
      followUpCount: 0,
    };
  }
  userState[chatId].lastInteraction = Date.now();
  return userState[chatId];
}

loadState();

// ─────────────────────────────────────────────────────────────────────────────
// DELAY HELPER
// ─────────────────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

type Intent =
  | 'greeting'
  | 'confusion'
  | 'interest'
  | 'pricing'
  | 'rejection'
  | 'confirm'
  | 'demo_request'
  | 'category_hotel'
  | 'category_clinic'
  | 'unknown';

// Returns true if the message is predominantly English
function isEnglish(text: string): boolean {
  const t = text.toLowerCase();
  // Hinglish keywords that suggest it's NOT pure English
  const hinglishKeywords = /\b(haan|nhi|nahi|kya|kaise|batao|kardo|samjhao|hai|ho|rha|rahi|aur|kitna|paisa|acha|theek|samajh|ji|hi)\b/;
  if (hinglishKeywords.test(t)) return false;

  const ascii = (text.match(/[a-zA-Z]/g) || []).length;
  // If it's mostly Latin characters and no Hinglish keywords, fallback to Latin ratio
  return ascii / Math.max(text.length, 1) > 0.8;
}

function detectIntent(body: string): { intent: Intent; confidence: number } {
  const t = body.toLowerCase().trim();
  let intent: Intent = 'unknown';
  let conf = 0;

  if (/\b(hi|hello|hey|hii|helo|namaste)\b/.test(t)) { intent = 'greeting'; conf = 90; }
  else if (/(aapne msg|kaun|who are you|kya chahiye|kaise mila)/.test(t)) { intent = 'confusion'; conf = 85; }
  else if (/\b(hotel|booking|rooms?|resort|lodge)\b/.test(t)) { intent = 'category_hotel'; conf = 95; }
  else if (/\b(clinic|dentist|dental|doctor|patient|hospital)\b/.test(t)) { intent = 'category_clinic'; conf = 95; }
  else if (/\b(website|portfolio|e-commerce|web site|site)\b/.test(t)) { intent = 'interest'; conf = 95; }
  else if (/\b(automation|automate|bot|chatbot|workflow)\b/.test(t)) { intent = 'interest'; conf = 95; }
  else if (/(price|charge|cost|kitna|fees?|rate|paisa|rupee|\u20b9)/.test(t)) { intent = 'pricing'; conf = 90; }
  else if (/(^no$|nahi|nope|not interested|mat karo|band karo|stop)/.test(t)) { intent = 'rejection'; conf = 90; }
  else if (/(call|phone|baat karo|number do|contact karo)/.test(t)) { intent = 'confirm'; conf = 90; }
  else if (/\b(demo|show|example|sample|dikhao|dikha|dekhna)\b/.test(t)) { intent = 'demo_request'; conf = 90; }
  else if (/(details|info|batao|explain|samjhao|bataiye)/.test(t)) { intent = 'interest'; conf = 80; }
  else if (/(confirm|deal|agree|send|bhejo|proceed|ready|start)/.test(t)) { intent = 'confirm'; conf = 85; }
  else if (/(^yes$|haan|ha$|interested|zaroor|bilkul|sure|ok$|okay|theek hai)/.test(t)) { intent = 'interest'; conf = 70; }
  else if (/(hmm|om|oh|okay|theek|samajh nahi aaya|confused|confusion|samjha)/.test(t)) { intent = 'confusion'; conf = 85; }
  else if (/(later|baad me|next time|kal|after some time)/.test(t)) { intent = 'rejection'; conf = 80; }

  return { intent, confidence: conf };
}

function getDynamicPricing(chatId: string): string {
  const prefix = chatId.split('@')[0];
  if (prefix.startsWith('91') || prefix.startsWith('92')) {
    return "₹25,000 one-time plus ₹2,000/month";
  }
  if (prefix.startsWith('1') || prefix.startsWith('971')) {
    return "$800 one-time plus $200/month";
  }
  return "$700 one-time plus $200/month";
}

// ── Per-language message sets ──────────────────
const MSG_HI = {
  intro: `Namaste! Main Digilinex team se hu.\nHum businesses ko automate aur grow karne me help karte hain.\n\nKya main aapke business ke liye best system suggest karu?`,
  hotelInitial: `Agar aap direct bookings badhana chahte ho,\nto main aapke hotel ke liye custom booking system bana sakta hu.\n\nKya main idea explain karu?`,
  clinicInitial: `Agar aap patient inquiries badhana chahte ho,\nto main aapke clinic ke liye appointment system bana sakta hu.\n\nShall I explain how it works?`,
  websiteInitial: `Hum professional websites aur automation solutions banate hain.\nKya aap apne business ko online scale karna chahte hain?`,
  automationInitial: `Hum custom WhatsApp automation systems banate hain jo 24/7 leads close karte hain.\nKya main aapko demo dikhau?`,
  confirmCategory: `Just to confirm, aapka business kis category me hai? Hotel, Clinic, ya Website/Automation?`,
  explanation: `Ye system aapko direct customers laata hai.\nDemo check karein: https://anjali-booking-system--cryptosourav23.replit.app/`,
  microFollowUp: `Kya aapne hamara demo check kiya?`,
  lowInterest: `Kya aap aur details chahte hain ya directly setup shuru karein?`,
  fastClose: `Shall I set this up for you?`,
  trustBoost: `Ye system multiple businesses me successfully chal raha hai.`,
  closePush: `Kya aap setup start karna chahte ho?`,
  price: `Automation system ₹5,000 – ₹10,000 me ready ho jata hai.\n\nIsme WhatsApp auto-reply, lead handling aur setup sab included hota hai.\n\nKya main aapke liye setup start karu?`,
  followUp1: `Just checking.\nKya aap apne business ke liye custom system setup karna chahte ho?`,
  followUp2: `Agar aap abhi start karte ho, to hum aapko special setup offer de sakte hain.\nKya main aage badhu?`,
  followUp3: `Last call. Kya hum setup proceed karein? Warna main ye offer close kar raha hu.`,
  closed: `Theek hai!\nDigilinex team aapse details ke liye connect kar rahi hai.`,
  rejected: `Theek hai. Agar future me zarurat ho to batayein.`,
  fallback: `Samajh gaya 👍\n\nHum WhatsApp automation, website aur business systems setup karte hain.\n\nAapko kis type ka system chahiye?`,
  nonText: `Please wait, Digilinex team will contact you shortly.`,
};

const MSG_EN = {
  intro: `Hello! I am from the Digilinex team.\nWe help businesses automate and grow efficiently.\n\nShall I suggest the best system for your business?`,
  hotelInitial: `If you want to increase direct bookings,\nI can build a custom booking system for your hotel.\n\nWould you like me to explain the idea?`,
  clinicInitial: `If you want to increase patient inquiries,\nI can build a system for your clinic.\n\nShall I explain how it works?`,
  websiteInitial: `We build professional websites and automation solutions to scale your business.\nWould you like to see our portfolio?`,
  automationInitial: `We build custom WhatsApp automation systems that close leads 24/7.\nShall I share a quick demo?`,
  confirmCategory: `Just to confirm, are you a Hotel, Clinic, or looking for Website/Automation?`,
  explanation: `This system brings direct customers to you.\nDemo: https://anjali-booking-system--cryptosourav23.replit.app/`,
  microFollowUp: `Did you get a chance to check the demo?`,
  lowInterest: `Do you want me to explain more or proceed with setup?`,
  fastClose: `Should I set this up for you?`,
  trustBoost: `This system is already working for multiple businesses.`,
  closePush: `Would you like to start the setup?`,
  price: `Automation system starts from $5,000 to $10,000.\n\nThis includes WhatsApp auto-reply, lead handling and complete setup.\n\nShall I start your setup?`,
  followUp1: `Just checking.\nDo you want to setup a direct booking system for your business?`,
  followUp2: `If you start now, I can give you a special setup offer.\nShall I build it for you?`,
  followUp3: `Last checking call. Shall we proceed? Otherwise, I will close this setup offer.`,
  closed: `Understood!\nThe Digilinex team is connecting with you.`,
  rejected: `Understood. Feel free to reach out whenever you need help.`,
  fallback: `Got it 👍\n\nWe build WhatsApp automation, websites and business systems.\n\nWhat type of system do you need?`,
  nonText: `Please wait, Digilinex team will contact you shortly.`,
};

const HOTEL_BULK_VARS = [
  "Hi {name},\n\nI noticed your hotel online.\n\nI can help increase your direct bookings with a custom system.\n\nCan I share a quick demo?",
  "Hello {name},\n\nI saw your hotel and thought I could help you get more direct guests.\n\nWe build custom booking systems that work.\n\nWould you like to see a demo?",
  "Hi {name},\n\nAre you looking to increase direct bookings for your hotel?\n\nI can build a personalized system for you.\n\nShall I explain the idea?",
];

const CLINIC_BULK_VARS = [
  "Hi {name},\n\nI came across your clinic.\n\nI can help increase patient inquiries with a custom system.\n\nWould you like to see a demo?",
  "Hello {name},\n\nI saw your clinic online and noticed you might need help with patient bookings.\n\nWe create patient acquisition systems.\n\nCan I show you how it works?",
  "Hi {name},\n\nDo you want more patient inquiries for your clinic?\n\nI can set up a custom system for you.\n\nShall I share a quick demo?",
];

// Pick the right message set based on the user's language
function M(body: string): typeof MSG_EN {
  return isEnglish(body) ? MSG_EN : MSG_HI;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM — LEAD CAPTURE
// ─────────────────────────────────────────────────────────────────────────────

async function markLeadAsHot(client: Client, chatId: string, score: number) {
  const sid = `[SESSION ${SESSION_ID}]`;
  await client.sendText(ADMIN_NUMBER as ChatId,
    `${sid} 🔥 HOT LEAD ALERT:\n` +
    "Number: " + chatId + "\n" +
    "Score: " + score + "\n" +
    "Link: https://wa.me/" + chatId.split('@')[0]
  );
  console.log(`${sid} [ALERT] Hot lead alert sent for ${chatId}`);
}

interface Lead {
  phone: string;
  name: string;
  message: string;
  stage: string;
  lastMessageTime: string;
}

function saveLead(chatId: string, body: string, user: UserState, name: string = ''): void {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // Requirement: ignore if phone number is missing or invalid
  if (!chatId || !chatId.endsWith('@c.us')) {
    return;
  }

  // Requirement: ignore duplicate messages from same number
  if (user.lastSentMsg === body) {
    console.log(`${sid} [CRM] Duplicate message ignored for ${chatId}`);
    return;
  }

  const phone = chatId.split('@')[0];
  const lastMessageTime = new Date().toISOString();

  try {
    let leads: Lead[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, 'utf8').trim();
      leads = raw ? JSON.parse(raw) : [];
    }

    // Requirement: Lead Deduplication (Phone as unique ID)
    const existingIndex = leads.findIndex(l => l.phone === phone);
    const newLead: Lead = {
      phone,
      name: name || "User",
      message: body,
      stage: user.stage,
      lastMessageTime
    };

    if (existingIndex > -1) {
      // Update existing lead
      leads[existingIndex] = { ...leads[existingIndex], ...newLead };
      // console.log(`${sid} [CRM] Lead updated: ${phone}`);
    } else {
      // Create new lead
      leads.push(newLead);
      console.log(`${sid} [CRM] Lead saved: ${phone}`);
    }

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  } catch (err: any) {
    console.error(`${sid} [CRM] Failed to write lead:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

// Tracks active follow-up timers per user so we never double-schedule
const followUpTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function scheduleFollowUp(
  client: Client,
  chatId: string,
  user: UserState
): void {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // Cancel any existing timer for this user first
  if (followUpTimers[chatId]) {
    clearTimeout(followUpTimers[chatId]);
    delete followUpTimers[chatId];
  }

  // Requirement: Cancel followup if user replies (handled by the caller of this function)
  // Requirement: Ensure no duplicate followups (handled by clearing existing timer)
  
  if (user.stage === 'converted' || user.status === 'DEAD' || user.humanEscalated) return;

  const msgSet = user.language === 'en' ? MSG_EN : MSG_HI;

  // Requirement: Scheduled followups (5 minutes, 1 hour, 24 hours)
  let delayMs = 0;
  if (user.followUpCount === 0) delayMs = 5 * 60 * 1000;      // 5 mins
  else if (user.followUpCount === 1) delayMs = 60 * 60 * 1000;   // 1 hour
  else if (user.followUpCount === 2) delayMs = 24 * 60 * 60 * 1000; // 24 hours
  else return; // Max 3 followups

  followUpTimers[chatId] = setTimeout(async () => {
    // Re-check state before sending
    if (userState[chatId]?.status === 'ACTIVE' && 
        userState[chatId]?.stage !== 'converted' && 
        !userState[chatId]?.humanEscalated) {
      try {
        user.followUpCount += 1;
        
        let followMsg = "";
        if (user.followUpCount === 1) followMsg = msgSet.followUp1;
        else if (user.followUpCount === 2) followMsg = msgSet.followUp2;
        else if (user.followUpCount === 3) followMsg = msgSet.followUp3;

        if (followMsg) {
          await client.sendText(chatId as ChatId, followMsg);
          console.log(`${sid} [FOLLOWUP] Scheduled followup sent to ${chatId} (count=${user.followUpCount})`);
          saveState(); // Save updated followUpCount
          
          // Schedule next one if applicable
          if (user.followUpCount < 3) {
            scheduleFollowUp(client, chatId, user);
          }
        }
      } catch (err: any) {
        console.error(`${sid} [FOLLOWUP] Failed for ${chatId}:`, err.message);
      }
    }
  }, delayMs);

  // console.log(`${sid} [FOLLOWUP] Scheduled in ${delayMs / 1000 / 60}m for ${chatId}`);
  console.log(`${sid} [FOLLOWUP] Followup scheduled for ${chatId} in ${Math.round(delayMs / 1000 / 60)} minutes`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK SENDER ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function getSentLeads(): string[] {
  if (fs.existsSync(SENT_LEADS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SENT_LEADS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveSentLead(number: string) {
  const leads = getSentLeads();
  leads.push(number);
  fs.writeFileSync(SENT_LEADS_FILE, JSON.stringify(leads, null, 2));
}


async function runBulkOutreach(client: Client) {
  console.log('[BULK] Starting outreach...');
  
  // STEP 5: SELF CHAT SHEET CONTROL
  let targetUrl = SHEET_URL;
  try {
    const hostNum = await client.getHostNumber();
    const selfId = `${hostNum}@c.us`;
    const messages = await client.loadAndGetAllMessagesInChat(selfId as any, true, false);
    const lastMsg = messages[messages.length - 1]?.body || '';
    if (lastMsg.startsWith('http')) {
      targetUrl = lastMsg.trim();
      console.log(`[BULK] Using dynamic URL from self-chat: ${targetUrl}`);
    }
  } catch (e) {}

  if (!targetUrl) {
    console.error('[BULK] No SHEET_URL found.');
    return;
  }

  const response = await axios.get(targetUrl).catch(() => ({ data: '' }));
  let leads: any[] = [];
  
  if (typeof response.data === 'string') {
    // Parser for CSV from /export?format=csv
    const lines = response.data.split(/\r?\n/).filter((line: string) => line.trim());
    if (lines.length > 1) {
      const headers = lines[0].toLowerCase().split(',').map((h: string) => h.trim());
      leads = lines.slice(1).map((line: string) => {
        const values = line.split(',').map((v: string) => v.trim());
        const lead: any = {};
        headers.forEach((h: string, i: number) => {
          if (h && values[i]) lead[h] = values[i];
        });
        return lead;
      });
    }
  } else if (Array.isArray(response.data)) {
    leads = response.data;
  }

  const sent = getSentLeads();
  let count = 0;
  let rotationCounter = 0;

  for (const lead of leads) {
    const num = String(lead.number).replace(/\D/g, '');
    const chatId = `${num}@c.us`;

    // STEP 4: STRICT DUPLICATE CHECK
    if (sent.includes(chatId)) {
      console.log(`[BULK] Skip ${chatId} (Already in sentLeads.json)`);
      continue;
    }

    const { category, name } = lead;
    
    // STEP 3: CLEAN PERSONALIZATION
    const cleanName = (name && name.length > 2) ? name : "Sir";
    
    // STEP 2: MESSAGE ROTATION
    const variants = category === 'hotel' ? HOTEL_BULK_VARS : CLINIC_BULK_VARS;
    const variationIndex = Math.floor(rotationCounter / 5) % variants.length;
    const template = variants[variationIndex];
    const body = template.replace('{name}', cleanName);

    try {
      // STEP 6: LOGGING BEFORE SEND
      console.log(`[BULK] Sending → ${chatId} | ${cleanName} | ${category}`);
      
      await client.sendText(chatId as ChatId, body);
      
      // STEP 1.6: INITIALIZE USER STATE
      const user = getUser(chatId);
      user.category = (category === 'hotel' ? 'hotel' : 'clinic');
      user.stage = 'asked_interest';
      
      saveSentLead(chatId);
      count++;
      rotationCounter++;
      
      // STEP 6: LOGGING AFTER SEND
      console.log(`[BULK] SENT → ${chatId}`);
      
      // STEP 1.4: 60 SECOND DELAY
      console.log(`[BULK] OK. Waiting exactly 60s...`);
      await delay(60000);
    } catch (err: any) {
      console.error(`[BULK] Failed for ${chatId}:`, err.message);
    }
  }
  
  await client.sendText(ADMIN_NUMBER as ChatId, `Bulk outreach finished. Sent ${count} messages.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE HANDLER & FAQ SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

type FaqCluster = {
  id: string;
  keywords: string[];
  flowEn: string[];
  flowHi: string[];
};

const WA_FAQ_CLUSTERS: FaqCluster[] = [
  {
    id: "services",
    keywords: ["what services", "kya service", "what do you do", "kya banate", "kya kaam", "website banate", "lead generation"],
    flowEn: [
      "We help businesses grow by implementing fully automated customer acquisition systems.",
      "This includes custom website development, targeted SEO, and AI driven WhatsApp sales agents.",
      "The system is designed to generate leads and convert them 24/7 without your manual intervention.",
      "We analyze your industry and competitors first.",
      "Then we create a tailored roadmap that guarantees maximum conversion.",
      "Once deployed, the AI will handle initial inquiries and book appointments automatically.",
      "Would you like to see a demo of how this works?",
      "Shall we discuss how we can implement this for your business?"
    ],
    flowHi: [
      "Hum businesses ki growth ke liye fully automated customer acquisition systems banate hain.",
      "Isme custom website development, targeted SEO, aur AI WhatsApp sales agents shamil hain.",
      "Ye system din raat leads generate aur convert karne ke liye design kiya gaya hai, bina aapki mehnat ke.",
      "Hum pehle aapki industry aur competitors ko analyze karte hain.",
      "Phir ek tailored roadmap banate hain jo maximum conversion guarantee karta hai.",
      "Setup ke baad, AI apne aap messages reply karega aur appointments book karega.",
      "Kya aap iska demo dekhna chahte hain?",
      "Kya hum discuss karein aapke business me ise kaise setup karna hai?"
    ]
  },
  {
    id: "pricing",
    keywords: ["charge", "price", "cost", "kitna paisa", "fees", "rate", "rupee", "kitna loge", "package", "kitna charge"],
    flowEn: [
      "Our package starts from 5,000 to 10,000 rupees depending on the required customized features.",
      "This is a one-time setup cost for the complete system including website, SEO, and lead generation.",
      "We avoid monthly retainers for the base setup to keep it cost-effective for you.",
      "The return on investment is usually seen within the first 30 days.",
      "If you act now, we are offering a 20 percent early bird discount on the complete package.",
      "This is an investment, not an expense, as it naturally brings more paying clients.",
      "Would you like to review our detailed pricing structure?",
      "Shall we lock in the discounted price and proceed?"
    ],
    flowHi: [
      "Hamara package requirements ke hisaab se 5,000 se 10,000 rupees se start hota hai.",
      "Ye complete system ka one-time setup cost hai jisme website, SEO aur lead generation shamil hai.",
      "Hum base setup ke liye monthly charges nahi lete taaki ye aapke liye sasta rahe.",
      "Iska return on investment aam taur par pehle 30 din me hi dikhne lagta hai.",
      "Agar aap abhi start karte hain, to complete package pe 20 percent discount chal raha hai.",
      "Ye ek investment hai, kharcha nahi, kyunki ye directly aapko paying clients lake dega.",
      "Kya aap detailed pricing structure dekhna chahte hain?",
      "Kya hum ye discounted price lock karke aage badhein?"
    ]
  },
  {
    id: "delivery",
    keywords: ["time", "kitne din", "how many days", "delivery", "kab doge", "how long", "duration"],
    flowEn: [
      "We deliver the completely functional setup within 2 to 5 days of starting.",
      "Day 1 is focused on analyzing your business and gathering requirements.",
      "Days 2 and 3 involve continuous development and integration of the AI agent.",
      "On Day 4, we perform internal testing to ensure the bot handles inquiries perfectly.",
      "By Day 5, we launch the system and start routing actual traffic.",
      "We will also guide you on how to monitor your new dashboard.",
      "Can we start the requirements gathering step today?",
      "Shall we initiate the 5 day setup sprint?"
    ],
    flowHi: [
      "Hum 2 se 5 din ke andar poori tarah function karta hua setup deliver kar dete hain.",
      "Pehla din aapki requirements samajhne aur analysis me jata hai.",
      "Doosre aur teesre din hum development aur AI agent integration karte hain.",
      "Chauthe din internal testing hoti hai taaki bot perfectly inquiries handle kare.",
      "Panchwe din tak hum system launch karke actual traffic route karna shuru kar dete hain.",
      "Hum aapko dashboard use karna bhi sikhayenge.",
      "Kya hum aaj requirements final karke shuru karein?",
      "Kya hum 5 day setup shuru kardein?"
    ]
  },
  {
    id: "trust",
    keywords: ["proof", "dikhao", "trust", "scam", "fake", "viswas", "demo", "sample", "portfolio", "past work", "guarantee"],
    flowEn: [
      "We understand the need for trust before investing in digital tools.",
      "We have deployed successful systems for over 50 clients globally.",
      "Our systems are optimized strictly for clear outcomes like booked appointments or product sales.",
      "If the system does not function as intended, we completely revise the setup.",
      "You can review our live case studies showcasing up to 40 percent growth in client bookings.",
      "We also provide continuous daily lifetime support to solve any edge cases immediately.",
      "Would you like to examine a live functional demo right now?",
      "Shall we proceed so you can see the results firsthand?"
    ],
    flowHi: [
      "Hum samajhte hain ki digital tools me invest karne se pehle trust zaroori hai.",
      "Humne globally 50 se zyada clients ke liye successful systems laye hain.",
      "Hamare systems clearly booked appointments aur sales badhane ke liye optimized hain.",
      "Agar system discuss kiye gaye parameters pe kaam nahi karta, toh hum usko theek karte hain.",
      "Aap hamare live case studies dekh sakte hain jisme clients ki 40 percent growth hui hai.",
      "Hum life-time support dete hain kisi bhi issue ko turant solve karne ke liye.",
      "Kya aap abhi ek live functional demo check karna chahte hain?",
      "Kya hum proceeding karein taaki aap practically results dekh sakein?"
    ]
  },
  {
    id: "international",
    keywords: ["international", "global", "foreign", "bahar", "us", "uk", "other country", "out of india"],
    flowEn: [
      "Yes, we collaborate seamlessly with clients spanning across the globe.",
      "Our digital assets are universally hosted on high tier swift cloud servers globally.",
      "Distance does not affect our rapid delivery, support quality, or effective communication.",
      "We accommodate diverse global time zones and schedule detailed updates accordingly.",
      "International transactions are easily streamlined securely via specialized channels.",
      "The localized language parameters of your AI assistant can be configured entirely dynamically.",
      "Would you like to see a demo targeted at an international market?",
      "Shall we officially start setting up your specific international project?"
    ],
    flowHi: [
      "Haan, hum globally bohot se clients ke saath seamless tareeke se kaam karte hain.",
      "Hamare digital setups directly high tier global cloud servers par host hote hain.",
      "Distance se hamari delivery speed, support, ya communication quality pe koi asar nahi padta.",
      "Hum aapke time zone ke hisaab se meetings aur updates adjust karlete hain.",
      "International transactions specialized channels ke through easily aur securely ho jati hain.",
      "Aapke AI assistant ka language module aapke localized market ke hisaab se setup ho jata hai.",
      "Kya aap international market ka demo clear dekhna chahenge?",
      "Kya hum aapka international project exactly set up karna shuru kardein?"
    ]
  },
  {
    id: "roi_results",
    keywords: ["roi", "fayda", "profit", "benefit", "growth", "results"],
    flowEn: [
      "Our system heavily targets clear metrics: converting visitors directly into highly qualified leads.",
      "With an immediate 24/7 AI response, cold visitors are swiftly guided into warm commitments.",
      "Clients typically witness their specific conversion rates double within the inaugural 30 days.",
      "You will effectively save hundreds of hours previously spent addressing repetitive baseline questions.",
      "The analytics dashboard transparently tracks every single lead efficiently.",
      "We iteratively refine the intelligent flows purely based on real user actions to maximize results.",
      "Would you logically like to observe how the AI directly closes realistic leads?",
      "Shall we deploy this setup definitively to maximize your immediate ROI?"
    ],
    flowHi: [
      "Hamara system exactly is pe focus karta hai: visitors ko quickly qualified leads me convert karna.",
      "24/7 AI immediate response se cold traffic sidha warm leads me change hota hai.",
      "Zyadatar clients ki conversion rates practically 30 din me hi double ho jati hain.",
      "Aapke hazaro ghante bachenge jo pehle repetitive sawaal ka jawab dene me jate the.",
      "Analytics dashboard efficiently har ek lead ko transparently track karta hai.",
      "Hum real data check karke messages ko consistently theek karte hain taaki zyada sales aaye.",
      "Kya aap practically dekhna chahenge ki AI leads ko directly kaise close karta hai?",
      "Kya hum ye setup deploy kardein taaki aapka practically ROI maximize ho sake?"
    ]
  },
  {
    id: "objection_expensive",
    keywords: ["too expensive", "mehanga", "not cheap", "high price", "budget"],
    flowEn: [
      "I understand it might appear like a significant investment purely upfront.",
      "However, actively consider the sheer cost of realistically losing daily potential customers.",
      "This system fundamentally acts as your 24/7 distinct digital salesman precisely operating endlessly.",
      "A single closed customer directly acquired organically through our advanced system often recovers the cost.",
      "We can structure the package selectively into manageable focused modules to fit your required budget.",
      "Quality custom architecture undeniably provides higher long term value than rigid generic templates.",
      "Would you thoughtfully like to inspect our specific modular pricing setup?",
      "Shall we safely start with the essential basic module exactly within your required budget?"
    ],
    flowHi: [
      "Main bilkul samajh sakta hu ki upfront thoda mehanga lag sakta hai.",
      "Par aap dhyan dijiye un customers ke nuksaan par jo aap daily online miss kar rahe hain.",
      "Ye system aapke business ke liye naturally 24/7 digital salesman ki tarah practically kaam karta hai.",
      "Is system se aaya ek accha customer smoothly aapki saari cost asani se recover karsakta hai.",
      "Hum package ko modules me divide karsakte hain jo realistically aapke practically budget me fit baithe.",
      "Premium quality aur fully custom tools aapko generic templates se safely bohot better return dete hain.",
      "Kya aap purely hamare modular options dekhna practically pasand karenge?",
      "Kya hum directly basic module ke saath specifically start kardein?"
    ]
  },
  {
    id: "tech_details",
    keywords: ["tech", "how built", "technology", "backend", "code", "architecture"],
    flowEn: [
      "The architecture firmly utilizes robust efficient frameworks securely optimized strictly for ultimate speed.",
      "We deploy modern React/Next.js explicitly for highly scalable SEO driven interactive frontend portals.",
      "The intelligent AI bot dynamically integrates straight through direct secure automated WhatsApp APIs.",
      "Data routing securely relies on highly managed functional cloud services to prevent standard crashes.",
      "Webhooks effortlessly sync real time conversational data clearly to your personalized external CRM.",
      "Custom analytics constantly record deep conversational pathways effectively to fine tune direct answers.",
      "Would you practically like a comprehensive technical blueprint completely mapped out?",
      "Shall we actively connect over a quick tech focused call straight away?"
    ],
    flowHi: [
      "Hamara architecture specifically robust frameworks use karta hai jo seriously speed ke liye optimized hain.",
      "Hum highly fast aur deeply SEO friendly sites naturally banate hain modern React aur Next.js se.",
      "Ye naturally smart AI bot purely authentic official WhatsApp APIs ke effectively through integrate hota hai.",
      "Sara internal data cloud server pe perfectly manage hota hai taaki specifically koyi crash practically na ho.",
      "Webhooks easily live messages directly aapke clearly internal CRM me automatically bhejdete hain.",
      "Analytics clear details track karte hain taaki automatically system specifically khud seekh sake.",
      "Kya aapko ek purely technical blueprint asani se detail me chahiye?",
      "Kya hum specifically ek dedicated practically technical call arrange kardein?"
    ]
  },
  {
    id: "human_contact",
    keywords: ["team", "baat karo", "owner", "boss", "real person", "insan", "human", "contact"],
    flowEn: [
      "Our specialized Digilinex support team is always ready to assist you personally.",
      "Most basic setup questions are covered by this intelligent assistant immediately.",
      "However, for very specific customizations or deep technical audits, a specialist is better.",
      "I have recorded your request, and a human account manager will review the transcript.",
      "They typically reach out within 1 to 2 hours during standard business times.",
      "Would you like to provide your preferred contact time?",
      "Shall we hold your details and have our senior architect call you?"
    ],
    flowHi: [
      "Hamari specialized Digilinex team hamesha aapki personal madad ke liye ready hai.",
      "Zyadatar basic sawaalon ke jawab ye intelligent assistant turant dedeta hai.",
      "Par specific customization ya technical audit ke liye, senior team se baat karna sahi rehta hai.",
      "Maine aapki details note karli hain, team pur conversation review karegi.",
      "Team aam taur par 1-2 ghante me direct contact kar leti hai.",
      "Kya aap apna preferred call time batana chahenge?",
      "Kya hum details save karke aapke liye ek senior executive ki call arrange kardein?"
    ]
  },
  {
    id: "competitors",
    keywords: ["why you", "difference", "other company", "competitor", "better than", "muqabla", "doosre", "kyon"],
    flowEn: [
      "We differentiate ourselves by focusing purely on high conversion AI logic rather than generic web templates.",
      "Most agencies stop at building a website, but we integrate active 24/7 lead capture agents.",
      "Our systems are built on proprietary flows refined through thousands of real world interactions.",
      "We provide lifetime support and daily optimization which most freelancers simply cannot offer.",
      "The speed and accuracy of our AI lead qualification are benchmarks in the industry.",
      "We also offer transparent analytics so you can see exactly which sources bring the best leads.",
      "Would you like to see a direct comparison of our features versus standard setups?",
      "Shall we show you why 50 plus businesses chose us over traditional agencies?"
    ],
    flowHi: [
      "Hum generic templates ke bajaye high conversion AI logic par focus karte hain jo humein alag banata hai.",
      "Zyadatar log sirf website banakar chhod dete hain, par hum active 24/7 lead capture agents dete hain.",
      "Hamare systems hazaro real world interactions se seekhe huye proprietary flows par base hain.",
      "Hum lifetime support aur daily optimization dete hain jo aam taur par freelancers nahi de paate.",
      "Hamari AI qualification ki speed aur accuracy industry me sabse best mani jati hai.",
      "Hum transparent analytics bhi dete hain taaki aap dekh sakein ki leads kahan se aa rahi hain.",
      "Kya aap hamare features ka standard setups ke saath direct comparison dekhna chahenge?",
      "Kya hum aapko dikhayein ki 50 plus businesses ne humein baaki agencies ke upar kyon chuna?"
    ]
  }
];

function matchFaqCluster(body: string): FaqCluster | null {
  const text = body.toLowerCase();
  let bestMatch: FaqCluster | null = null;
  let highestScore = 0;

  for (const cluster of WA_FAQ_CLUSTERS) {
    let score = 0;
    for (const kw of cluster.keywords) {
      if (text.includes(kw)) {
        score += kw.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = cluster;
    }
  }

  return highestScore > 2 ? bestMatch : null;
}

// Send text, tracking last replies. If text is a duplicate, generate alternate wording.
async function sendSafe(
  client: Client,
  chatId: string,
  user: UserState,
  text: string
): Promise<void> {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // STEP 1: STRICT NO REPEAT SYSTEM
  if (user.lastReplies.includes(text)) {
    const fallback = "Please wait, Digilinex team will contact you shortly.";
    if (user.lastSentMsg !== fallback) {
       await client.sendText(chatId as ChatId, fallback);
       user.lastSentMsg = fallback;
       analytics.trackMessageSent(chatId);
    }
    user.humanEscalated = true;
    return;
  }

  // Requirement: Anti-Spam / Anti-Ban delay (3-10 seconds random)
  const waitTime = Math.floor(Math.random() * (10000 - 3000 + 1) + 3000);
  // console.log(`${sid} [DELAY] Waiting ${waitTime/1000}s before sending to ${chatId}`);
  await delay(waitTime);

  try {
    await client.sendText(chatId as ChatId, text);
    console.log(`${sid} [REPLY] Sent to ${chatId}`);
    analytics.trackMessageSent(chatId);
    analytics.trackMessageDelivered(chatId);
  } catch (err: any) {
    console.error(`${sid} [REPLY] Failed to send:`, err.message);
    analytics.trackMessageFailed(chatId, text);
  }

  user.lastSentMsg = text;
  user.lastReplies.push(text);
  if (user.lastReplies.length > 5) {
    user.lastReplies.shift();
  }
  saveState();
}

// Wrapper for outbound tracking
async function sendSafeOutbound(
  client: Client,
  chatId: string,
  user: UserState,
  text: string,
  sheetId: string,
  category: 'clinic' | 'hotel'
): Promise<void> {
  registerOutboundLead(chatId, SESSION_ID, sheetId, category);
  await sendSafe(client, chatId, user, text);
}

async function askGpt(body: string, history: string[] = [], chatId: string): Promise<string> {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // 🔥 FIX GPT ERROR: TEMP DISABLE IF INVALID
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('sk-proj-')) {
    console.warn('[GPT] Disabled - invalid or test key detected');
    return 'Please wait, Digilinex team will contact you shortly.';
  }
  
  try {
    const pricing = getDynamicPricing(chatId);
    const isDetail = body.toLowerCase().includes('how it works') || body.toLowerCase().includes('kaise kaam karta hai');
    const safeHistory = history || [];

    // 🔥 ELITE SALES CLOSER SYSTEM PROMPT
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an elite WhatsApp sales closer for Digilinex Automation.

Your ONLY goal is to convert leads into paying customers.

RULES:
* Keep replies short (1-3 lines max)
* Be confident, not robotic
* Always push conversation forward
* Never say "we will contact you"
* Always try to close the deal

SALES STRATEGY:
1. If user asks price → give range + push to confirm
2. If user shows interest → move to closing
3. If user hesitates → create urgency
4. If user says yes → immediately confirm & lock

STYLE:
* Hinglish (natural human tone)
* Friendly but slightly authoritative
* No long paragraphs

CLOSING BEHAVIOR:
* Always end with a question that pushes decision
* Example: "Should I set this up for you?"

PRICING RULE:
* Always say: ${pricing}

URGENCY:
* Limited slots
* Setup takes time
* First come first serve

DO NOT:
* Give long explanations
* Act like support agent
* Delay closing

You are a DEAL CLOSER, not a chatbot.`
        },
        ...safeHistory.map(txt => ({ role: "assistant" as const, content: txt })),
        { role: "user", content: body }
      ],
      max_tokens: isDetail ? 400 : 80,
      temperature: 0.5
    });

    let reply = response.choices[0].message.content || "";
    return reply;
  } catch (err: any) {
    console.error(`${sid} [GPT] Error:`, err.message);
    return "Please wait, Digilinex team will contact you shortly.";
  }
}

async function handleFAQOrFallback(
  client: Client,
  chatId: string,
  user: UserState,
  body: string,
  fallbackAction: () => Promise<void>
) {
  if (user.humanEscalated) return;

  const clusterMatch = matchFaqCluster(body);
  user.deepQuestionsCount += 1;

  // STEP 6: HUMAN ESCALATION Threshold from 15 to 8
  if (user.deepQuestionsCount > 8) {
    user.humanEscalated = true;
    await client.sendText(chatId as ChatId, "Please wait, Digilinex team will contact you shortly.");
    return;
  }

  // STEP 3 & STEP 8: INTELLIGENT GPT FALLBACK
  if (!clusterMatch && !user.currentFAQFlowId) {
    const gptReply = await askGpt(body, user.lastReplies, chatId);
    if (gptReply.toLowerCase().includes('digilinex team')) {
      user.humanEscalated = true;
      await client.sendText(chatId as ChatId, "Please wait, Digilinex team will contact you shortly.");
    } else {
      await sendSafe(client, chatId, user, gptReply);
    }
    return;
  }

  let activeCluster: FaqCluster | null = null;

  if (clusterMatch) {
    if (user.currentFAQFlowId !== clusterMatch.id) {
      user.currentFAQFlowId = clusterMatch.id;
      user.currentFAQStep = 0;
    }
    activeCluster = clusterMatch;
  } else if (user.currentFAQFlowId) {
    activeCluster = WA_FAQ_CLUSTERS.find(c => c.id === user.currentFAQFlowId) || null;
  }

  if (activeCluster) {
    const isEn = isEnglish(body);
    user.language = isEn ? 'en' : 'hi';
    const flow = isEn ? activeCluster.flowEn : activeCluster.flowHi;

    if (user.currentFAQStep >= flow.length) {
      user.currentFAQFlowId = null;
      await fallbackAction();
      return;
    }

    let reply = flow[user.currentFAQStep];
    user.currentFAQStep += 1;

    // STEP 5: AGGRESSIVE SALES CTA
    if (user.currentFAQStep === flow.length) {
      if (user.stage === 'new' || user.stage === 'asked_interest') {
        reply += isEn
          ? "\n\nShall I start your setup today?"
          : "\n\nKya main aaj hi aapka setup start karu?";
      } else if (user.stage === 'interested') {
        reply += isEn
          ? "\n\nShall I start your setup today?"
          : "\n\nKya main aaj hi aapka setup start karu?";
      } else if (user.stage === 'demo_sent' || user.stage === 'negotiating') {
        reply += isEn
          ? "\n\nShall I start your setup today?"
          : "\n\nKya main aaj hi aapka setup start karu?";
      }
      user.currentFAQFlowId = null;
    }

    await sendSafe(client, chatId, user, reply);
  } else {
    user.currentFAQFlowId = null;
    const gptReply = await askGpt(body, user.lastReplies, chatId);
    if (gptReply.toLowerCase().includes('digilinex team')) {
      user.humanEscalated = true;
      await client.sendText(chatId as ChatId, "Please wait, Digilinex team will contact you shortly.");
    } else {
      await sendSafe(client, chatId, user, gptReply);
    }
  }
}

async function handleMessage(client: Client, message: Message): Promise<void> {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // 🔥 CRITICAL: STOP SELF MESSAGE LOOP
  if (message.fromMe) return;
  
  // 🔥 IGNORE SYSTEM MESSAGES
  if (!message.body) return;
  if (message.body.includes('System Ready') || message.body.includes('STABLE READY') || message.body.includes('Client ready')) {
    console.log('[SKIP SYSTEM MESSAGE]');
    return;
  }
  
  const chatId = message.from;
  const body = (message.body || '').trim();
  
  // 🔥 STOP DUPLICATE MESSAGES
  const lastMsg = lastMessageMap.get(chatId);
  if (lastMsg === body) {
    console.log(`[SKIP DUPLICATE] ${chatId}: "${body}"`);
    return;
  }
  lastMessageMap.set(chatId, body);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PRIORITY: Handle outbound campaign replies BEFORE regular bot logic
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldPrioritizeOutboundReply(chatId)) {
    const user = getUser(chatId);
    const outboundReply = processOutboundReply(chatId, body);
    if (outboundReply) {
      console.log(`${sid} [OUTBOUND] Handling reply from ${chatId}`);
      await sendSafe(client, chatId, user, outboundReply);
      saveState();
      return; // Exit early - don't process with regular bot logic
    }
  }
  
  const name = message.sender?.pushname || message.sender?.name || "";
  const user = getUser(chatId);
  const { intent, confidence } = detectIntent(body);
  const msg = M(body);
  const currentIntent = intent as Intent;

  const stageBeforeReply = user.stage;
  user.messagesCount += 1;
  user.lastInteraction = Date.now();
  user.followUpCount = 0;
  
  saveLead(chatId, body, user, name);

  // 🔥 IMPROVE PRICE RESPONSE
  if (body.toLowerCase().includes('price') || body.toLowerCase().includes('cost') || body.toLowerCase().includes('kitna')) {
    // 🔥 STOP PRICE SPAM LOOP
    if (user.lastSentMsg === 'price') {
      console.log(`[SKIP PRICE REPEAT] ${chatId}`);
      return;
    }
    
    await sendSafe(client, chatId, user,
      `Automation system ₹5,000 – ₹10,000 me ready ho jata hai.\n\nIsme WhatsApp auto-reply, lead handling aur setup sab included hota hai.\n\nKya main aapke liye setup start karu?`
    );
    user.lastSentMsg = 'price';
    user.stage = 'closing';
    user.lastInteraction = Date.now();
    saveState();
    return;
  }

  // 🔥 SCORE SYSTEM: Update score based on intent
  if (intent === 'interest') user.score += 10;
  if (intent === 'pricing') user.score += 20;
  if (intent === 'confirm') user.score += 30;
  if (intent === 'demo_request') user.score += 15;
  if (intent === 'rejection') user.score -= 20;
  
  // 🔥 FIX SCORE OVERFLOW: Cap score at 100
  user.score = Math.min(user.score, 100);
  user.score = Math.max(user.score, 0);

  console.log(`\n${sid} [BOT] body     : "${body}"`);
  console.log(`${sid} [BOT] intent   : ${intent} (${confidence}%)`);
  console.log(`${sid} [BOT] stage    : ${user.stage} | Score: ${user.score}`);

  // 🔥 FIX NO REPLY AFTER CONVERSION: Allow replies even after converted
  if (user.status === 'DEAD') {
    const msg_lower = body.toLowerCase();
    if (msg_lower === 'hi' || msg_lower === 'hello' || msg_lower === 'hey') {
      console.log(`${sid} [RESET] New conversation after conversion`);
      user.stage = 'new';
      user.status = 'ACTIVE';
      user.score = 0;
      user.followUpCount = 0;
    } else {
      console.log(`${sid} [SKIP RESET] Converted user but continuing flow`);
      user.status = 'ACTIVE';
    }
    return;
  }

  // Requirement: Context + History Fix (Fix null history crash)
  if (user.category === 'unknown' && !user.categoryDetectedFromHistory) {
    try {
      // Fallback for null history
      const history = await client.loadAndGetAllMessagesInChat(chatId, false, false).catch(() => []);
      const safeHistory = history || [];
      const userMessages = safeHistory.filter(m => !m.fromMe).slice(-3);
      const textToScan = (userMessages.map(m => (m.body || '')).join(' ') + ' ' + body).toLowerCase();
      
      let detected = false;
      if (/\b(hotel|booking|room|reservation)\b/.test(textToScan)) {
        user.category = 'hotel';
        user.categoryDetectedFromHistory = true;
        detected = true;
      } else if (/\b(clinic|doctor|patient|appointment)\b/.test(textToScan)) {
        user.category = 'clinic';
        user.categoryDetectedFromHistory = true;
        detected = true;
      } else if (/\b(website|portfolio|e-commerce)\b/.test(textToScan)) {
        user.category = 'website';
        user.categoryDetectedFromHistory = true;
        detected = true;
      } else if (/\b(automation|automate|bot|chatbot)\b/.test(textToScan)) {
        user.category = 'automation';
        user.categoryDetectedFromHistory = true;
        detected = true;
      }

      if (!detected && user.stage === 'new') {
        const waitTime = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
        await delay(waitTime);
        
        // Requirement: greeting -> intro message
        if (currentIntent === 'greeting') {
          await client.sendText(chatId as ChatId, msg.intro);
        } else {
          await client.sendText(chatId as ChatId, msg.confirmCategory);
        }
        saveState();
        return;
      }
    } catch (e: any) {
      console.error(`${sid} [CONTEXT] Failed to read history:`, e.message);
    }
  }

  // Requirement: Stage Management (Update stage based on replies)
  if (/(^ha$|^yes$|^ok$)/i.test(body.toLowerCase())) {
     if (user.stage === 'confirm_start') {
        await client.sendText(chatId as ChatId, msg.closed);
        user.stage = 'converted'; // Production mapping
        user.status = 'DEAD';
        analytics.trackConversion(chatId);
        console.log(`${sid} [STAGE] ${chatId} converted!`);
        saveLead(chatId, body, user, name);
        saveState();
        return; // 🔥 CRITICAL: RETURN
     }
  }

  if (currentIntent === 'rejection') {
    await sendSafe(client, chatId, user, msg.rejected);
    user.stage = 'rejected';
    saveState();
    return; // 🔥 CRITICAL: RETURN
  }

  // 🔥 AUTO CLOSE TRIGGER: Hot lead detection (score >= 40)
  if (
    user.score >= 40 &&
    user.stage !== 'converted' &&
    user.stage !== 'closing'
  ) {
    const isEn = isEnglish(body);
    const closingMsg = isEn
      ? "Great! Let's get this started. I'll set everything up for you.\n\nPlease confirm to proceed."
      : "Bilkul! Chaliye shuru karte hain. Main aapka setup tayyar kar dunga.\n\nKya aap confirm karte ho?";
    await sendSafe(client, chatId, user, closingMsg);
    user.stage = 'closing';
    console.log(`${sid} [SCORE] Hot lead detected! Score: ${user.score}`);
    saveState();
    return; // 🔥 CRITICAL: RETURN TO PREVENT DUPLICATE RESPONSES
  }

  // 🔥 FINAL PAYMENT PUSH: Closing stage confirmation
  if (user.stage === 'closing' && (intent === 'confirm' || intent === 'interest')) {
    const isEn = isEnglish(body);
    const paymentMsg = isEn
      ? "Perfect! I'm locking your setup.\n\nOur team will contact you shortly to complete everything."
      : "Bilkul! Main aapka setup lock kar raha hu.\n\nHamari team aapko jaldi hi contact karega.";
    await sendSafe(client, chatId, user, paymentMsg);
    user.stage = 'converted';
    user.status = 'DEAD';
    analytics.trackConversion(chatId);
    console.log(`${sid} [CONVERTED] Lead closed! Score: ${user.score}`);
    saveLead(chatId, body, user, name);
    saveState();
    return; // 🔥 CRITICAL: RETURN TO PREVENT DUPLICATE RESPONSES
  }

  // 🔥 URGENCY PUSH: Limited slots message
  if (user.stage === 'interested' && user.score > 20) {
    const isEn = isEnglish(body);
    const urgencyMsg = isEn
      ? "We have limited slots this week.\n\nDo you want me to reserve one for you?"
      : "Is hafte ke liye limited slots hain.\n\nKya main aapke liye ek slot reserve karu?";
    await sendSafe(client, chatId, user, urgencyMsg);
    console.log(`${sid} [URGENCY] Sending limited slots message. Score: ${user.score}`);
    saveState();
    return; // 🔥 CRITICAL: RETURN TO PREVENT DUPLICATE RESPONSES
  }

  // 🔥 HANDLE "INTERESTED" PROPERLY
  const msg_lower = body.toLowerCase();
  if (msg_lower.includes('interested') || msg_lower.includes('intersted')) {
    await sendSafe(client, chatId, user,
      `Great 👍\n\nAutomation system ₹5,000 – ₹10,000 me ready ho jata hai.\n\nKya main aapke liye setup start karu?`
    );
    user.stage = 'closing';
    user.score += 20;
    user.lastInteraction = Date.now();
    saveState();
    return;
  }
  
  // 🔥 HANDLE UNKNOWN MESSAGES PROPERLY
  if (intent === 'unknown') {
    await sendSafe(client, chatId, user,
      `Samajh gaya 👍\n\nAap WhatsApp automation ya website system me interested ho?\n\nMain help kar sakta hoon.`
    );
    user.lastInteraction = Date.now();
    return;
  }
  
  // 🔥 HANDLE SHORT REPLIES (IMPORTANT)
  if (message.body.toLowerCase() === 'bolo' || message.body.toLowerCase() === 'haan') {
    await sendSafe(client, chatId, user,
      `Great 👍\n\nMain aapke business ke liye automation setup kar sakta hoon.\n\nAapka business type kya hai?`
    );
    user.lastInteraction = Date.now();
    return;
  }

  // FAQ / GPT Fallback handling
  await handleFAQOrFallback(client, chatId, user, body, async () => {
    // Stage Machine logic if FAQ doesn't handle it
    const shouldAddBoost = Math.random() < 0.25;

    switch (user.stage) {
      case 'new': {
        if (user.category === 'hotel') {
          let text = msg.hotelInitial;
          if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
          await sendSafe(client, chatId, user, text);
          user.stage = 'interested';
          return; // 🔥 CRITICAL: RETURN
        } else if (user.category === 'clinic') {
          let text = msg.clinicInitial;
          if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
          await sendSafe(client, chatId, user, text);
          user.stage = 'interested';
          return; // 🔥 CRITICAL: RETURN
        } else if (user.category === 'website') {
          let text = msg.websiteInitial;
          if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
          await sendSafe(client, chatId, user, text);
          user.stage = 'interested';
          return; // 🔥 CRITICAL: RETURN
        } else if (user.category === 'automation') {
          let text = msg.automationInitial;
          if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
          await sendSafe(client, chatId, user, text);
          user.stage = 'interested';
          return; // 🔥 CRITICAL: RETURN
        } else {
          // fallback
          await sendSafe(client, chatId, user, msg.confirmCategory);
          return; // 🔥 CRITICAL: RETURN
        }
      }

      case 'interested': {
        if (currentIntent === 'interest' || currentIntent === 'greeting') {
          await sendSafe(client, chatId, user, msg.explanation);
          user.stage = 'qualified';
          return; // 🔥 CRITICAL: RETURN
        } else {
          await sendSafe(client, chatId, user, msg.fallback);
          return; // 🔥 CRITICAL: RETURN
        }
      }

      case 'qualified': {
        await sendSafe(client, chatId, user, msg.closePush);
        user.stage = 'confirm_start';
        return; // 🔥 CRITICAL: RETURN
      }

      case 'confirm_start': {
        await sendSafe(client, chatId, user, msg.closePush);
        return; // 🔥 CRITICAL: RETURN
      }

      default:
        user.stage = 'new';
        await sendSafe(client, chatId, user, msg.fallback);
        return; // 🔥 CRITICAL: RETURN
    }
  });

  if (user.stage !== stageBeforeReply) {
    console.log(`${sid} [BOT] → stage: ${stageBeforeReply} → ${user.stage} | Score: ${user.score}`);
    saveLead(chatId, body, user, name);
  }

  user.lastInteraction = Date.now();
  saveState();
  scheduleFollowUp(client, chatId, user);
  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// SESSION BOOTSTRAP & GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle graceful shutdown
 */
async function shutdown(signal: string) {
  const sid = `[SESSION ${SESSION_ID}]`;
  console.log(`\n${sid} [${signal}] Shutting down...`);
  
  if (analytics) {
    analytics.stopDashboard();
    console.log(`${sid} [SHUTDOWN] Analytics stopped.`);
  }
  
  if (globalClient) {
    try {
      await globalClient.kill();
      console.log(`${sid} [SHUTDOWN] WhatsApp client closed.`);
    } catch (e: any) {
      console.error(`${sid} [SHUTDOWN] Error killing client:`, e.message);
    }
  }

  if (server) {
    server.close(() => {
      console.log(`${sid} [SHUTDOWN] Express server closed.`);
      process.exit(0);
    });
    // Force exit after 5s if server.close hangs
    setTimeout(() => {
      console.log(`${sid} [SHUTDOWN] Force exiting...`);
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// For "death" library if used elsewhere, but we handle it via process signals
const ON_DEATH = (fn: any) => {
  process.on('exit', fn);
};

ev.on('qr.**', async (qrcode, sessionId) => {
  const buf = Buffer.from(qrcode.replace('data:image/png;base64,', ''), 'base64');
  const filename = path.join(SESSION_DIR, `qr_code.png`);
  fs.writeFileSync(filename, buf);
  console.log(`[QR ${sessionId}] Saved → ${filename} (scan with your phone)`);
});

ev.on('STARTUP.**', async (data, sessionId) => {
  if (data === 'SUCCESS') console.log(`[STARTUP] ${sessionId} ready ✅`);
});

async function start(client: Client): Promise<void> {
  const sid = `[SESSION ${SESSION_ID}]`;
  console.log(`${sid} Client started, wait for readiness signal...`);
  
  // Initialize analytics
  analytics = new Analytics(SESSION_DIR, SESSION_ID);
  analytics.startDashboard();
  console.log(`${sid} Analytics initialized`);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Initialize Multi-Sheet Outbound Engine
  // ─────────────────────────────────────────────────────────────────────────────
  const clientMap: Record<string, Client> = {};
  
  const sendSafeWrapper = async (
    sessionId: string,
    chatId: string,
    text: string
  ): Promise<boolean> => {
    try {
      const user = getUser(chatId);
      await sendSafe(client, chatId, user, text);
      return true;
    } catch (err: any) {
      console.error(`${sid} [OUTBOUND] Send failed:`, err.message);
      return false;
    }
  };

  // Start auto-polling for all sheets
  startAutoPolling(clientMap, sendSafeWrapper);
  console.log(`${sid} Multi-sheet outbound engine started`);
  
  // 🔥 FIX: Extended hardening period after QR scan (already done in launchWhatsAppClient)
  // This ensures session files are fully saved before processing messages
  console.log(`${sid} [STABILITY] Session hardening complete`);

  // 🔥 FIX: Validate session is ready
  try {
    const host = await client.getHostNumber();
    const isConn = await client.isConnected();
    if (isConn && host) {
      console.log(`${sid} [SESSION] Validated successfully. Host: ${host}`);
    } else {
      console.warn(`${sid} [SESSION] Validation warning - may need manual intervention`);
    }
  } catch (e: any) {
    console.error(`${sid} [SESSION] Validation error:`, e.message);
  }

  const sessionId = process.env.SESSION_ID || "default";
  globalClient = client;

  app.use(client.middleware(true));

  // PORT CONFLICT FIX & SAFE SERVER START
  try {
    const targetPort = getPortForSession(SESSION_ID);
    const assignedPort = await getPort({ port: [targetPort, ...Array.from({ length: 50 }, (_, i) => 8000 + i)] });
    
    server = app.listen(assignedPort, () => {
      console.log(`[SESSION ${SESSION_ID}] Running on port ${assignedPort} ✅`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[SESSION ${SESSION_ID}] Port ${assignedPort} in use, retrying...`);
      } else {
        console.error(`[SESSION ${SESSION_ID}] Server error:`, err.message);
      }
    });

  } catch (err: any) {
    console.error(`[SESSION ${SESSION_ID}] FAILED to start server:`, err.message);
  }

  client.onStateChanged(state => {
    console.log(`[STATE] ${state}`);
    // 🔥 FIX: Do NOT auto-restart on state changes
    // Only log state for monitoring
    if (state === 'CONFLICT') {
      console.warn(`${sid} [STATE] CONFLICT detected - manual intervention may be needed`);
    }
    if (state === 'UNLAUNCHED') {
      console.warn(`${sid} [STATE] UNLAUNCHED detected - session may need restart`);
    }
  });

  console.log(`${sid} [STABILITY] STABLE READY ✅`);
  
  // 🔥 FIX: Auto Self Test with proper error handling
  try {
    const me = await client.getHostNumber();
    if (me) {
      await client.sendText(`${me}@c.us` as any, "System Ready ✅");
      console.log(`${sid} [SELF-TEST] Message sent to host.`);
    }
  } catch (e: any) {
    console.warn(`${sid} [SELF-TEST] Warning:`, e.message);
    // Don't fail startup on self-test error
  }

  // ATTACH LISTENERS ONLY AFTER STABLE READY
  console.log(`${sid} Attaching listeners...`);

  // Single consolidated onMessage handler — prevents duplicate listener leak
  client.onMessage(async (message: Message) => {
    try {
      if (message.fromMe) return;

      // Admin command
      if (message.from === ADMIN_NUMBER && message.body === 'START BULK') {
        await client.sendText(ADMIN_NUMBER as ChatId, "Bulk outreach initiated...");
        runBulkOutreach(client);
        return;
      }

      // Multi-sheet metrics command
      if (message.from === ADMIN_NUMBER && message.body === 'SHEET METRICS') {
        const metrics = getSheetMetrics();
        const metricsText = Object.entries(metrics)
          .map(([sheetId, m]: [string, any]) => 
            `${sheetId}: ${m.sentToday}/${m.dailyLimit} sent, ${m.failedCount} failed`
          )
          .join('\n');
        await client.sendText(ADMIN_NUMBER as ChatId, `[SHEET METRICS]\n${metricsText}`);
        return;
      }

      // Test ping
      if (message.body && message.body.toLowerCase() === 'hi') {
        console.log(`${sid} Test message received: hi`);
        await client.sendText(message.from, 'Working ✅');
        return;
      }

      console.log(`${sid} Incoming:`, message.body);

      if (message.type !== MessageTypes.TEXT) {
        await delay(3000);
        await client.sendText(message.from, M(message.body || '').nonText);
        return;
      }

      await handleMessage(client, message);
    } catch (err: any) {
      console.error(`${sid} Error in onMessage:`, err.message);
    }
  });

  client.onAddedToGroup(chat => console.log(`[GROUP] Added to: ${chat.id}`));
  client.onIncomingCall(call => console.log(`[CALL]  Incoming:`, call));

  console.log(`${sid} Waiting for messages...`);

  // Health Check Loop
  setInterval(async () => {
    try {
      const ok = await client.isConnected();
      if (!ok) {
        console.warn(`${sid} Health Check: Connection lost!`);
        await client.forceRefocus().catch(() => {});
      }
    } catch (e: any) {
      console.warn(`${sid} Health Check: Error checking connection`, e.message);
    }
  }, 30000);
}

// Prevent duplicate execution using a simple lock file
const LOCK_FILE = path.join(SESSION_DIR, `.lock`);
if (fs.existsSync(LOCK_FILE)) {
  const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
  try {
    // Automatically detect and kill any existing node processes for same SESSION_ID
    process.kill(pid, 0); 
    console.log(`[SESSION ${SESSION_ID}] Found existing process ${pid}. Killing...`);
    process.kill(pid, 'SIGKILL');
    // Allow OS to reclaim resources
    const startSync = Date.now();
    while (Date.now() - startSync < 2000) {} 
    fs.unlinkSync(LOCK_FILE);
  } catch (e) {
    // Process not running, stale lock
    fs.unlinkSync(LOCK_FILE);
  }
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());

process.on('exit', () => {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch (e: any) {}
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUPPETEER/CHROME LAUNCH STABILITY FIX
// ─────────────────────────────────────────────────────────────────────────────

// Clear any Puppeteer environment overrides
delete process.env.PUPPETEER_EXECUTABLE_PATH;
delete process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;

// Track launch attempts to prevent infinite loops
let launchAttempts = 0;
const MAX_LAUNCH_ATTEMPTS = 2;

async function launchWhatsAppClient() {
  const sid = `[SESSION ${SESSION_ID}]`;
  launchAttempts++;

  if (launchAttempts > MAX_LAUNCH_ATTEMPTS) {
    console.error(`${sid} [FATAL] Max launch attempts (${MAX_LAUNCH_ATTEMPTS}) exceeded. Exiting.`);
    process.exit(1);
  }

  console.log(`${sid} [BROWSER] Initializing Chrome (attempt ${launchAttempts}/${MAX_LAUNCH_ATTEMPTS})...`);
  console.log(`${sid} [AUTH] Scan QR and wait 60 seconds`);

  try {
    const client = await create({
      sessionId: SESSION_ID,
      headless: false,  // 🔥 FIX: Set to false for stable multi-device support
      useChrome: true,
      multiDevice: true,
      restartOnCrash: false,  // 🔥 FIX: Disable auto-restart to prevent context destruction
      blockCrashLogs: true,
      disableSpins: true,
      qrTimeout: 0,  // Wait indefinitely for QR scan
      authTimeout: 120,  // 🔥 FIX: Increased from 60 to 120 seconds
      sessionDataPath: SESSION_DIR,
      qrLogSkip: false,
      popup: false,
      // 🔥 FIX: REMOVED invalid chromiumArgs that break multi-device
      // Removed: '--no-sandbox', '--disable-dev-shm-usage'
      args: [
        // Only safe, essential args for stable Chrome launch
        '--disable-gpu',  // Disable GPU acceleration for stability
      ],
    });

    console.log(`${sid} [SESSION] QR required`);
    console.log(`${sid} [AUTH] Waiting for QR scan...`);

    // Wait for successful authentication
    await delay(5000);

    const isConnected = await client.isConnected();
    if (!isConnected) {
      console.warn(`${sid} [AUTH] Not connected yet, waiting...`);
      await delay(10000);
    }

    console.log(`${sid} [SESSION] Logged in successfully`);
    console.log(`${sid} [SESSION] Restart safe`);

    // 🔥 FIX: Do NOT restart bot for at least 120 seconds after QR scan
    console.log(`${sid} [STABILITY] Hardening session for 120 seconds...`);
    await delay(120000);

    return client;
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error(`${sid} [BROWSER] Launch failed:`, errMsg);

    // 🔥 FIX: Retry once on "Execution context destroyed" errors
    if (errMsg.includes('Execution context') || errMsg.includes('destroyed')) {
      console.warn(`${sid} [RECOVERY] Execution context error detected. Retrying...`);
      await delay(5000);
      return launchWhatsAppClient();  // Recursive retry
    }

    // Do NOT delete session immediately on error
    console.error(`${sid} [ERROR] Session preserved for debugging`);
    throw err;
  }
}

console.log(`[SESSION ${SESSION_ID}] Initializing browser...`);
console.log(`[SESSION ${SESSION_ID}] Using system Chrome`);
console.log("Creating client...");

try {
  launchWhatsAppClient()
    .then(client => {
      console.log(`[SESSION ${SESSION_ID}] Client initialized`);
      return start(client);
    })
    .catch(e => {
      console.error(`[SESSION ${SESSION_ID}] FAILED`, e.message);
      console.error("[FATAL ERROR]", e);
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
      process.exit(1);
    });
} catch (error) {
  console.error("[FATAL ERROR] Outside of promise:", error);
  process.exit(1);
}
