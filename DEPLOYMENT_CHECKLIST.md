# Google Sheets API Integration - Deployment Checklist

## ✅ Pre-Deployment Verification

### Code Files
- [ ] `demo/google-sheets-api.ts` exists
- [ ] `demo/multi-sheet-engine.ts` updated
- [ ] `demo/index.ts` updated
- [ ] `.env` updated with API key
- [ ] No syntax errors in TypeScript files
- [ ] All imports resolved

### Configuration
- [ ] `GOOGLE_SHEETS_API_KEY` in `.env`
- [ ] Sheet IDs in `SHEET_CONFIGS`
- [ ] Session IDs match WhatsApp accounts
- [ ] Sheet names correct (case-sensitive)
- [ ] Polling interval set (2 minutes)
- [ ] Daily limits configured (100/sheet)

### Documentation
- [ ] `GOOGLE_SHEETS_API_INTEGRATION.md` created
- [ ] `GOOGLE_SHEETS_API_QUICK_REF.md` created
- [ ] `GOOGLE_SHEETS_API_SUMMARY.md` created
- [ ] `GOOGLE_SHEETS_API_TECHNICAL_REF.md` created
- [ ] This checklist created

---

## 🚀 Deployment Steps

### Step 1: Backup Current System
```bash
# Backup files
cp demo/multi-sheet-engine.ts demo/multi-sheet-engine.ts.backup
cp demo/index.ts demo/index.ts.backup
cp .env .env.backup

# Verify backups
ls -la demo/*.backup
ls -la .env.backup
```
- [ ] Backup created
- [ ] Backup verified

### Step 2: Deploy New Files
```bash
# Copy new google-sheets-api.ts
cp google-sheets-api.ts demo/

# Verify file exists
ls -la demo/google-sheets-api.ts
```
- [ ] google-sheets-api.ts deployed
- [ ] File permissions correct

### Step 3: Update Configuration
```bash
# Verify API key in .env
grep GOOGLE_SHEETS_API_KEY .env

# Verify sheet configs
grep -A 5 "SHEET_CONFIGS" demo/multi-sheet-engine.ts
```
- [ ] API key present
- [ ] Sheet configs correct
- [ ] No CSV URLs in config

### Step 4: Verify Code Changes
```bash
# Check for CSV export URLs
grep -r "export?format=csv" demo/

# Should return: (no results)
```
- [ ] No CSV export URLs found
- [ ] All CSV functions disabled

### Step 5: Build & Test
```bash
# Build TypeScript
npm run build

# Check for errors
echo $?  # Should be 0
```
- [ ] Build successful
- [ ] No compilation errors

---

## 🧪 Testing Phase

### Test 1: System Startup
```bash
# Start system
npm run dev -- --session=9155604591

# Wait for startup
# Should see: [STABILITY] STABLE READY ✅
```
- [ ] System starts without errors
- [ ] No crash on startup
- [ ] Session initialized

### Test 2: API Connection
```bash
# Check logs for API calls
tail -f wa-9155604591/logs.txt | grep "SHEETS-API"

# Should see:
# [SHEETS-API] Fetching: {spreadsheetId}
```
- [ ] API calls successful
- [ ] No permission errors
- [ ] Data fetched

### Test 3: Data Fetching
```bash
# Check logs for data fetch
tail -f wa-9155604591/logs.txt | grep "SHEET.*Headers"

# Should see:
# [SHEET] sheet1 Headers: name, phone, message, status
```
- [ ] Headers detected
- [ ] Column mapping correct
- [ ] Data parsed

### Test 4: Lead Processing
```bash
# Add test row to sheet:
# name: Test | phone: 9876543210 | message: Test | status: pending

# Check logs for lead validation
tail -f wa-9155604591/logs.txt | grep "Valid lead"

# Should see:
# [SHEET] sheet1 Row 2: ✅ Valid lead - 919876543210 (Test, clinic)
```
- [ ] Lead validated
- [ ] Phone formatted
- [ ] Category detected

### Test 5: Message Sending
```bash
# Check logs for message send
tail -f wa-9155604591/logs.txt | grep "SENT"

# Should see:
# [SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
```
- [ ] Message sent
- [ ] Counter incremented
- [ ] No errors

### Test 6: Status Update
```bash
# Check logs for status update
tail -f wa-9155604591/logs.txt | grep "Updated.*sent"

# Should see:
# [SHEETS-API] Updated Sheet1!D2 → sent
```
- [ ] Status updated in sheet
- [ ] Cell reference correct
- [ ] Value set to "sent"

### Test 7: Multi-Sheet Polling
```bash
# Check logs for all sheets
tail -f wa-9155604591/logs.txt | grep "sheet[123]"

# Should see:
# [SHEET] sheet1 ...
# [SHEET] sheet2 ...
# [SHEET] sheet3 ...
```
- [ ] All sheets polled
- [ ] Independent polling
- [ ] No conflicts

