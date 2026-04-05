# Multi-Sheet Engine - Ready-to-Use Code Snippets

Copy and paste these exact snippets into index.ts at the specified locations.

## SNIPPET 1: Add Imports (at top of file, after existing imports)

**Location**: After line ~30 (after `import { Analytics } from './analytics';`)

```typescript
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
```

---

## SNIPPET 2: Add sendSafeOutbound Wrapper

**Location**: After the existing `sendSafe()` function (around line 1150)

```typescript
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
```

---

## SNIPPET 3: Add Outbound Reply Priority Check

**Location**: In `handleMessage()` function, right after `lastMessageMap.set(chatId, body);` line

**Find this:**
```typescript
  lastMessageMap.set(chatId, body);
  const name = message.sender?.pushname || message.sender?.name || "";
```

**Replace with:**
```typescript
  lastMessageMap.set(chatId, body);

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIORITY: Handle outbound campaign replies BEFORE regular bot logic
  // ─────────────────────────────────────────────────────────────────────────────
  if (shouldPrioritizeOutboundReply(chatId)) {
    const outboundReply = processOutboundReply(chatId, body);
    if (outboundReply) {
      console.log(`${sid} [OUTBOUND] Handling reply from ${chatId}`);
      await sendSafe(client, chatId, user, outboundReply);
      saveState();
      return; // Exit early - don't process with regular bot logic
    }
  }

  const name = message.sender?.pushname || message.sender?.name || "";
```

---

## SNIPPET 4: Initialize Multi-Sheet Engine

**Location**: In `start()` function, after `analytics.startDashboard();` line

**Find this:**
```typescript
  analytics = new Analytics(SESSION_DIR, SESSION_ID);
  analytics.startDashboard();
  console.log(`${sid} Analytics initialized`);
  
  // Enforce wait for session settling...
```

**Replace with:**
```typescript
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
  
  // Enforce wait for session settling...
```

---

## SNIPPET 5: Add Metrics Command

**Location**: In `client.onMessage()` handler, after the 'START BULK' command

**Find this:**
```typescript
      // Admin command
      if (message.from === ADMIN_NUMBER && message.body === 'START BULK') {
        await client.sendText(ADMIN_NUMBER as ChatId, "Bulk outreach initiated...");
        runBulkOutreach(client);
        return;
      }

      // Test ping
```

**Replace with:**
```typescript
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
```

---

## Quick Reference

### Files to Create
1. `demo/multi-sheet-engine.ts` - Core engine
2. `demo/outbound-integration.ts` - Reply handling
3. `demo/MULTI_SHEET_INTEGRATION.md` - Integration guide
4. `demo/IMPLEMENTATION_CHECKLIST.md` - Checklist
5. `demo/MULTI_SHEET_SUMMARY.md` - Summary

### Code Changes to index.ts
1. Add imports (5 lines)
2. Add sendSafeOutbound wrapper (10 lines)
3. Add outbound reply check (15 lines)
4. Initialize engine (20 lines)
5. Add metrics command (10 lines)

**Total: 60 lines of changes**

### Testing Commands
```
SHEET METRICS    → Check metrics
START BULK       → Manual trigger
```

### Expected Logs
```
[SHEET] sheet1 Fetched 15 pending leads
[SHEET] sheet1 Start processing 15 leads
[SHEET] sheet1 Sending to 919876543210
[SHEET] sheet1 Sent to 919876543210 (1/100)
[OUTBOUND] Registered 919876543210@c.us from sheet1 (clinic)
[OUTBOUND] Reply from 919876543210@c.us (clinic): What's the price?
```

---

## Verification Checklist

After making all 5 changes:

- [ ] TypeScript compiles: `tsc`
- [ ] No import errors
- [ ] No type errors
- [ ] Application starts
- [ ] Existing bot logic works
- [ ] Outbound replies detected
- [ ] Metrics command works
- [ ] No performance issues

---

## Rollback

If needed, simply:
1. Remove the 5 code changes
2. Delete the 3 new files
3. Restart application

All existing functionality will be restored.
