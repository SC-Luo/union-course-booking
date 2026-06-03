const DEFAULT_SPREADSHEET_ID = "1UhO0cnrR7XFxtJO4KLx107JW4pimZQ7MTwLPhRh7eQQ";
const TOKEN_PROPERTIES = ["SYNC_TOKEN", "GOOGLE_SHEETS_SYNC_TOKEN"];

function doPost(event) {
  try {
    const payload = parsePayload(event);
    const properties = PropertiesService.getScriptProperties();
    const expectedTokens = getConfiguredTokens(properties);
    const payloadToken = String(payload.token || "").trim();

    if (!payloadToken || expectedTokens.indexOf(payloadToken) === -1) {
      return jsonResponse({ ok: false, error: "invalid token" });
    }

    const spreadsheetId = getSpreadsheetId(properties);
    if (!spreadsheetId) {
      return jsonResponse({ ok: false, error: "SPREADSHEET_ID is missing" });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const tables = Array.isArray(payload.tables) ? payload.tables : [];
    let updatedSheets = 0;

    tables.forEach(function(table) {
      const sheetName = safeSheetName(table.sheetName);
      const headers = Array.isArray(table.headers) ? table.headers : [];
      const rows = Array.isArray(table.rows) ? table.rows : [];

      writeTable(spreadsheet, sheetName, headers, rows);
      updatedSheets += 1;
    });

    writeSyncMeta(spreadsheet, {
      generatedAt: payload.generatedAt || "",
      syncedAt: new Date().toISOString(),
      updatedSheets: updatedSheets
    });

    return jsonResponse({ ok: true, updatedSheets: updatedSheets });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function setupGoogleSheetsSyncProperties() {
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", DEFAULT_SPREADSHEET_ID);
}

function parsePayload(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("request body is missing");
  }

  return JSON.parse(event.postData.contents);
}

function getConfiguredTokens(properties) {
  const tokens = [];

  TOKEN_PROPERTIES.forEach(function(key) {
    const value = String(properties.getProperty(key) || "").trim();
    if (value && tokens.indexOf(value) === -1) tokens.push(value);
  });

  return tokens;
}

function getSpreadsheetId(properties) {
  return String(properties.getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID || "").trim();
}

function writeTable(spreadsheet, sheetName, headers, rows) {
  const sheet = getOrCreateSheet(spreadsheet, sheetName);
  const width = Math.max(
    1,
    headers.length,
    rows.reduce(function(max, row) {
      return Math.max(max, Array.isArray(row) ? row.length : 0);
    }, 0)
  );
  const values = [headers].concat(rows).map(function(row) {
    return padRow(normalizeRow(row), width);
  });

  sheet.clearContents();
  ensureGridSize(sheet, values.length, width);

  if (values.length > 0) {
    sheet.getRange(1, 1, values.length, width).setValues(values);
    sheet.setFrozenRows(1);
  }

  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, width).setFontWeight("bold");
  }

  sheet.autoResizeColumns(1, Math.min(width, 40));
}

function writeSyncMeta(spreadsheet, meta) {
  const sheet = getOrCreateSheet(spreadsheet, "_sync_meta");
  const values = [
    ["key", "value"],
    ["syncedAt", meta.syncedAt],
    ["generatedAt", meta.generatedAt],
    ["updatedSheets", String(meta.updatedSheets)]
  ];

  sheet.clearContents();
  ensureGridSize(sheet, values.length, 2);
  sheet.getRange(1, 1, values.length, 2).setValues(values);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function getOrCreateSheet(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureGridSize(sheet, rowCount, columnCount) {
  if (sheet.getMaxRows() < rowCount) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < columnCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
  }
}

function safeSheetName(name) {
  const cleaned = String(name || "sheet")
    .replace(/\.csv$/i, "")
    .replace(/[\\/?*[\]:]/g, "_")
    .slice(0, 100);

  return cleaned || "sheet";
}

function normalizeRow(row) {
  const source = Array.isArray(row) ? row : [];
  return source.map(normalizeCellValue);
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function padRow(row, width) {
  const next = row.slice(0, width);
  while (next.length < width) next.push("");
  return next;
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
