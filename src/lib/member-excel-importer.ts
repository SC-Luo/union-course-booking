import type {
  BookingData,
  CourseOffering,
  CourseSeries,
  Entitlement,
  Enrollment,
  ImportBatch,
  Student,
  StudentCourseRecord,
  StudentCourseRecordType,
} from "./types";

export type MemberWorkbookSheet = {
  name: string;
  /** 可傳入二維陣列。第一列會被視為表頭。 */
  rows: unknown[][];
};

export type MemberExcelImportOptions = {
  fileName: string;
  importedAt?: string;
  importedBy?: string;
  importBatchId?: string;
  /** 前幾欄是學員基本資料。預設會依表頭名稱自動判斷，通常為編號~地址。 */
  profileColumnNames?: string[];
};

export type MemberExcelImportSummary = {
  importBatchId: string;
  totalRows: number;
  totalCourseCells: number;
  createdStudents: number;
  updatedStudents: number;
  createdCourseSeries: number;
  createdCourseOfferings: number;
  createdStudentCourseRecords: number;
  createdEntitlements: number;
  warnings: string[];
};

const DEFAULT_PROFILE_COLUMNS = new Set(["編號", "建檔日期", "分會", "姓名", "手機", "生日", "身分證", "地址"]);

/**
 * 將會員 Excel 轉入 BookingData。
 *
 * 年度分開原則：
 * - 每個工作表（例如 ST115、ST114）都被視為不同來源年度 / 批次。
 * - 同一課程欄位名稱會共用同一個 courseSeries。
 * - 但每個 sheet + courseSeries 會建立獨立 courseOffering。
 * - 每一個非空課程格都會建立 studentCourseRecord，保留 sourceSheet / sourceRow / sourceColumn。
 * - 只有日期格會自動建立一年複訓 entitlement。
 */
