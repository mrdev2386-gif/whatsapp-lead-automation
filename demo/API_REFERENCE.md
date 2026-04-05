# Google Sheets Write-Back System - API Reference

## sheets-writeback.ts

### Types

```typescript
interface SheetWriteConfig {
  spreadsheetId: string;      // Google Sheet ID
  sheetName: string;          // Sheet name (e.g., "Sheet1")
  apiKey?: string;            // Google Sheets API key
  serviceAccountKey?: any;    // Service account key (optional)
}

interface RowMapping {
  chatId: string;             // 919876543210@c.us
  sheetId: string;            // sheet1, sheet2, sheet3
  rowIndex: number;           // 1-indexed row number
  phoneNumber: string;        // 919876543210
  lastUpdateTime: number;     // Timestamp
}

interface UpdateResult {
  success: boolean;           // Update successful?
  rowIndex: number;           // Row that was updated
  status: 'sent' | 'failed';  // New status
  error?: string;             // Error message if failed
  retryCount: number;         // Number of retries used
}
```

### Functions

#### registerRowMapping()
Register a lead with its row information for future updates.

```typescript
registerRowMapping(
  chatId: string,
  sheetId: string,
  rowIndex: number,
  phoneNumber: string
): void
```

**Parameters:**
- `chatId` - WhatsApp chat ID (919876543210@c.us)
- `sheetId` - Sheet identifier (sheet1, sheet2, sheet3)
- `rowIndex` - Row number in sheet (1-indexed)
- `phoneNumber` - Phone number (919876543210)

**Example:**
```typescript
registerRowMapping('919876543210@c.us', 'sheet1', 2, '919876543210');
```

**Logs:**
```
[SHEET WRITEBACK] Registered 919876543210@c.us → row 2 (sheet: sheet1)
```

---

#### getRowMapping()
Get row mapping for a chat.

```typescript
getRowMapping(chatId: string): RowMapping | null
```

**Parameters:**
- `chatId` - WhatsApp chat ID

**Returns:**
- `RowMapping` if found, `null` otherwise

**Example:**
```typescript
const mapping = getRowMapping('919876543210@c.us');
if (mapping) {
  console.log(`Row: ${mapping.rowIndex}, Sheet: ${mapping.sheetId}`);
}
```

---

#### verifyRowStatus()
Verify row still exists and is pending before updating.

```typescript
async function verifyRowStatus(
  config: SheetWriteConfig,
  rowIndex: number
): Promise<boolean>
```

**Parameters:**
- `config` - Sheet configuration
- `rowIndex` - Row number to verify

**Returns:**
- `true` if row exists and status is "pending"
- `false` otherwise

**Example:**
```typescript
const config: SheetWriteConfig = {
  spreadsheetId: '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
  sheetName: 'Sheet1',
  apiKey: process.env.GOOGLE_SHEETS_API_KEY
};

const isValid = await verifyRowStatus(config, 2);
if (isValid) {
  console.log('Row is still pending');
}
```

---

#### updateLeadStatusInSheet()
Update lead status in Google Sheets with retry logic.

```typescript
async function updateLeadStatusInSheet(
  config: SheetWriteConfig,
  rowIndex: number,
  newStatus: 'sent' | 'failed',
  retryCount?: number
): Promise<UpdateResult>
```

**Parameters:**
- `config` - Sheet configuration
- `rowIndex` - Row number to update
- `newStatus` - New status ('sent' or 'failed')
- `retryCount` - Current retry count (internal)

**Returns:**
- `UpdateResult` with success status and details

**Retry Logic:**
- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 5 seconds
- Attempt 4: After 10 seconds
- Max 3 retries (4 total attempts)

**Example:**
```typescript
const result = await updateLeadStatusInSheet(config, 2, 'sent');
if (result.success) {
  console.log(`Updated row ${result.rowIndex} to ${result.status}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

**Logs:**
```
[SHEET UPDATE] Updated row 2 → sent
[SHEET UPDATE ERROR] Attempt 1/4: Network timeout
[SHEET RETRY] Retrying in 2000ms...
```

---

#### batchUpdateLeadStatus()
Batch update multiple rows (respects API quota).

```typescript
async function batchUpdateLeadStatus(
  config: SheetWriteConfig,
  updates: Array<{ rowIndex: number; status: 'sent' | 'failed' }>
): Promise<UpdateResult[]>
```

**Parameters:**
- `config` - Sheet configuration
- `updates` - Array of updates to perform

**Returns:**
- Array of `UpdateResult` for each update

