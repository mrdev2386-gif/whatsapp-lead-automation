"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
console.log("[BOOT] Script started");
const wa_automate_1 = require("@open-wa/wa-automate");
const dotenv = __importStar(require("dotenv"));
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const getPort = require('get-port');
const { OpenAI } = require('openai');
console.log("[BOOT] Modules loaded successfully");
let globalClient;
let server;
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
function getPortForSession(sessionId) {
    // Simple deterministic port mapping: last 4 digits of sessionId + offset 8000
    // If not a number, fallback to get-port random
    const numericId = parseInt(sessionId.replace(/\D/g, '').slice(-4));
    if (isNaN(numericId))
        return 8080;
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
// PERSISTENT STATE STORE
// ─────────────────────────────────────────────────────────────────────────────
const STATE_FILE = path.join(SESSION_DIR, 'state.json');
let userState = {};
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            userState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            console.log(`[SESSION ${SESSION_ID}] State loaded (${Object.keys(userState).length} users)`);
        }
        catch (e) {
            console.error(`[SESSION ${SESSION_ID}] Failed to load state:`, e);
            userState = {};
        }
    }
}
function saveState() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(userState, null, 2), 'utf8');
    }
    catch (e) {
        console.error(`[SESSION ${SESSION_ID}] Failed to save state:`, e);
    }
}
function getUser(chatId) {
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
const delay = (ms) => new Promise(res => setTimeout(res, ms));
// Returns true if the message is predominantly English
function isEnglish(text) {
    const t = text.toLowerCase();
    // Hinglish keywords that suggest it's NOT pure English
    const hinglishKeywords = /\b(haan|nhi|nahi|kya|kaise|batao|kardo|samjhao|hai|ho|rha|rahi|aur|kitna|paisa|acha|theek|samajh|ji|hi)\b/;
    if (hinglishKeywords.test(t))
        return false;
    const ascii = (text.match(/[a-zA-Z]/g) || []).length;
    // If it's mostly Latin characters and no Hinglish keywords, fallback to Latin ratio
    return ascii / Math.max(text.length, 1) > 0.8;
}
function detectIntent(body) {
    const t = body.toLowerCase().trim();
    let intent = 'unknown';
    let conf = 0;
    if (/\b(hi|hello|hey|hii|helo|namaste)\b/.test(t)) {
        intent = 'greeting';
        conf = 90;
    }
    else if (/(aapne msg|kaun|who are you|kya chahiye|kaise mila)/.test(t)) {
        intent = 'confusion';
        conf = 85;
    }
    else if (/\b(hotel|booking|rooms?|resort|lodge)\b/.test(t)) {
        intent = 'category_hotel';
        conf = 95;
    }
    else if (/\b(clinic|dentist|dental|doctor|patient|hospital)\b/.test(t)) {
        intent = 'category_clinic';
        conf = 95;
    }
    else if (/\b(website|portfolio|e-commerce|web site|site)\b/.test(t)) {
        intent = 'interest';
        conf = 95;
    }
    else if (/\b(automation|automate|bot|chatbot|workflow)\b/.test(t)) {
        intent = 'interest';
        conf = 95;
    }
    else if (/(price|charge|cost|kitna|fees?|rate|paisa|rupee|\u20b9)/.test(t)) {
        intent = 'pricing';
        conf = 90;
    }
    else if (/(^no$|nahi|nope|not interested|mat karo|band karo|stop)/.test(t)) {
        intent = 'rejection';
        conf = 90;
    }
    else if (/(call|phone|baat karo|number do|contact karo)/.test(t)) {
        intent = 'confirm';
        conf = 90;
    }
    else if (/\b(demo|show|example|sample|dikhao|dikha|dekhna)\b/.test(t)) {
        intent = 'demo_request';
        conf = 90;
    }
    else if (/(details|info|batao|explain|samjhao|bataiye)/.test(t)) {
        intent = 'interest';
        conf = 80;
    }
    else if (/(confirm|deal|agree|send|bhejo|proceed|ready|start)/.test(t)) {
        intent = 'confirm';
        conf = 85;
    }
    else if (/(^yes$|haan|ha$|interested|zaroor|bilkul|sure|ok$|okay|theek hai)/.test(t)) {
        intent = 'interest';
        conf = 70;
    }
    else if (/(hmm|om|oh|okay|theek|samajh nahi aaya|confused|confusion|samjha)/.test(t)) {
        intent = 'confusion';
        conf = 85;
    }
    else if (/(later|baad me|next time|kal|after some time)/.test(t)) {
        intent = 'rejection';
        conf = 80;
    }
    return { intent, confidence: conf };
}
function getDynamicPricing(chatId) {
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
    price: `Digilinex team aapse pricing ke liye shortly connect karegi.`,
    followUp1: `Just checking.\nKya aap apne business ke liye custom system setup karna chahte ho?`,
    followUp2: `Agar aap abhi start karte ho, to hum aapko special setup offer de sakte hain.\nKya main aage badhu?`,
    followUp3: `Last call. Kya hum setup proceed karein? Warna main ye offer close kar raha hu.`,
    closed: `Theek hai!\nDigilinex team aapse details ke liye connect kar rahi hai.`,
    rejected: `Theek hai. Agar future me zarurat ho to batayein.`,
    fallback: `Digilinex team aapse jaldi hi connect karegi.`,
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
    price: `The Digilinex team will connect with you shortly regarding pricing.`,
    followUp1: `Just checking.\nDo you want to setup a direct booking system for your business?`,
    followUp2: `If you start now, I can give you a special setup offer.\nShall I build it for you?`,
    followUp3: `Last checking call. Shall we proceed? Otherwise, I will close this setup offer.`,
    closed: `Understood!\nThe Digilinex team is connecting with you.`,
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
function M(body) {
    return isEnglish(body) ? MSG_EN : MSG_HI;
}
// ─────────────────────────────────────────────────────────────────────────────
// CRM — LEAD CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
async function markLeadAsHot(client, chatId, score) {
    const sid = `[SESSION ${SESSION_ID}]`;
    await client.sendText(ADMIN_NUMBER, `${sid} 🔥 HOT LEAD ALERT:\n` +
        "Number: " + chatId + "\n" +
        "Score: " + score + "\n" +
        "Link: https://wa.me/" + chatId.split('@')[0]);
    console.log(`${sid} [ALERT] Hot lead alert sent for ${chatId}`);
}
function saveLead(chatId, body, user, name = '') {
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
        let leads = [];
        if (fs.existsSync(LEADS_FILE)) {
            const raw = fs.readFileSync(LEADS_FILE, 'utf8').trim();
            leads = raw ? JSON.parse(raw) : [];
        }
        // Requirement: Lead Deduplication (Phone as unique ID)
        const existingIndex = leads.findIndex(l => l.phone === phone);
        const newLead = {
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
        }
        else {
            // Create new lead
            leads.push(newLead);
            console.log(`${sid} [CRM] Lead saved: ${phone}`);
        }
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    }
    catch (err) {
        console.error(`${sid} [CRM] Failed to write lead:`, err.message);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────
// Tracks active follow-up timers per user so we never double-schedule
const followUpTimers = {};
function scheduleFollowUp(client, chatId, user) {
    const sid = `[SESSION ${SESSION_ID}]`;
    // Cancel any existing timer for this user first
    if (followUpTimers[chatId]) {
        clearTimeout(followUpTimers[chatId]);
        delete followUpTimers[chatId];
    }
    // Requirement: Cancel followup if user replies (handled by the caller of this function)
    // Requirement: Ensure no duplicate followups (handled by clearing existing timer)
    if (user.stage === 'closed' || user.status === 'DEAD' || user.humanEscalated)
        return;
    const msgSet = user.language === 'en' ? MSG_EN : MSG_HI;
    // Requirement: Scheduled followups (5 minutes, 1 hour, 24 hours)
    let delayMs = 0;
    if (user.followUpCount === 0)
        delayMs = 5 * 60 * 1000; // 5 mins
    else if (user.followUpCount === 1)
        delayMs = 60 * 60 * 1000; // 1 hour
    else if (user.followUpCount === 2)
        delayMs = 24 * 60 * 60 * 1000; // 24 hours
    else
        return; // Max 3 followups
    followUpTimers[chatId] = setTimeout(async () => {
        // Re-check state before sending
        if (userState[chatId]?.status === 'ACTIVE' &&
            userState[chatId]?.stage !== 'closed' &&
            !userState[chatId]?.humanEscalated) {
            try {
                user.followUpCount += 1;
                let followMsg = "";
                if (user.followUpCount === 1)
                    followMsg = msgSet.followUp1;
                else if (user.followUpCount === 2)
                    followMsg = msgSet.followUp2;
                else if (user.followUpCount === 3)
                    followMsg = msgSet.followUp3;
                if (followMsg) {
                    await client.sendText(chatId, followMsg);
                    console.log(`${sid} [FOLLOWUP] Scheduled followup sent to ${chatId} (count=${user.followUpCount})`);
                    saveState(); // Save updated followUpCount
                    // Schedule next one if applicable
                    if (user.followUpCount < 3) {
                        scheduleFollowUp(client, chatId, user);
                    }
                }
            }
            catch (err) {
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
function getSentLeads() {
    if (fs.existsSync(SENT_LEADS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(SENT_LEADS_FILE, 'utf8'));
        }
        catch (e) {
            return [];
        }
    }
    return [];
}
function saveSentLead(number) {
    const leads = getSentLeads();
    leads.push(number);
    fs.writeFileSync(SENT_LEADS_FILE, JSON.stringify(leads, null, 2));
}
async function runBulkOutreach(client) {
    console.log('[BULK] Starting outreach...');
    // STEP 5: SELF CHAT SHEET CONTROL
    let targetUrl = SHEET_URL;
    try {
        const hostNum = await client.getHostNumber();
        const selfId = `${hostNum}@c.us`;
        const messages = await client.loadAndGetAllMessagesInChat(selfId, true, false);
        const lastMsg = messages[messages.length - 1]?.body || '';
        if (lastMsg.startsWith('http')) {
            targetUrl = lastMsg.trim();
            console.log(`[BULK] Using dynamic URL from self-chat: ${targetUrl}`);
        }
    }
    catch (e) { }
    if (!targetUrl) {
        console.error('[BULK] No SHEET_URL found.');
        return;
    }
    const response = await axios.get(targetUrl).catch(() => ({ data: '' }));
    let leads = [];
    if (typeof response.data === 'string') {
        // Parser for CSV from /export?format=csv
        const lines = response.data.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length > 1) {
            const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
            leads = lines.slice(1).map((line) => {
                const values = line.split(',').map((v) => v.trim());
                const lead = {};
                headers.forEach((h, i) => {
                    if (h && values[i])
                        lead[h] = values[i];
                });
                return lead;
            });
        }
    }
    else if (Array.isArray(response.data)) {
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
            await client.sendText(chatId, body);
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
        }
        catch (err) {
            console.error(`[BULK] Failed for ${chatId}:`, err.message);
        }
    }
    await client.sendText(ADMIN_NUMBER, `Bulk outreach finished. Sent ${count} messages.`);
}
const WA_FAQ_CLUSTERS = [
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
function matchFaqCluster(body) {
    const text = body.toLowerCase();
    let bestMatch = null;
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
async function sendSafe(client, chatId, user, text) {
    const sid = `[SESSION ${SESSION_ID}]`;
    // STEP 1: STRICT NO REPEAT SYSTEM
    if (user.lastReplies.includes(text)) {
        const fallback = "Please wait, Digilinex team will contact you shortly.";
        if (user.lastSentMsg !== fallback) {
            await client.sendText(chatId, fallback);
            user.lastSentMsg = fallback;
        }
        user.humanEscalated = true;
        return;
    }
    // Requirement: Anti-Spam / Anti-Ban delay (3-10 seconds random)
    const waitTime = Math.floor(Math.random() * (10000 - 3000 + 1) + 3000);
    // console.log(`${sid} [DELAY] Waiting ${waitTime/1000}s before sending to ${chatId}`);
    await delay(waitTime);
    await client.sendText(chatId, text);
    console.log(`${sid} [REPLY] Sent to ${chatId}`);
    user.lastSentMsg = text;
    user.lastReplies.push(text);
    if (user.lastReplies.length > 5) {
        user.lastReplies.shift();
    }
    saveState();
}
async function askGpt(body, history = [], chatId) {
    const sid = `[SESSION ${SESSION_ID}]`;
    try {
        const pricing = getDynamicPricing(chatId);
        const isDetail = body.toLowerCase().includes('how it works') || body.toLowerCase().includes('kaise kaam karta hai');
        // Requirement: Fix null history crash
        const safeHistory = history || [];
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
                ...safeHistory.map(txt => ({ role: "assistant", content: txt })),
                { role: "user", content: body }
            ],
            max_tokens: isDetail ? 400 : 80,
            temperature: 0.5
        });
        let reply = response.choices[0].message.content || "";
        return reply;
    }
    catch (err) {
        console.error(`${sid} [GPT] Error:`, err.message);
        return "Please wait, Digilinex team will contact you shortly.";
    }
}
async function handleFAQOrFallback(client, chatId, user, body, fallbackAction) {
    if (user.humanEscalated)
        return;
    const clusterMatch = matchFaqCluster(body);
    user.deepQuestionsCount += 1;
    // STEP 6: HUMAN ESCALATION Threshold from 15 to 8
    if (user.deepQuestionsCount > 8) {
        user.humanEscalated = true;
        await client.sendText(chatId, "Please wait, Digilinex team will contact you shortly.");
        return;
    }
    // STEP 3 & STEP 8: INTELLIGENT GPT FALLBACK
    if (!clusterMatch && !user.currentFAQFlowId) {
        const gptReply = await askGpt(body, user.lastReplies, chatId);
        if (gptReply.toLowerCase().includes('digilinex team')) {
            user.humanEscalated = true;
            await client.sendText(chatId, "Please wait, Digilinex team will contact you shortly.");
        }
        else {
            await sendSafe(client, chatId, user, gptReply);
        }
        return;
    }
    let activeCluster = null;
    if (clusterMatch) {
        if (user.currentFAQFlowId !== clusterMatch.id) {
            user.currentFAQFlowId = clusterMatch.id;
            user.currentFAQStep = 0;
        }
        activeCluster = clusterMatch;
    }
    else if (user.currentFAQFlowId) {
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
            }
            else if (user.stage === 'interested') {
                reply += isEn
                    ? "\n\nShall I start your setup today?"
                    : "\n\nKya main aaj hi aapka setup start karu?";
            }
            else if (user.stage === 'demo_sent' || user.stage === 'negotiating') {
                reply += isEn
                    ? "\n\nShall I start your setup today?"
                    : "\n\nKya main aaj hi aapka setup start karu?";
            }
            user.currentFAQFlowId = null;
        }
        await sendSafe(client, chatId, user, reply);
    }
    else {
        user.currentFAQFlowId = null;
        const gptReply = await askGpt(body, user.lastReplies, chatId);
        if (gptReply.toLowerCase().includes('digilinex team')) {
            user.humanEscalated = true;
            await client.sendText(chatId, "Please wait, Digilinex team will contact you shortly.");
        }
        else {
            await sendSafe(client, chatId, user, gptReply);
        }
    }
}
async function handleMessage(client, message) {
    const sid = `[SESSION ${SESSION_ID}]`;
    const chatId = message.from;
    const body = (message.body || '').trim();
    const name = message.sender?.pushname || message.sender?.name || "";
    const user = getUser(chatId);
    const { intent, confidence } = detectIntent(body);
    const msg = M(body);
    const currentIntent = intent;
    const stageBeforeReply = user.stage;
    user.messagesCount += 1;
    user.lastInteraction = Date.now();
    user.followUpCount = 0; // Requirement: Cancel/Restart followup ladder if user replies
    // Requirement: Use single codebase and proper lead storage
    saveLead(chatId, body, user, name);
    console.log(`\n${sid} [BOT] body     : "${body}"`);
    console.log(`${sid} [BOT] intent   : ${intent} (${confidence}%)`);
    console.log(`${sid} [BOT] stage    : ${user.stage}`);
    if (user.status === 'DEAD' || user.stage === 'closed' || user.stage === 'converted') {
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
            }
            else if (/\b(clinic|doctor|patient|appointment)\b/.test(textToScan)) {
                user.category = 'clinic';
                user.categoryDetectedFromHistory = true;
                detected = true;
            }
            else if (/\b(website|portfolio|e-commerce)\b/.test(textToScan)) {
                user.category = 'website';
                user.categoryDetectedFromHistory = true;
                detected = true;
            }
            else if (/\b(automation|automate|bot|chatbot)\b/.test(textToScan)) {
                user.category = 'automation';
                user.categoryDetectedFromHistory = true;
                detected = true;
            }
            if (!detected && user.stage === 'new') {
                const waitTime = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
                await delay(waitTime);
                // Requirement: greeting -> intro message
                if (currentIntent === 'greeting') {
                    await client.sendText(chatId, msg.intro);
                }
                else {
                    await client.sendText(chatId, msg.confirmCategory);
                }
                saveState();
                return;
            }
        }
        catch (e) {
            console.error(`${sid} [CONTEXT] Failed to read history:`, e.message);
        }
    }
    // Requirement: Stage Management (Update stage based on replies)
    if (/(^ha$|^yes$|^ok$)/i.test(body.toLowerCase())) {
        if (user.stage === 'confirm_start') {
            await client.sendText(chatId, msg.closed);
            user.stage = 'converted'; // Production mapping
            user.status = 'DEAD';
            console.log(`${sid} [STAGE] ${chatId} converted!`);
            saveLead(chatId, body, user, name);
            saveState();
            return;
        }
    }
    if (currentIntent === 'rejection') {
        await sendSafe(client, chatId, user, msg.rejected);
        user.stage = 'rejected';
        saveState();
        return;
    }
    if (currentIntent === 'pricing') {
        await sendSafe(client, chatId, user, msg.price);
        user.stage = 'interested';
        saveState();
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
                    if (shouldAddBoost)
                        text += "\n\n" + msg.trustBoost;
                    await sendSafe(client, chatId, user, text);
                    user.stage = 'interested';
                }
                else if (user.category === 'clinic') {
                    let text = msg.clinicInitial;
                    if (shouldAddBoost)
                        text += "\n\n" + msg.trustBoost;
                    await sendSafe(client, chatId, user, text);
                    user.stage = 'interested';
                }
                else if (user.category === 'website') {
                    let text = msg.websiteInitial;
                    if (shouldAddBoost)
                        text += "\n\n" + msg.trustBoost;
                    await sendSafe(client, chatId, user, text);
                    user.stage = 'interested';
                }
                else if (user.category === 'automation') {
                    let text = msg.automationInitial;
                    if (shouldAddBoost)
                        text += "\n\n" + msg.trustBoost;
                    await sendSafe(client, chatId, user, text);
                    user.stage = 'interested';
                }
                else {
                    // fallback
                    await sendSafe(client, chatId, user, msg.confirmCategory);
                }
                break;
            }
            case 'interested': {
                if (currentIntent === 'interest' || currentIntent === 'greeting') {
                    await sendSafe(client, chatId, user, msg.explanation);
                    user.stage = 'qualified';
                }
                else {
                    await sendSafe(client, chatId, user, msg.fallback);
                }
                break;
            }
            case 'qualified': {
                await sendSafe(client, chatId, user, msg.closePush);
                user.stage = 'confirm_start';
                break;
            }
            case 'confirm_start': {
                await sendSafe(client, chatId, user, msg.closePush);
                break;
            }
            default:
                user.stage = 'new';
                await sendSafe(client, chatId, user, msg.fallback);
        }
    });
    if (user.stage !== stageBeforeReply) {
        console.log(`${sid} [BOT] → stage: ${stageBeforeReply} → ${user.stage}`);
        saveLead(chatId, body, user, name);
    }
    saveState();
    scheduleFollowUp(client, chatId, user);
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
async function shutdown(signal) {
    const sid = `[SESSION ${SESSION_ID}]`;
    console.log(`\n${sid} [${signal}] Shutting down...`);
    if (globalClient) {
        try {
            await globalClient.kill();
            console.log(`${sid} [SHUTDOWN] WhatsApp client closed.`);
        }
        catch (e) {
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
    }
    else {
        process.exit(0);
    }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// For "death" library if used elsewhere, but we handle it via process signals
const ON_DEATH = (fn) => {
    process.on('exit', fn);
};
wa_automate_1.ev.on('qr.**', async (qrcode, sessionId) => {
    const buf = Buffer.from(qrcode.replace('data:image/png;base64,', ''), 'base64');
    const filename = path.join(SESSION_DIR, `qr_code.png`);
    fs.writeFileSync(filename, buf);
    console.log(`[QR ${sessionId}] Saved → ${filename} (scan with your phone)`);
});
wa_automate_1.ev.on('STARTUP.**', async (data, sessionId) => {
    if (data === 'SUCCESS')
        console.log(`[STARTUP] ${sessionId} ready ✅`);
});
async function start(client) {
    const sid = `[SESSION ${SESSION_ID}]`;
    console.log(`${sid} Client started, wait for readiness signal...`);
    // Enforce wait for session settling and storage
    console.log(`${sid} Hardening session (60s wait)...`);
    await delay(60000);
    let isValid = false;
    try {
        const isConn = await client.isConnected();
        const host = await client.getHostNumber();
        if (isConn && host) {
            isValid = true;
            console.log(`${sid} Session saved successfully. Host: ${host}`);
        }
    }
    catch (e) { }
    if (!isValid) {
        console.error(`${sid} Validation failed! Stuck detected, restarting...`);
        // Force a fresh start next time
        await client.kill();
        process.exit(1);
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
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[SESSION ${SESSION_ID}] Port ${assignedPort} in use, retrying...`);
            }
            else {
                console.error(`[SESSION ${SESSION_ID}] Server error:`, err.message);
            }
        });
    }
    catch (err) {
        console.error(`[SESSION ${SESSION_ID}] FAILED to start server:`, err.message);
    }
    client.onStateChanged(state => {
        console.log(`[STATE] ${state}`);
        if (state === 'CONFLICT' || state === 'UNLAUNCHED')
            client.forceRefocus();
    });
    console.log(`${sid} READY ✅`);
    // Auto Self Test
    try {
        const me = await client.getHostNumber();
        if (me) {
            await client.sendText(`${me}@c.us`, "System Ready ✅");
            console.log(`${sid} Self-test message sent to host.`);
        }
    }
    catch (e) {
        console.error(`${sid} Self-test failed:`, e.message);
    }
    // ATTACH LISTENERS ONLY AFTER READY
    console.log(`${sid} Attaching listeners...`);
    // Debug: log every message (in + out) without acting on it
    client.onAnyMessage((msg) => {
        console.log(`[ANY] from=${msg.from} fromMe=${msg.fromMe} type=${msg.type} body="${msg.body}"`);
    });
    // Force Simple Reply Test
    client.onMessage(async (message) => {
        if (message.body && message.body.toLowerCase() === "hi") {
            console.log(`[SESSION ${SESSION_ID}] Test message received: hi`);
            await client.sendText(message.from, "Working ✅");
            console.log(`[SESSION ${SESSION_ID}] Test reply sent`);
        }
    });
    // Sales funnel: only fires for incoming messages (fromMe === false)
    client.onMessage(async (message) => {
        try {
            // Hard guard — never process our own outgoing messages
            if (message.fromMe)
                return;
            console.log(`[SESSION ${SESSION_ID}] Incoming:`, message.body);
            // Only handle plain text messages in the funnel
            // Non-text types (image, audio, etc.) get a soft nudge
            if (message.type !== wa_automate_1.MessageTypes.TEXT) {
                await delay(3000);
                await client.sendText(message.from, M(message.body || '').nonText);
                return;
            }
            await handleMessage(client, message);
        }
        catch (err) {
            console.error(`[SESSION ${SESSION_ID}] Error in onMessage:`, err.message);
        }
    });
    // Command System for Admin
    client.onMessage(async (message) => {
        if (message.fromMe)
            return;
        if (message.from === ADMIN_NUMBER && message.body === 'START BULK') {
            await client.sendText(ADMIN_NUMBER, "Bulk outreach initiated...");
            runBulkOutreach(client);
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
                await client.forceRefocus().catch(() => { });
            }
        }
        catch (e) {
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
        while (Date.now() - startSync < 2000) { }
        fs.unlinkSync(LOCK_FILE);
    }
    catch (e) {
        // Process not running, stale lock
        fs.unlinkSync(LOCK_FILE);
    }
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());
process.on('exit', () => {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            fs.unlinkSync(LOCK_FILE);
        }
        catch (e) { }
    }
});
console.log(`[SESSION ${SESSION_ID}] Initializing browser...`);
console.log("Creating client...");
try {
    (0, wa_automate_1.create)({
        sessionId: SESSION_ID,
        multiDevice: true,
        useChrome: true,
        headless: false,
        blockCrashLogs: true,
        disableSpins: true,
        qrTimeout: 0,
        authTimeout: 60,
        sessionDataPath: SESSION_DIR,
        qrLogSkip: false,
        popup: true,
    })
        .then(client => {
        console.log(`[SESSION ${SESSION_ID}] Client initialized`);
        return start(client);
    })
        .catch(e => {
        console.error(`[SESSION ${SESSION_ID}] FAILED`, e.message);
        console.error("[FATAL ERROR]", e);
        if (fs.existsSync(LOCK_FILE))
            fs.unlinkSync(LOCK_FILE);
    });
}
catch (error) {
    console.error("[FATAL ERROR] Outside of promise:", error);
}