export function importMemberWorkbookToBookingData(
  currentData: BookingData,
  workbook: MemberWorkbookSheet[],
  options: MemberExcelImportOptions,
): { data: BookingData; summary: MemberExcelImportSummary } {
  const importedAt = options.importedAt ?? new Date().toISOString();
  const importBatchId = options.importBatchId ?? `import-member-${safeId(options.fileName)}-${Date.now()}`;
  const profileColumns = new Set(options.profileColumnNames?.map(cleanHeader) ?? DEFAULT_PROFILE_COLUMNS);

  const data: BookingData = {
    ...currentData,
    students: [...(currentData.students ?? [])],
    courseSeries: [...(currentData.courseSeries ?? [])],
    courseOfferings: [...(currentData.courseOfferings ?? [])],
    studentCourseRecords: [...(currentData.studentCourseRecords ?? [])],
    enrollments: [...(currentData.enrollments ?? [])],
    entitlements: [...(currentData.entitlements ?? [])],
    importBatches: [...(currentData.importBatches ?? [])],
  };

  const summary: MemberExcelImportSummary = {
    importBatchId,
    totalRows: 0,
    totalCourseCells: 0,
    createdStudents: 0,
    updatedStudents: 0,
    createdCourseSeries: 0,
    createdCourseOfferings: 0,
    createdStudentCourseRecords: 0,
    createdEntitlements: 0,
    warnings: [],
  };

  for (const sheet of workbook) {
    if (!sheet.rows.length) continue;
    const [headerRow, ...bodyRows] = sheet.rows;
    const headers = headerRow.map((item) => cleanHeader(String(item ?? "")));
    const sourceYear = parseSourceYear(sheet.name);

    for (const [bodyIndex, row] of bodyRows.entries()) {
      const sourceRow = bodyIndex + 2;
      const profile = readProfile(headers, row);
      if (!profile.name && !profile.phone && !profile.externalMemberNo) continue;
      summary.totalRows += 1;

      const studentResult = upsertStudent(data.students, profile, importedAt);
      if (studentResult.created) summary.createdStudents += 1;
      else summary.updatedStudents += 1;
      const student = studentResult.student;

      headers.forEach((header, columnIndex) => {
        if (!header || profileColumns.has(header)) return;
        const rawCellValue = row[columnIndex];
        if (isBlank(rawCellValue)) return;

        summary.totalCourseCells += 1;
        const rawValue = stringifyCellValue(rawCellValue);
        const parsed = classifyCourseCell(rawCellValue);
        const series = upsertCourseSeries(data.courseSeries, header, importedAt);
        if (series.created) summary.createdCourseSeries += 1;

        const offering = upsertCourseOffering(data.courseOfferings, series.item, sheet.name, sourceYear, importedAt);
        if (offering.created) summary.createdCourseOfferings += 1;

        const recordId = buildStudentCourseRecordId(student.id, offering.item.id, sheet.name, sourceRow, header);
        let entitlementId: string | undefined;

        if (parsed.recordType === "first_attendance_date" && parsed.firstAttendanceAt) {
          const entitlement = upsertEntitlement(
            data.entitlements,
            student.id,
            series.item.id,
            offering.item.id,
            sheet.name,
            sourceYear.rocYear,
            recordId,
            parsed.firstAttendanceAt,
            importedAt,
          );
          entitlementId = entitlement.item.id;
          if (entitlement.created) summary.createdEntitlements += 1;
        }

        const enrollment = upsertEnrollment(
          data.enrollments,
          student.id,
          series.item.id,
          offering.item.id,
          parsed.recordType === "first_attendance_date" ? "active" : "active",
          importBatchId,
          importedAt,
        );
        const enrollmentId = enrollment.item.id;

        const existingRecord = data.studentCourseRecords.find((item) => item.id === recordId);
        const record: StudentCourseRecord = {
          id: recordId,
          studentId: student.id,
          seriesId: series.item.id,
          offeringId: offering.item.id,
          sourceSheet: sheet.name,
          sourceRocYear: sourceYear.rocYear,
          sourceWesternYear: sourceYear.westernYear,
          sourceRow,
          sourceColumn: header,
          sourceCell: `${columnName(columnIndex + 1)}${sourceRow}`,
          rawValue,
          normalizedValue: parsed.normalizedValue,
          recordType: parsed.recordType,
          firstAttendanceAt: parsed.firstAttendanceAt,
          entitlementId,
          enrollmentId,
          importBatchId,
          importedAt: existingRecord?.importedAt ?? importedAt,
          updatedAt: importedAt,
        };

        if (existingRecord) {
          Object.assign(existingRecord, record);
        } else {
          data.studentCourseRecords.push(record);
          summary.createdStudentCourseRecords += 1;
        }

        if (parsed.recordType === "unknown") {
          summary.warnings.push(`${sheet.name}!${record.sourceCell} 無法判斷資料格內容：${rawValue}`);
        }
      });
    }
  }

  const batch: ImportBatch = {
    id: importBatchId,
    importType: "member_excel",
    fileName: options.fileName,
    importedBy: options.importedBy,
    totalRows: summary.totalRows,
    totalCourseCells: summary.totalCourseCells,
    createdStudents: summary.createdStudents,
    updatedStudents: summary.updatedStudents,
    createdCourseSeries: summary.createdCourseSeries,
    createdCourseOfferings: summary.createdCourseOfferings,
    createdStudentCourseRecords: summary.createdStudentCourseRecords,
    createdEntitlements: summary.createdEntitlements,
    warningCount: summary.warnings.length,
    createdCount: summary.createdStudents + summary.createdStudentCourseRecords + summary.createdEntitlements,
    matchedCount: summary.updatedStudents,
    skippedCount: 0,
    errorCount: 0,
    status: "completed",
    createdAt: importedAt,
  };

  const existingBatch = data.importBatches.find((item) => item.id === batch.id);
  if (existingBatch) Object.assign(existingBatch, batch);
  else data.importBatches.push(batch);

  return { data, summary };
}

function readProfile(headers: string[], row: unknown[]) {
  const value = (name: string) => row[headers.indexOf(name)];
  return {
    externalMemberNo: cleanText(value("編號")),
    registeredAt: normalizeDateValue(value("建檔日期")),
    branch: cleanText(value("分會")),
    name: cleanText(value("姓名")),
    phone: cleanText(value("手機")),
    birthday: normalizeDateValue(value("生日")),
    nationalId: cleanText(value("身分證")),
    address: cleanText(value("地址")),
  };
}

