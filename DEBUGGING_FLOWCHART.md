# Google Sheets Outbound System - Debugging Flowchart

## 🔍 Debugging Decision Tree

```
START: No DMs Being Sent
│
├─ Check 1: Is system running?
│  ├─ NO → Start system: npm run dev -- --session=9155604591
│  └─ YES → Continue
│
├─ Check 2: Are logs showing "Valid leads"?
│  ├─ NO (0 leads) → Go to ISSUE A
│  ├─ YES (X leads) → Continue
│  └─ ERROR → Go to ISSUE B
│
├─ Check 3: Are logs showing "SEND TRIGGER"?
│  ├─ NO → Go to ISSUE C
│  └─ YES → Continue
│
├─ Check 4: Are logs showing "✅ SENT"?
│  ├─ NO (showing ❌ FAILED) → Go to ISSUE D
│  └─ YES → SUCCESS! ✅
│
└─ Check 5: Did Google Sheet status update?
   ├─ NO → Go to ISSUE E
   └─ YES → FULLY WORKING! 🎉
```

---

## 🔴 ISSUE A: No Valid Leads Detected

### Symptoms
```
[SHEET] sheet1 Valid leads: 0
[SHEET] sheet1 Pending rows: 0
```

### Diagnosis Tree
```
ISSUE A: No Valid Leads
│
├─ Check A1: Is sheet accessible?
│  ├─ NO → Sheet URL wrong or private
│  │   └─ FIX: Make sheet public, verify URL
│  └─ YES → Continue
│
├─ Check A2: Does sheet have data?
│  ├─ NO → Sheet is empty
│  │   └─ FIX: Add rows to sheet
│  └─ YES → Continue
│
├─ Check A3: Are rows marked "pending"?
│  ├─ NO → All rows are "sent" or "failed"
│  │   └─ FIX: Change status to "pending"
│  └─ YES → Continue
│
└─ Check A4: Is data format correct?
   ├─ NO → Invalid numbers/categories
   │   └─ FIX: See ISSUE F
   └─ YES → Contact support
```

### Quick Fix
```
1. Open Google Sheet
2. Check "status" column
3. Change all values to "pending" (lowercase)
4. Restart system
5. Check logs for "Valid leads: X"
```

---

## 🟠 ISSUE B: Fetch Error

### Symptoms
```
[SHEET] sheet1 Fetch error: timeout
[SHEET] sheet1 Fetch error: 403 Forbidden
```

### Diagnosis Tree
```
ISSUE B: Fetch Error
│
├─ Check B1: Is sheet public?
│  ├─ NO → Sheet is private
│  │   └─ FIX: Share sheet publicly
│  └─ YES → Continue
│
├─ Check B2: Is URL correct?
│  ├─ NO → Wrong spreadsheet ID
│  │   └─ FIX: Update SHEET_CONFIGS with correct ID
│  └─ YES → Continue
│
├─ Check B3: Is internet working?
│  ├─ NO → Network issue
│  │   └─ FIX: Check internet connection
│  └─ YES → Continue
│
└─ Check B4: Is Google Sheets API working?
   ├─ NO → Google service down
   │   └─ FIX: Wait and retry
   └─ YES → Contact support
```

### Quick Fix
```
1. Verify sheet is publicly shared
2. Copy correct spreadsheet ID from URL
3. Update SHEET_CONFIGS in multi-sheet-engine.ts
4. Restart system
```

---

## 🟡 ISSUE C: Send Trigger Not Reached

### Symptoms
```
[SHEET] sheet1 Valid leads: 3
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 No pending leads
```

### Diagnosis Tree
```
ISSUE C: Send Trigger Not Reached
│
├─ Check C1: Is daily limit reached?
│  ├─ YES → Limit exceeded
│  │   └─ FIX: Wait 24 hours or reset manually
│  └─ NO → Continue
│
├─ Check C2: Is client connected?
│  ├─ NO → WhatsApp not logged in
│  │   └─ FIX: Restart and scan QR code
│  └─ YES → Continue
│
├─ Check C3: Are leads being processed?
│  ├─ NO → Leads array is empty
│  │   └─ FIX: Check ISSUE A
│  └─ YES → Continue
│
└─ Check C4: Is there an exception?
   ├─ YES → Exception in processSheetOutreach
   │   └─ FIX: Check error logs
   └─ NO → Contact support
```

### Quick Fix
```
1. Check logs for "Daily limit reached"
2. If yes, wait 24 hours
3. If no, restart system
4. Scan QR code
5. Wait 120 seconds for hardening
```

---

## 🔴 ISSUE D: Send Fails

### Symptoms
```
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ❌ FAILED to send to 919876543210
```

### Diagnosis Tree
```
ISSUE D: Send Fails
│
├─ Check D1: Is client connected?
│  ├─ NO → WhatsApp disconnected
│  │   └─ FIX: Restart system, scan QR
│  └─ YES → Continue
│
├─ Check D2: Is phone number valid?
│  ├─ NO → Invalid format
│  │   └─ FIX: See ISSUE F
│  └─ YES → Continue
│
├─ Check D3: Is message empty?
│  ├─ YES → No message to send
│  │   └─ FIX: Add message to sheet
│  └─ NO → Continue
│
├─ Check D4: Is rate limit hit?
│  ├─ YES → Too many sends too fast
│  │   └─ FIX: Increase SEND_DELAY
│  └─ NO → Continue
│
└─ Check D5: Is phone number blocked?
   ├─ YES → Number blocked on WhatsApp
   │   └─ FIX: Use different number
   └─ NO → Contact support
```