### Test 8: Error Handling
```bash
# Test with invalid sheet ID
# Modify SHEET_CONFIGS temporarily

# Check logs for error
tail -f wa-9155604591/logs.txt | grep "ERROR\|Error"

# Should see graceful error handling
```
- [ ] Errors logged
- [ ] System continues
- [ ] No crashes

---

## 📊 Verification Metrics

### Performance
- [ ] Fetch time < 2 seconds
- [ ] Parse time < 200ms
- [ ] Total cycle < 3 seconds
- [ ] No memory leaks
- [ ] CPU usage normal

### Reliability
- [ ] No duplicate messages
- [ ] No missed leads
- [ ] All status updates successful
- [ ] Error rate < 1%
- [ ] Uptime > 99%

### Logging
- [ ] All API calls logged
- [ ] All errors logged
- [ ] Metrics logged
- [ ] No sensitive data logged
- [ ] Log rotation working

---

## 🔍 Post-Deployment Verification

### Check System Health
```bash
# Check process running
ps aux | grep "node.*index.ts"

# Check port listening
netstat -tlnp | grep 8[0-9][0-9][0-9]

# Check logs for errors
grep ERROR wa-9155604591/logs.txt | wc -l
```
- [ ] Process running
- [ ] Port listening
- [ ] Error count acceptable

### Verify Data Flow
```bash
# Check sheet for updates
# Open Google Sheet and verify:
# - Rows marked as "sent"
# - Timestamps updated
# - No duplicate sends

# Check WhatsApp for messages
# Verify messages received by test numbers
```
- [ ] Sheet updated
- [ ] Messages received
- [ ] No duplicates

### Monitor Metrics
```bash
# Check metrics command
# Send to admin: SHEET METRICS

# Should see:
# [SHEET METRICS]
# sheet1: X/100 sent, Y failed
# sheet2: X/100 sent, Y failed
# sheet3: X/100 sent, Y failed
```
- [ ] Metrics accurate
- [ ] Counters incrementing
- [ ] Limits respected

---

## 🚨 Rollback Plan

### If Issues Occur
```bash
# Stop system
Ctrl+C

# Restore backup
cp demo/multi-sheet-engine.ts.backup demo/multi-sheet-engine.ts
cp demo/index.ts.backup demo/index.ts
cp .env.backup .env

# Restart
npm run dev -- --session=9155604591
```
- [ ] Backup restored
- [ ] System restarted
- [ ] Verified working

### Verify Rollback
```bash
# Check for CSV export URLs
grep "export?format=csv" wa-9155604591/logs.txt

# Should see CSV URLs again
```
- [ ] Rollback successful
- [ ] System stable

---

## 📋 Sign-Off

### Development Team
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Documentation complete
- [ ] Ready for deployment

### QA Team
- [ ] All tests passed
- [ ] No critical issues
- [ ] Performance acceptable
- [ ] Ready for production

### Operations Team
- [ ] Deployment plan reviewed
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Support briefed

### Deployment
- [ ] Approved for deployment
- [ ] Deployed to production
- [ ] Verified working
- [ ] Monitoring active

---

## 📞 Support Contacts

### Issues During Deployment
- **Technical**: Check logs in `wa-{SESSION_ID}/`
- **API Issues**: Check `[SHEETS-API]` logs
- **Data Issues**: Check `[SHEET]` logs
- **Send Issues**: Check `[SEND]` logs

### Escalation
1. Check logs for error details
2. Review troubleshooting guide
3. Verify configuration
4. Check API key permissions
5. Contact support if needed

---

## 📚 Documentation References

- `GOOGLE_SHEETS_API_INTEGRATION.md` - Complete guide
- `GOOGLE_SHEETS_API_QUICK_REF.md` - Quick reference
- `GOOGLE_SHEETS_API_SUMMARY.md` - Summary of changes
- `GOOGLE_SHEETS_API_TECHNICAL_REF.md` - Technical details

---

## ✅ Final Checklist

### Before Going Live
- [ ] All tests passed
- [ ] All documentation reviewed
- [ ] Backup verified
- [ ] Rollback plan ready
- [ ] Team briefed
- [ ] Monitoring configured
- [ ] Support ready

### After Going Live
- [ ] System stable
- [ ] Metrics normal
- [ ] No errors
- [ ] Users notified
- [ ] Documentation updated
- [ ] Monitoring active

---

## 🎉 Deployment Complete

```
✅ Google Sheets API integrated
✅ CSV system removed
✅ Multi-sheet engine working
✅ Auto-polling active
✅ Status updates working
✅ Comprehensive logging
✅ Error handling complete
✅ Production ready
✅ Monitoring active
✅ Support briefed
```

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________
**Status**: ✅ COMPLETE

---

**Next Review**: 30 days after deployment
**Maintenance Window**: Weekly (Sunday 2-3 AM)
**Support Hours**: 24/7 for critical issues
