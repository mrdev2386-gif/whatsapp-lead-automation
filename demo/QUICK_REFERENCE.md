# Google Sheets Write-Back System - Quick Reference

## Setup (5 minutes)

### 1. Get API Key
```bash
# Go to: https://console.cloud.google.com/
# 1. Create project
# 2. Enable "Google Sheets API"
# 3. Create API Key (Credentials → API Key)
# 4. Copy key
```

### 2. Add to Environment
```bash
# In .env or environment variables
GOOGLE_SHEETS_API_KEY=AIzaSyD...your_key_here...
```

### 3. Verify Sheet Structure
```
| number | name | category | message | status |
|--------|------|----------|---------|--------|
| 919876543210 | Raj Kumar | clinic | (optional) | pending |
```

### 4. Start Bot
```bash
npm run dev
```

## How It Works

### Flow
1. **CSV Read** (every 2 min) → Fetch pending leads
2. **Send Message** → WhatsApp delivery
3. **Track ACK** → Message delivered
4. **Register Mapping** → chatId → row metadata
5. **Update Sheet** → Status: pending → sent/failed
6. **Retry Logic** → If API fails, retry with backoff

### Key Files
- `sheets-writeback.ts` - Core write-back engine
- `multi-sheet-engine.ts` - Multi-sheet outbound
- `outbound-integration.ts` - Outbound tracking
- `index.ts` - Main bot (integration point)

## Admin Commands

### Get Metrics
```
SHEET METRICS
```
Output:
```
sheet1: 45/100 sent, 2 failed
sheet2: 78/100 sent, 1 failed
sheet3: 23/100 sent, 0 failed
```

### Start Bulk
```
START BULK
```

## Logging

### Success
```
[SHEET UPDATE] Updated row 2 → sent
[SHEET WRITEBACK] Registered 919876543210@c.us → row 2 (sheet: sheet1)
```

### Errors
```
[SHEET UPDATE ERROR] Attempt 1/4: Network timeout
[SHEET RETRY] Retrying in 2000ms...
```

### No API Key
```
[SHEET] sheet1 No API key - skipping write-back for 919876543210
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Status not updating | Check `GOOGLE_SHEETS_API_KEY` is set |
| Wrong row updated | Check logs for `[SHEET WRITEBACK] Registered` |
| API rate limit | System handles with backoff (500ms delay) |
| Network timeout | Automatic retry (max 3 retries) |

## Configuration

### Sheet Config (index.ts)
```typescript
const SHEET_CONFIGS: SheetConfig[] = [
  {
    sheetId: 'sheet1',
    sessionId: '9155604591',
    spreadsheetId: '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
    sheetName: 'Sheet1'
  }
];
```

### Polling Settings (multi-sheet-engine.ts)
```typescript
const DAILY_LIMIT = 100;           // Leads per day
const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes
const SEND_DELAY = 60 * 1000;      // 60 seconds between sends
```

### Retry Settings (sheets-writeback.ts)
```typescript
const maxRetries = 3;
const retryDelays = [2000, 5000, 10000]; // 2s, 5s, 10s
```

## Performance

| Metric | Value |
|--------|-------|
| Polling Interval | 2 minutes |
| Send Delay | 60 seconds |
| API Delay | 500ms |
| Max Retries | 3 (4 total attempts) |
| Daily Limit | 100 leads/sheet |
| Memory | 2-5 MB |

## Files Generated

- `wa-sheet-mappings.json` - Row mapping persistence
- `sentLeads.json` - Sent leads tracking (fallback)
- `state.json` - User state persistence
- `leads.json` - CRM lead data

## Testing

### Manual Test
1. Add lead to sheet with status "pending"
2. Send message to that number
3. Check sheet - status should change to "sent"
4. Check logs for `[SHEET UPDATE]` message

### Check Logs
```bash
# Watch for successful updates
grep "\[SHEET UPDATE\]" logs.txt

# Watch for errors
grep "\[SHEET UPDATE ERROR\]" logs.txt

# Watch for retries
grep "\[SHEET RETRY\]" logs.txt
```

## Security

### DO
- Store API key in environment variables
- Use `.env` file (not in git)
- Rotate keys periodically
- Use service account keys

### DON'T
- Hardcode API keys
- Commit keys to git
- Share keys in logs
- Use personal API keys

## Integration Points

### In index.ts
```typescript
// Multi-sheet engine
startAutoPolling(clientMap, sendSafeWrapper);

// Outbound reply prioritization
if (shouldPrioritizeOutboundReply(chatId)) {
  const outboundReply = processOutboundReply(chatId, body);
  if (outboundReply) {
    await sendSafe(client, chatId, user, outboundReply);
    return;
  }
}

// Admin commands
if (message.body === 'SHEET METRICS') {
  const metrics = getSheetMetrics();
  // Send metrics to admin
}
```

## API Quotas

- 500 requests/100 seconds per user
- 100 concurrent requests
- Our system: Sequential (1 at a time)
- 500ms delay between updates
- Automatic backoff on rate limit

## Backward Compatibility

- `sentLeads.json` still used for duplicate prevention
- Can disable write-back anytime
- Gracefully skips if API key missing
- No breaking changes to existing logic

## Advanced

### Custom Status Column
```typescript
// In sheets-writeback.ts
const range = `${config.sheetName}!D${rowIndex}`; // Change C to D
```

### Batch Update Size
```typescript
// In multi-sheet-engine.ts
const batchSize = 10;
```

### Increase Retries
```typescript
// In sheets-writeback.ts
const maxRetries = 5; // Increase from 3
```

## Monitoring

### Key Logs to Watch
- `[SHEET UPDATE]` - Successful updates
- `[SHEET UPDATE ERROR]` - Failed updates
- `[SHEET RETRY]` - Retry attempts
- `[OUTBOUND]` - Outbound campaign tracking

### Expected Daily Output
```
[SHEET] sheet1 Fetched 50 pending leads
[SHEET] sheet1 Start processing 50 leads
[SHEET] sheet1 Sending to 919876543210
[SHEET] sheet1 SENT → 919876543210 (1/100)
[SHEET UPDATE] Updated row 2 → sent
...
[SHEET] sheet1 Completed (sent: 50/100)
```

## Support

1. Check logs for error messages
2. Verify `GOOGLE_SHEETS_API_KEY` is set
3. Confirm sheet structure (columns A-E)
4. Check Google Sheets API is enabled
5. Verify spreadsheet ID is correct

---

**Quick Start:** 5 minutes to setup, fully automated after that ✅
