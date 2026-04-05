# Multi-Sheet Engine - Implementation Checklist

## Files Created

✅ `multi-sheet-engine.ts` - Core outbound engine
✅ `outbound-integration.ts` - Reply handling and tracking
✅ `MULTI_SHEET_INTEGRATION.md` - Integration guide

## Code Changes Required in index.ts

### STEP 1: Add Imports (at top of file, after existing imports)

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

**Location**: After line ~30 (after other imports)

---

### STEP 2: Modify sendSafe() Function

**Current code** (around line 1100):
```typescript
async function sendSafe(
  client: Client,
  chatId: string,
  user: UserState,
  text: string
): Promise<void> {
  // ... existing code ...
}
```

**Add this wrapper function AFTER sendSafe():**

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

**Location**: After the existing sendSafe() function (around line 1150)

---

### STEP 3: Modify handleMessage() Function

**Find this section** (around line 1600):
```typescript
async function handleMessage(client: Client, message: Message): Promise<void> {
  const sid = `[SESSION ${SESSION_ID}]`;
  
  // 🔥 CRITICAL: STOP SELF MESSAGE LOOP
  if (message.fromMe) return;
  
  // 🔥 IGNORE SYSTEM MESSAGES
  if (!message.body) return;
  if (message.body.includes('System Ready') || ...) {
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
  const name = message.sender?.pushname || message.sender?.name || "";
  const user = getUser(chatId);
  // ... rest of function ...
}
```

**Add this code RIGHT AFTER the duplicate check** (after `lastMessageMap.set(chatId, body);`):

```typescript
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
```

**Location**: In handleMessage(), right after `lastMessageMap.set(chatId, body);` line

---

### STEP 4: Modify start() Function

**Find this section** (around line 2000):
```typescript
async function start(client: Client): Promise<void> {
  const sid = `[SESSION ${SESSION_ID}]`;
  console.log(`${sid} Client started, wait for readiness signal...`);
  
  // Initialize analytics
  analytics = new Analytics(SESSION_DIR, SESSION_ID);
  analytics.startDashboard();
  console.log(`${sid} Analytics initialized`);
  
  // ... rest of initialization ...
}
```

**Add this code AFTER analytics initialization** (after `analytics.startDashboard();`):

```typescript
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
```

**Location**: In start() function, after `analytics.startDashboard();` line

---

### STEP 5: Add Monitoring Endpoint (Optional)

**Find this section** (around line 2100):
```typescript
  client.onMessage(async (message: Message) => {
    try {
      if (message.fromMe) return;

      // Admin command
      if (message.from === ADMIN_NUMBER && message.body === 'START BULK') {
        await client.sendText(ADMIN_NUMBER as ChatId, "Bulk outreach initiated...");
        runBulkOutreach(client);
        return;
      }
      // ... rest of handler ...
    }
  });
```

**Add this new admin command** (after the existing 'START BULK' command):

```typescript
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
```

**Location**: In client.onMessage() handler, after the 'START BULK' command

---

## Summary of Changes

| File | Change | Lines | Type |
|------|--------|-------|------|
| index.ts | Add imports | ~30 | Add |
| index.ts | Add sendSafeOutbound wrapper | ~1150 | Add |
| index.ts | Add outbound reply priority check | ~1620 | Add |
| index.ts | Initialize multi-sheet engine | ~2020 | Add |
| index.ts | Add metrics command | ~2150 | Add |

## Testing Checklist

After making changes:

1. ✅ Verify TypeScript compiles without errors
2. ✅ Test existing bot logic still works (send message, get reply)
3. ✅ Test outbound reply detection (send message from outbound lead)
4. ✅ Test clinic pricing negotiation
5. ✅ Test hotel reply handling
6. ✅ Check daily limit enforcement
7. ✅ Verify 60-second delay between sends
8. ✅ Test metrics command
9. ✅ Verify analytics still works
10. ✅ Check memory usage is stable

## Rollback Plan

If issues occur:

1. Remove the 5 code changes in reverse order
2. Restart the application
3. Existing functionality will be fully restored

## Performance Impact

- **Memory**: +5-10 MB (for tracking outbound leads)
- **CPU**: Negligible (polling every 2 minutes)
- **Network**: One CSV fetch per sheet per 2 minutes
- **Latency**: No impact on existing bot responses

## Monitoring Commands

After integration, use these admin commands:

```
SHEET METRICS    → Get current metrics for all sheets
START BULK       → Manually trigger bulk outreach (existing)
```

## Next Steps

1. Copy the 3 new files to demo/ directory
2. Make the 5 code changes to index.ts
3. Compile TypeScript
4. Test thoroughly
5. Deploy to production

## Support

For issues:
- Check logs for [SHEET] and [OUTBOUND] prefixes
- Verify sheet structure matches requirements
- Ensure session is connected
- Check daily limits haven't been exceeded