function upsertStudent(students: Student[], profile: ReturnType<typeof readProfile>, importedAt: string) {
  const id = profile.externalMemberNo ? `student-${safeId(profile.externalMemberNo)}` : `student-${safeId(profile.name)}-${safeId(profile.phone)}`;
  const existing =
    students.find((student) => student.id === id) ??
    students.find((student) => Boolean(profile.phone) && student.phone === profile.phone) ??
    students.find((student) => Boolean(profile.name && profile.birthday) && student.name === profile.name && student.birthday === profile.birthday);

  const patch: Student = {
    ...(existing ?? {
      id,
      examGroup: "",
      seatNumber: students.length + 1,
      source: "excel_import",
      isActive: true,
    }),
    externalMemberNo: profile.externalMemberNo || existing?.externalMemberNo,
    branch: profile.branch || existing?.branch,
    name: profile.name || existing?.name || "未命名學員",
    phone: profile.phone || existing?.phone,
    birthday: profile.birthday || existing?.birthday,
    idNumberLast3: profile.nationalId?.slice(-3) || existing?.idNumberLast3,
    nationalIdHash: profile.nationalId ? `raw:${profile.nationalId}` : existing?.nationalIdHash,
    address: profile.address || existing?.address,
    source: existing?.source ?? "excel_import",
    updatedAt: importedAt,
    createdAt: existing?.createdAt ?? importedAt,
  };

  if (existing) {
    Object.assign(existing, patch);
    return { student: existing, created: false };
  }
  students.push(patch);
  return { student: patch, created: true };
}

function upsertCourseSeries(seriesList: CourseSeries[], columnName: string, importedAt: string) {
  const title = cleanCourseTitle(columnName);
  const id = `series-${safeId(title)}`;
  const existing = seriesList.find((item) => item.id === id);
  const patch: CourseSeries = {
    ...(existing ?? {
      id,
      code: safeId(title).toUpperCase(),
      title,
      categoryId: inferCategoryId(title),
      defaultCourseMode: "booking_flexible",
      isActive: true,
      createdAt: importedAt,
    }),
    title,
    categoryId: existing?.categoryId ?? inferCategoryId(title),
    updatedAt: importedAt,
  };
  if (existing) {
    Object.assign(existing, patch);
    return { item: existing, created: false };
  }
  seriesList.push(patch);
  return { item: patch, created: true };
}

function upsertCourseOffering(
  offerings: CourseOffering[],
  series: CourseSeries,
  sourceSheet: string,
  sourceYear: { rocYear?: number; westernYear?: number },
  importedAt: string,
) {
  const year = sourceYear.westernYear ?? new Date().getFullYear();
  const termLabel = sourceYear.rocYear ? `民國${sourceYear.rocYear}年度` : sourceSheet;
  const id = `offering-${safeId(series.id)}-${safeId(sourceSheet)}`;
  const existing = offerings.find((item) => item.id === id);
  const patch: CourseOffering = {
    ...(existing ?? {
      id,
      seriesId: series.id,
      categoryId: series.categoryId,
      code: `${series.code}-${sourceSheet}`,
      title: `${series.title} ${sourceSheet}`,
      displayTitle: `${series.title}｜${termLabel}`,
      year,
      termLabel,
      courseMode: series.defaultCourseMode,
      location: series.defaultLocation ?? "",
      capacity: series.defaultCapacity ?? 0,
      bookingOpen: true,
      status: "open",
      entitlementPolicy: {
        enabled: true,
        validMonths: 12,
        startFrom: "first_attendance",
      },
      createdAt: importedAt,
    }),
    sourceSheet,
    sourceRocYear: sourceYear.rocYear,
    updatedAt: importedAt,
  };
  if (existing) {
    Object.assign(existing, patch);
    return { item: existing, created: false };
  }
  offerings.push(patch);
  return { item: patch, created: true };
}

function upsertEnrollment(
  enrollments: Enrollment[],
  studentId: string,
  seriesId: string,
  offeringId: string,
  status: "active" | "withdrawn" | "completed" | "expired",
  importBatchId: string,
  importedAt: string,
) {
  const id = `enroll-${studentId}-${offeringId}`;
  const existing = enrollments.find((item) => item.id === id);
  const patch: Enrollment = {
    ...(existing ?? {
      id,
      studentId,
      offeringId,
      seriesId,
      enrollmentType: "booking_access",
      status,
      joinedAt: importedAt,
      createdAt: importedAt,
    }),
    importedBatchId: importBatchId,
    updatedAt: importedAt,
  };
  if (existing) {
    Object.assign(existing, patch);
    return { item: existing, created: false };
  }
  enrollments.push(patch);
  return { item: patch, created: true };
}

