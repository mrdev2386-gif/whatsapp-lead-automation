# Deployment Checklist - Google Sheets Write-Back System

## Pre-Deployment

### Environment Setup
- [ ] Node.js 16+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] TypeScript configured (`tsconfig.json`)
- [ ] `.env` file created in project root

### Google Sheets API
- [ ] Google Cloud Console project created
- [ ] Google Sheets API enabled
- [ ] API key generated
- [ ] API key added to `.env` as `GOOGLE_SHEETS_API_KEY`
- [ ] API key has no IP restrictions (or configured correctly)

### WhatsApp Setup
- [ ] WhatsApp Business Account created
- [ ] Session IDs configured in `index.ts`
- [ ] QR codes scanned for each session
- [ ] Admin number configured (`ADMIN_NUMBER`)

### Google Sheets
- [ ] Spreadsheet created for each sheet
- [ ] Column structure verified:
  - [ ] Column A: `number` (phone number)
  - [ ] Column B: `name` (contact name)
  - [ ] Column C: `status` (pending/sent/failed)
  - [ ] Column D: `category` (clinic/hotel)
  - [ ] Column E: `message` (optional)
- [ ] Spreadsheet IDs added to `SHEET_CONFIGS` in `index.ts`
- [ ] Sheet names verified (usually "Sheet1")
- [ ] Test data added with status "pending"

## Configuration

### index.ts
- [ ] `SHEET_CONFIGS` updated with correct spreadsheet IDs
- [ ] `SESSION_ID` configured
- [ ] `ADMIN_NUMBER` configured
- [ ] `SHEET_URL` configured (if using bulk outreach)

### Environment Variables
```bash
GOOGLE_SHEETS_API_KEY=AIzaSyD...
OPENAI_API_KEY=sk-proj-...
SESSION_ID=9155604591
ADMIN_NUMBER=918073539824@c.us
```

- [ ] All required variables set
- [ ] No hardcoded credentials in code
- [ ] `.env` file added to `.gitignore`

### Optional Configuration
- [ ] Polling interval adjusted (if needed)
- [ ] Send delay adjusted (if needed)
- [ ] Daily limit adjusted (if needed)
- [ ] Retry delays adjusted (if needed)

## Code Review

### sheets-writeback.ts
- [ ] Row mapping logic reviewed
- [ ] Retry logic verified
- [ ] API call format correct
- [ ] Error handling in place
- [ ] Cleanup function scheduled

### multi-sheet-engine.ts
- [ ] CSV parsing logic correct
- [ ] Lead filtering working
- [ ] Daily limit tracking accurate
- [ ] Polling interval set correctly
- [ ] Message templates appropriate

### outbound-integration.ts
- [ ] Lead registration working
- [ ] Reply processing logic correct
- [ ] Pricing negotiation appropriate
- [ ] Cleanup scheduled

### index.ts
- [ ] Multi-sheet engine initialized
- [ ] Outbound reply prioritization in place
- [ ] Admin commands working
- [ ] Error handling comprehensive
- [ ] Graceful shutdown implemented

## Testing

### Unit Tests
- [ ] Row mapping registration works
- [ ] Row verification logic correct
- [ ] Update retry logic works
- [ ] Batch update processing correct
- [ ] Lead fetching from CSV works
- [ ] Intent detection accurate
- [ ] Category detection working

### Integration Tests
- [ ] Message sending works
- [ ] Status updates in sheet
- [ ] Row mapping persists
- [ ] Outbound replies processed
- [ ] Admin commands respond
- [ ] Follow-ups scheduled

### End-to-End Tests
- [ ] Add test lead to sheet (status: pending)
- [ ] Send message to test number
- [ ] Verify status changes to "sent"
- [ ] Check logs for `[SHEET UPDATE]` message
- [ ] Verify row mapping created
- [ ] Test retry logic (simulate API failure)
- [ ] Test rate limiting (multiple sends)
- [ ] Test admin commands

### Performance Tests
- [ ] Memory usage under 450MB
- [ ] CPU usage minimal (<0.1%)
- [ ] API calls within quota
- [ ] No memory leaks after 24 hours
- [ ] Polling interval consistent

## Monitoring Setup

