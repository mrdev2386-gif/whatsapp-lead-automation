# Google Sheets API - Technical Reference

## 🔌 API Endpoints

### 1. Fetch Sheet Data
**Endpoint**: `GET /v4/spreadsheets/{spreadsheetId}/values/{range}`

**Usage**:
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
const response = await axios.get(url, { timeout: 15000 });
```

**Example**:
```
GET https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values/Sheet1!A:Z?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs
```

**Response**:
```json
{
  "range": "Sheet1!A1:D3",
  "majorDimension": "ROWS",
  "values": [
    ["name", "phone", "message", "status"],
    ["John", "9876543210", "Hi John...", "pending"],
    ["Jane", "9876543211", "Hi Jane...", "pending"]
  ]
}
```

**Rate Limit**: 500 requests/minute

---

### 2. Update Single Cell
**Endpoint**: `PUT /v4/spreadsheets/{spreadsheetId}/values/{range}`

**Usage**:
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
await axios.put(url, {
  values: [[value]]
}, { timeout: 10000 });
```

**Example**:
```
PUT https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values/Sheet1!D2?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs

Body:
{
  "values": [["sent"]]
}
```

**Response**:
```json
{
  "spreadsheetId": "1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ",
  "updatedRange": "Sheet1!D2",
  "updatedRows": 1,
  "updatedColumns": 1,
  "updatedCells": 1
}
```

**Rate Limit**: 500 requests/minute

---

### 3. Batch Update Cells
**Endpoint**: `POST /v4/spreadsheets/{spreadsheetId}/values:batchUpdate`

**Usage**:
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate?key=${API_KEY}`;
await axios.post(url, {
  data: [
    { range: "Sheet1!D2", values: [["sent"]] },
    { range: "Sheet1!D3", values: [["sent"]] }
  ],
  valueInputOption: 'USER_ENTERED'
}, { timeout: 10000 });
```

**Example**:
```
POST https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values:batchUpdate?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs

Body:
{
  "data": [
    { "range": "Sheet1!D2", "values": [["sent"]] },
    { "range": "Sheet1!D3", "values": [["sent"]] }
  ],
  "valueInputOption": "USER_ENTERED"
}
```

**Response**:
```json
{
  "spreadsheetId": "1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ",
  "totalUpdatedRows": 2,
  "totalUpdatedColumns": 1,
  "totalUpdatedCells": 2,
  "responses": [...]
}
```

**Rate Limit**: 500 requests/minute

---

### 4. Append Row
**Endpoint**: `POST /v4/spreadsheets/{spreadsheetId}/values/{range}:append`

**Usage**:
```typescript
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?key=${API_KEY}`;
await axios.post(url, {
  values: [["John", "9876543210", "Hi John...", "pending"]]
}, { timeout: 10000 });
```

**Example**:
```
POST https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values/Sheet1!A:Z:append?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs

Body:
{
  "values": [["John", "9876543210", "Hi John...", "pending"]]
}
```

**Response**:
```json
{
  "spreadsheetId": "1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ",
  "updatedRange": "Sheet1!A4:D4",
  "updatedRows": 1,
  "updatedColumns": 4,
  "updatedCells": 4
}
```

**Rate Limit**: 500 requests/minute

---

## 🔑 API Key Configuration

### Location
```env
GOOGLE_SHEETS_API_KEY=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs
```

### Usage in Code
```typescript
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || 'AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs';

// In URL
const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Sheet1?key=${API_KEY}`;
```

### Permissions Required
- ✅ `https://www.googleapis.com/auth/spreadsheets` - Read/Write
- ✅ `https://www.googleapis.com/auth/drive` - File access

---

## 📊 Data Mapping

### Request Format
```typescript
interface SheetData {
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
}

interface SheetRow {
  [key: string]: string;
}
```

### Example Response
```json
{
  "spreadsheetId": "1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ",
  "sheetName": "Sheet1",
  "headers": ["name", "phone", "message", "status"],
  "rows": [
    {
      "name": "John",
      "phone": "9876543210",
      "message": "Hi John...",
      "status": "pending"
    },
    {
      "name": "Jane",
      "phone": "9876543211",
      "message": "Hi Jane...",
      "status": "pending"
    }
  ]
}
```

---

## ⚠️ Error Codes

### 400 Bad Request
```json
{
  "error": {
    "code": 400,
    "message": "Invalid range",
    "errors": [{"message": "Invalid range", "domain": "global", "reason": "badRequest"}]
  }
}
```

**Causes**:
- Invalid range format
- Invalid spreadsheet ID
- Malformed request

---