**Features:**
- Sequential processing (not parallel)
- 500ms delay between API calls
- Respects Google Sheets API quota

**Example:**
```typescript
const updates = [
  { rowIndex: 2, status: 'sent' as const },
  { rowIndex: 3, status: 'sent' as const },
  { rowIndex: 4, status: 'failed' as const }
];

const results = await batchUpdateLeadStatus(config, updates);
results.forEach(r => {
  console.log(`Row ${r.rowIndex}: ${r.success ? 'OK' : 'FAILED'}`);
});
```

---

#### markLeadAsSent()
Mark lead as sent after successful delivery.

```typescript
async function markLeadAsSent(
  config: SheetWriteConfig,
  chatId: string
): Promise<boolean>
```

**Parameters:**
- `config` - Sheet configuration
- `chatId` - WhatsApp chat ID

**Returns:**
- `true` if update successful
- `false` otherwise

**Example:**
```typescript
const success = await markLeadAsSent(config, '919876543210@c.us');
if (success) {
  console.log('Lead marked as sent');
}
```

**Logs:**
```
[SHEET UPDATE] 919876543210@c.us marked as sent
```

---

#### markLeadAsFailed()
Mark lead as failed after delivery failure.

```typescript
async function markLeadAsFailed(
  config: SheetWriteConfig,
  chatId: string
): Promise<boolean>
```

**Parameters:**
- `config` - Sheet configuration
- `chatId` - WhatsApp chat ID

**Returns:**
- `true` if update successful
- `false` otherwise

**Example:**
```typescript
const success = await markLeadAsFailed(config, '919876543210@c.us');
if (success) {
  console.log('Lead marked as failed');
}
```

---

#### cleanupOldMappings()
Clean up old mappings (older than 7 days).

```typescript
function cleanupOldMappings(): void
```

**Features:**
- Runs automatically every 24 hours
- Removes mappings older than 7 days
- Logs cleanup count

**Example:**
```typescript
cleanupOldMappings();
```

**Logs:**
```
[SHEET WRITEBACK] Cleaned up 5 old mappings
```

---

#### loadMappings()
Load mappings from disk.

```typescript
function loadMappings(): void
```

**Features:**
- Called automatically on startup
- Loads from `wa-sheet-mappings.json`
- Logs count of loaded mappings

**Example:**
```typescript
loadMappings();
```

**Logs:**
```
[SHEET WRITEBACK] Loaded 42 row mappings
```

---

#### saveMappings()
Save mappings to disk.

```typescript
function saveMappings(): void
```

**Features:**
- Called automatically after registration
- Saves to `wa-sheet-mappings.json`
- Ensures restart safety

**Example:**
```typescript
saveMappings();
```

---

## multi-sheet-engine.ts

### Types

```typescript
interface SheetConfig {
  sheetId: string;            // sheet1, sheet2, sheet3
  sessionId: string;          // WhatsApp session ID
  spreadsheetId: string;      // Google Sheet ID
  sheetName: string;          // Sheet name
}

interface SheetLead {
  rowIndex: number;           // Row number
  number: string;             // Phone number
  name: string;               // Contact name
  category: 'clinic' | 'hotel'; // Category
  message?: string;           // Custom message
  status: 'pending' | 'sent' | 'failed'; // Status
}

interface SheetMetrics {
  sentToday: number;          // Leads sent today
  lastResetTime: number;      // Last reset timestamp
  failedLeads: SheetLead[];   // Failed leads
  lastPollTime: number;       // Last poll timestamp
}
```

### Functions

#### fetchLeadsFromSheet()
Fetch pending leads from Google Sheets CSV export.

```typescript
async function fetchLeadsFromSheet(
  config: SheetConfig
): Promise<SheetLead[]>
```

**Parameters:**
- `config` - Sheet configuration

**Returns:**
- Array of pending leads

**Features:**
- Fetches via CSV export (no auth needed)
- Filters for "pending" status only
- Validates required columns
- 10-second timeout

**Example:**
```typescript
const leads = await fetchLeadsFromSheet(SHEET_CONFIGS[0]);
console.log(`Found ${leads.length} pending leads`);
```

**Logs:**
```
[SHEET] sheet1 Fetched 50 pending leads
```

---

#### updateLeadStatusInSheet()
Update lead status in Google Sheets.

```typescript
async function updateLeadStatusInSheet(
  config: SheetConfig,
  lead: SheetLead,
  newStatus: 'sent' | 'failed',
  chatId: string
): Promise<boolean>
```

