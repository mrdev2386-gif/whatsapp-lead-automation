# Google Sheets Outbound System - Runtime Debugging Guide

## Problem Statement

The multi-sheet outbound DM engine was not sending messages despite having pending leads in Google Sheets. Root causes needed to be identified through deep runtime debugging.

---

## 6 Debugging Tasks Implemented

### Task 1: Verify Sheet Data Structure

**What it does**: Validates that Google Sheets has the exact required columns.

**Implementation**:
```typescript
const headers = lines[0].toLowerCase().split(',').map((h: string) => h.trim());
console.log(`[SHEET] ${config.sheetId} Headers: ${headers.join(', ')}`);

const numberIdx = headers.indexOf('number');
const nameIdx = headers.indexOf('name');
const categoryIdx = headers.indexOf('category');
const statusIdx = headers.indexOf('status');
const messageIdx = headers.indexOf('message');
```

**Expected Log Output**:
```
[SHEET] sheet1 Headers: number, name, category, message, status
```

**What to check**:
- All 5 columns present: `number`, `name`, `category`, `message`, `status`
- Column order doesn't matter (uses indexOf)
- If any column is missing, system logs error and returns empty leads

---

### Task 2: Fix Status Filter

**What it does**: Normalizes status values to lowercase and trims whitespace.

**Implementation**:
```typescript
const rawStatus = values[statusIdx] || '';
const status = rawStatus.trim().toLowerCase();
const normalizedStatus = status === '' ? 'pending' : status;

if (normalizedStatus !== 'pending') {
  skippedCount++;
  continue;
}
```

**Handles these cases**:
- `"Pending"` → `"pending"` ✅
- `"PENDING"` → `"pending"` ✅
- `"pending "` (with spaces) → `"pending"` ✅
- `""` (empty) → `"pending"` (auto-fix) ✅
- `"sent"` → skipped ✅
- `"failed"` → skipped ✅

**Expected Log Output**:
```
[SHEET] sheet1 Row 2: status="Pending" → normalized="pending"
[SHEET] sheet1 Row 3: status="PENDING" → normalized="pending"
[SHEET] sheet1 Row 4: status="sent" → normalized="sent"
```

---

### Task 3: Validate and Normalize Numbers

**What it does**: Removes invalid characters and ensures proper phone number format.

**Implementation**:
```typescript
const rawNumber = values[numberIdx] || '';
const number = rawNumber.replace(/[^0-9]/g, ''); // Remove +, spaces, non-numeric

if (!number) {
  console.warn(`[SHEET] ${config.sheetId} Row ${i}: Invalid number "${rawNumber}" - skipping`);
  invalidNumberCount++;
  continue;
}

// Ensure format: 91XXXXXXXXXX (Indian format)
let formattedNumber = number;
if (!number.startsWith('91') && number.length === 10) {
  formattedNumber = '91' + number;
  console.log(`[SHEET] ${config.sheetId} Row ${i}: Auto-formatted number ${number} → ${formattedNumber}`);
}

if (formattedNumber.length < 10) {
  console.warn(`[SHEET] ${config.sheetId} Row ${i}: Number too short "${formattedNumber}" - skipping`);
  invalidNumberCount++;
  continue;
}
```

**Handles these cases**:
- `"+919876543210"` → `"919876543210"` ✅
- `"9876543210"` → `"919876543210"` (auto-format) ✅
- `"+91 9876543210"` → `"919876543210"` ✅
- `"9876543210 "` (with spaces) → `"919876543210"` ✅
- `"abc"` → skipped ❌
- `"123"` (too short) → skipped ❌

**Expected Log Output**:
```
[SHEET] sheet1 Row 2: Auto-formatted number 9876543210 → 919876543210
[SHEET] sheet1 Row 3: Invalid number "abc" - skipping
[SHEET] sheet1 Row 4: Number too short "123" - skipping
```

---

### Task 4: Debug Sheet Read

**What it does**: Logs comprehensive statistics about sheet reading process.

**Implementation**:
```typescript
console.log(`[SHEET] ${config.sheetId} === SHEET READ SUMMARY ===`);
console.log(`[SHEET] ${config.sheetId} Total rows: ${lines.length - 1}`);
console.log(`[SHEET] ${config.sheetId} Pending rows: ${pendingCount}`);
console.log(`[SHEET] ${config.sheetId} Valid leads: ${leads.length}`);
console.log(`[SHEET] ${config.sheetId} Skipped (non-pending): ${skippedCount}`);
console.log(`[SHEET] ${config.sheetId} Invalid numbers: ${invalidNumberCount}`);
console.log(`[SHEET] ${config.sheetId} Invalid categories: ${invalidCategoryCount}`);

if (leads.length === 0 && pendingCount > 0) {
  console.warn(`[SHEET] ${config.sheetId} Found ${pendingCount} pending rows but 0 valid leads!`);
  console.log(`[SHEET] ${config.sheetId} Sample row: ${lines[1]}`);
}
```

