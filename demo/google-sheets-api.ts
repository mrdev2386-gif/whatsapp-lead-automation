import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SHEETS API INTEGRATION - REPLACES CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = "AIzaSyCyDHcSwHCU4Tb53cvQ9KB9eM1EQW37Hck";

interface SheetRow {
  [key: string]: string;
}

interface SheetData {
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
}

/**
 * Fetch data directly from Google Sheets API (replaces CSV export)
 * @param spreadsheetId - Google Sheets ID
 * @param sheetName - Sheet name (default: Sheet1)
 * @returns Sheet data with headers and rows
 */
async function fetchFromGoogleSheetsAPI(
  spreadsheetId: string,
  sheetName: string = 'Sheet1'
): Promise<SheetData> {
  try {
    const encodedSheetName = encodeURIComponent(sheetName);
    const range = `${encodedSheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;

    console.log(`[SHEETS-API] Fetching: ${spreadsheetId} (${sheetName})`);
    console.log(`[SHEETS-URL] ${url}`);

    const response = await axios.get(url, { timeout: 15000 });

    if (!response.data.values || response.data.values.length === 0) {
      console.log(`[SHEETS-API] No data found in ${sheetName}`);
      return {
        spreadsheetId,
        sheetName,
        headers: [],
        rows: []
      };
    }

    const allRows = response.data.values;
    const headers = (allRows[0] || []).map((h: string) => (h || '').toLowerCase().trim());

    console.log(`[SHEETS-API] Headers: ${headers.join(', ')}`);
    console.log(`[SHEETS-API] Total rows: ${allRows.length - 1}`);

    // Convert rows to objects using headers
    const rows: SheetRow[] = allRows.slice(1).map((row: string[]) => {
      const obj: SheetRow = {};
      headers.forEach((header: string, idx: number) => {
        if (header) {
          obj[header] = (row[idx] || '').trim();
        }
      });
      return obj;
    });

    return {
      spreadsheetId,
      sheetName,
      headers,
      rows
    };
  } catch (err: any) {
    console.error(`[SHEETS-API] Error fetching ${spreadsheetId}:`, err.message);
    if (err.response?.status === 403) {
      console.error('[SHEETS-API] Permission denied - check API key and sheet access');
    }
    if (err.response?.status === 404) {
      console.error('[SHEETS-API] Spreadsheet not found - check spreadsheet ID');
    }
    throw err;
  }
}

/**
 * Update a cell in Google Sheets (for marking leads as sent)
 * @param spreadsheetId - Google Sheets ID
 * @param range - Cell range (e.g., "Sheet1!D2")
 * @param value - Value to set
 */
async function updateSheetCell(
  spreadsheetId: string,
  range: string,
  value: string
): Promise<boolean> {
  try {
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW&key=${API_KEY}`;

    await axios.put(url, {
      range,
      values: [[value]]
    }, { timeout: 10000 });

    console.log(`[SHEETS-API] Updated ${range} → ${value}`);
    return true;
  } catch (err: any) {
    console.error(`[SHEETS-API] Update failed for ${range}:`, err.message);
    return false;
  }
}

/**
 * Batch update multiple cells
 * @param spreadsheetId - Google Sheets ID
 * @param updates - Array of {range, value} objects
 */
async function batchUpdateSheetCells(
  spreadsheetId: string,
  updates: Array<{ range: string; value: string }>
): Promise<boolean> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate?key=${API_KEY}`;

    const data = {
      data: updates.map(u => ({
        range: u.range,
        values: [[u.value]]
      })),
      valueInputOption: 'USER_ENTERED'
    };

    await axios.post(url, data, { timeout: 10000 });

    console.log(`[SHEETS-API] Batch updated ${updates.length} cells`);
    return true;
  } catch (err: any) {
    console.error(`[SHEETS-API] Batch update failed:`, err.message);
    return false;
  }
}

/**
 * Append a new row to Google Sheets
 * @param spreadsheetId - Google Sheets ID
 * @param sheetName - Sheet name
 * @param values - Row values
 */
async function appendRowToSheet(
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<boolean> {
  try {
    const encodedSheetName = encodeURIComponent(sheetName);
    const range = `${encodedSheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?key=${API_KEY}`;

    await axios.post(url, {
      values: [values]
    }, { timeout: 10000 });

    console.log(`[SHEETS-API] Appended row to ${sheetName}`);
    return true;
  } catch (err: any) {
    console.error(`[SHEETS-API] Append failed:`, err.message);
    return false;
  }
}

/**
 * Fix sheet structure by rewriting headers and shifting data
 * @param spreadsheetId - Google Sheets ID
 * @param sheetName - Sheet name
 */
async function fixSheetStructure(
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  try {
    console.log(`[SHEETS-FIX] Starting structure fix for ${sheetName}...`);

    const encodedSheetName = encodeURIComponent(sheetName);
    const range = `${encodedSheetName}!A:D`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;

    const response = await axios.get(url, { timeout: 15000 });

    if (!response.data.values || response.data.values.length === 0) {
      console.log('[SHEETS-FIX] No data found in sheet');
      return false;
    }

    const rows = response.data.values;
    console.log(`[SHEETS-FIX] Found ${rows.length} rows`);

    // Create fixed data with correct headers
    const fixedData = [
      ['name', 'phone', 'message', 'status'],
      ...rows.map((r: string[]) => [
        (r[0] || '').trim(),
        '91' + ((r[1] || '').replace(/\D/g, '').slice(-10)),
        (r[2] || '').trim(),
        'pending'
      ])
    ];

    console.log(`[SHEETS-FIX] Prepared ${fixedData.length} rows with corrected structure`);

    // Update sheet with fixed data
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;

    await axios.put(
      updateUrl,
      {
        range: `${sheetName}!A:D`,
        values: fixedData
      },
      { timeout: 15000 }
    );

    console.log(`[SHEETS-FIX] ✅ Sheet structure fixed successfully`);
    console.log(`[SHEETS-FIX] - Headers: name, phone, message, status`);
    console.log(`[SHEETS-FIX] - Phone numbers formatted with 91 prefix`);
    console.log(`[SHEETS-FIX] - All statuses set to pending`);
    console.log(`[SHEETS-FIX] - Data preserved and shifted correctly`);

    return true;
  } catch (err: any) {
    console.error(`[SHEETS-FIX] Error fixing sheet structure:`, err.message);
    if (err.response?.status === 403) {
      console.error('[SHEETS-FIX] Permission denied - check API key and sheet access');
    }
    if (err.response?.status === 404) {
      console.error('[SHEETS-FIX] Spreadsheet not found - check spreadsheet ID');
    }
    return false;
  }
}

export {
  fetchFromGoogleSheetsAPI,
  updateSheetCell,
  batchUpdateSheetCells,
  appendRowToSheet,
  fixSheetStructure,
  SheetData,
  SheetRow,
  API_KEY
};
