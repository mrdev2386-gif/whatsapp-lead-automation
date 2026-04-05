# Low-RAM Stabilization Guide - Session Integrity Fix

## CRITICAL: Do NOT assume anything. Follow EXACTLY.

---

## STEP 1: DELETE OLD SESSION (MANDATORY)

Run cleanup script:
```bash
cleanup.bat
```

Or manually:
```cmd
rd /s /q wa-YOUR_SESSION_ID
rd /s /q node_modules\.cache
taskkill /F /IM chrome.exe /T
taskkill /F /IM node.exe /T
```

---

## STEP 2: VERIFY ULTRA-LIGHT CONFIG

Check `demo/index.ts` has these settings:

```typescript
create({
  sessionId: SESSION_ID,
  headless: true,              // ✅ MUST be true
  useChrome: true,
  multiDevice: true,
  restartOnCrash: true,
  authTimeout: 60,             // ✅ REDUCED from 120
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote'
  ]
})
```

---

## STEP 3: REDUCE STABILIZATION DELAY

Check `start()` function has:
```typescript
await delay(60000);  // ✅ REDUCED from 120000
```

---

## STEP 4: CLOSE ALL BACKGROUND APPS

- Close Chrome
- Close VS Code
- Close all browsers
- Close Slack, Discord, etc.

---

## STEP 5: ENABLE HIGH PERFORMANCE MODE

```cmd
powercfg -setactive SCHEME_MIN
```

---

## STEP 6: RUN THE BOT

```bash
node demo/index.js --session=YOUR_PHONE_NUMBER
```

Example:
```bash
node demo/index.js --session=918073539824
```

---

## STEP 7: QR CODE SCAN (VERY IMPORTANT)

1. QR code will appear in terminal
2. **DO NOT touch mouse/keyboard**
3. **DO NOT switch windows**
4. Scan with your phone
5. **WAIT 60-90 seconds** for full initialization
6. Do NOT close terminal

---

## STEP 8: VALIDATE SUCCESS

Look for:
```
[SESSION YOUR_NUMBER] STABLE READY ✅
Waiting for messages...
```

If you see:
```
Session integrity check failed
```

**RESTART PC** and repeat from STEP 1.

---

## STEP 9: FAILSAFE (If still failing)

1. Restart PC completely
2. Ensure stable internet connection
3. Run only ONE session at a time
4. Check available RAM: `tasklist /v`
5. If RAM < 2GB, close more apps

---

## CRITICAL RULES

❌ Do NOT use `headless: false`
❌ Do NOT run multiple sessions
❌ Do NOT increase delay beyond 60s
❌ Do NOT touch system during QR scan
❌ Do NOT use `--disable-web-security` (removed)

✅ Do use `--no-sandbox`
✅ Do use `--disable-gpu`
✅ Do use `--single-process`
✅ Do wait full 60s after QR scan
✅ Do close all background apps

---

## TROUBLESHOOTING

### "Session integrity check failed" loop
→ Delete session folder, restart PC, run cleanup.bat

### "Port already in use"
→ Kill all node processes: `taskkill /F /IM node.exe /T`

### "Chrome crashed"
→ Reduce other apps, increase available RAM

### "QR code not appearing"
→ Check terminal output, ensure headless: true

### "Connection lost after startup"
→ Check internet, restart bot, verify no firewall blocks

---

## PERFORMANCE TARGETS

- RAM usage: < 500MB
- Startup time: 60-90 seconds
- Session stability: 24+ hours
- Message response: < 5 seconds

---

## NEXT STEPS

Once STABLE READY ✅ appears:

1. Send "hi" to test
2. Bot should reply "Working ✅"
3. Send "START BULK" from admin number to test bulk outreach
4. Monitor logs for any errors

---

**Last Updated:** 2024
**Version:** Ultra-Light v1.0
