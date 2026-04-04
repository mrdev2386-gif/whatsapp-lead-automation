# ✅ VERIFICATION CHECKLIST

## PRE-DEPLOYMENT CHECKLIST

### System Requirements
- [ ] Windows 10/11 or Linux/Mac
- [ ] Node.js 16+ installed
- [ ] Minimum 1GB free RAM
- [ ] Internet connection active
- [ ] WhatsApp account ready

### Environment Cleanup
- [ ] All Chrome instances closed: `taskkill /F /IM chrome.exe /T`
- [ ] All Node processes closed: `taskkill /F /IM node.exe /T`
- [ ] Old session folder deleted: `rd /s /q wa-YOUR_NUMBER`
- [ ] npm cache cleared: `npm cache clean --force`

### Dependency Installation
- [ ] Puppeteer@19 installed: `npm install puppeteer@19 --save-exact`
- [ ] All dependencies installed: `npm install`
- [ ] Puppeteer version verified: `npm list puppeteer` → shows 19.0.0

### Configuration Files
- [ ] `.env` file exists with OPENAI_API_KEY
- [ ] ADMIN_NUMBER set in `.env`
- [ ] SHEET_URL set in `.env` (if using bulk)
- [ ] SESSION_ID set or will use CLI arg

### Code Changes Verified
- [ ] Session delay is 120s (not 90s)
- [ ] Chrome flags include `--disable-web-security`
- [ ] Chrome flags include `--disable-features=IsolateOrigins,site-per-process`
- [ ] puppeteer@19.0.0 in package.json dependencies
- [ ] puppeteer@19.0.0 in package.json overrides

---

## STARTUP VERIFICATION

### Step 1: Launch
```bash
node demo/index.js --session=YOUR_NUMBER
```
- [ ] Script starts without errors
- [ ] "[BOOT] Script started" appears
- [ ] "[BOOT] Modules loaded successfully" appears

### Step 2: Browser Initialization
- [ ] "[SESSION] Initializing browser..." appears
- [ ] "Creating client..." appears
- [ ] "[SESSION] Client initialized" appears

### Step 3: Stabilization Wait
- [ ] "[SESSION] Hardening session (120s wait — do NOT touch system)..." appears
- [ ] **WAIT 2 FULL MINUTES** — Do NOT touch keyboard/mouse
- [ ] No errors during wait period

### Step 4: Validation
- [ ] "[SESSION] Session saved successfully. Host: YOUR_NUMBER" appears
- [ ] "[SESSION] STABLE READY ✅" appears
- [ ] "[SESSION] Attaching listeners..." appears
- [ ] "[SESSION] Waiting for messages..." appears

### Step 5: QR Code
- [ ] QR code appears in terminal
- [ ] QR code saved to `wa-YOUR_NUMBER/qr_code.png`
- [ ] Scan QR with WhatsApp phone

### Step 6: Connection
- [ ] WhatsApp shows "Connected" status
- [ ] No "Session integrity check failed" errors
- [ ] No "Connection lost" errors

---

## FUNCTIONAL VERIFICATION

### Test 1: Basic Message
- [ ] Send "hi" from WhatsApp
- [ ] Bot responds with "Working ✅"
- [ ] Response appears in logs

### Test 2: Sales Funnel
- [ ] Send "hello" from WhatsApp
- [ ] Bot responds with intro message
- [ ] Message matches language (English/Hindi)

### Test 3: FAQ System
- [ ] Send "what services" from WhatsApp
- [ ] Bot responds with services flow
- [ ] Multi-line response works correctly

### Test 4: Pricing Query
- [ ] Send "price" from WhatsApp
- [ ] Bot responds with pricing message
- [ ] Dynamic pricing applied correctly

### Test 5: Rejection Handling
- [ ] Send "no" from WhatsApp
- [ ] Bot responds with rejection message
- [ ] User stage updates to "rejected"

---

## PERFORMANCE VERIFICATION

### Startup Time
- [ ] Startup completes in ~3 minutes
- [ ] 120s stabilization wait observed
- [ ] No timeout errors

