import { create, Client, ev, NotificationLanguage, Message, MessageTypes } from '../src/index';
import type { ChatId } from '../src/api/model/aliases';

const fs = require('fs');
const axios = require('axios');
const ON_DEATH = fn => process.on('exit', fn);
let globalClient: Client;
const express = require('express');
const app = express();
app.use(express.json({ limit: '200mb' }));
require('dotenv').config();
const PORT = 8082;
const { OpenAI } = require('openai');
const { google } = require('googleapis');

if (!process.env.OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY is missing from environment variables.");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SPREADSHEET_ID = '1mrrOGWzNTp2YYXiY5BxnsvqM8g3BsfB1yIpbc5qMR3w';
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || "918073539824@c.us";
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';
const SENT_LEADS_FILE = 'sentLeads.json';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Stage =
  | 'new'
  | 'asked_interest'
  | 'interested'
  | 'demo_sent'
  | 'negotiating'
  | 'confirm_start'
  | 'closed'
  | 'rejected';

type Category = 'hotel' | 'clinic' | 'unknown';

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
// STATE STORE  (in-memory, keyed by WhatsApp chat ID)
// ─────────────────────────────────────────────────────────────────────────────

const userState: Record<string, UserState> = {};

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

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

// ── Per-language message sets (no emojis, no "automation") ──────────────────
const MSG_HI = {
  hotelInitial: `Agar aap direct bookings increase karna chahte ho,\nto main aapke hotel ke liye custom booking system bana sakta hu.\n\nKya aap chahte ho main idea explain karu?`,
  clinicInitial: `Agar aap patient inquiries increase karna chahte ho,\nto main aapke clinic ke liye system bana sakta hu.\n\nKya main aapko explain karu kaise kaam karega?`,
  confirmCategory: `Just to confirm, belongs to which category? Hotel or Clinic?`,
  explanation: `Ye system aapko direct customers laata hai.\nDemo check karein: https://anjali-booking-system--cryptosourav23.replit.app/`,
  microFollowUp: `Did you get a chance to check the demo?`,
  lowInterest: `Do you want me to explain more or proceed with setup?`,
  fastClose: `Should I set this up for you?`,
  trustBoost: `This system is already working for other businesses.`,
  closePush: `Kya aap setup start karna chahte ho?`,
  price: `Digilinex team aapse shortly connect karegi regarding pricing.`,
  followUp1: `Just checking.\n\nKya aap apne business ke liye\ndirect booking system setup karna chahte ho?`,
  followUp2: `Agar aap abhi start karte ho,\nto main aapko special setup offer de sakta hu.\n\nKya main aapke liye bana du?`,
  followUp3: `Last check. Kya hum setup proceed karein?\nNahi to main ye offer close kar raha hu.`,
  closed: `Okay.\n\nDigilinex team aapse connect kar rahi hai.`,
  rejected: `Theek hai. Agar future me kabhi zarurat ho to zarur batayein.`,
  fallback: `Digilinex team aapse jaldi hi connect karegi.`,
  nonText: `Please wait, Digilinex team will contact you shortly.`,
};

const MSG_EN = {
  hotelInitial: `If you want to increase direct bookings,\nI can build a custom booking system for your hotel.\n\nWould you like me to explain the idea?`,
  clinicInitial: `If you want to increase patient inquiries,\nI can build a system for your clinic.\n\nShall I explain how it works?`,
  confirmCategory: `Just to confirm, are you a Hotel or a Clinic?`,
  explanation: `This system brings direct customers to you.\nDemo: https://anjali-booking-system--cryptosourav23.replit.app/`,
  microFollowUp: `Did you get a chance to check the demo?`,
  lowInterest: `Do you want me to explain more or proceed with setup?`,
  fastClose: `Should I set this up for you?`,
  trustBoost: `This system is already working for other businesses.`,
  closePush: `Would you like to start the setup?`,
  price: `The Digilinex team will connect with you shortly regarding pricing.`,
  followUp1: `Just checking.\n\nDo you want to setup a\ndirect booking system for your business?`,
  followUp2: `If you start now,\nI can give you a special setup offer.\n\nShall I build it for you?`,
  followUp3: `Last checking call. Shall we proceed?\nOtherwise, I will close this setup offer.`,
  closed: `Okay.\n\nThe Digilinex team is connecting with you.`,
  rejected: `Understood. Feel free to reach out whenever you need help.`,
  fallback: `The Digilinex team will connect with you shortly.`,
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
const LEADS_FILE = 'leads.json';

async function saveToGoogleSheet(lead: any) {
  try {
    if (!fs.existsSync('credentials.json')) {
      console.log('[CRM] Skip Sheets: credentials.json not found');
      return;
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          lead.time,
          lead.number,
          lead.message,
          lead.stage,
          lead.category,
          lead.score,
          lead.status
        ]],
      },
    });
    console.log('[CRM] Logged to Google Sheet successfully');
  } catch (err: any) {
    console.error('[CRM] Google Sheets Error:', err.message);
  }
}

