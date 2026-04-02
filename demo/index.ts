import { create, Client, ev, NotificationLanguage, Message, MessageTypes } from '../src/index';
import type { ChatId } from '../src/api/model/aliases';

const fs  = require('fs');
const ON_DEATH = fn => process.on('exit', fn);
let globalClient: Client;
const express = require('express');
const app = express();
app.use(express.json({ limit: '200mb' }));
const PORT = 8082;

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
  // Count ASCII word characters vs total characters
  const ascii = (text.match(/[a-zA-Z]/g) || []).length;
  return ascii / Math.max(text.length, 1) > 0.6;
}

function detectIntent(body: string): Intent {
  const t = body.toLowerCase().trim();

  if (/\b(hi|hello|hey|hii|helo|namaste)\b/.test(t))                         return 'greeting';
  if (/(aapne msg|kaun|who are you|kya chahiye|kaise mila)/.test(t))          return 'confusion';
  if (/\b(hotel|booking|rooms?|resort|lodge)\b/.test(t))                      return 'category_hotel';
  if (/\b(clinic|dentist|dental|doctor|patient|hospital)\b/.test(t))         return 'category_clinic';
  if (/(price|charge|cost|kitna|fees?|rate|paisa|rupee|\u20b9)/.test(t))      return 'pricing';
  if (/(^no$|nahi|nope|not interested|mat karo|band karo|stop)/.test(t))      return 'rejection';
  if (/(call|phone|baat karo|number do|contact karo)/.test(t))                return 'confirm';
  if (/\b(demo|show|example|sample|dikhao|dikha|dekhna)\b/.test(t))           return 'demo_request';
  if (/(details|info|batao|explain|samjhao|bataiye)/.test(t))                 return 'interest';
  if (/(^yes$|haan|ha$|interested|zaroor|bilkul|sure|ok$|okay|theek hai|start karo|karo)/.test(t)) return 'interest';
  if (/(confirm|deal|agree|send|bhejo|proceed)/.test(t))                      return 'confirm';

  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

// ── Per-language message sets (no emojis, no "automation") ──────────────────
const MSG_HI = {
  initial:          `Maine aapko contact kiya tha kyunki main businesses ko online se customers dilata hu.\n\nKya aap apne business ke liye aur bookings ya patients chahte ho?`,
  askCategory:      `Aapka business kaunsa hai?\n\nHotel / Booking\nClinic / Dentist`,
  demoHotel:        `Maine hotels ke liye ek system banaya hai jo online bookings increase karta hai.\n\nKya main aapko ek demo dikha sakta hu?`,
  demoClinic:       `Maine clinics ke liye ek system banaya hai jo patients increase karta hai.\n\nKya main aapko ek demo dikha sakta hu?`,
  demoLinkHotel:    `Ye ek sample demo hai:\nhttps://anjali-booking-system--cryptosourav23.replit.app/\n\nYe sirf ek example hai. Hum aapke business ke hisaab se custom website, SEO aur lead generation setup karte hain.`,
  demoLinkClinic:   `Ye ek sample demo hai:\nhttps://ayaan-wellness-care.netlify.app/\n\nYe sirf ek example hai. Hum aapke business ke hisaab se custom website, SEO aur lead generation setup karte hain.`,
  demoAlready:      `Demo link upar share kar diya hai. Koi sawaal ho to zarur puchhen.`,
  priceHotel:       `Standard price 10,000 rupaye hai (website, SEO aur lead generation).\nAgar aap abhi start karte ho to 8,000 me kar denge.`,
  priceClinic:      `Standard price 5,000 rupaye hai (website, SEO aur lead generation).\nAgar aap abhi start karte ho to 4,000 me kar denge.`,
  askConfirm:       `Kya main kaam shuru karu?`,
  closed:           `Theek hai. Digilinex team jaldi hi aapse contact karegi.`,
  rejected:         `Theek hai. Agar future me kabhi zarurat ho to zarur batayein.`,
  confusion:        `Main Digilinex se hu. Hum businesses ko online se customers dilate hain.\n\nKya aap interested hain?`,
  fallback:         `Please wait, Digilinex team will contact you shortly.`,
  closedFollowUp:   `Aapka kaam jaldi shuru hoga. Digilinex team contact karegi.`,
  nonText:          `Main sirf text messages samajh sakta hu. Kya aap apne business ke baare me bata sakte hain?`,
};

const MSG_EN = {
  initial:          `I reached out because I help businesses get more customers online.\n\nWould you like more bookings or patients for your business?`,
  askCategory:      `What type of business do you run?\n\nHotel / Booking\nClinic / Dentist`,
  demoHotel:        `I have built a system for hotels that increases online bookings.\n\nWould you like to see a demo?`,
  demoClinic:       `I have built a system for clinics that increases patient appointments.\n\nWould you like to see a demo?`,
  demoLinkHotel:    `Here is a sample demo:\nhttps://anjali-booking-system--cryptosourav23.replit.app/\n\nThis is just an example. We build a custom website, SEO and lead generation setup tailored to your business.`,
  demoLinkClinic:   `Here is a sample demo:\nhttps://ayaan-wellness-care.netlify.app/\n\nThis is just an example. We build a custom website, SEO and lead generation setup tailored to your business.`,
  demoAlready:      `I have already shared the demo link above. Feel free to ask if you have any questions.`,
  priceHotel:       `Standard price is 10,000 rupees (website, SEO and lead generation).\nIf you start now, we can do it for 8,000.`,
  priceClinic:      `Standard price is 5,000 rupees (website, SEO and lead generation).\nIf you start now, we can do it for 4,000.`,
  askConfirm:       `Shall I go ahead and start the work?`,
  closed:           `Noted. The Digilinex team will contact you shortly.`,
  rejected:         `Understood. Feel free to reach out whenever you need help.`,
  confusion:        `I am from Digilinex. We help businesses get more customers online.\n\nAre you interested?`,
  fallback:         `Please wait, Digilinex team will contact you shortly.`,
  closedFollowUp:   `Your project will begin soon. The Digilinex team will be in touch.`,
  nonText:          `I can only process text messages. Could you tell me about your business?`,
};

// Pick the right message set based on the user's language
function M(body: string): typeof MSG_EN {
  return isEnglish(body) ? MSG_EN : MSG_HI;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM — LEAD CAPTURE
// ─────────────────────────────────────────────────────────────────────────────

const LEADS_FILE = 'leads.json';

function saveLead(chatId: string, body: string, user: UserState): void {
  const lead = {
    number:   chatId,
    message:  body,
    stage:    user.stage,
    category: user.category,
    time:     new Date().toISOString(),
  };

  // Always log to terminal
  console.log('LEAD:', lead);

  // Append to leads.json safely
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
  stage: Stage,
  user: UserState
): void {
  // Cancel any existing timer for this user first
  if (followUpTimers[chatId]) {
    clearTimeout(followUpTimers[chatId]);
    delete followUpTimers[chatId];
  }

  let followUpMsg: string | null = null;
  let followUpDelay = 0;

  if (stage === 'asked_interest') {
    followUpMsg   = `Kya aap apne business ke liye aur customers chahte hain?`;
    followUpDelay = 2 * 60 * 1000;
  } else if (stage === 'demo_sent') {
    followUpMsg   = `Demo dekh liya? Kaisa laga?`;
    followUpDelay = 1 * 60 * 1000;
  } else if (stage === 'negotiating') {
    followUpMsg   = `Agar aap start karna chahte hain to bata dijiye.`;
    followUpDelay = 2 * 60 * 1000;
  }

  if (!followUpMsg) return;

  followUpTimers[chatId] = setTimeout(async () => {
    // Only send if stage hasn't progressed since scheduling
    if (userState[chatId]?.stage === stage) {
      try {
        await client.sendText(chatId as ChatId, followUpMsg);
        console.log(`[FOLLOWUP] Sent to ${chatId} (stage=${stage})`);
      } catch (err) {
        console.error(`[FOLLOWUP] Failed for ${chatId}:`, err);
      }
    }
    delete followUpTimers[chatId];
  }, followUpDelay);

  console.log(`[FOLLOWUP] Scheduled for ${chatId} in ${followUpDelay / 1000}s (stage=${stage})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

// Send text, but if it's identical to the last message sent, use altText instead
async function sendSafe(
  client: Client,
  chatId: string,
  user: UserState,
  text: string,
  altText?: string
): Promise<void> {
  const out = user.lastSentMsg === text ? (altText ?? M('').fallback) : text;
  await client.sendText(chatId as ChatId, out);
  user.lastSentMsg = out;
}

async function handleMessage(client: Client, message: Message): Promise<void> {
  const chatId = message.from;
  const body   = (message.body || '').trim();
  const user   = getUser(chatId);
  const intent = detectIntent(body);
  const msg    = M(body);

  saveLead(chatId, body, user);

  console.log(`\n[BOT] ──────────────────────────────────`);
  console.log(`[BOT] from     : ${chatId}`);
  console.log(`[BOT] body     : "${body}"`);
  console.log(`[BOT] intent   : ${intent}`);
  console.log(`[BOT] stage    : ${user.stage}`);
  console.log(`[BOT] category : ${user.category}`);

  const stageBeforeReply = user.stage;

  await delay(3000);

  // ── REJECTION: always handle regardless of stage ─────────────────────────
  if (intent === 'rejection') {
    await sendSafe(client, chatId, user, msg.rejected);
    user.stage = 'rejected';
    scheduleFollowUp(client, chatId, user.stage, user);
    return;
  }

  // ── STAGE MACHINE ────────────────────────────────────────────────────────
  switch (user.stage) {

    case 'new': {
      const out = intent === 'confusion' ? msg.confusion : msg.initial;
      await sendSafe(client, chatId, user, out);
      user.stage = 'asked_interest';
      break;
    }

    case 'asked_interest': {
      if (intent === 'confusion' || intent === 'greeting') {
        await sendSafe(client, chatId, user, msg.confusion);
        break;
      }
      if (intent === 'category_hotel') {
        user.category = 'hotel';
        await sendSafe(client, chatId, user, msg.demoHotel);
        user.stage = 'interested';
        break;
      }
      if (intent === 'category_clinic') {
        user.category = 'clinic';
        await sendSafe(client, chatId, user, msg.demoClinic);
        user.stage = 'interested';
        break;
      }
      if (intent === 'interest') {
        await sendSafe(client, chatId, user, msg.askCategory);
        user.stage = 'interested';
        break;
      }
      await sendSafe(client, chatId, user, msg.fallback);
      break;
    }

    case 'interested': {
      if (intent === 'category_hotel' || (user.category === 'unknown' && body.toLowerCase().includes('hotel'))) {
        user.category = 'hotel';
        await sendSafe(client, chatId, user, msg.demoHotel);
        break;
      }
      if (intent === 'category_clinic' || (user.category === 'unknown' && body.toLowerCase().includes('clinic'))) {
        user.category = 'clinic';
        await sendSafe(client, chatId, user, msg.demoClinic);
        break;
      }
      if (intent === 'demo_request' || intent === 'interest' || intent === 'confirm') {
        const demoMsg = user.category === 'hotel' ? msg.demoLinkHotel : msg.demoLinkClinic;
        await sendSafe(client, chatId, user, demoMsg, msg.demoAlready);
        user.stage = 'demo_sent';
        break;
      }
      if (intent === 'pricing') {
        const priceMsg = user.category === 'hotel' ? msg.priceHotel : msg.priceClinic;
        await sendSafe(client, chatId, user, priceMsg);
        user.stage = 'negotiating';
        break;
      }
      await sendSafe(client, chatId, user, msg.fallback);
      break;
    }

    case 'demo_sent': {
      if (intent === 'demo_request') {
        await sendSafe(client, chatId, user, msg.demoAlready);
        break;
      }
      if (intent === 'pricing' || intent === 'interest' || intent === 'confirm') {
        const priceMsg = user.category === 'hotel' ? msg.priceHotel : msg.priceClinic;
        await sendSafe(client, chatId, user, priceMsg);
        user.stage = 'negotiating';
        break;
      }
      const nudge = isEnglish(body)
        ? `Did you check the demo? Feel free to ask any questions.\n\nWould you like to know the pricing?`
        : `Demo dekh liya? Koi sawaal ho to puchh sakte hain.\n\nPrice jaanna chahte hain?`;
      await sendSafe(client, chatId, user, nudge);
      break;
    }

    case 'negotiating': {
      if (intent === 'pricing') {
        const priceMsg = user.category === 'hotel' ? msg.priceHotel : msg.priceClinic;
        await sendSafe(client, chatId, user, priceMsg);
        break;
      }
      await sendSafe(client, chatId, user, msg.askConfirm);
      user.stage = 'confirm_start';
      break;
    }

    case 'confirm_start': {
      if (intent === 'interest' || intent === 'confirm') {
        await sendSafe(client, chatId, user, msg.closed);
        user.stage = 'closed';
        break;
      }
      await sendSafe(client, chatId, user, msg.askConfirm);
      break;
    }

    case 'closed': {
      await sendSafe(client, chatId, user, msg.closedFollowUp);
      break;
    }

    case 'rejected': {
      if (intent === 'interest' || intent === 'greeting') {
        user.stage = 'new';
        await sendSafe(client, chatId, user, msg.initial);
      } else {
        await sendSafe(client, chatId, user, msg.rejected);
      }
      break;
    }

    default: {
      await sendSafe(client, chatId, user, msg.initial);
      user.stage = 'asked_interest';
    }
  }

  console.log(`[BOT] → stage: ${stageBeforeReply} → ${user.stage}`);

  if (user.stage !== stageBeforeReply) {
    scheduleFollowUp(client, chatId, user.stage, user);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

ON_DEATH(async () => {
  console.log('[EXIT] Killing session...');
  if (globalClient) await globalClient.kill();
});

ev.on('qr.**', async (qrcode, sessionId) => {
  const buf      = Buffer.from(qrcode.replace('data:image/png;base64,', ''), 'base64');
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

  client.onAddedToGroup(chat  => console.log(`[GROUP] Added to: ${chat.id}`));
  client.onIncomingCall(call  => console.log(`[CALL]  Incoming:`, call));
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