**Expected Log Output**:
```
[SHEET] sheet1 === SHEET READ SUMMARY ===
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 3
[SHEET] sheet1 Valid leads: 3
[SHEET] sheet1 Skipped (non-pending): 2
[SHEET] sheet1 Invalid numbers: 0
[SHEET] sheet1 Invalid categories: 0
```

**Debugging scenarios**:

**Scenario A: No leads detected**
```
[SHEET] sheet1 === SHEET READ SUMMARY ===
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 0
[SHEET] sheet1 Valid leads: 0
[SHEET] sheet1 Skipped (non-pending): 5
```
→ All rows have status != "pending". Check sheet status column.

**Scenario B: Pending but invalid**
```
[SHEET] sheet1 === SHEET READ SUMMARY ===
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 3
[SHEET] sheet1 Valid leads: 0
[SHEET] sheet1 Invalid numbers: 2
[SHEET] sheet1 Invalid categories: 1
[SHEET] sheet1 Sample row: ,John,clinic,message,pending
```
→ Numbers or categories are invalid. Check data format.

---

### Task 5: Ensure Send Trigger

**What it does**: Logs before and after sendSafe function execution.

**Implementation**:
```typescript
// TASK 5: Ensure send trigger - log before sendSafe call
console.log(`[SHEET] ${sheetId} === SEND TRIGGER ===`);
console.log(`[SHEET] ${sheetId} Sending to ${lead.number} (${lead.name}, ${lead.category})`);
console.log(`[SHEET] ${sheetId} Message preview: ${message.substring(0, 50)}...`);

// Use sendSafe to ensure proper delivery tracking
const success = await sendSafeFunc(chatId, message);

if (success) {
  const updated = await updateLeadStatusInSheet(config, lead, 'sent', chatId);
  if (updated) {
    metrics.sentToday += 1;
    console.log(`[SHEET] ${sheetId} ✅ SENT to ${lead.number} (${metrics.sentToday}/${DAILY_LIMIT})`);
  }
} else {
  await updateLeadStatusInSheet(config, lead, 'failed', chatId);
  metrics.failedLeads.push(lead);
  console.log(`[SHEET] ${sheetId} ❌ FAILED to send to ${lead.number}`);
}
```

**Expected Log Output**:
```
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543210 (John, clinic)
[SHEET] sheet1 Message preview: Hi John,

I came across your clinic...
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
```

**Debugging scenarios**:

**Scenario A: Send trigger not reached**
```
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 No pending leads
```
→ Leads were fetched but not processed. Check if leads array is empty.

**Scenario B: Send fails**
```
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543210 (John, clinic)
[SHEET] sheet1 ❌ FAILED to send to 919876543210
```
→ sendSafeFunc returned false. Check WhatsApp client connection.

---

### Task 6: Auto-Fix Missing Status

**What it does**: Treats missing or empty status values as "pending".

**Implementation**:
```typescript
const rawStatus = values[statusIdx] || '';
const status = rawStatus.trim().toLowerCase();
const normalizedStatus = status === '' ? 'pending' : status;
```

**Handles these cases**:
- Empty cell → treated as `"pending"` ✅
- Whitespace only → treated as `"pending"` ✅
- Explicit `"pending"` → kept as `"pending"` ✅

**Expected Log Output**:
```
[SHEET] sheet1 Row 2: status="" → normalized="pending"
[SHEET] sheet1 Row 3: status="   " → normalized="pending"
```

---

## Complete Debugging Workflow

### Step 1: Check Sheet Fetch
```
[SHEET] sheet1 Fetching from: https://docs.google.com/spreadsheets/d/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/export?format=csv
[SHEET] sheet1 Total rows fetched: 6
[SHEET] sheet1 Headers: number, name, category, message, status
```

**If you see**:
- `Total rows fetched: 1` → Sheet is empty or only has headers
- `Headers: ...` missing columns → Add missing columns to sheet

### Step 2: Check Row Processing
```
[SHEET] sheet1 Row 1: status="Pending" → normalized="pending"
[SHEET] sheet1 Row 1: ✅ Valid lead - 919876543210 (John, clinic)
[SHEET] sheet1 Row 2: status="sent" → normalized="sent"
```

**If you see**:
- `Invalid number` → Fix phone numbers in sheet
- `Invalid category` → Use only "clinic" or "hotel"
- `Number too short` → Ensure 10-digit numbers

### Step 3: Check Summary
```
[SHEET] sheet1 === SHEET READ SUMMARY ===
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 3
[SHEET] sheet1 Valid leads: 3
```