async function markLeadAsHot(client: Client, chatId: string, score: number) {
  await client.sendText(ADMIN_NUMBER as ChatId,
    "🔥 HOT LEAD ALERT:\n" +
    "Number: " + chatId + "\n" +
    "Score: " + score + "\n" +
    "Link: https://wa.me/" + chatId.split('@')[0]
  );
  console.log(`[ALERT] Hot lead alert sent for ${chatId}`);
}

function saveLead(chatId: string, body: string, user: UserState): void {
  // STEP 7: PREVENT DUPLICATES - Only log if stage or score changed significantly
  if (user.lastLoggedStage === user.stage && user.lastLoggedScore === user.score) {
    return;
  }

  const lead = {
    number: chatId,
    message: body,
    stage: user.stage,
    category: user.category,
    score: user.score,
    status: user.score >= 70 ? 'HOT' : 'COLD',
    time: new Date().toISOString(),
  };

  console.log('LEAD:', lead);
  saveToGoogleSheet(lead);

  user.lastLoggedStage = user.stage;
  user.lastLoggedScore = user.score;

  try {
    let leads: object[] = [];
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, 'utf8').trim();
      leads = raw ? JSON.parse(raw) : [];
    }
    leads.push(lead);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  } catch (err) {
    console.error('[CRM] Failed to write lead:', err);
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
  // Cancel any existing timer for this user first
  if (followUpTimers[chatId]) {
    clearTimeout(followUpTimers[chatId]);
    delete followUpTimers[chatId];
  }

  if (user.stage === 'closed' || user.status === 'DEAD') return;

  const msgSet = user.language === 'en' ? MSG_EN : MSG_HI;

  // STEP 7: MICRO FOLLOW-UP (30 minutes after demo)
  if (user.stage === 'demo_sent') {
    followUpTimers[chatId] = setTimeout(async () => {
      if (userState[chatId]?.stage === 'demo_sent' && userState[chatId]?.status === 'ACTIVE') {
        try {
          await client.sendText(chatId as ChatId, msgSet.microFollowUp);
          console.log(`[MICRO-FOLLOWUP] Sent to ${chatId}`);
        } catch (e) {}
      }
    }, 30 * 60 * 1000);
    return;
  }

  // STEP 5: OFFER CONTROL & FOLLOW-UP LADDER
  followUpTimers[chatId] = setTimeout(async () => {
    if (userState[chatId]?.status === 'ACTIVE' && userState[chatId]?.stage !== 'closed') {
      try {
        user.followUpCount += 1;
        
        if (user.followUpCount === 1) {
          await client.sendText(chatId as ChatId, msgSet.followUp1); // 24h
        } else if (user.followUpCount === 2) {
          await client.sendText(chatId as ChatId, msgSet.followUp2); // 48h (with offer)
        } else if (user.followUpCount === 3) {
          await client.sendText(chatId as ChatId, msgSet.followUp3); // 72h
        } else if (user.followUpCount > 3) {
          // STEP 6: DEAD LEAD SYSTEM
          user.status = 'DEAD';
          console.log(`[DEAD LEAD] Marked ${chatId}`);
          return;
        }

        console.log(`[FOLLOWUP-${user.followUpCount}] Sent to ${chatId}`);
        scheduleFollowUp(client, chatId, user); // Reschedule for next ladder

      } catch (err) {
        console.error(`[FOLLOWUP] Failed for ${chatId}:`, err);
      }
    }
  }, 24 * 60 * 60 * 1000);

  console.log(`[FOLLOWUP] Scheduled ladder for ${chatId} (count=${user.followUpCount})`);
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
  let targetUrl = GOOGLE_SCRIPT_URL;
  try {
    const hostNum = await client.getHostNumber();
    const selfId = `${hostNum}@c.us`;
    const messages = await client.loadAndGetAllMessagesInChat(selfId, true, false);
    const lastMsg = messages[messages.length - 1]?.body || '';
    if (lastMsg.startsWith('http')) {
      targetUrl = lastMsg.trim();
      console.log(`[BULK] Using dynamic URL from self-chat: ${targetUrl}`);
    }
  } catch (e) {}

  if (!targetUrl) {
    console.error('[BULK] No GOOGLE_SCRIPT_URL found.');
    return;
  }

  const leads = await axios.get(targetUrl).then(res => res.data).catch(() => []);
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
  text: string,
  altText?: string
): Promise<void> {
  // STEP 1: STRICT NO REPEAT SYSTEM
  if (user.lastReplies.includes(text)) {
    const fallback = isEnglish(text)
      ? "Please wait, Digilinex team will contact you shortly."
      : "Please wait, Digilinex team will contact you shortly.";

    await client.sendText(chatId as ChatId, fallback);
    user.humanEscalated = true;
    return;
  }

  await client.sendText(chatId as ChatId, text);

  user.lastSentMsg = text;
  user.lastReplies.push(text);
  if (user.lastReplies.length > 5) {
    user.lastReplies.shift();
  }
}

