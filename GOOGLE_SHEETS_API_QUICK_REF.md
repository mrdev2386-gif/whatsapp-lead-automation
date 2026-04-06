# Google Sheets API Integration - Quick Reference

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Add to .env
GOOGLE_SHEETS_API_KEY=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs
```

### 2. Verify Files
```
✅ demo/google-sheets-api.ts (NEW)
✅ demo/multi-sheet-engine.ts (UPDATED)
✅ demo/index.ts (UPDATED)
✅ .env (UPDATED)
```

### 3. Start System
```bash
npm run dev -- --session=9155604591
```

---

## 📊 Sheet Format

### Minimum (4 columns)
```
name | phone | message | status
John | 9876543210 | Hi John... | pending
```

### With Category (5 columns)
```
name | phone | message | status | category
John | 9876543210 | Hi John... | pending | clinic
```

---

## 🔍 Verification

### Check Logs
```bash
# Should see:
[SHEETS-API] Fetching: {spreadsheetId}
[SHEET] Headers: name, phone, message, status
[SHEET] Valid leads: X
[SHEET] ✅ SENT to {number}
[SHEETS-API] Updated Sheet1!D2 → sent
```

### Test Manually
```bash
# Add test row to sheet:
name: Test | phone: 9876543210 | message: Test | status: pending

# Check logs for:
[SHEET] Row 2: ✅ Valid lead - 919876543210 (Test, clinic)
[SHEET] ✅ SENT to 919876543210
[SHEETS-API] Updated Sheet1!D2 → sent
```

---

## 🛠️ Configuration

### Sheet Configs
File: `demo/multi-sheet-engine.ts`

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

### API Key
File: `.env`

```env
GOOGLE_SHEETS_API_KEY=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs
```

---

## 📈 Polling Cycle

**Interval**: 2 minutes (configurable)

**Per Cycle**:
1. Fetch data from Google Sheets API
2. Validate columns and data
3. Filter pending leads
4. Send WhatsApp messages
5. Update status in sheet
6. Log metrics

---

## ✅ Checklist

### Pre-Deployment
- [ ] API key in `.env`
- [ ] Sheet IDs in SHEET_CONFIGS
- [ ] Column headers correct
- [ ] Test data in sheets
- [ ] google-sheets-api.ts exists
- [ ] multi-sheet-engine.ts updated
- [ ] index.ts updated

### Post-Deployment
- [ ] System starts without errors
- [ ] Logs show API fetch
- [ ] Leads fetched successfully
- [ ] Messages sent
- [ ] Status updated in sheet
- [ ] No CSV export URLs in logs
- [ ] No duplicate polling

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | Check API key, enable Sheets API |
| Spreadsheet not found | Verify ID, check sheet access |
| No data found | Check headers, verify data format |
| Rate limit | Increase polling interval |
| Duplicate polling | Check only one polling system active |

---

## 📊 Metrics Command

```bash
# Send to admin number:
SHEET METRICS

# Response:
[SHEET METRICS]
sheet1: 45/100 sent, 2 failed
sheet2: 32/100 sent, 1 failed
sheet3: 28/100 sent, 0 failed
```

---

## 🎯 Key Points

✅ **Native API** - No CSV export
✅ **Multi-Sheet** - Independent polling
✅ **Auto-Update** - Status synced to sheet
✅ **Error Handling** - Comprehensive logging
✅ **No Duplicates** - Single polling system
✅ **Scalable** - Add sheets easily

---

## 📞 Support

**Logs Location**: `wa-{SESSION_ID}/` directory

**Key Log Patterns**:
- `[SHEETS-API]` - API calls
- `[SHEET]` - Processing
- `[SEND]` - Message sending
- `[ERROR]` - Issues

---

**Status**: ✅ READY TO DEPLOY
