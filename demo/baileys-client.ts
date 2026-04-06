import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

const logger = pino({ level: 'silent' });

export interface BaileysClient {
  sock: WASocket;
  isConnected: boolean | (() => boolean);
  sendMessage: (phone: string, message: string) => Promise<void>;
  getHostNumber: () => Promise<string>;
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
    if (m.messages[0]?.message?.conversation) {
      console.log('[BAILEYS] Message received:', m.messages[0].message.conversation);
    }
  });

  const client = {
    sock,
    get isConnected() {
      return isConnected;
    },
    sendMessage: async (phone: string, message: string) => {
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      try {
        await sock.sendMessage(jid, { text: message });
        console.log('[BAILEYS] Message sent to', phone);
      } catch (err: any) {
        console.error('[BAILEYS] Failed to send to', phone, ':', err.message);
        throw err;
      }
    },
    getHostNumber: async () => {
      return sock.user?.id?.split(':')[0] || '';
    }
  };

  return client;
}