function upsertEntitlement(
  entitlements: Entitlement[],
  studentId: string,
  seriesId: string,
  offeringId: string,
  sourceSheet: string,
  sourceRocYear: number | undefined,
  sourceRecordId: string,
  startsAt: string,
  importedAt: string,
) {
  const endsAt = addYears(startsAt, 1);
  const id = `ent-${studentId}-${seriesId}-${startsAt}-${safeId(sourceSheet)}`;
  const existing = entitlements.find((item) => item.id === id);
  const patch: Entitlement = {
    ...(existing ?? {
      id,
      studentId,
      seriesId,
      offeringId,
      entitlementType: "one_year_retake",
      startsAt,
      endsAt,
      status: isExpired(endsAt) ? "expired" : "active",
      createdAt: importedAt,
    }),
    sourceSheet,
    sourceRocYear,
    sourceRecordId,
    updatedAt: importedAt,
  };
  if (existing) {
    Object.assign(existing, patch);
    return { item: existing, created: false };
  }
  entitlements.push(patch);
  return { item: patch, created: true };
}

function classifyCourseCell(value: unknown): {
  recordType: StudentCourseRecordType;
  normalizedValue: string;
  firstAttendanceAt?: string;
} {
  const date = normalizeDateValue(value);
  if (date) return { recordType: "first_attendance_date", normalizedValue: date, firstAttendanceAt: date };

  const text = cleanText(value);
  if (/^\d{2,3}[-－]\d+/.test(text)) return { recordType: "term_code", normalizedValue: text };
  if (/^(v|V|Y|y|有|是|✓|✔|√|ˇ)$/.test(text)) return { recordType: "marker", normalizedValue: text };
  if (/報名|待開課|尚未上課|未上/.test(text)) return { recordType: "registered_not_started", normalizedValue: text };
  if (/缺考|缺席|未到|退訓|取消/.test(text)) return { recordType: "absence_or_no_show", normalizedValue: text };
  if (/補繳|轉班|補課|特殊|待確認|備註/.test(text)) return { recordType: "note", normalizedValue: text };
  return { recordType: "unknown", normalizedValue: text };
}

function parseSourceYear(sourceSheet: string) {
  const match = sourceSheet.match(/ST(\d{2,3})/i);
  if (!match) return {};
  const rocYear = Number(match[1]);
  return Number.isFinite(rocYear) ? { rocYear, westernYear: rocYear + 1911 } : {};
}

function normalizeDateValue(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }
  const text = cleanText(value);
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanHeader(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function cleanCourseTitle(value: string) {
  return cleanHeader(value).replace(/[｜|].*$/g, "");
}

function cleanText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function stringifyCellValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cleanText(value);
}

function isBlank(value: unknown) {
  return cleanText(value) === "";
}

function buildStudentCourseRecordId(studentId: string, offeringId: string, sourceSheet: string, sourceRow: number, sourceColumn: string) {
  return `scr-${studentId}-${offeringId}-${safeId(sourceSheet)}-${sourceRow}-${safeId(sourceColumn)}`;
}

function safeId(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function addYears(date: string, years: number) {
  const value = new Date(`${date}T00:00:00+08:00`);
  value.setFullYear(value.getFullYear() + years);
  return value.toISOString().slice(0, 10);
}

function isExpired(date: string) {
  return date < new Date().toISOString().slice(0, 10);
}

function columnName(index: number) {
  let name = "";
  let value = index;
  while (value > 0) {
    const mod = (value - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    value = Math.floor((value - mod) / 26);
  }
  return name;
}

function inferCategoryId(title: string) {
  if (/美容|新祕|行動美容|粉刺|挽臉/.test(title)) return "B";
  if (/SPA|經絡|體甲/.test(title)) return "S";
  if (/甲|凝膠|手足/.test(title)) return "N";
  if (/睫|角蛋白|3D|36D/.test(title)) return "E";
  if (/髮|剪髮|男丙/.test(title)) return "H";
  if (/紋/.test(title)) return "T";
  if (/熱蠟|除毛/.test(title)) return "W";
  if (/行銷|AI|數位/.test(title)) return "D";
  if (/店長|創業|管理/.test(title)) return "M";
  return "O";
}
