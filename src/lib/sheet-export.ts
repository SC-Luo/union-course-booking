import type { BookingData } from "@/lib/types";

type CsvColumn<T = Record<string, unknown>> = {
  key: string;
  label: string;
  value?: (row: T) => unknown;
};

type ExportTable = {
  id: keyof BookingData;
  label: string;
  description: string;
  fileName: string;
  columns: CsvColumn[];
};

function valueAtPath(row: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, row);
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvCell(value: unknown) {
  const text = stringifyCell(value);
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  // BOM 讓 Google Sheet / Excel 較容易正確辨識 UTF-8 中文。
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\n")}`;
}

function buildTableRows(data: BookingData, table: ExportTable) {
  const source = data[table.id];
  const rows = Array.isArray(source) ? source : [];

  return rows.map((rawRow) => {
    const row = rawRow as Record<string, unknown>;
    return table.columns.map((column) => {
      if (column.value) return column.value(row);
      return valueAtPath(row, column.key);
    });
  });
}

export const EXPORT_TABLES: ExportTable[] = [
  {
    id: "students",
    label: "學員主檔",
    description: "一位學員一列；作為後續名冊、預約、點名與學習歷程的主資料。",
    fileName: "01_students.csv",
    columns: [
      { key: "id", label: "studentId" },
      { key: "externalMemberNo", label: "會員編號" },
      { key: "branch", label: "分會" },
      { key: "name", label: "姓名" },
      { key: "phone", label: "手機" },
      { key: "idNumberLast3", label: "身分識別末碼" },
      { key: "birthday", label: "生日" },
      { key: "address", label: "地址" },
      { key: "source", label: "來源" },
      { key: "notes", label: "備註" },
      { key: "createdAt", label: "建立時間" },
      { key: "updatedAt", label: "更新時間" },
    ],
  },
  {
    id: "courseSeries",
    label: "課程系列",
    description: "課程本體，例如美容丙級、美甲初階；不代表某年度實際開課。",
    fileName: "02_courseSeries.csv",
    columns: [
      { key: "id", label: "seriesId" },
      { key: "code", label: "系列代碼" },
      { key: "title", label: "課程系列名稱" },
      { key: "categoryId", label: "分類" },
      { key: "defaultCourseMode", label: "預設課程模式" },
      { key: "description", label: "說明" },
      { key: "defaultLocation", label: "預設地點" },
      { key: "defaultCapacity", label: "預設名額" },
      { key: "color", label: "顏色" },
      { key: "isActive", label: "啟用" },
    ],
  },
  {
    id: "courseOfferings",
    label: "年度 / 期別課程",
    description: "同一課程系列在不同年度或期別的實際開設。",
    fileName: "03_courseOfferings.csv",
    columns: [
      { key: "id", label: "offeringId" },
      { key: "seriesId", label: "seriesId" },
      { key: "categoryId", label: "分類" },
      { key: "code", label: "課程代碼" },
      { key: "title", label: "課程名稱" },
      { key: "displayTitle", label: "顯示名稱" },
      { key: "year", label: "西元年度" },
      { key: "termLabel", label: "期別" },
      { key: "sourceSheet", label: "來源工作表" },
      { key: "sourceRocYear", label: "民國年度" },
      { key: "courseMode", label: "課程模式" },
      { key: "location", label: "地點" },
      { key: "capacity", label: "名額" },
      { key: "bookingOpen", label: "開放報名" },
      { key: "status", label: "狀態" },
    ],
  },
  {
    id: "courseSessions",
    label: "上課場次",
    description: "每一堂實際上課時間。",
    fileName: "04_courseSessions.csv",
    columns: [
      { key: "id", label: "sessionId" },
      { key: "offeringId", label: "offeringId" },
      { key: "legacyCourseId", label: "舊courseId" },
      { key: "seriesId", label: "seriesId" },
      { key: "categoryId", label: "分類" },
      { key: "date", label: "日期" },
      { key: "startsAt", label: "開始時間" },
      { key: "endsAt", label: "結束時間" },
      { key: "title", label: "標題" },
      { key: "unitName", label: "單元" },
      { key: "location", label: "地點" },
      { key: "capacity", label: "名額" },
      { key: "bookingDeadline", label: "報名截止" },
      { key: "status", label: "狀態" },
      { key: "stats.reservedCount", label: "已預約" },
      { key: "stats.attendedCount", label: "已到" },
      { key: "stats.absentCount", label: "未到" },
      { key: "stats.uncheckedCount", label: "未點名" },
    ],
  },
  {
    id: "studentCourseRecords",
    label: "學員課程紀錄",
    description: "Excel 中每個非空的學生 × 課程資料格都會保存成一筆。",
    fileName: "05_studentCourseRecords.csv",
    columns: [
      { key: "id", label: "recordId" },
      { key: "studentId", label: "studentId" },
      { key: "seriesId", label: "seriesId" },
      { key: "offeringId", label: "offeringId" },
      { key: "sourceSheet", label: "來源工作表" },
      { key: "sourceRocYear", label: "民國年度" },
      { key: "sourceWesternYear", label: "西元年度" },
      { key: "sourceRow", label: "來源列" },
      { key: "sourceColumn", label: "來源課程欄" },
      { key: "sourceCell", label: "來源格" },
      { key: "rawValue", label: "原始值" },
      { key: "normalizedValue", label: "整理後值" },
      { key: "recordType", label: "判斷類型" },
      { key: "firstAttendanceAt", label: "第一堂日期" },
      { key: "entitlementId", label: "複訓資格Id" },
      { key: "importBatchId", label: "匯入批次" },
      { key: "importedAt", label: "匯入時間" },
    ],
  },
  {
    id: "entitlements",
    label: "複訓資格",
    description: "自由預約複訓課的一年上課權利。",
    fileName: "06_entitlements.csv",
    columns: [
      { key: "id", label: "entitlementId" },
      { key: "studentId", label: "studentId" },
      { key: "seriesId", label: "seriesId" },
      { key: "offeringId", label: "offeringId" },
      { key: "sourceSheet", label: "來源工作表" },
      { key: "sourceRocYear", label: "民國年度" },
      { key: "sourceRecordId", label: "來源紀錄" },
      { key: "entitlementType", label: "資格類型" },
      { key: "startsAt", label: "開始日" },
      { key: "endsAt", label: "到期日" },
      { key: "status", label: "狀態" },
      { key: "createdAt", label: "建立時間" },
    ],
  },
  {
    id: "enrollments",
    label: "課程名冊關聯",
    description: "固定名單課與學員的關聯。",
    fileName: "07_enrollments.csv",
    columns: [
      { key: "id", label: "enrollmentId" },
      { key: "studentId", label: "studentId" },
      { key: "offeringId", label: "offeringId" },
      { key: "seriesId", label: "seriesId" },
      { key: "enrollmentType", label: "名冊類型" },
      { key: "status", label: "狀態" },
      { key: "importedBatchId", label: "匯入批次" },
      { key: "joinedAt", label: "加入時間" },
      { key: "leftAt", label: "離開時間" },
      { key: "notes", label: "備註" },
    ],
  },
  {
    id: "attendanceRecords",
    label: "點名 / 學習歷程",
    description: "每位學員對每一堂課的出席紀錄。",
    fileName: "08_attendanceRecords.csv",
    columns: [
      { key: "id", label: "attendanceId" },
      { key: "studentId", label: "studentId" },
      { key: "offeringId", label: "offeringId" },
      { key: "seriesId", label: "seriesId" },
      { key: "sessionId", label: "sessionId" },
      { key: "reservationId", label: "reservationId" },
      { key: "source", label: "來源" },
      { key: "status", label: "出席狀態" },
      { key: "checkedAt", label: "點名時間" },
      { key: "checkedBy", label: "點名人" },
      { key: "note", label: "備註" },
    ],
  },
  {
    id: "reservations",
    label: "預約紀錄",
    description: "學員自行預約或後台手動加入的預約紀錄。",
    fileName: "09_reservations.csv",
    columns: [
      { key: "id", label: "reservationId" },
      { key: "studentId", label: "studentId" },
      { key: "courseId", label: "舊courseId" },
      { key: "offeringId", label: "offeringId" },
      { key: "seriesId", label: "seriesId" },
      { key: "sessionId", label: "sessionId" },
      { key: "studentName", label: "姓名" },
      { key: "phoneLastThree", label: "手機末三碼" },
      { key: "bookedAt", label: "預約時間" },
      { key: "cancelledAt", label: "取消時間" },
      { key: "status", label: "預約狀態" },
      { key: "attendanceStatus", label: "出席狀態" },
      { key: "source", label: "來源" },
    ],
  },
  {
    id: "importBatches",
    label: "匯入批次",
    description: "每次匯入 Excel / 名冊的批次摘要。",
    fileName: "10_importBatches.csv",
    columns: [
      { key: "id", label: "importBatchId" },
      { key: "importType", label: "匯入類型" },
      { key: "fileName", label: "檔名" },
      { key: "totalRows", label: "總列數" },
      { key: "totalCourseCells", label: "課程資料格數" },
      { key: "createdStudents", label: "新增學員" },
      { key: "updatedStudents", label: "更新學員" },
      { key: "createdCourseSeries", label: "新增課程系列" },
      { key: "createdCourseOfferings", label: "新增年度課程" },
      { key: "createdStudentCourseRecords", label: "新增課程紀錄" },
      { key: "createdEntitlements", label: "新增複訓資格" },
      { key: "warningCount", label: "警告數" },
      { key: "status", label: "狀態" },
      { key: "createdAt", label: "建立時間" },
    ],
  },
  {
    id: "categories",
    label: "課程分類",
    description: "分類、顏色與排序。",
    fileName: "11_categories.csv",
    columns: [
      { key: "id", label: "categoryId" },
      { key: "code", label: "代碼" },
      { key: "name", label: "名稱" },
      { key: "description", label: "說明" },
      { key: "sortOrder", label: "排序" },
      { key: "isActive", label: "啟用" },
      { key: "color", label: "顏色" },
    ],
  },
];

export function getExportTable(tableId: string) {
  return EXPORT_TABLES.find((table) => table.id === tableId);
}

export function buildSheetCsv(data: BookingData, tableId: string) {
  const table = getExportTable(tableId);
  if (!table) return null;

  const headers = table.columns.map((column) => column.label);
  const rows = buildTableRows(data, table);
  return {
    table,
    csv: toCsv(headers, rows),
    rowCount: rows.length,
  };
}