**Parameters:**
- `config` - Sheet configuration
- `lead` - Lead to update
- `newStatus` - New status
- `chatId` - WhatsApp chat ID

**Returns:**
- `true` if successful
- `false` otherwise

**Features:**
- Registers row mapping
- Calls sheets-writeback API
- Gracefully skips if no API key

**Example:**
```typescript
const success = await updateLeadStatusInSheet(
  config,
  lead,
  'sent',
  '919876543210@c.us'
);
```

---

#### processSheetOutreach()
Process one sheet's outreach.

```typescript
async function processSheetOutreach(
  client: Client,
  config: SheetConfig,
  sendSafeFunc: (chatId: string, text: string) => Promise<boolean>
): Promise<void>
```

**Parameters:**
- `client` - WhatsApp client
- `config` - Sheet configuration
- `sendSafeFunc` - Safe send function

**Features:**
- Fetches pending leads
- Respects daily limit (100/day)
- 60-second delay between sends
- Updates status after send
- Tracks metrics

**Example:**
```typescript
const sendSafeFunc = async (chatId: string, text: string) => {
  const user = getUser(chatId);
  await sendSafe(client, chatId, user, text);
  return true;
};

await processSheetOutreach(client, SHEET_CONFIGS[0], sendSafeFunc);
```

**Logs:**
```
[SHEET] sheet1 Start processing 50 leads
[SHEET] sheet1 Sending to 919876543210
[SHEET] sheet1 SENT → 919876543210 (1/100)
[SHEET] sheet1 Completed (sent: 50/100)
```

---

#### startAutoPolling()
Start auto-polling engine (runs every 2 minutes).

```typescript
async function startAutoPolling(
  clients: Record<string, Client>,
  sendSafeFunc: (sessionId: string, chatId: string, text: string) => Promise<boolean>
): Promise<void>
```

**Parameters:**
- `clients` - Map of session ID to client
- `sendSafeFunc` - Safe send function

**Features:**
- Polls every 2 minutes
- Processes all sheets
- Handles errors gracefully
- Logs polling activity

**Example:**
```typescript
const clientMap: Record<string, Client> = {};
const sendSafeWrapper = async (sessionId: string, chatId: string, text: string) => {
  const user = getUser(chatId);
  await sendSafe(client, chatId, user, text);
  return true;
};

startAutoPolling(clientMap, sendSafeWrapper);
```

**Logs:**
```
[SHEET] Auto-polling engine started (2-minute interval)
```

---

#### getSheetMetrics()
Get metrics for sheets.

```typescript
function getSheetMetrics(sheetId?: string): Record<string, any>
```

**Parameters:**
- `sheetId` - Optional sheet ID (if not provided, returns all)

**Returns:**
- Metrics object with sent count, daily limit, failed count, last reset

**Example:**
```typescript
// Get all metrics
const allMetrics = getSheetMetrics();
console.log(allMetrics);

// Get specific sheet
const sheet1Metrics = getSheetMetrics('sheet1');
console.log(`sheet1: ${sheet1Metrics.sentToday}/${sheet1Metrics.dailyLimit}`);
```

**Output:**
```typescript
{
  sheet1: {
    sentToday: 45,
    dailyLimit: 100,
    failedCount: 2,
    lastReset: "2024-01-15T10:30:00.000Z"
  },
  sheet2: {
    sentToday: 78,
    dailyLimit: 100,
    failedCount: 1,
    lastReset: "2024-01-15T10:30:00.000Z"
  }
}
```

---

## outbound-integration.ts

### Types

```typescript
interface OutboundLead {
  chatId: string;             // 919876543210@c.us
  sessionId: string;          // WhatsApp session ID
  sheetId: string;            // sheet1, sheet2, sheet3
  category: 'clinic' | 'hotel'; // Category
  sentTime: number;           // Timestamp
  messageId?: string;         // Message ID
}
```

### Functions

#### registerOutboundLead()
Register outbound lead for reply tracking.

```typescript
function registerOutboundLead(
  chatId: string,
  sessionId: string,
  sheetId: string,
  category: 'clinic' | 'hotel'
): void
```

**Parameters:**
- `chatId` - WhatsApp chat ID
- `sessionId` - Session ID
- `sheetId` - Sheet ID
- `category` - Category (clinic or hotel)

**Example:**
```typescript
registerOutboundLead('919876543210@c.us', '9155604591', 'sheet1', 'clinic');
```

