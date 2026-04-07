import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import OpenAI from 'openai';

const logger = pino({ level: 'silent' });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

// Debug: Verify OpenAI API key is loaded
console.log('[DEBUG] OPENAI KEY:', process.env.OPENAI_API_KEY ? 'LOADED ✅' : 'MISSING ❌');
const contactedUsers = new Set<string>();

// Track follow-up timers to prevent duplicates
const followUpTimers = new Map<string, NodeJS.Timeout>();

const systemPrompt = `You are a highly skilled WhatsApp sales expert who helps clinic owners get more patients.

You are NOT a bot. You talk like a real human sales person.

━━━━━━━━━━━━━━━━━━━━━━━
🎯 MAIN GOAL:
Convert every conversation into a paid client (₹4000–₹7000 deal).

━━━━━━━━━━━━━━━━━━━━━━━
💼 WHAT YOU SELL:

You help clinics grow by:

1. Creating a high-converting website that attracts patients
2. Setting up WhatsApp automation that handles all inquiries and follow-ups automatically

End result:
More patient inquiries → more bookings → more revenue

━━━━━━━━━━━━━━━━━━━━━━━
🧠 YOUR BEHAVIOR:

* Talk like a normal human (not robotic)
* Keep messages short (2–4 lines max)
* Use simple Hinglish / English mix
* Never send long paragraphs
* Ask questions to keep conversation going
* Be confident and slightly persuasive
* Focus on BENEFITS (more patients), not technical details

━━━━━━━━━━━━━━━━━━━━━━━
📈 SALES FLOW (IMPORTANT):

1. If user says "yes / interested":
   → Explain benefit simply
   → Move conversation forward

2. If user asks "how it works":
   → "We create a simple website + automate WhatsApp so every inquiry is handled automatically."

3. If user asks price:
   → "It usually comes between ₹4000–₹7000 depending on setup 🙂"

4. If user asks demo:
   → Send BOTH links:
   https://ayaan-wellness-care.netlify.app/
   https://suchitratental.netlify.app/

5. If user shows strong interest:
   → Close:
   "Should I set this up for your clinic this week?"

6. If user is confused:
   → Ask:
   "Are you currently getting enough patient inquiries?"

7. If user stops replying:
   → Re-engage naturally

━━━━━━━━━━━━━━━━━━━━━━━
💬 HANDLE ANY QUESTION:

You MUST handle ANY type of question:

* price
* guarantee
* trust
* time
* results
* technical
* random questions

Even if unsure:
→ answer confidently and naturally
→ keep conversation moving toward closing

━━━━━━━━━━━━━━━━━━━━━━━
💰 CONVERSION STYLE:

* Always bring conversation back to:
  → more patients
  → more inquiries
  → automation benefit

* Create urgency:
  → "this week"
  → "quick setup"
  → "most clinics start seeing results fast"

━━━━━━━━━━━━━━━━━━━━━━━
🧲 PSYCHOLOGY:

* Make user feel they are missing patients
* Show it's simple and affordable
* Make decision feel easy

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT:

* NEVER say you are AI
* NEVER sound robotic
* ALWAYS behave like real person
* ALWAYS keep messages short
* ALWAYS guide conversation toward closing

━━━━━━━━━━━━━━━━━━━━━━━
🎯 FINAL RULE:

Your job is NOT to answer perfectly.

Your job is to:
→ keep user engaged
→ build interest
→ CLOSE the deal

━━━━━━━━━━━━━━━━━━━━━━━
`;

async function generateAIReply(userMessage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.85,
      max_tokens: 200
    });

    return response.choices[0].message.content || 'Thanks for your message!';
  } catch (err: any) {
    console.error('[AI] Error generating reply:', err.message);
    return 'Thanks for your message! Let me get back to you shortly.';
  }
}

