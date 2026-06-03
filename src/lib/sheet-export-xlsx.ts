import * as XLSX from "xlsx";

import type { BookingData } from "@/lib/types";
import { EXPORT_TABLES } from "@/lib/sheet-export";

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

function safeSheetName(name: string, index: number) {
  // Excel 工作表名稱不可包含 : \/ ? * [ ]，且長度上限 31。
  const cleaned = name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
  return cleaned || `sheet_${index + 1}`;
}

export function buildGoogleSheetImportWorkbook(data: BookingData) {
  const workbook = XLSX.utils.book_new();

  EXPORT_TABLES.forEach((table, index) => {
    const headers = table.columns.map((column) => column.label);
    const source = data[table.id];
    const rows = Array.isArray(source) ? source : [];
    const body = rows.map((rawRow) => {
      const row = rawRow as Record<string, unknown>;
      return table.columns.map((column) => {
        const value = column.value ? column.value(row) : valueAtPath(row, column.key);
        return toSheetCellValue(value);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = headers.map((header, columnIndex) => {
      const maxBodyLength = body.reduce((max, row) => {
        const cell = row[columnIndex];
        const length = cell === null || cell === undefined ? 0 : String(cell).length;
        return Math.max(max, Math.min(length, 40));
      }, String(header).length);
      return { wch: Math.min(Math.max(maxBodyLength + 2, 10), 42) };
    });

    const sheetName = safeSheetName(table.sheetName ?? table.fileName.replace(/\.csv$/i, ""), index);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    compression: true,
  }) as Buffer;

  return buffer;
}

export function buildGoogleSheetImportFileName() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `union-course-booking-google-sheet-import-${date}.xlsx`;
}