async function askGpt(body: string, history: string[], chatId: string): Promise<string> {
  try {
    const pricing = getDynamicPricing(chatId);
    const isDetail = body.toLowerCase().includes('how it works') || body.toLowerCase().includes('kaise kaam karta hai');

    // STEP 4 & 5: GPT GUARDRAILS & TRUST BOOST
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional sales agent for Digilinex. Pricing: ${pricing}. 
          RULES: 
          1. Default reply: Max 3 lines ONLY. No long paragraphs.
          2. IF 'how it works' allow 7-15 lines.
          3. Tone: Professional human-closer. NO emojis. NO symbols like *. 
          4. Trust Boost: Occasionally mention 'Ye system already multiple businesses me use ho raha hai' (in Hinglish) or 'We have already implemented this for multiple businesses' (in English).
          5. If serious, push close. If confused, simplify. If rude, stay calm.
          6. ALWAYS end with: Would you like to proceed?`
        },
        ...history.map(txt => ({ role: "assistant" as const, content: txt })),
        { role: "user", content: body }
      ],
      max_tokens: isDetail ? 400 : 80,
      temperature: 0.5
    });

    let reply = response.choices[0].message.content || "";
    return reply;
  } catch (err: any) {
    console.error("[GPT] Error:", err.message);
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
  const chatId = message.from;
  const body = (message.body || '').trim();
  const user = getUser(chatId);
  const { intent, confidence } = detectIntent(body);
  const clusterMatch = matchFaqCluster(body);
  const msg = M(body);
  const currentIntent = intent as Intent;

  const stageBeforeReply = user.stage;
  user.messagesCount += 1;
  saveLead(chatId, body, user);

  console.log(`\n[BOT] ──────────────────────────────────`);
  console.log(`[BOT] body     : "${body}"`);
  console.log(`[BOT] intent   : ${intent} (${confidence}%)`);
  console.log(`[BOT] score    : ${user.score}`);

  if (user.status === 'DEAD' || user.stage === 'closed') return;

  // STEP 1: DM CONTEXT DETECTION & FALLBACK
  if (user.category === 'unknown' && !user.categoryDetectedFromHistory) {
    try {
      const messages = await client.loadAndGetAllMessagesInChat(chatId, false, false);
      const userMessages = messages.filter(m => !m.fromMe).slice(-3);
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
      }

      // STEP 1: WRONG CATEGORY FALLBACK
      if (!detected && user.stage === 'new') {
        await client.sendText(chatId as ChatId, msg.confirmCategory);
        return;
      }
    } catch (e) {
      console.error('[CONTEXT] Failed to read history', e);
    }
  }

  // STEP 6: CLOSE CONDITION
  if (/(^ha$|^yes$|^ok$)/i.test(body.toLowerCase())) {
    await client.sendText(chatId as ChatId, msg.closed);
    user.stage = 'closed';
    user.status = 'DEAD';
    return;
  }

  // STEP 2: FAST CLOSE TRIGGER
  if (/(^ok$|^hmm$|^batao$|^fine$)/i.test(body.toLowerCase())) {
    await client.sendText(chatId as ChatId, msg.fastClose);
    return;
  }

  // STEP 4: PRICE HANDLING
  if (currentIntent === 'pricing') {
    await client.sendText(chatId as ChatId, msg.price);
    return;
  }

  // STEP 3: LOW INTEREST HANDLING
  if (body.length < 5) {
    user.shortReplyCount += 1;
    if (user.shortReplyCount >= 2) {
      await client.sendText(chatId as ChatId, msg.lowInterest);
      user.shortReplyCount = 0;
      return;
    }
  } else {
    user.shortReplyCount = 0;
  }

  // ── REJECTION ──────────────────────────────────────────────────────────
  if (currentIntent === 'rejection') {
    await sendSafe(client, chatId, user, msg.rejected);
    user.stage = 'rejected';
    return;
  }

  // STEP 4: TRUST BOOST LINE (Random injection)
  const shouldAddBoost = Math.random() < 0.25;

  // ── STAGE MACHINE ────────────────────────────────────────────────────────
  switch (user.stage) {
    case 'new': {
      if (user.category === 'hotel') {
        let text = msg.hotelInitial;
        if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
        await sendSafe(client, chatId, user, text);
        user.stage = 'asked_interest';
      } else if (user.category === 'clinic') {
        let text = msg.clinicInitial;
        if (shouldAddBoost) text += "\n\n" + msg.trustBoost;
        await sendSafe(client, chatId, user, text);
        user.stage = 'asked_interest';
      } else {
        // Fallback for confirming category
        await sendSafe(client, chatId, user, msg.confirmCategory);
      }
      break;
    }

    case 'asked_interest': {
      if (currentIntent === 'interest' || currentIntent === 'greeting') {
        let text = msg.explanation;
        if (shouldAddBoost) text = msg.trustBoost + "\n\n" + text;
        await sendSafe(client, chatId, user, text);
        user.stage = 'demo_sent';
      } else {
        await sendSafe(client, chatId, user, msg.fallback);
      }
      break;
    }

    case 'demo_sent': 
    case 'interested': {
      if (currentIntent === 'interest' || currentIntent === 'greeting') {
        await sendSafe(client, chatId, user, msg.closePush);
        user.stage = 'confirm_start';
      } else {
        await sendSafe(client, chatId, user, msg.fallback);
      }
      break;
    }

    case 'confirm_start': {
      if (currentIntent === 'interest' || currentIntent === 'confirm') {
        await client.sendText(chatId as ChatId, msg.closed);
        user.stage = 'closed';
        user.status = 'DEAD';
      } else {
        await sendSafe(client, chatId, user, msg.closePush);
      }
      break;
    }

    default: {
      if (user.category === 'hotel') await sendSafe(client, chatId, user, msg.hotelInitial);
      else if (user.category === 'clinic') await sendSafe(client, chatId, user, msg.clinicInitial);
      user.stage = 'asked_interest';
    }
  }

  console.log(`[BOT] → stage: ${stageBeforeReply} → ${user.stage}`);

  scheduleFollowUp(client, chatId, user);
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

ON_DEATH(async () => {
  console.log('[EXIT] Killing session...');
  if (globalClient) await globalClient.kill();
});

ev.on('qr.**', async (qrcode, sessionId) => {
  const buf = Buffer.from(qrcode.replace('data:image/png;base64,', ''), 'base64');
  const filename = `qr_code${sessionId ? '_' + sessionId : ''}.png`;
  fs.writeFileSync(filename, buf);
  console.log(`[QR] Saved → ${filename}  (scan with your phone)`);
});

ev.on('STARTUP.**', async (data, sessionId) => {
  if (data === 'SUCCESS') console.log(`[STARTUP] ${sessionId} ready ✅`);
});

async function start(client: Client): Promise<void> {
  globalClient = client;

  app.use(client.middleware(true));
  app.listen(PORT, () => console.log(`[HTTP] Listening on port ${PORT}`));

  const me = await client.getMe();
  console.log(`[ME] Host:`, me?.wid || me);

  client.onStateChanged(state => {
    console.log(`[STATE] ${state}`);
    if (state === 'CONFLICT' || state === 'UNLAUNCHED') client.forceRefocus();
  });

  // Debug: log every message (in + out) without acting on it
  client.onAnyMessage((msg: Message) => {
    console.log(`[ANY] from=${msg.from} fromMe=${msg.fromMe} type=${msg.type} body="${msg.body}"`);
  });

  // Sales funnel: only fires for incoming messages (fromMe === false)
  client.onMessage(async (message: Message) => {
    // Hard guard — never process our own outgoing messages
    if (message.fromMe) return;

    // Only handle plain text messages in the funnel
    // Non-text types (image, audio, etc.) get a soft nudge
    if (message.type !== MessageTypes.TEXT) {
      await delay(3000);
      await client.sendText(message.from, M(message.body || '').nonText);
      return;
    }

    await handleMessage(client, message);
  });

  // Command System for Admin
  client.onMessage(async (message: Message) => {
    if (message.fromMe) return;
    if (message.from === ADMIN_NUMBER && message.body === 'START BULK') {
      await client.sendText(ADMIN_NUMBER as ChatId, "Bulk outreach initiated...");
      runBulkOutreach(client);
    }
  });

  client.onAddedToGroup(chat => console.log(`[GROUP] Added to: ${chat.id}`));
  client.onIncomingCall(call => console.log(`[CALL]  Incoming:`, call));
}

create({
  sessionId: 'customer-support',
  useChrome: true,
  restartOnCrash: start,
  headless: true,
  throwErrorOnTosBlock: true,
  qrTimeout: 0,
  authTimeout: 0,
  killProcessOnBrowserClose: true,
  autoRefresh: true,
  safeMode: true,
  disableSpins: true,
  multiDevice: true,
  hostNotificationLang: NotificationLanguage.PTBR,
  viewport: { height: 1200 },
  popup: 3012,
  defaultViewport: null,
  protocolTimeout: 120000,
  chromiumArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
  ],
})
  .then(client => start(client))
  .catch(e => console.error(`[FATAL]`, e.message));
