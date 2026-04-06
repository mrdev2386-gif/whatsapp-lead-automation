# Google Sheets Outbound System - Quick Troubleshooting

## 🔴 No DMs Being Sent

### Check 1: Are leads being detected?
```bash
grep "Valid leads:" logs.txt
```

**Expected**: `Valid leads: X` where X > 0

**If 0**: Go to Check 2

---

### Check 2: Is sheet data valid?

**Open your Google Sheet and verify**:

| Column | Format | Example | Status |
|--------|--------|---------|--------|
| number | 10+ digits | 9876543210 | ✅ |
| name | Any text | John | ✅ |
| category | clinic/hotel | clinic | ✅ |
| message | Any text | Hi John... | ✅ |
| status | pending/sent/failed | pending | ✅ |

**Common mistakes**:
- ❌ Number: "+919876543210" (has +)
- ❌ Number: "9876543210 " (has spaces)
- ❌ Category: "Clinic" (uppercase)
- ❌ Status: "Pending" (uppercase)
- ❌ Status: "pending " (trailing space)

**Fix**: Ensure all data matches format above

---

### Check 3: Are rows marked as "pending"?

```bash
grep "status=" logs.txt | head -5
```

**Expected**:
```
[SHEET] sheet1 Row 1: status="pending" → normalized="pending"
[SHEET] sheet1 Row 2: status="pending" → normalized="pending"
```

**If showing "sent" or "failed"**: Change status to "pending" in sheet

---

### Check 4: Is WhatsApp client connected?

```bash
grep "Found client for" logs.txt
```

**Expected**:
```
[CLIENT] Found client for 9155604591
```

**If missing**: 
1. Restart system
2. Scan QR code
3. Wait 120 seconds for hardening

---

### Check 5: Is send trigger being called?

```bash
grep "SEND TRIGGER" logs.txt
```

**Expected**:
```
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543210 (John, clinic)
```

**If missing**: Leads are not being processed. Check Check 1-3

---

### Check 6: Are sends succeeding?

```bash
grep "SENT\|FAILED" logs.txt
```

**Expected**:
```
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
[SHEET] sheet1 ✅ SENT to 919876543211 (2/100)
```

**If showing FAILED**: Check WhatsApp connection (Check 4)

---

## 🟡 Partial Issues

### Some leads not being sent

**Check daily limit**:
```bash
grep "Daily limit reached" logs.txt
```

**If found**: Wait 24 hours or manually reset in code

**Check invalid data**:
```bash
grep "Invalid\|skipping" logs.txt
```

**If found**: Fix data in Google Sheet

---

### Status not updating in sheet

**Check API key**:
```bash
grep "No API key" logs.txt
```

**If found**: Set `GOOGLE_SHEETS_API_KEY` environment variable

---

## 🟢 Everything Working

**Expected log pattern**:
```
[CLIENT] Found client for 9155604591
[SHEET] sheet1 Valid leads: 3
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ✅ SENT to 919876543211 (2/100)
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ✅ SENT to 919876543212 (3/100)
[SHEET] sheet1 Completed (sent: 3/100)
```

---

## 📋 Data Format Checklist

### Google Sheet Setup

```
Row 1 (Headers):
number | name | category | message | status

Row 2 (Example):
9876543210 | John | clinic | Hi John, I saw your clinic... | pending

Row 3 (Example):
9876543211 | Jane | hotel | Hi Jane, I noticed your hotel... | pending
```

### Phone Number Format
- ✅ `9876543210` (10 digits, auto-formatted to 919876543210)
- ✅ `919876543210` (12 digits with country code)
- ✅ `+919876543210` (with +, auto-cleaned)
- ❌ `+91 9876543210` (with spaces - will be cleaned)
- ❌ `abc` (non-numeric)
- ❌ `123` (too short)

### Category Format
- ✅ `clinic` (lowercase)
- ✅ `hotel` (lowercase)
- ❌ `Clinic` (uppercase)
- ❌ `HOTEL` (uppercase)
- ❌ `other` (invalid)

### Status Format
- ✅ `pending` (lowercase)
- ✅ `sent` (lowercase)
- ✅ `failed` (lowercase)
- ✅ `` (empty - auto-treated as pending)
- ❌ `Pending` (uppercase)
- ❌ `SENT` (uppercase)
- ❌ `pending ` (trailing space)

---

## 🔧 Quick Fixes

### Fix 1: Reset all statuses to pending
In Google Sheet, select status column and replace all "sent" with "pending"

### Fix 2: Restart system
```bash
npm run dev -- --session=9155604591
```

### Fix 3: Check logs in real-time
```bash
npm run dev -- --session=9155604591 2>&1 | grep SHEET
```

### Fix 4: Verify sheet URL
```bash
# Check if sheet is accessible
curl "https://docs.google.com/spreadsheets/d/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/export?format=csv"
```

---

## 📊 Metrics Command

Send message to admin number:
```
SHEET METRICS
```

**Response**:
```
[SHEET METRICS]
sheet1: 5/100 sent, 0 failed
sheet2: 3/100 sent, 1 failed
sheet3: 0/100 sent, 0 failed
```

---

## 🚀 Performance Tips

1. **Increase polling frequency** (default: 2 minutes)
   - Edit `POLL_INTERVAL` in multi-sheet-engine.ts

2. **Decrease send delay** (default: 60 seconds)
   - Edit `SEND_DELAY` in multi-sheet-engine.ts
   - ⚠️ Too fast may trigger WhatsApp rate limits

3. **Increase daily limit** (default: 100)
   - Edit `DAILY_LIMIT` in multi-sheet-engine.ts

---

## 📞 Support

If issues persist:

1. Check all logs for errors
2. Verify Google Sheet format
3. Ensure WhatsApp client is connected
4. Check environment variables are set
5. Restart system and try again

---

**Last Updated**: 2024
