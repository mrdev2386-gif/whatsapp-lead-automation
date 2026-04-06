# 🚀 Quick Start - Running the System

## ✅ Compilation Successful

The TypeScript has been compiled successfully to `demo/dist/`.

---

## 🏃 Running the System

### Option 1: Run Compiled JavaScript (Recommended)
```bash
cd c:\Users\dell\wa-automate-nodejs
node demo/dist/index.js --session=9155604591
```

### Option 2: Run with TypeScript (Development)
```bash
cd c:\Users\dell\wa-automate-nodejs
npm run dev -- --session=9155604591
```

### Option 3: Build and Run
```bash
cd c:\Users\dell\wa-automate-nodejs
npm run build
node demo/dist/index.js --session=9155604591
```

---

## 📱 Authentication Flow

When you run the system, you'll see:

```
[SESSION 9155604591] [BROWSER] Initializing Chrome...
[SESSION 9155604591] [AUTH] Scan QR and wait 60 seconds
```

### Steps:
1. **Wait for QR Code** - The system will display a QR code in the terminal
2. **Scan with Phone** - Open WhatsApp on your phone and scan the QR code
3. **Wait for Connection** - The system will authenticate (takes 30-120 seconds)
4. **System Ready** - Once authenticated, you'll see: `[STABILITY] STABLE READY ✅`

---

## 🔍 What to Expect

### During Startup
```
[BOOT] Script started
[BOOT] Modules loaded successfully
[SESSION 9155604591] State loaded (2 users)
[SESSION 9155604591] [BROWSER] Initializing Chrome...
[SESSION 9155604591] [AUTH] Scan QR and wait 60 seconds
```

### During Authentication
```
- Browser launched: 4249ms
- Page loaded in 4109ms: 200
- Authenticating...
- Authentication successful
```

### When Ready
```
[SESSION 9155604591] [STABILITY] STABLE READY ✅
[SESSION 9155604591] Waiting for messages...
[SHEET] Auto-polling engine started (2-minute interval)
```

---

## ✅ Verification

### Check System is Running
```bash
# In another terminal:
ps aux | findstr "node.*index.js"
```

### Check Logs
```bash
# Watch logs in real-time:
tail -f wa-9155604591/logs.txt

# Or on Windows:
Get-Content wa-9155604591/logs.txt -Wait
```

### Check Google Sheets API
```bash
# Look for API calls:
grep "SHEETS-API" wa-9155604591/logs.txt

# Should see:
# [SHEETS-API] Fetching: {spreadsheetId}
# [SHEET] Headers: name, phone, message, status
```

---

## 🛠️ Troubleshooting

### Issue: "App Offline"
**Cause**: WhatsApp connection lost or QR code not scanned
**Solution**: 
1. Make sure your phone has internet
2. Scan the QR code when prompted
3. Wait for authentication to complete

### Issue: "Authentication timed out"
**Cause**: QR code not scanned within 120 seconds
**Solution**:
1. Restart the system
2. Scan QR code immediately when it appears
3. Keep phone connected to internet

### Issue: "Cannot find module"
**Cause**: TypeScript not compiled
**Solution**:
```bash
npx tsc
node demo/dist/index.js --session=9155604591
```

### Issue: Port already in use
**Cause**: Another instance running on same port
**Solution**:
```bash
# Kill existing process
taskkill /F /IM node.exe

# Or use different session
node demo/dist/index.js --session=9508310294
```

---

## 📊 Multi-Session Support

Run multiple sessions simultaneously:

```bash
# Terminal 1 - Session 1
node demo/dist/index.js --session=9155604591

# Terminal 2 - Session 2
node demo/dist/index.js --session=9508310294

# Terminal 3 - Session 3
node demo/dist/index.js --session=6299261088
```

Each session:
- Uses separate WhatsApp account
- Has independent polling
- Stores data in `wa-{SESSION_ID}/` folder
- Runs on different port (8000 + last 3 digits of session ID)

---

## 📈 Monitoring

### Real-time Metrics
```bash
# Send to admin number:
SHEET METRICS

# Response:
[SHEET METRICS]
sheet1: 45/100 sent, 2 failed
sheet2: 32/100 sent, 1 failed
sheet3: 28/100 sent, 0 failed
```

### Log Patterns to Watch
```
[SHEETS-API]     - Google Sheets API calls
[SHEET]          - Sheet processing
[SEND]           - Message sending
[ERROR]          - Errors
[MEMORY]         - Memory usage
[STABILITY]      - System status
```

---

## 🔐 Security Notes

### API Key
- Stored in `.env` (not in code)
- Never logged or exposed
- Keep `.env` file secure

### Session Data
- Stored in `wa-{SESSION_ID}/` folder
- Contains WhatsApp session info
- Keep folder secure

### Logs
- Stored in `wa-{SESSION_ID}/logs.txt`
- Contains system activity
- Review for errors

---

## 📋 File Locations

```
c:\Users\dell\wa-automate-nodejs\
├── demo/
│   ├── dist/
│   │   ├── index.js          ← Run this
│   │   ├── google-sheets-api.js
│   │   ├── multi-sheet-engine.js
│   │   └── ...
│   ├── index.ts
│   ├── google-sheets-api.ts
│   └── multi-sheet-engine.ts
├── wa-9155604591/            ← Session 1 data
│   ├── logs.txt
│   ├── state.json
│   └── ...
├── wa-9508310294/            ← Session 2 data
├── wa-6299261088/            ← Session 3 data
├── .env                       ← Configuration
└── tsconfig.json
```

---

## 🎯 Next Steps

1. **Run the system**
   ```bash
   node demo/dist/index.js --session=9155604591
   ```

2. **Scan QR code** when prompted

3. **Wait for authentication** (30-120 seconds)

4. **Check logs** for "STABLE READY ✅"

5. **Monitor** with `SHEET METRICS` command

6. **Add test data** to Google Sheets

7. **Verify** messages are sent and status updated

---

## 📞 Support

### Documentation
- **Quick Reference**: GOOGLE_SHEETS_API_QUICK_REF.md
- **Full Guide**: GOOGLE_SHEETS_API_INTEGRATION.md
- **Technical**: GOOGLE_SHEETS_API_TECHNICAL_REF.md

### Logs
- Check `wa-{SESSION_ID}/logs.txt` for errors
- Look for `[ERROR]` or `[SHEETS-API]` patterns
- Review error messages for solutions

### Common Commands
```bash
# Compile TypeScript
npx tsc

# Run system
node demo/dist/index.js --session=9155604591

# Check logs
tail -f wa-9155604591/logs.txt

# Kill process
taskkill /F /IM node.exe
```

---

**Status**: ✅ READY TO RUN

**Next**: Execute `node demo/dist/index.js --session=9155604591` and scan the QR code!