function scheduleFollowUp(from: string, sock: WASocket): void {
  // Clear existing timer if any
  if (followUpTimers.has(from)) {
    clearTimeout(followUpTimers.get(from));
  }

  // Schedule follow-up after 5-10 minutes
  const delayMs = (Math.floor(Math.random() * (10 - 5 + 1)) + 5) * 60 * 1000;
  
  const timer = setTimeout(async () => {
    try {
      await sock.sendMessage(from, {
        text: 'Just checking 🙂 are you interested in getting more patient inquiries for your clinic?'
      });
      console.log('[FOLLOWUP] Sent to', from);
      followUpTimers.delete(from);
    } catch (err: any) {
      console.error('[FOLLOWUP] Error:', err.message);
    }
  }, delayMs);

  followUpTimers.set(from, timer);
}

export function addContactedUser(jid: string): void {
  contactedUsers.add(jid);
  console.log('[AI] Tracked contacted user:', jid);
}

export function getContactedUsers(): Set<string> {
  return contactedUsers;
}

export interface BaileysClient {
  sock: WASocket;
  isConnected: boolean | (() => boolean);
  sendMessage: (phone: string, message: string) => Promise<void>;
  getHostNumber: () => Promise<string>;
  addContactedUser: (jid: string) => void;
}

export async function initBaileysClient(sessionId: string): Promise<BaileysClient> {
  // Sanitize sessionId to prevent path traversal
  const sanitizedSessionId = path.basename(sessionId).replace(/[^a-zA-Z0-9_-]/g, '');
  const authPath = path.join(process.cwd(), `auth_${sanitizedSessionId}`);
  
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: logger as any,
    browser: ['Ubuntu', 'Chrome', '120.0.0.0']
  });

  let isConnected = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[BAILEYS] QR Code generated - scan with WhatsApp');
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('[BAILEYS] Connection closed. Reconnecting:', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => initBaileysClient(sanitizedSessionId), 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      console.log('[BAILEYS] ✅ WhatsApp Connected');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      console.log('[AI] Message event triggered');
      const msg = m.messages[0];
      if (!msg.message) {
        console.log('[AI] No message content');
        return;
      }
      if (msg.key.fromMe) {
        console.log('[AI] Ignoring own message');
        return;
      }

      const from = msg.key.remoteJid || '';
      console.log('[AI] Raw JID:', from);
      const normalizedFrom = from.replace('@s.whatsapp.net', '@c.us');
      console.log('[AI] Normalized JID:', normalizedFrom);
      console.log('[AI] Contacted users:', Array.from(contactedUsers));
      
      // Only reply to contacted users
      if (!contactedUsers.has(normalizedFrom)) {
        console.log('[AI] Ignored:', normalizedFrom);
        return;
      }

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text.trim()) {
        console.log('[AI] Empty message text');
        return;
      }

      console.log('[AI] Message:', text);

      // Human-like delay (4-8 seconds)
      const delay = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
      console.log('[AI] Waiting', delay, 'seconds...');
      await new Promise(r => setTimeout(r, delay * 1000));

      // Generate AI reply
      console.log('[AI] Calling OpenAI...');
      const reply = await generateAIReply(text);
      console.log('[AI] Reply:', reply);
      
      // Send reply
      console.log('[AI] Sending reply to', normalizedFrom);
      await sock.sendMessage(normalizedFrom, { text: reply });
      console.log('[AI] ✓ Replied');

      // Schedule follow-up
      scheduleFollowUp(normalizedFrom, sock);
    } catch (err: any) {
      console.error('[AI] Error:', err.message);
      if (err.stack) console.error(err.stack);
    }
  });

  const client = {
    sock,
    get isConnected() {
      return isConnected;
    },
    sendMessage: async (phone: string, message: string) => {
      const jid = phone.includes('@') ? phone : `${phone}@c.us`;
      try {
        await sock.sendMessage(jid, { text: message });
        console.log('[BAILEYS] Message sent to', phone);
        // Track as contacted user for AI replies
        addContactedUser(jid);
      } catch (err: any) {
        console.error('[BAILEYS] Failed to send to', phone, ':', err.message);
        throw err;
      }
    },
    getHostNumber: async () => {
      return sock.user?.id?.split(':')[0] || '';
    },
    addContactedUser: (jid: string) => {
      addContactedUser(jid);
    }
  };

  return client;
}
