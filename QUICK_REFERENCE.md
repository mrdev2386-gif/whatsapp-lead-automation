# Quick Reference Card

## 🚀 Start/Stop

```bash
# Start application
npm start

# Start directly (no restart wrapper)
npm run start:direct

# Stop (Ctrl+C)
# Or with PM2:
pm2 stop wa-automation
pm2 restart wa-automation
pm2 delete wa-automation
```

---

## 📊 Monitoring

```bash
# View logs
tail -f app.log

# Filter logs
grep "\[SHEET\]" app.log          # Sheet operations
grep "\[BAILEYS\]" app.log        # WhatsApp events
grep "ERROR" app.log              # Errors only
grep "✓ SENT" app.log             # Sent messages
grep "✗ FAILED" app.log           # Failed messages

# Count messages sent today
grep "✓ SENT" app.log | wc -l

# Real-time monitoring
watch -n 1 'tail -20 app.log'
```

---

## 🔧 Configuration

### Environment Variables (.env)
```env
SESSION_ID=9155604591
```

### Google Sheets API Key
File: `demo/google-sheets-api.ts`
```typescript
const API_KEY = "YOUR_API_KEY_HERE";
```

### Sheet Configurations
File: `demo/multi-sheet-engine.ts`
```typescript
const SHEET_CONFIGS: SheetConfig[] = [
  {
    sheetId: 'sheet1',
    sessionId: '9155604591',
    spreadsheetId: 'SHEET_ID',
    sheetName: 'Sheet1'
  }
];
```

---

## 🐛 Troubleshooting

### Problem: QR Code Not Showing
```bash
# Solution 1: Check terminal
node demo/index.js 2>&1 | tee app.log

# Solution 2: Use different terminal
# Try: iTerm2, Windows Terminal, or SSH session
```

### Problem: Connection Drops
```bash
# Solution 1: Check internet
ping google.com

# Solution 2: Restart app
npm start

# Solution 3: Logout WhatsApp Web
# On phone: Settings > Linked Devices > Logout
# Wait 5 minutes, restart app
```

### Problem: Messages Not Sending
```bash
# Check 1: Verify phone numbers
# Format: 91XXXXXXXXXX (10+ digits)

# Check 2: Check daily limit
grep "Daily limit reached" app.log

# Check 3: Verify API key
# Test: curl "https://sheets.googleapis.com/v4/spreadsheets/ID/values/Sheet1?key=KEY"

# Check 4: Check sheet columns
# Required: number, name, message, status
```

### Problem: High Memory Usage
```bash
# Check memory
ps aux | grep node

# Solution: Restart
npm start  # Kill and restart
# Or with PM2:
pm2 restart wa-automation
```

### Problem: Process Won't Start
```bash
# Check if port in use
lsof -i :3000

# Kill existing process
pkill -f "node demo/index.js"

# Check logs
cat app.log | tail -50

# Check dependencies
npm install
```

---

## 📈 Performance Checks

```bash
# Memory usage
ps aux | grep node | grep -v grep

# CPU usage
top -p $(pgrep -f "node demo/index.js")

# Disk usage
du -sh auth_*
du -sh wa-sheet-mappings.json

# Network connections
netstat -an | grep ESTABLISHED | grep node
```

---

## 🔐 Security

```bash
# Check file permissions
ls -la auth_*
ls -la .env

# Set secure permissions
chmod 600 .env
chmod 700 auth_*

# Check for exposed credentials
grep -r "AIzaSy" .
grep -r "password" .
grep -r "token" .
```

---

## 📊 Metrics

```bash
# Get sheet metrics (in code)
const { getSheetMetrics } = require('./demo/multi-sheet-engine.ts');
const metrics = getSheetMetrics();
console.log(metrics);

# Or from logs
grep "Cycle complete" app.log | tail -10
```

---

## 🔄 Maintenance

### Daily
- [ ] Check logs for errors
- [ ] Verify messages sending
- [ ] Monitor memory usage

### Weekly
- [ ] Review performance metrics
- [ ] Check for stuck processes
- [ ] Verify all sheets working

### Monthly
- [ ] Rotate API keys
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Backup session files

---

## 📞 Emergency Contacts

### If System Down
1. Check logs: `tail -f app.log`
2. Restart: `npm start`
3. Check internet: `ping google.com`
4. Check WhatsApp: Scan QR again
5. Contact support if persists

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot find module" | Missing dependency | `npm install` |
| "EADDRINUSE" | Port in use | `pkill -f node` |
| "QR not showing" | Terminal issue | Use different terminal |
| "Connection closed" | Network issue | Restart app |
| "API key invalid" | Wrong key | Update `google-sheets-api.ts` |
| "Sheet not found" | Wrong ID | Verify spreadsheet ID |

---

## 🎯 Daily Operations

### Morning
```bash
# Check system status
ps aux | grep node
tail -20 app.log

# Verify connection
grep "WhatsApp Connected" app.log | tail -1
```

### Throughout Day
```bash
# Monitor messages
grep "✓ SENT" app.log | wc -l

# Check for errors
grep "ERROR" app.log

# Monitor memory
ps aux | grep node
```

### Evening
```bash
# Review daily stats
grep "Cycle complete" app.log | tail -5

# Check for issues
grep "FAILED\|ERROR" app.log

# Prepare for next day
# Verify sheets have pending leads
```

---

## 🚀 Deployment Commands

```bash
# Development
npm run start:direct

# Production (with restart wrapper)
npm start

# Production (with PM2)
pm2 start demo/restart.js --name "wa-automation"
pm2 save
pm2 startup

# Production (with Systemd)
sudo systemctl start wa-automation
sudo systemctl status wa-automation
sudo journalctl -u wa-automation -f
```

---

## 📝 Log Prefixes

| Prefix | Meaning |
|--------|---------|
| `[BOOT]` | Startup messages |
| `[BAILEYS]` | WhatsApp client |
| `[SHEET]` | Sheet processing |
| `[FETCH]` | Data fetching |
| `[OUTBOUND]` | Message sending |
| `[ENGINE]` | Automation engine |
| `[SHEET WRITEBACK]` | Status updates |

---

## 🔗 Useful Links

- Baileys: https://github.com/WhiskeySockets/Baileys
- Google Sheets API: https://developers.google.com/sheets/api
- Node.js: https://nodejs.org/en/docs/
- PM2: https://pm2.keymetrics.io/

---

## 📋 Checklist

### Before Going Live
- [ ] `npm install` successful
- [ ] QR code scans
- [ ] Test message sends
- [ ] Logs look good
- [ ] Memory usage normal
- [ ] All sheets configured

### During Operation
- [ ] Monitor logs daily
- [ ] Check message counts
- [ ] Verify status updates
- [ ] Monitor resource usage

### Weekly
- [ ] Review performance
- [ ] Check for errors
- [ ] Verify all sheets
- [ ] Update if needed

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Production Ready ✅
