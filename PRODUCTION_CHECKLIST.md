# Production Verification Checklist

## ✅ Pre-Deployment Checklist

### 1. Dependencies
- [ ] Run `npm install` successfully
- [ ] All packages installed (check `node_modules/`)
- [ ] No peer dependency warnings

### 2. Configuration
- [ ] `.env` file created with `SESSION_ID`
- [ ] Google Sheets API key set in `google-sheets-api.ts`
- [ ] Sheet IDs and names correct in `multi-sheet-engine.ts`
- [ ] Column mappings verified (number, name, message, status)

### 3. File Structure
- [ ] `demo/index.ts` - Main entry point
- [ ] `demo/baileys-client.ts` - Baileys client
- [ ] `demo/multi-sheet-engine.ts` - Sheet automation
- [ ] `demo/google-sheets-api.ts` - Google Sheets API
- [ ] `demo/sheets-writeback.ts` - Status updates
- [ ] `demo/restart.js` - Restart wrapper

### 4. First Run Test
```bash
npm start
```
- [ ] QR code appears in terminal
- [ ] Scan QR with WhatsApp
- [ ] See "[BAILEYS] ✅ WhatsApp Connected"
- [ ] See "[ENGINE] Starting sheet engine..."
- [ ] No errors in console

### 5. Message Sending Test
- [ ] Add test lead to Google Sheet (pending status)
- [ ] Wait for next polling cycle (2 minutes)
- [ ] Verify message received on WhatsApp
- [ ] Verify status updated to "sent" in sheet

### 6. Error Handling
- [ ] Disconnect WhatsApp Web on phone
- [ ] Verify auto-reconnection in logs
- [ ] Reconnect WhatsApp Web
- [ ] Verify system resumes normally

### 7. Daily Limits
- [ ] Verify 100 message limit per sheet per day
- [ ] Check limit resets at 24-hour mark
- [ ] Verify "Daily limit reached" message in logs

### 8. Logging
- [ ] Logs contain proper prefixes ([BOOT], [BAILEYS], [SHEET], etc.)
- [ ] No sensitive data in logs
- [ ] Logs are readable and useful for debugging

### 9. Performance
- [ ] Memory usage stable (< 200MB)
- [ ] CPU usage low when idle
- [ ] No memory leaks after 24 hours
- [ ] Handles 100+ messages without issues

### 10. Security
- [ ] No credentials in code
- [ ] API keys in environment variables
- [ ] Session files not committed to git
- [ ] `.gitignore` includes auth_* and .env

---

## 🚀 Deployment Steps

### Step 1: Prepare Server
```bash
# Install Node.js 20+
node --version  # Should be v20.0.0 or higher

# Clone repository
git clone <repo-url>
cd wa-automate-nodejs

# Install dependencies
npm install --production
```

### Step 2: Configure Environment
```bash
# Create .env file
echo "SESSION_ID=9155604591" > .env

# Update API keys
nano demo/google-sheets-api.ts  # Set API_KEY
nano demo/multi-sheet-engine.ts # Set SHEET_CONFIGS
```

### Step 3: Initial QR Scan
```bash
# Run once to scan QR code
npm start

# After QR scan and connection, press Ctrl+C
# Session is now saved in auth_<SESSION_ID>/
```

### Step 4: Start Service
```bash
# Option A: Direct
npm start

# Option B: PM2 (recommended)
npm install -g pm2
pm2 start demo/restart.js --name "wa-automation"
pm2 save
pm2 startup

# Option C: Systemd (see BAILEYS_MIGRATION_GUIDE.md)
```

### Step 5: Monitor
```bash
# Check logs
tail -f ~/.pm2/logs/wa-automation-out.log

# Check metrics
pm2 monit

# Check status
pm2 status
```

---

## 🔍 Verification Commands

### Check Installation
```bash
npm list @whiskeysockets/baileys
npm list @hapi/boom
npm list dotenv
```

### Test Connection
```bash
node -e "
const { initBaileysClient } = require('./demo/baileys-client.ts');
initBaileysClient('test').then(() => console.log('OK')).catch(e => console.error(e));
"
```

### Check Google Sheets API
```bash
node -e "
const { fetchFromGoogleSheetsAPI } = require('./demo/google-sheets-api.ts');
fetchFromGoogleSheetsAPI('SHEET_ID', 'Sheet1').then(d => console.log(d.headers)).catch(e => console.error(e));
"
```

### Monitor Logs
```bash
# Real-time logs
tail -f app.log

# Filter by component
grep "\[SHEET\]" app.log
grep "\[BAILEYS\]" app.log
grep "ERROR" app.log

# Count sent messages
grep "✓ SENT" app.log | wc -l

# Find failures
grep "✗ FAILED" app.log
```

---

## ⚠️ Common Issues & Fixes

### Issue: "Cannot find module"
```bash
# Solution
npm install
npm install --save-dev typescript ts-node
```

### Issue: "QR code not appearing"
```bash
# Solution: Check terminal supports QR
node demo/index.js 2>&1 | tee app.log
```

### Issue: "Connection keeps dropping"
```bash
# Solution: Check WhatsApp Web login
# 1. Logout from WhatsApp Web on phone
# 2. Wait 5 minutes
# 3. Restart application
# 4. Scan QR code again
```

### Issue: "Messages not sending"
```bash
# Solution: Verify configuration
# 1. Check phone numbers (10+ digits)
# 2. Check daily limit (100/day)
# 3. Verify API key is valid
# 4. Check sheet column names
```

### Issue: "High memory usage"
```bash
# Solution: Restart application
pm2 restart wa-automation
# Or
npm start  # Kill and restart
```

---

## 📊 Performance Targets

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Memory | < 150MB | < 250MB |
| CPU (idle) | < 5% | < 10% |
| CPU (sending) | < 20% | < 30% |
| Reconnect time | < 5s | < 10s |
| Message send time | < 2s | < 5s |
| Uptime | > 99% | > 95% |

---

## 🔐 Security Checklist

- [ ] `.env` file not committed
- [ ] API keys rotated monthly
- [ ] Logs don't contain sensitive data
- [ ] Session files in secure directory
- [ ] File permissions set correctly (600 for auth files)
- [ ] No hardcoded credentials
- [ ] HTTPS used for all external APIs
- [ ] Rate limiting enabled
- [ ] Error messages don't leak info

---

## 📞 Support Contacts

- **Baileys Issues**: https://github.com/WhiskeySockets/Baileys/issues
- **Google Sheets API**: https://developers.google.com/sheets/api/support
- **Node.js Help**: https://nodejs.org/en/docs/

---

**Last Updated**: 2024
**Status**: Production Ready ✅