### Quick Fix
```
1. Check WhatsApp is logged in
2. Verify phone number format (10+ digits)
3. Check message is not empty
4. Restart system
5. Try again
```

---

## 🟡 ISSUE E: Status Not Updating

### Symptoms
```
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
(But Google Sheet still shows "pending")
```

### Diagnosis Tree
```
ISSUE E: Status Not Updating
│
├─ Check E1: Is API key set?
│  ├─ NO → No API key configured
│  │   └─ FIX: Set GOOGLE_SHEETS_API_KEY env var
│  └─ YES → Continue
│
├─ Check E2: Is API key valid?
│  ├─ NO → Invalid or expired key
│  │   └─ FIX: Generate new API key
│  └─ YES → Continue
│
├─ Check E3: Does API have permissions?
│  ├─ NO → API not authorized
│  │   └─ FIX: Enable Sheets API in Google Cloud
│  └─ YES → Continue
│
└─ Check E4: Is sheet writable?
   ├─ NO → Sheet is read-only
   │   └─ FIX: Enable write permissions
   └─ YES → Contact support
```

### Quick Fix
```
1. Check logs for "No API key"
2. If yes, set GOOGLE_SHEETS_API_KEY
3. If no, verify API key is valid
4. Restart system
```

---

## 🟠 ISSUE F: Invalid Data Format

### Symptoms
```
[SHEET] sheet1 Invalid number "abc" - skipping
[SHEET] sheet1 Invalid category "other" - skipping
[SHEET] sheet1 Number too short "123" - skipping
```

### Diagnosis Tree
```
ISSUE F: Invalid Data Format
│
├─ Check F1: Phone numbers
│  ├─ Contains non-numeric? → Remove +, spaces
│  ├─ Too short (< 10)? → Add country code
│  ├─ Too long (> 12)? → Remove extra digits
│  └─ Format: 91XXXXXXXXXX ✅
│
├─ Check F2: Categories
│  ├─ Uppercase? → Change to lowercase
│  ├─ Invalid value? → Use "clinic" or "hotel"
│  └─ Format: clinic or hotel ✅
│
├─ Check F3: Status
│  ├─ Uppercase? → Change to lowercase
│  ├─ Trailing space? → Remove whitespace
│  └─ Format: pending, sent, or failed ✅
│
└─ Check F4: Names & Messages
   ├─ Trailing space? → Remove whitespace
   ├─ Empty name? → Will default to "Sir"
   └─ Empty message? → Will use template ✅
```

### Quick Fix
```
1. Open Google Sheet
2. Check each column format:
   - number: 10+ digits (e.g., 9876543210)
   - category: clinic or hotel (lowercase)
   - status: pending (lowercase)
3. Fix invalid data
4. Restart system
```

---

## ✅ SUCCESS Indicators

### All Systems Go
```
[CLIENT] Found client for 9155604591
[SHEET] sheet1 Total rows fetched: 5
[SHEET] sheet1 Valid leads: 3
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
[SHEET] sheet1 ✅ SENT to 919876543211 (2/100)
[SHEET] sheet1 ✅ SENT to 919876543212 (3/100)
[SHEET] sheet1 Completed (sent: 3/100)
```

### Verification Checklist
- [ ] Logs show "Valid leads: X" where X > 0
- [ ] Logs show "SEND TRIGGER" for each lead
- [ ] Logs show "✅ SENT" for each message
- [ ] Google Sheet status column updates to "sent"
- [ ] WhatsApp receives messages on target numbers

---

## 🚨 Emergency Troubleshooting

### If nothing works:

**Step 1: Verify basics**
```bash
# Check system is running
ps aux | grep node

# Check logs for errors
npm run dev -- --session=9155604591 2>&1 | head -50
```

**Step 2: Verify sheet**
```bash
# Check sheet is accessible
curl "https://docs.google.com/spreadsheets/d/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/export?format=csv"
```

**Step 3: Verify WhatsApp**
```bash
# Check client is connected
# Send test message: "hi"
# Should receive: "Working ✅"
```

**Step 4: Reset and retry**
```bash
# Kill all node processes
killall node

# Restart system
npm run dev -- --session=9155604591

# Scan QR code
# Wait 120 seconds
# Check logs
```

---

## 📞 Support Information

### When to contact support:
1. All checks pass but still no sends
2. Consistent "FAILED" messages
3. Google Sheet not updating despite API key
4. WhatsApp client keeps disconnecting

### Information to provide:
1. Last 50 lines of logs
2. Google Sheet format (screenshot)
3. Error messages from logs
4. System info (OS, Node version)

---

## 📊 Log Grep Commands

### Find all issues
```bash
grep "ERROR\|FAILED\|Invalid\|skipping" logs.txt
```

### Find valid leads
```bash
grep "Valid leads:" logs.txt
```

### Find sends
```bash
grep "SENT\|FAILED" logs.txt
```

### Find summary
```bash
grep "SHEET READ SUMMARY" -A 6 logs.txt
```

### Real-time monitoring
```bash
npm run dev -- --session=9155604591 2>&1 | grep SHEET
```

---

**Last Updated**: 2024