### Message Response
- [ ] Messages processed within 5 seconds
- [ ] No delays or hangs
- [ ] Logs show proper sequencing

### Memory Usage
- [ ] Chrome process uses <500MB RAM
- [ ] Node process uses <200MB RAM
- [ ] No memory leaks observed

### CPU Usage
- [ ] CPU usage normal during idle
- [ ] CPU spikes only during message processing
- [ ] No sustained high CPU usage

---

## ERROR HANDLING VERIFICATION

### Connection Loss
- [ ] Health check runs every 30s
- [ ] Auto-reconnect works if connection lost
- [ ] No "Session integrity check failed" errors

### Browser Crash
- [ ] `restartOnCrash: true` enables recovery
- [ ] Browser restarts automatically
- [ ] Session resumes without manual intervention

### Invalid Messages
- [ ] Non-text messages handled gracefully
- [ ] Images/audio get soft nudge response
- [ ] No crashes on invalid input

---

## LOGS VERIFICATION

### Expected Log Patterns
- [ ] "[SESSION X] [CRM] Lead saved: PHONE_NUMBER"
- [ ] "[SESSION X] [REPLY] Sent to CHAT_ID"
- [ ] "[SESSION X] [FOLLOWUP] Followup scheduled for CHAT_ID"
- [ ] "[SESSION X] [BOT] body: MESSAGE_TEXT"
- [ ] "[SESSION X] [BOT] intent: INTENT_TYPE (CONFIDENCE%)"

### No Error Logs
- [ ] No "Session integrity check failed"
- [ ] No "Connection lost" (unless intentional)
- [ ] No "Chrome crashed" (unless system issue)
- [ ] No "CORS error" (should be fixed)
- [ ] No "Puppeteer version mismatch"

---

## DEPLOYMENT READINESS

### Code Quality
- [ ] No console errors
- [ ] No console warnings (except expected)
- [ ] All imports resolve correctly
- [ ] TypeScript compiles without errors

### Dependencies
- [ ] All npm packages installed
- [ ] No missing dependencies
- [ ] No version conflicts
- [ ] puppeteer@19.0.0 confirmed

### Configuration
- [ ] All environment variables set
- [ ] Session folder created
- [ ] Lock file mechanism working
- [ ] State file persisting correctly

### Business Logic
- [ ] Sales funnel working
- [ ] FAQ system responding
- [ ] CRM saving leads
- [ ] Follow-ups scheduling
- [ ] Bulk outreach ready (if configured)

---

## POST-DEPLOYMENT CHECKLIST

### First 24 Hours
- [ ] No crashes observed
- [ ] Messages processed correctly
- [ ] Leads saved to CRM
- [ ] Follow-ups scheduled
- [ ] No "Session integrity check failed" errors

### First Week
- [ ] Consistent uptime
- [ ] All features working
- [ ] No memory leaks
- [ ] Performance stable
- [ ] Leads converting

### Ongoing Monitoring
- [ ] Daily log review
- [ ] Weekly performance check
- [ ] Monthly lead analysis
- [ ] Quarterly system audit

---

## ROLLBACK PLAN (If Needed)

If issues persist:

1. [ ] Stop current session: `Ctrl+C`
2. [ ] Revert code: `git checkout demo/index.ts package.json`
3. [ ] Reinstall: `npm install`
4. [ ] Delete session: `rd /s /q wa-YOUR_NUMBER`
5. [ ] Restart: `node demo/index.js --session=YOUR_NUMBER`

---

## SIGN-OFF

- [ ] All pre-deployment checks passed
- [ ] All startup verification passed
- [ ] All functional tests passed
- [ ] All performance checks passed
- [ ] All error handling verified
- [ ] Logs reviewed and clean
- [ ] Ready for production deployment

**Deployment Date:** _______________
**Verified By:** _______________
**Status:** ✅ READY FOR PRODUCTION

---

**Note:** Keep this checklist for future reference and audits.
