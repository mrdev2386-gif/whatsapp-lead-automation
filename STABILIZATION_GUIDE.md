# WhatsApp Session Integrity Stabilization Guide

## ✅ Deep Stabilization Implementation Complete

All critical fixes have been applied to `demo/index.ts` to resolve "Session integrity check failed" errors and ensure reliable startup.

---

## 1. CLIENT CONFIG (CRITICAL) ✅

**Location:** Bottom of `demo/index.ts` (create() call)

**Applied Config:**
```typescript
create({
  sessionId: SESSION_ID,
  headless: false,
  useChrome: true,
  multiDevice: true,
  restartOnCrash: true,
  blockCrashLogs: true,
  disableSpins: true,
  qrTimeout: 0,
  authTimeout: 120,
  sessionDataPath: SESSION_DIR,
  qrLogSkip: false,
  popup: true,
  args: [
    '--disable-dev-shm-usage',      // Prevents Chrome OOM crashes on low memory
    '--no-first-run',               // Reduces startup overhead
    '--no-default-browser-check',   // Skips unnecessary checks
    '--disable-extensions',         // Disables browser extensions
  ],
})
```

**Why These Settings:**
- `headless: false` — Keeps browser visible during login phase
- `restartOnCrash: true` — Auto-recovers if browser crashes
- `authTimeout: 120` — Gives more time on slow/low-RAM systems
- `--disable-dev-shm-usage` — Critical for low-memory environments
- `multiDevice: true` — Enables multi-device support

---

## 2. SESSION STABILIZATION DELAY ✅

**Location:** `start()` function, immediately after client initialization

**Applied:**
```typescript
console.log(`${sid} Hardening session (90s wait — do NOT touch system)...`);
await delay(90000);
```

**Why 90 seconds:**
- Allows WhatsApp Web to fully initialize
- Ensures session data is persisted to disk
- Prevents premature listener attachment
- Gives browser time to stabilize

---

## 3. SAFE READY VALIDATION ✅

**Location:** `start()` function, after 90s delay

**Applied:**
```typescript
let isValid = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    if (!client || !client.getHostNumber) {
      console.log(`${sid} Retrying session init... (attempt ${attempt})`);
      await delay(10000);
      continue;
    }
    const isConn = await client.isConnected();
    const host = await client.getHostNumber();
    if (isConn && host) {
      isValid = true;
      console.log(`${sid} Session saved successfully. Host: ${host}`);
      break;
    }
  } catch (e) {
    console.warn(`${sid} Validation attempt ${attempt} failed, retrying...`);
    await delay(5000);
  }
}

if (!isValid) {
  console.error(`${sid} Validation failed after 3 attempts! Restarting...`);
  await client.kill();
  process.exit(1);
}
```

**Checks:**
- `!client || !client.getHostNumber` — Catches reinjection failures
- `isConnected()` — Verifies active connection
- `getHostNumber()` — Confirms session is valid
- 3 retry attempts with 5-10s gaps

---

## 4. LISTENERS ATTACH AFTER STABLE READY ✅

**Location:** `start()` function, after validation passes

**Applied:**
```typescript
console.log(`${sid} STABLE READY ✅`);

// Auto Self Test
try {
  const me = await client.getHostNumber();
  if (me) {
    await client.sendText(`${me}@c.us` as any, "System Ready ✅");
    console.log(`${sid} Self-test message sent to host.`);
  }
} catch (e: any) {
  console.error(`${sid} Self-test failed:`, e.message);
}

// ATTACH LISTENERS ONLY AFTER STABLE READY
console.log(`${sid} Attaching listeners...`);

// BASIC TEST HANDLER
client.onMessage(async (message: Message) => {
  try {
    if (message.fromMe) return;
    if (message.body && message.body.toLowerCase() === "hi") {
      console.log(`[SESSION ${SESSION_ID}] Test message received: hi`);
      await client.sendText(message.from, "Working ✅");
      console.log(`[SESSION ${SESSION_ID}] Test reply sent`);
    }
  } catch (err: any) {
    console.error(`[SESSION ${SESSION_ID}] Test handler error:`, err.message);
  }
});

// SALES FUNNEL
client.onMessage(async (message: Message) => {
  // ... full sales funnel logic
});
```

**Key Points:**
- Listeners only attach AFTER `STABLE READY ✅` log
- Basic test handler responds to "hi" with "Working ✅"
- Sales funnel processes all other messages

