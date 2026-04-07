import * as dotenv from "dotenv";
dotenv.config();

console.log("[BOOT] Baileys WhatsApp Automation Started");

import * as fs from "fs";
import * as path from "path";
import { initBaileysClient } from "./baileys-client";
import { startAutoPolling } from "./multi-sheet-engine";
import { fixSheetStructure } from "./google-sheets-api";

const SESSION_ID = process.env.SESSION_ID || "9155604591";
const SESSION_DIR = path.join(process.cwd(), `wa-${SESSION_ID}`);

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

console.log(`[BOOT] Session: ${SESSION_ID}`);
console.log(`[BOOT] Session Dir: ${SESSION_DIR}`);

async function main() {
  try {
    console.log("[BOOT] Initializing Baileys client...");
    
    const client = await initBaileysClient(SESSION_ID);
    console.log("[BOOT] Client initialized");

    console.log("[BOOT] Waiting for connection...");
    
    let attempts = 0;
    const maxAttempts = 120; // Increased from 60 to 120 seconds
    while (!client.isConnected && attempts < maxAttempts) {
      if (attempts % 10 === 0 && attempts > 0) {
        console.log(`[BOOT] Still connecting... (${attempts}s elapsed)`);
      }
      await new Promise(res => setTimeout(res, 1000));
      attempts++;
    }

    if (!client.isConnected) {
      console.error(`[BOOT] Failed to connect after ${maxAttempts} seconds`);
      process.exit(1);
    }

    console.log("[BOOT] Connected to WhatsApp");

    // TEMPORARY: Fix sheet structure (remove after successful run)
    console.log("[BOOT] Fixing sheet structure...");
    await fixSheetStructure(
      '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
      'Leads_9155604591'
    );
    console.log("[BOOT] Sheet structure fix completed");

    console.log("[ENGINE] Starting sheet engine...");
    
    const clientMap = { [SESSION_ID]: client.sock };
    
    const sendSafeWrapper = async (
      sessionId: string,
      chatId: string,
      text: string
    ): Promise<boolean> => {
      try {
        await client.sendMessage(chatId, text);
        // Track as contacted user for AI replies
        client.addContactedUser(chatId);
        return true;
      } catch (err: any) {
        console.error(`[OUTBOUND] Send failed:`, err.message);
        return false;
      }
    };

    startAutoPolling(clientMap, sendSafeWrapper);
    console.log("[ENGINE] Multi-sheet outbound engine started");

    console.log("[BOOT] System Ready");
    console.log("[BOOT] Listening for messages...");

  } catch (error: any) {
    console.error("[BOOT] Fatal error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