### 403 Forbidden
```json
{
  "error": {
    "code": 403,
    "message": "The caller does not have permission",
    "errors": [{"message": "The caller does not have permission", "domain": "global", "reason": "forbidden"}]
  }
}
```

**Causes**:
- Invalid API key
- Sheet not shared with API key account
- Insufficient permissions

---

### 404 Not Found
```json
{
  "error": {
    "code": 404,
    "message": "Requested entity not found",
    "errors": [{"message": "Requested entity not found", "domain": "global", "reason": "notFound"}]
  }
}
```

**Causes**:
- Invalid spreadsheet ID
- Sheet name doesn't exist
- Spreadsheet deleted

---

### 429 Too Many Requests
```json
{
  "error": {
    "code": 429,
    "message": "Rate Limit Exceeded",
    "errors": [{"message": "Rate Limit Exceeded", "domain": "global", "reason": "rateLimitExceeded"}]
  }
}
```

**Causes**:
- Exceeded 500 requests/minute
- Too many concurrent requests

**Solution**:
- Implement exponential backoff
- Increase polling interval
- Reduce number of sheets

---

## 🔄 Request/Response Cycle

### Fetch Data
```
1. Request
   GET /v4/spreadsheets/{id}/values/Sheet1?key={key}
   
2. Response (200 OK)
   {
     "range": "Sheet1!A1:D3",
     "values": [...]
   }
   
3. Parse
   headers = values[0]
   rows = values.slice(1)
   
4. Map
   rows.map(row => ({
     name: row[0],
     phone: row[1],
     message: row[2],
     status: row[3]
   }))
```

### Update Status
```
1. Request
   PUT /v4/spreadsheets/{id}/values/Sheet1!D2?key={key}
   { "values": [["sent"]] }
   
2. Response (200 OK)
   {
     "updatedRange": "Sheet1!D2",
     "updatedRows": 1,
     "updatedCells": 1
   }
   
3. Verify
   Check updatedCells === 1
```

---

## 📈 Rate Limits

### Quotas
- **Requests per minute**: 500
- **Requests per day**: 1,000,000
- **Concurrent requests**: 100

### Optimization
```typescript
// Good: Batch updates
await batchUpdateSheetCells(id, [
  { range: "Sheet1!D2", value: "sent" },
  { range: "Sheet1!D3", value: "sent" }
]);

// Bad: Individual updates
await updateSheetCell(id, "Sheet1!D2", "sent");
await updateSheetCell(id, "Sheet1!D3", "sent");
```

---

## 🔐 Security Best Practices

### API Key Protection
```typescript
// ✅ Good
const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

// ❌ Bad
const API_KEY = 'AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs';
```

### Error Handling
```typescript
// ✅ Good
if (err.response?.status === 403) {
  console.error('Permission denied - check API key');
}

// ❌ Bad
console.error('Error:', err.message); // Might expose API key
```

### Logging
```typescript
// ✅ Good
console.log(`[SHEETS-API] Fetching: ${spreadsheetId}`);

// ❌ Bad
console.log(`[SHEETS-API] URL: ${url}`); // Exposes API key
```

---

## 🧪 Testing

### Manual Test
```bash
# Fetch data
curl "https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values/Sheet1?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs"

# Update cell
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"values":[["sent"]]}' \
  "https://sheets.googleapis.com/v4/spreadsheets/1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ/values/Sheet1!D2?key=AIzaSyAOB97HJHHsAbO50QQ-kJtw3jyXU22A0bs"
```

### Unit Test
```typescript
describe('Google Sheets API', () => {
  it('should fetch sheet data', async () => {
    const data = await fetchFromGoogleSheetsAPI(
      '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
      'Sheet1'
    );
    expect(data.headers).toBeDefined();
    expect(data.rows).toBeDefined();
  });

  it('should update cell', async () => {
    const result = await updateSheetCell(
      '1EX1deJaPlYOqv45d7lMmW552g9vvFh6cESG3CMl9tFQ',
      'Sheet1!D2',
      'sent'
    );
    expect(result).toBe(true);
  });
});
```

---

## 📚 References

### Official Documentation
- [Google Sheets API v4](https://developers.google.com/sheets/api)
- [Values API](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/values)
- [Batch Update](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/values/batchUpdate)

### Related APIs
- [Google Drive API](https://developers.google.com/drive/api)
- [Google Cloud Console](https://console.cloud.google.com)

---

## ✅ Implementation Checklist

- [x] API endpoints documented
- [x] Request/response formats shown
- [x] Error codes explained
- [x] Rate limits documented
- [x] Security best practices listed
- [x] Testing examples provided
- [x] Code samples included

---

**Status**: ✅ COMPLETE - All API endpoints documented and integrated