### Logging
- [ ] Log levels configured
- [ ] Log files created
- [ ] Log rotation configured (if needed)
- [ ] Key logs identified:
  - [ ] `[SHEET UPDATE]` - Successful updates
  - [ ] `[SHEET UPDATE ERROR]` - Failed updates
  - [ ] `[SHEET RETRY]` - Retry attempts
  - [ ] `[OUTBOUND]` - Outbound tracking

### Metrics
- [ ] Metrics collection working
- [ ] Dashboard accessible
- [ ] Key metrics tracked:
  - [ ] Messages sent
  - [ ] Messages delivered
  - [ ] Messages failed
  - [ ] Conversions
  - [ ] Sheet updates

### Alerts
- [ ] Memory alert configured (450MB)
- [ ] Error rate alert configured
- [ ] API quota alert configured
- [ ] Connection loss alert configured

## Security

### API Keys
- [ ] API key stored in environment variable
- [ ] API key not in code
- [ ] API key not in logs
- [ ] API key not in git history
- [ ] API key rotation scheduled

### Data Protection
- [ ] Row verification before update
- [ ] Phone number validation
- [ ] Row index validation
- [ ] No sensitive data in logs
- [ ] Mapping file permissions correct

### Access Control
- [ ] Admin commands restricted to admin number
- [ ] Session isolation working
- [ ] No cross-session data leakage
- [ ] Lock file mechanism working

## Deployment

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Backup of current state
- [ ] Rollback plan documented

### Deployment
- [ ] Code deployed to production
- [ ] Environment variables set
- [ ] Database/files migrated (if needed)
- [ ] Services started
- [ ] Health checks passing

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Verify sheet updates working
- [ ] Check metrics dashboard
- [ ] Test admin commands
- [ ] Verify follow-ups scheduled
- [ ] Monitor for 24 hours

## Rollback Plan

- [ ] Previous version backed up
- [ ] Rollback procedure documented
- [ ] Rollback tested (if possible)
- [ ] Communication plan ready
- [ ] Estimated rollback time: 5 minutes

## Documentation

- [ ] SHEETS_WRITEBACK_GUIDE.md reviewed
- [ ] IMPLEMENTATION_COMPLETE.md reviewed
- [ ] QUICK_REFERENCE.md reviewed
- [ ] API_REFERENCE.md reviewed
- [ ] IMPLEMENTATION_SUMMARY.md reviewed
- [ ] Runbook created for operations
- [ ] Troubleshooting guide available

## Operations Handoff

- [ ] Operations team trained
- [ ] Admin commands documented
- [ ] Monitoring dashboard explained
- [ ] Alert procedures documented
- [ ] Escalation path defined
- [ ] Support contact information provided

## Post-Deployment Monitoring (First 24 Hours)

### Hour 1
- [ ] System running without errors
- [ ] Messages sending successfully
- [ ] Sheet updates working
- [ ] No memory leaks detected
- [ ] Logs clean and informative

### Hour 6
- [ ] Polling working consistently
- [ ] Daily limit tracking accurate
- [ ] Retry logic functioning
- [ ] No API quota issues
- [ ] Metrics dashboard updated

### Hour 24
- [ ] System stable for 24 hours
- [ ] No crashes or restarts
- [ ] Memory usage stable
- [ ] All features working
- [ ] Ready for production

## Sign-Off

- [ ] Development Lead: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] Operations Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______

## Notes

```
[Add any additional notes or observations here]
```

---

## Quick Verification Commands

### Check Environment
```bash
echo $GOOGLE_SHEETS_API_KEY
echo $OPENAI_API_KEY
echo $SESSION_ID
```

### Check Logs
```bash
# Watch for successful updates
tail -f logs.txt | grep "\[SHEET UPDATE\]"

# Watch for errors
tail -f logs.txt | grep "\[SHEET UPDATE ERROR\]"

# Watch for retries
tail -f logs.txt | grep "\[SHEET RETRY\]"
```

### Test Admin Commands
```
Send to admin: SHEET METRICS
Expected: Metrics for all sheets

Send to admin: START BULK
Expected: Bulk outreach initiated
```

### Verify Sheet Updates
1. Add lead to sheet with status "pending"
2. Send message to that number
3. Check sheet - status should change to "sent"
4. Check logs for `[SHEET UPDATE]` message

---

**Deployment Checklist Complete** ✅