**If you see**:
- `Valid leads: 0` but `Pending rows: 3` → Check validation errors above
- `Valid leads: 3` → Proceed to Step 4

### Step 4: Check Send Trigger
```
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543210 (John, clinic)
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
```

**If you see**:
- `Start processing 0 leads` → No valid leads found (check Step 2)
- `SEND TRIGGER` not appearing → Check if leads array is empty
- `FAILED to send` → Check WhatsApp client connection

---

## Common Issues & Solutions

### Issue 1: "No pending leads"
**Logs**:
```
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 0
[SHEET] sheet1 Valid leads: 0
```

**Solution**:
1. Open Google Sheet
2. Check "status" column - all rows should have "pending"
3. Ensure status is lowercase or will be auto-normalized
4. Re-run system

### Issue 2: "Found pending rows but 0 valid leads"
**Logs**:
```
[SHEET] sheet1 Pending rows: 3
[SHEET] sheet1 Valid leads: 0
[SHEET] sheet1 Invalid numbers: 2
[SHEET] sheet1 Invalid categories: 1
```

**Solution**:
1. Check "number" column - must be 10+ digits
2. Check "category" column - must be "clinic" or "hotel"
3. Fix invalid data in sheet
4. Re-run system

### Issue 3: "Send trigger not reached"
**Logs**:
```
[SHEET] sheet1 Valid leads: 3
[SHEET] sheet1 Start processing 3 leads
[SHEET] sheet1 No pending leads
```

**Solution**:
1. Check if daily limit reached: `Sent: 100/100`
2. Check if client is connected: `[CLIENT] Found client for 9155604591`
3. Restart system

### Issue 4: "Send fails"
**Logs**:
```
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 ❌ FAILED to send to 919876543210
```

**Solution**:
1. Check WhatsApp client is logged in
2. Check phone number format is correct
3. Check message is not empty
4. Check daily limit not reached

---

## Expected Full Log Sequence

```
[SHEET] Auto-polling engine started (2-minute interval)
[CLIENT] Found client for 9155604591
[SHEET] sheet1 Fetching from: https://docs.google.com/spreadsheets/d/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/export?format=csv
[SHEET] sheet1 Total rows fetched: 6
[SHEET] sheet1 Headers: number, name, category, message, status
[SHEET] sheet1 Row 1: status="pending" → normalized="pending"
[SHEET] sheet1 Row 1: ✅ Valid lead - 919876543210 (John, clinic)
[SHEET] sheet1 Row 2: status="pending" → normalized="pending"
[SHEET] sheet1 Row 2: ✅ Valid lead - 919876543211 (Jane, hotel)
[SHEET] sheet1 Row 3: status="sent" → normalized="sent"
[SHEET] sheet1 === SHEET READ SUMMARY ===
[SHEET] sheet1 Total rows: 5
[SHEET] sheet1 Pending rows: 2
[SHEET] sheet1 Valid leads: 2
[SHEET] sheet1 Skipped (non-pending): 3
[SHEET] sheet1 Invalid numbers: 0
[SHEET] sheet1 Invalid categories: 0
[SHEET] sheet1 Start processing 2 leads
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543210 (John, clinic)
[SHEET] sheet1 Message preview: Hi John,

I came across your clinic...
[SHEET] sheet1 ✅ SENT to 919876543210 (1/100)
[SHEET] sheet1 === SEND TRIGGER ===
[SHEET] sheet1 Sending to 919876543211 (Jane, hotel)
[SHEET] sheet1 Message preview: Hi Jane,

I noticed your hotel online...
[SHEET] sheet1 ✅ SENT to 919876543211 (2/100)
[SHEET] sheet1 Completed (sent: 2/100)
```

---

## Testing Checklist

- [ ] Google Sheet has columns: number, name, category, message, status
- [ ] At least 1 row has status = "pending"
- [ ] Phone numbers are 10+ digits (auto-formatted to 91XXXXXXXXXX)
- [ ] Categories are "clinic" or "hotel" (lowercase)
- [ ] WhatsApp client is logged in and connected
- [ ] System logs show "Valid leads: X" where X > 0
- [ ] System logs show "SEND TRIGGER" for each lead
- [ ] System logs show "✅ SENT" for successful sends
- [ ] Google Sheet status column updates to "sent" after DM

---

## Files Modified

1. **multi-sheet-engine.ts**
   - Enhanced `fetchLeadsFromSheet()` with all 6 debugging tasks
   - Added comprehensive logging at each step
   - Improved error handling and validation

---

**Status**: ✅ Complete with full debugging capabilities
**Compatibility**: Node.js 16+, open-wa/wa-automate latest
**Last Updated**: 2024