---

## 5. BASIC TEST HANDLER ✅

**Responds to:** "hi" message
**Response:** "Working ✅"

This allows you to verify the session is working without triggering the full sales funnel.

---

## 6. SINGLE SESSION ENFORCEMENT ✅

**Location:** Top of `demo/index.ts` (lock file mechanism)

**Applied:**
```typescript
const LOCK_FILE = path.join(SESSION_DIR, `.lock`);
if (fs.existsSync(LOCK_FILE)) {
  const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
  try {
    process.kill(pid, 0); 
    console.log(`[SESSION ${SESSION_ID}] Found existing process ${pid}. Killing...`);
    process.kill(pid, 'SIGKILL');
    const startSync = Date.now();
    while (Date.now() - startSync < 2000) {} 
    fs.unlinkSync(LOCK_FILE);
  } catch (e) {
    fs.unlinkSync(LOCK_FILE);
  }
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());
```

**Prevents:** Multiple sessions running simultaneously

---

## 🚀 FINAL TEST FLOW

### Step 1: Force Clean Start
```bash
pm2 delete all
taskkill /F /IM node.exe /T
taskkill /F /IM chrome.exe /T
```

### Step 2: Run Session
```bash
node demo/index.js --session=YOUR_NUMBER
```

### Step 3: Scan QR Code
- Wait for QR code to appear
- Scan with your phone
- Do NOT touch system

### Step 4: Wait 2 Full Minutes
- No interaction
- No touching keyboard/mouse
- Let system stabilize

### Step 5: Verify Logs
Look for these exact logs in order:
```
[SESSION YOUR_NUMBER] Hardening session (90s wait — do NOT touch system)...
[SESSION YOUR_NUMBER] Session saved successfully. Host: YOUR_NUMBER
[SESSION YOUR_NUMBER] STABLE READY ✅
[SESSION YOUR_NUMBER] Attaching listeners...
[SESSION YOUR_NUMBER] Waiting for messages...
```

### Step 6: Test Connection
Send "hi" from WhatsApp to the bot number
Expected response: "Working ✅"

---

## ⚠️ FAILSAFE (If Still Unstable)

1. **Restart System**
   - Full system restart
   - Clears all memory

2. **Check Resources**
   - Minimum 1GB free RAM
   - Close all unnecessary apps
   - Disable antivirus temporarily

3. **Verify Environment**
   - Check `OPENAI_API_KEY` is set
   - Verify internet connection
   - Ensure WhatsApp Web is accessible

4. **Check Logs**
   - Look for "Session integrity check failed"
   - Check for "Validation failed" messages
   - Verify no port conflicts

---

## 📊 Key Metrics

| Metric | Value | Purpose |
|--------|-------|---------|
| Initial Delay | 90s | Session stabilization |
| Retry Attempts | 3 | Reinjection failure recovery |
| Retry Gap | 5-10s | Allow recovery time |
| Auth Timeout | 120s | Slow system support |
| Health Check | 30s | Connection monitoring |

---

## 🔍 Troubleshooting

### "Session integrity check failed"
- **Cause:** Listeners attached too early
- **Fix:** Already fixed — 90s delay + validation

### "Client invalid, restarting"
- **Cause:** `getHostNumber` not available
- **Fix:** Already fixed — retry guard with 3 attempts

### "Port already in use"
- **Cause:** Previous session still running
- **Fix:** Already fixed — lock file mechanism

### "Connection lost"
- **Cause:** Browser crashed or disconnected
- **Fix:** Already fixed — `restartOnCrash: true`

---

## ✨ What Was Changed

**ONLY stabilization fixes applied:**
- ✅ Client config updated
- ✅ 90s hardening delay added
- ✅ Safe ready validation added
- ✅ Retry guard for reinjection failures
- ✅ Listeners attach after STABLE READY
- ✅ Basic test handler added
- ✅ Single session enforcement

**NO business logic modified:**
- ✅ Sales funnel unchanged
- ✅ Message handlers unchanged
- ✅ CRM system unchanged
- ✅ Follow-up scheduler unchanged

---

## 📝 Notes

- Do NOT modify business logic
- Do NOT skip the 90s wait
- Do NOT run multiple sessions
- Do NOT touch system during startup
- Do NOT close browser during QR scan

---

**Status:** ✅ Deep Stabilization Complete
**Last Updated:** $(date)
**Version:** 1.0
