import { getBookingData } from "@/lib/booking-repository";
import { EXPORT_TABLES } from "@/lib/sheet-export";

type GoogleSheetsSyncMode = "all";

type GoogleSheetsTablePayload = {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
};

type GoogleSheetsSyncPayload = {
  token: string;
  mode: GoogleSheetsSyncMode;
  generatedAt: string;
  tables: GoogleSheetsTablePayload[];
};

export type GoogleSheetsSyncResult =
  | {
      ok: true;
      updatedSheets: number;
      message: string;
    }
  | {
      ok: false;
      reason: "not-configured" | "failed";
      message: string;
    };

function valueAtPath(row: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, row);
}

function toSheetCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function safeSheetName(name: string) {
  // Google Sheets 工作表名稱不能包含部分特殊字元，且長度上限為 100。
  const cleaned = name.replace(/\.csv$/i, "").replace(/[\\/?*\[\]:]/g, "_").slice(0, 100);
  return cleaned || "sheet";
}


async function buildPayload(token: string, mode: GoogleSheetsSyncMode): Promise<GoogleSheetsSyncPayload> {
  const data = await getBookingData();
  const tables = EXPORT_TABLES.map((table) => {
    const source = data[table.id];
    const rows = Array.isArray(source) ? source : [];
    const headers = table.columns.map((column) => column.label);
    const body = rows.map((rawRow) => {
      const row = rawRow as Record<string, unknown>;
      return table.columns.map((column) => toSheetCellValue(column.value ? column.value(row) : valueAtPath(row, column.key)));
    });

    return {
      sheetName: safeSheetName(table.sheetName ?? table.fileName),
      headers,
      rows: body,
    };
  });

  return {
    token,
    mode,
    generatedAt: new Date().toISOString(),
    tables,
  };
}

async function readWebhookResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as { ok?: boolean; updatedSheets?: number; error?: string };
  } catch {
    return { ok: response.ok, error: text };
  }
}

export async function syncGoogleSheets(mode: GoogleSheetsSyncMode = "all"): Promise<GoogleSheetsSyncResult> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  const token = process.env.GOOGLE_SHEETS_SYNC_TOKEN?.trim();

  console.log("[google-sheets-sync env]", {
    hasWebhookUrl: Boolean(webhookUrl),
    hasSyncToken: Boolean(token),
  });

  if (!webhookUrl || !token) {
    return {
      ok: false,
      reason: "not-configured",
      message: "尚未設定 GOOGLE_SHEETS_WEBHOOK_URL 或 GOOGLE_SHEETS_SYNC_TOKEN。",
    };
  }

  try {
    const payload = await buildPayload(token, mode);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await readWebhookResponse(response);

    if (!response.ok || result?.ok === false) {
      return {
        ok: false,
        reason: "failed",
        message: result?.error || `Google Apps Script Webhook 回應失敗：${response.status}`,
      };
    }

    return {
      ok: true,
      updatedSheets: Number(result?.updatedSheets ?? payload.tables.length),
      message: "已同步到 Google 試算表。",
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : "同步到 Google 試算表時發生未知錯誤。",
    };
  }
}