**Logs:**
```
[OUTBOUND] Registered 919876543210@c.us from sheet1 (clinic)
```

---

#### isOutboundLead()
Check if chat is from outbound campaign.

```typescript
function isOutboundLead(chatId: string): boolean
```

**Parameters:**
- `chatId` - WhatsApp chat ID

**Returns:**
- `true` if outbound lead
- `false` otherwise

**Example:**
```typescript
if (isOutboundLead(chatId)) {
  console.log('This is an outbound lead');
}
```

---

#### getOutboundLead()
Get outbound lead info.

```typescript
function getOutboundLead(chatId: string): OutboundLead | null
```

**Parameters:**
- `chatId` - WhatsApp chat ID

**Returns:**
- `OutboundLead` if found, `null` otherwise

**Example:**
```typescript
const lead = getOutboundLead('919876543210@c.us');
if (lead) {
  console.log(`Category: ${lead.category}, Sheet: ${lead.sheetId}`);
}
```

---

#### processOutboundReply()
Process reply from outbound lead.

```typescript
function processOutboundReply(chatId: string, message: string): string | null
```

**Parameters:**
- `chatId` - WhatsApp chat ID
- `message` - User message

**Returns:**
- Reply message if handled, `null` otherwise

**Features:**
- Clinic pricing negotiation
- Hotel reply handling
- Automatic response generation

**Example:**
```typescript
const reply = processOutboundReply('919876543210@c.us', 'What is the price?');
if (reply) {
  await client.sendText(chatId, reply);
}
```

---

#### shouldPrioritizeOutboundReply()
Check if reply should be prioritized.

```typescript
function shouldPrioritizeOutboundReply(chatId: string): boolean
```

**Parameters:**
- `chatId` - WhatsApp chat ID

**Returns:**
- `true` if outbound lead reply
- `false` otherwise

**Example:**
```typescript
if (shouldPrioritizeOutboundReply(chatId)) {
  // Handle outbound reply first
  const reply = processOutboundReply(chatId, message);
  if (reply) {
    await sendSafe(client, chatId, user, reply);
    return; // Exit early
  }
}
```

---

## Constants

### multi-sheet-engine.ts

```typescript
const DAILY_LIMIT = 100;              // Leads per day per sheet
const POLL_INTERVAL = 2 * 60 * 1000;  // 2 minutes
const SEND_DELAY = 60 * 1000;         // 60 seconds between sends
```

### sheets-writeback.ts

```typescript
const maxRetries = 3;                 // Max retry attempts
const retryDelays = [2000, 5000, 10000]; // Retry delays (ms)
const MAPPING_FILE = 'wa-sheet-mappings.json'; // Mapping file
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `No API key - skipping write-back` | `GOOGLE_SHEETS_API_KEY` not set | Add API key to environment |
| `Row no longer pending or doesn't exist` | Row status changed | Prevents overwriting manual updates |
| `Network timeout` | API unreachable | Automatic retry with backoff |
| `Invalid response format` | CSV parsing failed | Check sheet structure |
| `Missing required columns` | Column headers incorrect | Verify columns: number, name, category, status |

### Retry Logic

```
Attempt 1: Immediate
  ↓ (if fails)
Attempt 2: Wait 2s
  ↓ (if fails)
Attempt 3: Wait 5s
  ↓ (if fails)
Attempt 4: Wait 10s
  ↓ (if fails)
FAILED - Keep as "pending"
```

---

## Integration Example

```typescript
import {
  registerRowMapping,
  markLeadAsSent,
  markLeadAsFailed,
  SheetWriteConfig
} from './sheets-writeback';

import {
  processSheetOutreach,
  startAutoPolling,
  getSheetMetrics
} from './multi-sheet-engine';

import {
  registerOutboundLead,
  isOutboundLead,
  processOutboundReply,
  shouldPrioritizeOutboundReply
} from './outbound-integration';

// Setup
const config: SheetWriteConfig = {
  spreadsheetId: '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
  sheetName: 'Sheet1',
  apiKey: process.env.GOOGLE_SHEETS_API_KEY
};

// Handle incoming message
if (shouldPrioritizeOutboundReply(chatId)) {
  const reply = processOutboundReply(chatId, message);
  if (reply) {
    await client.sendText(chatId, reply);
    return;
  }
}

// After sending message
registerRowMapping(chatId, 'sheet1', 2, '919876543210');
const success = await markLeadAsSent(config, chatId);

// Get metrics
const metrics = getSheetMetrics();
console.log(metrics);
```

---

**API Reference Complete** ✅
