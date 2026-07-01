import Link from "next/link";
import {
  assignStudentsToCourseEligibilityAction,
  bulkImportStudentIdentitiesAction,
  bulkUpdateStudentCourseEligibilityAction,
  hardDeleteStudentIdentityAction,
  updateStudentIdentityStatusAction,
  saveStudentIdentityAction,
  updateStudentCourseEligibilityAction,
  saveInstructorIdentityAction,
  deleteInstructorIdentityAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { RosterFlowNav } from "@/components/roster-flow-nav";
import { getBookingData } from "@/lib/booking-repository";
import type {
  CourseOffering,
  CourseSeries,
  Instructor,
  Student,
  StudentCourseRecord,
} from "@/lib/types";
import { StudentDirectoryPage } from "./student-directory-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{
    mode?: string;
    seriesId?: string;
    year?: string;
    offeringId?: string;
    status?: string;
    q?: string;
    instructorId?: string;
    saved?: string;
    error?: string;
    imported?: string;
    skipped?: string;
    linked?: string;
    enrolled?: string;
    filter?: string;
  }>;
};

type CourseOption = {
  id: string;
  title: string;
  color?: string;
  categoryId?: string;
  isActive?: boolean;
};

const ELIGIBILITY_STATUSES = ["上課中", "已結訓"];

type ActiveClassChip = {
  offeringId: string;
  seriesId: string;
  year: string;
  label: string;
};

const IMPORT_ELIGIBILITY_STATUSES = ELIGIBILITY_STATUSES;
const MODES = [
  ["students", "學員名冊", "匯入與新增學員基本資料"],
  ["eligibility", "課程資格", "選擇指定班級後，批量加入尚未加入的學員"],
  ["instructors", "講師名冊", "管理講師基本資料、授課專長與狀態"],
  ["history", "學習履歷", "彙整學員資格、梯次、報名與出席紀錄"],
] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function norm(value: unknown) {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

function looksLikeMemberNo(value: unknown) {
  return /^ST\d{2,}-\d{3,}$/i.test(text(value));
}

function looksLikeChineseName(value: unknown) {
  return /^[\u4e00-\u9fa5·・]{2,8}$/.test(text(value));
}

function isLikelyMisalignedStudent(student: Student) {
  return (
    looksLikeMemberNo(student.name) ||
    looksLikeChineseName(student.birthday) ||
    /^0\d{8,9}$/.test(text(student.memberNo).replace(/\D/g, ""))
  );
}

function getRosterStatus(student: Student) {
  if (isLikelyMisalignedStudent(student)) {
    return {
      key: "misaligned",
      label: "疑似錯位",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (student.needsReview) {
    return {
      key: "review",
      label: "待確認",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (student.isActive === false) {
    return {
      key: "inactive",
      label: "停用",
      className: "border-zinc-200 bg-zinc-50 text-zinc-500",
    };
  }
  return {
    key: "active",
    label: "啟用",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

const STUDENT_STATUS_FILTERS = [
  ["all", "全部"],
  ["active", "啟用"],
  ["inactive", "停用"],
  ["review", "待確認"],
  ["misaligned", "疑似錯位"],
] as const;

function statusTone(status: string) {
  if (status === "已結訓")
    return "border-sky-200 bg-sky-50 text-sky-700";
  if (["未加入", ""].includes(status))
    return "border-zinc-200 bg-zinc-50 text-zinc-500";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function canBook(status: string) {
  return status === "上課中";
}

function getCourseRosterStatus(record?: StudentCourseRecord) {
  const value = text(record?.normalizedValue || record?.rawValue || "上課中");
  if (["上課中", "已分配梯次"].includes(value)) return "上課中";
  if (["已結訓", "通過", "completed"].includes(value)) return "已結訓";
  return value;
}

function isEligibilityRecord(record: StudentCourseRecord) {
  const sourceColumn = norm(record.sourceColumn);
  return (
    record.recordType === "roster" ||
    sourceColumn.includes("課程資格") ||
    sourceColumn.includes("課程狀態") ||
    sourceColumn.includes("上課資格") ||
    sourceColumn.includes("eligibility") ||
    sourceColumn.includes("美容丙級")
  );
}

function optionKeyFromOffering(offering: CourseOffering) {
  return text(
    offering.seriesId || offering.courseMasterId || offering.courseSeriesId,
  );
}

function offeringBelongsToOption(offering: CourseOffering, optionId: string) {
  return [offering.seriesId, offering.courseMasterId, offering.courseSeriesId]
    .map(text)
    .includes(optionId);
}

function normalizeCourseTitleForMatch(value: unknown) {
  return norm(cleanCourseTitle(text(value)));
}

function offeringMatchesCourseOption(
  offering: CourseOffering,
  option?: CourseOption,
) {
  if (!option) return false;
  if (offeringBelongsToOption(offering, option.id)) return true;

  const optionTitle = normalizeCourseTitleForMatch(option.title);
  const offeringTitles = [
    offering.displayTitle,
    offering.displayName,
    offering.title,
    offering.name,
    offering.shortName,
    offering.classDisplayName,
  ].map(normalizeCourseTitleForMatch);

  return (
    Boolean(optionTitle) &&
    offeringTitles.some(
      (title) =>
        title === optionTitle ||
        title.includes(optionTitle) ||
        optionTitle.includes(title),
    )
  );
}

function recordMatches(
  record: StudentCourseRecord,
  seriesId: string,
  year: string,
) {
  if (!isEligibilityRecord(record)) return false;
  if (
    seriesId !== "all" &&
    record.seriesId !== seriesId &&
    record.courseMasterId !== seriesId
  )
    return false;
  if (
    year !== "all" &&
    String(record.year ?? record.sourceRocYear ?? "") !== year
  )
    return false;
  return true;
}

function cleanCourseTitle(value: string) {
  return text(value)
    .replace(/\s*[｜|]\s*\d+\s*年.*$/g, "")
    .replace(/\s*\d+\s*年\s*[｜|].*$/g, "")
    .trim();
}

function getCourseOptions(
  courseSeries: CourseSeries[],
  courseOfferings: CourseOffering[],
) {
  const options = new Map<string, CourseOption>();

  courseSeries.forEach((series) => {
    if (!series.id) return;
    options.set(series.id, {
      id: series.id,
      title: series.title || series.name || series.id,
      color: series.color || series.defaultColor,
      categoryId: series.categoryId,
      isActive: series.isActive,
    });
  });

  courseOfferings.forEach((offering) => {
    const id = optionKeyFromOffering(offering);
    if (!id || options.has(id)) return;
    const title = cleanCourseTitle(
      offering.displayTitle ||
        offering.displayName ||
        offering.title ||
        offering.shortName ||
        id,
    );
    options.set(id, {
      id,
      title: title || id,
      color: offering.color,
      categoryId: offering.categoryId,
      isActive: offering.isActive ?? offering.status !== "archived",
    });
  });

  return Array.from(options.values())
    .filter((item) => item.isActive !== false)
    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
}

function getYearOptions(
  courseOfferings: CourseOffering[],
  records: StudentCourseRecord[],
) {
  const values = new Set<string>();
  courseOfferings.forEach((item) => {
    if (item.year) values.add(String(item.year));
  });
  records.forEach((item) => {
    const year = item.year ?? item.sourceRocYear;
    if (year) values.add(String(year));
  });
  if (values.size === 0) values.add(String(new Date().getFullYear() - 1911));
  return Array.from(values).sort((a, b) => Number(b) - Number(a));
}

function buildHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const qs = query.toString();
  return `/admin/students${qs ? `?${qs}` : ""}`;
}

function baseTemplateText() {
  return [
    "姓名\t身分證後三碼\t手機\t生日\t會員編號\t備註",
    "王小明\t123\t0912345678\t1990/01/01\tM001\t115年度美容丙級學員",
    "李小美\t456\t0987654321\t1991/02/02\tM002\t尚未決定考試梯次",
  ].join("\n");
}

function getStudentName(student?: Student) {
  return student?.name ?? "未知學員";
}

function getStudentSortKey(student: Student) {
  const memberNo = text(student.memberNo);
  if (memberNo) return memberNo;
  return getStudentName(student);
}

function compareStudentsByMemberNo(a: Student, b: Student) {
  return getStudentSortKey(a).localeCompare(getStudentSortKey(b), "zh-Hant", {
    numeric: true,
  });
}

function studentMatches(student: Student, q: string) {
  const query = norm(q);
  if (!query) return true;
  return [
    student.name,
    student.idNumberLast3,
    student.phone,
    student.memberNo,
    student.note,
    student.source,
  ]
    .map(norm)
    .some((item) => item.includes(query));
}

function instructorMatches(instructor: Instructor, q: string) {
  const query = norm(q);
  if (!query) return true;
  return [
    instructor.name,
    instructor.phone,
    instructor.note,
    instructor.source,
    ...(instructor.specialties ?? []),
    ...(instructor.courseSeriesIds ?? []),
    ...(instructor.courseOfferingIds ?? []),
  ]
    .map(norm)
    .some((item) => item.includes(query));
}

function statusLabel(value: unknown) {
  const status = text(value);
  const labels: Record<string, string> = {
    active: "啟用",
    withdrawn: "已退出",
    completed: "已完成",
    expired: "已逾期",
    booked: "已報名",
    cancelled: "已取消",
    unchecked: "未點名",
    attended: "已出席",
    absent: "缺席",
    leave: "請假",
    pending: "待處理",
  };
  return labels[status] ?? status ?? "未設定";
}

function dateText(...values: unknown[]) {
  return values.map(text).find(Boolean) ?? "未紀錄時間";
}

function logStudentDirectoryDebug(params: {
  students: Student[];
  filteredStudents: Student[];
  status: string;
  q: string;
}) {
  if (process.env.NODE_ENV !== "development") return;

  const { students, filteredStudents, status, q } = params;
  const active = students.filter((student) => student.isActive !== false).length;
  const inactive = students.filter((student) => student.isActive === false).length;
  const needsReview = students.filter((student) => student.needsReview).length;
  const misaligned = students.filter(isLikelyMisalignedStudent).length;

  console.info("[admin/students] roster load summary", {
    totalStudents: students.length,
    filteredStudents: filteredStudents.length,
    selectedStatus: status,
    hasSearchQuery: Boolean(norm(q)),
    statusCounts: {
      active,
      inactive,
      needsReview,
      misaligned,
    },
    fieldPresenceCounts: {
      name: students.filter((student) => Boolean(text(student.name))).length,
      phone: students.filter((student) => Boolean(text(student.phone))).length,
      memberNo: students.filter((student) => Boolean(text(student.memberNo))).length,
      idNumberLast3: students.filter((student) => Boolean(text(student.idNumberLast3))).length,
      isActive: students.filter((student) => student.isActive != null).length,
      needsReview: students.filter((student) => student.needsReview != null).length,
      createdAt: students.filter((student) => Boolean(text(student.createdAt))).length,
      updatedAt: students.filter((student) => Boolean(text(student.updatedAt))).length,
    },
  });
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const {
    mode = "students",
    seriesId: querySeriesId,
    year: queryYear,
    offeringId: queryOfferingId,
    status = "all",
    q = "",
    instructorId: editingInstructorId,
    saved,
    error,
    imported,
    skipped,
    linked,
    enrolled,
    filter: queryFilter,
  } = await searchParams;
  let bookingData;
  try {
    bookingData = await getBookingData();
  } catch (error) {
    console.error("[admin/students] failed to load booking data", {
      message: error instanceof Error ? error.message : String(error),
    });

    return (
      <AdminShell currentSection="roster.students">
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-rose-700">資料來源錯誤</p>
          <h1 className="mt-2 text-2xl font-black text-zinc-950">
            無法載入 Firestore 學員名冊
          </h1>
          <p className="mt-3 text-sm leading-7 text-rose-700">
            Production 後台需要 Firestore 才能讀取名冊。請檢查 Vercel 的 Firebase Admin 環境變數與 Firestore 權限；這不是單純沒有學員資料。
          </p>
        </section>
      </AdminShell>
    );
  }

  const {
    students = [],
    courseSeries = [],
    courseOfferings = [],
    courseSessions = [],
    reservations = [],
    studentCourseRecords = [],
    enrollments = [],
    attendanceRecords = [],
    instructors = [],
    categories = [],
  } = bookingData;

  const currentMode = MODES.some(([key]) => key === mode) ? mode : "students";
  const instructorSpecialtyCategories = categories
    .filter((category) => category.isActive !== false)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  const courseOptions = getCourseOptions(courseSeries, courseOfferings);
  const selectedSeriesId =
    querySeriesId && courseOptions.some((option) => option.id === querySeriesId)
      ? querySeriesId
      : (courseOptions[0]?.id ?? "all");
  const years = getYearOptions(courseOfferings, studentCourseRecords);
  const selectedYear =
    queryYear ?? years[0] ?? String(new Date().getFullYear() - 1911);
  const selectedCourse = courseOptions.find(
    (item) => item.id === selectedSeriesId,
  );
  const selectedOfferings = courseOfferings
    .filter(
      (item) =>
        offeringMatchesCourseOption(item, selectedCourse) &&
        String(item.year ?? "") === String(selectedYear),
    )
    .sort(
      (a, b) =>
        Number(a.termNumber ?? a.term ?? 0) -
        Number(b.termNumber ?? b.term ?? 0),
    );
  const selectedOffering =
    selectedOfferings.find((item) => item.id === queryOfferingId) ??
    selectedOfferings[0];
  const selectedOfferingId = selectedOffering?.id ?? "";

  const visibleStudents = students.filter(
    (student) => student.isActive !== false,
  );
  const inactiveStudents = students.filter(
    (student) => student.isActive === false,
  );
  const suspectedMisalignedStudents = students.filter(
    isLikelyMisalignedStudent,
  );
  const filteredStudents = visibleStudents
    .filter((student) => studentMatches(student, q))
    .sort(compareStudentsByMemberNo);
  const studentListRows = students
    .filter((student) => studentMatches(student, q))
    .filter((student) => {
      const rosterStatus = getRosterStatus(student).key;
      if (status === "all") return true;
      return rosterStatus === status;
    })
    .sort(compareStudentsByMemberNo);

  logStudentDirectoryDebug({
    students,
    filteredStudents: studentListRows,
    status,
    q,
  });

  if (currentMode === "students") {
    return (
      <StudentDirectoryPage
        students={studentListRows}
        q={q}
        status={status}
        saved={saved}
        error={error}
        imported={imported}
      />
    );
  }

  const records = studentCourseRecords.filter((record) =>
    recordMatches(record, selectedSeriesId, selectedYear),
  );
  const recordByStudentId = new Map(
    records.map((record) => [record.studentId, record]),
  );
  const seriesById = new Map(courseSeries.map((item) => [item.id, item]));
  const offeringById = new Map(courseOfferings.map((item) => [item.id, item]));

  const selectedEnrollmentStatusByStudentId = new Map<string, string>();
  const activeClassChipsByStudentId = new Map<string, ActiveClassChip[]>();
  enrollments
    .filter((enrollment) => !["withdrawn", "cancelled", "inactive"].includes(text(enrollment.status)))
    .forEach((enrollment) => {
      const currentEnrollmentStatus = text(enrollment.status || "active");
      if (selectedOfferingId && enrollment.offeringId === selectedOfferingId) {
        selectedEnrollmentStatusByStudentId.set(enrollment.studentId, currentEnrollmentStatus);
      }

      const offering = enrollment.offeringId
        ? offeringById.get(enrollment.offeringId)
        : undefined;
      const offeringId = enrollment.offeringId || offering?.id || "";
      const seriesId =
        offering?.seriesId ||
        offering?.courseSeriesId ||
        offering?.courseMasterId ||
        selectedSeriesId ||
        "";
      const year = String(offering?.year || selectedYear || "");
      const label =
        enrollment.classDisplayName ||
        offering?.classDisplayName ||
        offering?.displayName ||
        offering?.displayTitle ||
        offering?.shortName ||
        [offering?.title, offering?.year ? `${offering.year}年` : "", offering?.termLabel || (offering?.term ? `第${offering.term}期` : "")]
          .filter(Boolean)
          .join("｜") ||
        "已加入班級";
      if (!offeringId) return;
      const chips = activeClassChipsByStudentId.get(enrollment.studentId) ?? [];
      if (!chips.some((chip) => chip.offeringId === offeringId)) {
        chips.push({ offeringId, seriesId, year, label });
      }
      activeClassChipsByStudentId.set(enrollment.studentId, chips);
    });

  const qualificationRows = filteredStudents
    .map((student) => {
      const record = recordByStudentId.get(student.id);
      const currentClasses = activeClassChipsByStudentId.get(student.id) ?? [];
      const selectedEnrollmentStatus = selectedEnrollmentStatusByStudentId.get(student.id);
      const rowStatus = selectedEnrollmentStatus === "completed" ? "已結訓" : selectedEnrollmentStatus ? "上課中" : "未加入";
      return {
        currentClasses,
        record,
        student,
        status: rowStatus,
      };
    })
    .filter((row) => {
      if (status === "bookable" && !canBook(row.status)) return false;
      if (status === "blocked" && canBook(row.status)) return false;
      if (!norm(q)) return true;
      return (
        studentMatches(row.student, q) ||
        [row.currentClasses.map((item) => item.label).join(" "), row.record?.note, row.record?.classDisplayName, row.record?.termLabel]
          .map(norm)
          .some((item) => item.includes(norm(q)))
      );
    });
  const sessionById = new Map(courseSessions.map((item) => [item.id, item]));

  const visibleInstructors = instructors
    .filter((instructor) => instructor.isActive !== false)
    .filter((instructor) => instructorMatches(instructor, q))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const editingInstructor =
    instructors.find((instructor) => instructor.id === editingInstructorId) ?? null;

  const historyStudentCandidates = currentMode === "history" && norm(q)
    ? students
        .filter((student) => student.isActive !== false)
        .filter((student) => studentMatches(student, q))
        .sort(compareStudentsByMemberNo)
    : [];
  const selectedHistoryStudent = historyStudentCandidates[0];
  const selectedHistoryStudentId = selectedHistoryStudent?.id ?? "";

  const selectedHistoryRecords = selectedHistoryStudent
    ? studentCourseRecords.filter((record) => record.studentId === selectedHistoryStudentId)
    : [];
  const selectedHistoryEnrollments = selectedHistoryStudent
    ? enrollments.filter((enrollment) => enrollment.studentId === selectedHistoryStudentId)
    : [];
  const visibleHistoryEnrollments = selectedHistoryEnrollments.filter((enrollment) => {
    const enrollmentStatus = norm(enrollment.status);
    return !["withdrawn", "cancelled", "inactive"].includes(enrollmentStatus);
  });
  const selectedHistoryReservations = selectedHistoryStudent
    ? reservations.filter((reservation) => reservation.studentId === selectedHistoryStudentId)
    : [];
  const selectedHistoryAttendance = selectedHistoryStudent
    ? attendanceRecords.filter((attendance) => attendance.studentId === selectedHistoryStudentId)
    : [];

  const historyCourseCards = [
    ...visibleHistoryEnrollments.map((enrollment) => {
      const offering = offeringById.get(enrollment.offeringId);
      const series = enrollment.seriesId ? seriesById.get(enrollment.seriesId) : undefined;
      const relatedAttendance = selectedHistoryAttendance.filter((attendance) => {
        if (attendance.offeringId && attendance.offeringId === enrollment.offeringId) return true;
        const attendanceSeriesId = (attendance as { seriesId?: string }).seriesId;
        if (attendanceSeriesId && enrollment.seriesId && attendanceSeriesId === enrollment.seriesId) return true;
        return false;
      });
      const attendedCount = relatedAttendance.filter((item) => statusLabel(item.status) === "已出席").length;
      const totalAttendance = relatedAttendance.length;
      const latestActivity = [
        enrollment.updatedAt,
        enrollment.createdAt,
        enrollment.joinedAt,
        ...relatedAttendance.map((item) => item.updatedAt || item.checkedAt || item.createdAt),
      ]
        .map(text)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0];

      return {
        id: `history-enrollment-${enrollment.id}`,
        title:
          enrollment.classDisplayName ||
          offering?.displayTitle ||
          offering?.displayName ||
          offering?.title ||
          series?.title ||
          "課程班級",
        status: statusLabel(enrollment.status),
        attendanceText: totalAttendance > 0 ? `${attendedCount} / ${totalAttendance}` : "尚無點名",
        latestActivity: latestActivity || "未紀錄",
        note: text(enrollment.note || enrollment.notes || enrollment.groupLabel),
      };
    }),
    ...selectedHistoryRecords
      .filter((record) => {
        if (!record?.offeringId) return true;
        return !visibleHistoryEnrollments.some((enrollment) => enrollment.offeringId === record?.offeringId);
      })
      .filter((record) => {
        const recordStatus = norm(getCourseRosterStatus(record));
        return !["已退出", "withdrawn", "cancelled", "inactive"].includes(recordStatus);
      })
      .map((record) => {
        const series = seriesById.get(record.seriesId || record.courseMasterId || "");
        const offering = record?.offeringId ? offeringById.get(record?.offeringId) : undefined;
        return {
          id: `history-record-${record.id}`,
          title:
            record?.classDisplayName ||
            offering?.displayTitle ||
            offering?.displayName ||
            offering?.title ||
            series?.title ||
            record.sourceColumn ||
            "課程狀態",
          status: getCourseRosterStatus(record),
          attendanceText: "尚無點名",
          latestActivity: dateText(record?.updatedAt, record?.createdAt, record.importedAt),
          note: text(record?.note || record?.rawValue),
        };
      }),
  ].sort((a, b) => text(b.latestActivity).localeCompare(text(a.latestActivity)));

  const recentHistoryRows = [
    ...selectedHistoryReservations.map((reservation) => {
      const session = reservation.sessionId ? sessionById.get(reservation.sessionId) : undefined;
      const offering = reservation.offeringId ? offeringById.get(reservation.offeringId) : undefined;
      return {
        id: `reservation-${reservation.id}`,
        type: "預約報名",
        title:
          session?.title ||
          session?.unitName ||
          offering?.displayTitle ||
          offering?.displayName ||
          offering?.title ||
          "預約紀錄",
        status: statusLabel(reservation.status),
        occurredAt: dateText(reservation.updatedAt, reservation.createdAt, reservation.bookedAt),
        note: text(reservation.note || reservation.source),
      };
    }),
    ...selectedHistoryAttendance.map((attendance) => {
      const session = sessionById.get(attendance.sessionId || attendance.courseSessionId || "");
      const offering = offeringById.get(attendance.offeringId);
      return {
        id: `attendance-${attendance.id}`,
        type: "點名出席",
        title:
          session?.title ||
          session?.unitName ||
          offering?.displayTitle ||
          offering?.displayName ||
          offering?.title ||
          "出席紀錄",
        status: statusLabel(attendance.status),
        occurredAt: dateText(attendance.updatedAt, attendance.createdAt, attendance.checkedAt),
        note: text(attendance.note || attendance.source),
      };
    }),
    ...visibleHistoryEnrollments.map((enrollment) => ({
      id: `enrollment-${enrollment.id}`,
      type: "課程資格",
      title:
        enrollment.classDisplayName ||
        offeringById.get(enrollment.offeringId)?.displayTitle ||
        offeringById.get(enrollment.offeringId)?.displayName ||
        offeringById.get(enrollment.offeringId)?.title ||
        "班級名單",
      status: statusLabel(enrollment.status),
      occurredAt: dateText(enrollment.updatedAt, enrollment.createdAt, enrollment.joinedAt),
      note: text(enrollment.note || enrollment.notes || enrollment.groupLabel),
    })),
  ]
    .sort((a, b) => text(b.occurredAt).localeCompare(text(a.occurredAt)))
    .slice(0, 8);

  const activeStudents = visibleStudents.length;
  const adminSection =
    currentMode === "students"
      ? "roster.students"
      : currentMode === "eligibility"
        ? "roster.eligibility"
        : currentMode === "instructors"
          ? "roster.instructors"
          : currentMode === "history"
            ? "roster.history"
            : "roster.offering";

  const pageMetaMap: Record<
    string,
    { eyebrow: string; title: string; description: string }
  > = {
    students: {
      eyebrow: "學員名冊",
      title: "學員查找與基本資料管理",
      description:
        "日常以搜尋學員、確認會員編號、手機與身分證末三碼為主；新增與批次匯入只在需要時展開。",
    },
    eligibility: {
      eyebrow: "課程資格",
      title: "班級加入管理",
      description:
        "選擇指定班級後，可將尚未加入的學員批量加入該班級。",
    },
    offering: {
      eyebrow: "梯次分配",
      title: "年度課程與期別名冊",
      description:
        "查看學員被分配到哪一個年度課程或期別，作為報名、點名與統計依據。",
    },
    instructors: {
      eyebrow: "講師名冊",
      title: "講師基本資料管理",
      description:
        "管理講師基本資料、專長與可授課資訊；目前先作為行政端名冊，不建立講師登入帳號。",
    },
    history: {
      eyebrow: "學員履歷",
      title: "學員履歷",
      description:
        "以學員為中心彙整報名、課程狀態、梯次分配與出席紀錄。",
    },
  };
  const pageMeta = pageMetaMap[currentMode] ?? pageMetaMap.students;

  // Eligibility-specific: derive seriesId/year from a single selected offering
  const eligibilityOfferingId = currentMode === "eligibility" ? (queryOfferingId || "") : "";
  const eligibilityOffering = eligibilityOfferingId
    ? courseOfferings.find((o) => o.id === eligibilityOfferingId) ?? null
    : null;
  const eligibilitySeriesId = eligibilityOffering
    ? (eligibilityOffering.seriesId || eligibilityOffering.courseSeriesId || eligibilityOffering.courseMasterId || "")
    : "";
  const eligibilityYear = eligibilityOffering ? String(eligibilityOffering.year || "") : "";
  const eligibilityEnrollments = eligibilityOfferingId
    ? enrollments.filter(
        (e) =>
          e.offeringId === eligibilityOfferingId &&
          !["withdrawn", "cancelled", "inactive"].includes(text(e.status)),
      )
    : [];
  const eligibilityEnrollmentStatusByStudentId = new Map(
    eligibilityEnrollments.map((e) => [e.studentId, text(e.status || "active")]),
  );

  const currentFilter = currentMode === "eligibility" ? (queryFilter || "available") : "all";
  const enrolledStudentIds = new Set(eligibilityEnrollments.map((e) => e.studentId));
  const availableStudents = filteredStudents.filter((s) => !enrolledStudentIds.has(s.id));
  const enrolledStudentRows = students
    .filter((s) => enrolledStudentIds.has(s.id))
    .filter((s) => studentMatches(s, q))
    .sort(compareStudentsByMemberNo)
    .map((s) => ({
      student: s,
      enrollmentStatus: text(eligibilityEnrollmentStatusByStudentId.get(s.id) || "active"),
      enrollmentLabel:
        eligibilityEnrollmentStatusByStudentId.get(s.id) === "completed" ? "已結訓" : "上課中",
    }));

  return (
    <AdminShell
      currentSection={adminSection}
    >
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">
          {pageMeta.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
          {pageMeta.title}
        </h1>
        <p className="mt-3 max-w-5xl text-sm leading-7 text-zinc-600">
          {pageMeta.description}
        </p>
      </section>

      {saved ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
          已更新資料{imported ? `，本次處理 ${imported} 筆` : ""}
          {linked ? `，建立 / 更新 ${linked} 筆課程狀態` : ""}
          {enrolled ? `，加入 ${enrolled} 筆班級名單` : ""}
          {skipped ? `，略過 ${skipped} 筆疑似錯位或資料不足的資料` : ""}。
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-800">
          資料不足，請確認必填欄位、課程目錄、年度與勾選學員。
        </p>
      ) : null}

      {currentMode === "students" ? (
        <section className="mt-5 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <p className="text-sm font-semibold text-[#a65f3b]">管理流程</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MODES.map(([key, label, description]) => (
                  <Link
                    key={key}
                    href={buildHref({
                      mode: key,
                      seriesId:
                        key === "students" ? undefined : selectedSeriesId,
                      year: key === "students" ? undefined : selectedYear,
                      status,
                      q,
                    })}
                    className={`rounded-full border px-4 py-2 text-sm font-bold ${currentMode === key ? "border-[#ef6c00] bg-[#ef6c00] text-white" : "border-[#e8d4c2] bg-white text-[#6b3b25]"}`}
                    title={description}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold xl:justify-end">
              <span className="rounded-full border border-[#ead7c6] bg-[#fffaf5] px-3 py-2 text-[#6b3b25]">
                啟用 {activeStudents} 筆
              </span>
              <span className="rounded-full border border-[#ead7c6] bg-white px-3 py-2 text-zinc-600">
                停用 / 歷史 {inactiveStudents.length} 筆
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                疑似錯位 {suspectedMisalignedStudents.length} 筆
              </span>
            </div>
          </div>

          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="mode" value="students" />
            <input
              name="q"
              defaultValue={q}
              placeholder="搜尋姓名、末三碼、手機、會員編號、備註"
              className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
            />
            <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
              搜尋
            </button>
          </form>
        </section>
      ) : null}

      {currentMode !== "students" ? (
        <>
          <RosterFlowNav current={currentMode as "eligibility" | "instructors" | "history"} />

          {currentMode === "history" ? (
            <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#a65f3b]">搜尋學員</p>
              <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input type="hidden" name="mode" value="history" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="搜尋姓名、會員編號、手機"
                  className="h-12 flex-1 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
                <button className="rounded-2xl bg-[#ef6c00] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d65f00]">
                  搜尋
                </button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}

      {currentMode === "students" ? (
        <>
          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <details
              id="student-import"
              className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm"
            >
              <summary className="cursor-pointer list-none">
                <p className="text-sm font-semibold text-[#a65f3b]">
                  批次匯入名冊
                </p>
                <h2 className="mt-1 text-xl font-black text-zinc-950">
                  依匯入目的建立學員資料
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  先選這份名單的用途，再貼上 Excel
                  內容；一般情況只要展開其中一種匯入方式即可。
                </p>
              </summary>

              <div className="mt-5 grid gap-4 border-t border-[#ead7c6] pt-5">
                <div className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] p-4">
                  <p className="text-sm font-bold text-[#6b3b25]">
                    選擇匯入目的
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    不要一次設定全部欄位。只建立名冊、建立課程狀態、加入指定班級，三種情境分開操作比較不容易匯錯。
                  </p>
                </div>

                <details className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-zinc-900">
                          1. 只建立學員資料
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          適合一般會員名冊，只會建立或更新學員基本資料，不建立課程狀態或班級名單。
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#a65f3b]">
                        最單純
                      </span>
                    </div>
                  </summary>
                  <form
                    action={bulkImportStudentIdentitiesAction}
                    className="mt-4 grid gap-3 border-t border-[#f0dfcf] pt-4"
                  >
                    <input
                      type="hidden"
                      name="importMode"
                      value="studentsOnly"
                    />
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      步驟 2｜貼上學員資料
                      <textarea
                        name="rosterText"
                        rows={8}
                        placeholder={baseTemplateText()}
                        className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
                      />
                    </label>
                    <button className="rounded-2xl bg-gradient-to-r from-[#ef6c00] to-[#b46f4a] px-5 py-3 text-sm font-bold text-white">
                      匯入學員基本資料
                    </button>
                  </form>
                </details>

                <details className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-zinc-900">
                          2. 建立學員資料＋課程狀態
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          適合「上課中、已結訓、未加入」這類資格名單，不會加入特定班級。
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#a65f3b]">
                        資格名單
                      </span>
                    </div>
                  </summary>
                  <form
                    action={bulkImportStudentIdentitiesAction}
                    className="mt-4 grid gap-4 border-t border-[#f0dfcf] pt-4"
                  >
                    <input
                      type="hidden"
                      name="importMode"
                      value="withEligibility"
                    />
                    <div className="grid gap-3 md:grid-cols-[1fr_140px_180px]">
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        步驟 2｜選課程主檔
                        <select
                          name="seriesId"
                          defaultValue={
                            selectedSeriesId === "all" ? "" : selectedSeriesId
                          }
                          className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                        >
                          <option value="">請選擇課程主檔</option>
                          {courseOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        年度
                        <input
                          name="year"
                          defaultValue={selectedYear}
                          className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        課程狀態
                        <select
                          name="eligibilityStatus"
                          defaultValue="上課中"
                          className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                        >
                          {IMPORT_ELIGIBILITY_STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      匯入備註
                      <input
                        name="note"
                        placeholder="例如：115年度美容丙級上課中名單"
                        className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      步驟 3｜貼上學員資料
                      <textarea
                        name="rosterText"
                        rows={8}
                        placeholder={baseTemplateText()}
                        className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
                      />
                    </label>
                    <button className="rounded-2xl bg-gradient-to-r from-[#ef6c00] to-[#b46f4a] px-5 py-3 text-sm font-bold text-white">
                      匯入並建立課程狀態
                    </button>
                  </form>
                </details>

                <details className="rounded-2xl border border-[#ead7c6] bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-zinc-900">
                          3. 建立學員資料＋加入指定班級
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          適合 115-1、115-2
                          這類正式班級名單；系統會由班級自動帶出課程主檔與年度。
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#a65f3b]">
                        班級名單
                      </span>
                    </div>
                  </summary>
                  <form
                    action={bulkImportStudentIdentitiesAction}
                    className="mt-4 grid gap-4 border-t border-[#f0dfcf] pt-4"
                  >
                    <input
                      type="hidden"
                      name="importMode"
                      value="withEnrollment"
                    />
                    <input
                      type="hidden"
                      name="eligibilityStatus"
                      value="上課中"
                    />
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        步驟 2｜選年度課程 / 班級
                        <select
                          name="targetOfferingId"
                          defaultValue=""
                          className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                        >
                          <option value="">請選擇要加入的班級</option>
                          {courseOfferings.map((offering) => (
                            <option key={offering.id} value={offering.id}>
                              {offering.displayTitle ??
                                offering.displayName ??
                                offering.title ??
                                offering.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                        課程狀態：上課中
                      </div>
                    </div>
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      匯入備註
                      <input
                        name="note"
                        placeholder="例如：115年第2期班級名單匯入"
                        className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      步驟 3｜貼上學員資料
                      <textarea
                        name="rosterText"
                        rows={8}
                        placeholder={baseTemplateText()}
                        className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
                      />
                    </label>
                    <button className="rounded-2xl bg-gradient-to-r from-[#ef6c00] to-[#b46f4a] px-5 py-3 text-sm font-bold text-white">
                      匯入並加入指定班級
                    </button>
                  </form>
                </details>
              </div>
            </details>

            <details className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none">
                <p className="text-sm font-semibold text-[#a65f3b]">單一新增</p>
                <h2 className="mt-1 text-xl font-black text-zinc-950">
                  新增單一學員基本資料
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  建立後再到「課程狀態」頁勾選加入課程。
                </p>
              </summary>
              <form
                action={saveStudentIdentityAction}
                className="mt-5 grid gap-3 border-t border-[#ead7c6] pt-5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    姓名
                    <input
                      name="name"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    身分證後三碼
                    <input
                      name="idNumberLast3"
                      maxLength={3}
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    手機
                    <input
                      name="phone"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    生日
                    <input
                      name="birthday"
                      placeholder="YYYY/MM/DD"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    會員編號
                    <input
                      name="memberNo"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-zinc-700">
                  備註
                  <input
                    name="note"
                    className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                  />
                </label>
                <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
                  建立學員
                </button>
              </form>
            </details>
          </section>

          <section
            id="student-list"
            className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm"
          >
            <div className="border-b border-[#ead7c6] p-5">
              <p className="text-sm font-semibold text-[#a65f3b]">學員名冊</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">
                所有學員基本資料
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                這裡只管理姓名、末三碼、手機、生日與會員編號；要加入課程請切到「課程狀態」。
              </p>
            </div>
            <div className="grid gap-4 border-b border-[#ead7c6] bg-[#fffaf5] p-5 xl:grid-cols-[1fr_auto] xl:items-end">
              <div>
                <p className="text-sm font-bold text-[#6b3b25]">狀態篩選</p>
                <p className="mt-1 text-xs text-zinc-500">
                  學員名冊只保留查找與狀態管理；課程狀態、梯次分配與履歷請到對應頁籤處理。
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {STUDENT_STATUS_FILTERS.map(([key, label]) => (
                  <Link
                    key={key}
                    href={buildHref({ mode: "students", q, status: key })}
                    className={`rounded-full border px-4 py-2 text-xs font-bold ${status === key ? "border-[#ef6c00] bg-[#ef6c00] text-white" : "border-[#ead7c6] bg-white text-[#6b3b25]"}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden grid-cols-[1.15fr_130px_100px_150px_150px_1fr_90px_96px] border-b border-[#ead7c6] bg-[#fff7ed] px-5 py-3 text-sm font-bold text-[#6b3b25] md:grid">
              <span>學員</span>
              <span>狀態</span>
              <span>末三碼</span>
              <span>手機</span>
              <span>會員編號</span>
              <span>備註</span>
              <span>履歷</span>
              <span>刪除</span>
            </div>
            <div className="divide-y divide-[#f0dfcf]">
              {studentListRows.map((student) => {
                const rosterStatus = getRosterStatus(student);
                return (
                  <div
                    key={student.id}
                    className="grid gap-3 px-5 py-4 transition hover:bg-[#fffaf5] md:grid-cols-[1.15fr_130px_100px_150px_150px_1fr_90px_96px] md:items-center"
                  >
                    <div>
                      <p className="font-black text-zinc-950">{student.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        生日：{text(student.birthday) || "未填"}｜來源：
                        {student.source || "學員總表"}
                      </p>
                    </div>
                    <div className="relative">
                      <details className="group inline-block">
                        <summary
                          className={`inline-flex cursor-pointer list-none rounded-full border px-3 py-1 text-xs font-bold ${rosterStatus.className}`}
                        >
                          {rosterStatus.label} ▾
                        </summary>
                        <div className="absolute z-20 mt-2 w-28 rounded-2xl border border-[#ead7c6] bg-white p-2 shadow-lg">
                          {[
                            ["active", "啟用"],
                            ["review", "待確認"],
                            ["inactive", "停用"],
                          ].map(([statusValue, statusLabel]) => (
                            <form
                              key={statusValue}
                              action={updateStudentIdentityStatusAction}
                            >
                              <input
                                type="hidden"
                                name="studentId"
                                value={student.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value={statusValue}
                              />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={buildHref({
                                  mode: "students",
                                  q,
                                  status,
                                })}
                              />
                              <button className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-[#6b3b25] hover:bg-[#fff7ed]">
                                {statusLabel}
                              </button>
                            </form>
                          ))}
                        </div>
                      </details>
                    </div>
                    <div className="font-bold text-zinc-950">
                      {student.idNumberLast3 || "未填"}
                    </div>
                    <div className="text-sm text-zinc-700">
                      {student.phone || "未填"}
                    </div>
                    <div className="text-sm text-zinc-700">
                      {student.memberNo || "未填"}
                    </div>
                    <div className="text-sm text-zinc-700">
                      {student.note || "—"}
                    </div>
                    <Link
                      href={buildHref({
                        mode: "history",
                        q: student.memberNo || student.name || student.phone,
                      })}
                      className="w-fit rounded-full border border-[#ead7c6] bg-white px-3 py-1 text-xs font-bold text-[#6b3b25] hover:border-[#ef6c00] hover:text-[#ef6c00]"
                    >
                      履歷
                    </Link>
                    <form action={hardDeleteStudentIdentityAction}>
                      <input
                        type="hidden"
                        name="studentId"
                        value={student.id}
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={buildHref({ mode: "students", q, status })}
                      />
                      <button className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100">
                        刪除
                      </button>
                    </form>
                  </div>
                );
              })}
              {studentListRows.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">
                  目前沒有符合條件的學員資料。請調整搜尋或狀態篩選。
                </p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {currentMode === "eligibility" ? (
        <section
          id="eligibility-list"
          className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm"
        >
          <div className="border-b border-[#ead7c6] p-5">
            <p className="text-sm font-semibold text-[#a65f3b]">課程資格</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-950">
              班級加入管理
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              選擇指定班級後，可將尚未加入的學員批量加入該班級。
            </p>
          </div>

          <div className="border-b border-[#ead7c6] bg-[#fffaf5] p-5">
            <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="mb-2 text-xs font-bold text-[#a65f3b]">指定班級</p>
                <div className="flex gap-2">
                  <input type="hidden" name="mode" value="eligibility" />
                  <select
                    name="offeringId"
                    defaultValue={eligibilityOfferingId || ""}
                    className="min-w-[320px] rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
                  >
                    <option value="">請選擇指定班級</option>
                    {courseOfferings
                      .filter((o) => o.isActive !== false)
                      .sort((a, b) => {
                        const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
                        if (yearDiff !== 0) return yearDiff;
                        return (a.displayName || a.displayTitle || a.title || "").localeCompare(
                          b.displayName || b.displayTitle || b.title || "",
                          "zh-Hant",
                        );
                      })
                      .map((offering) => (
                        <option key={offering.id} value={offering.id}>
                          {[
                            offering.displayName || offering.displayTitle || offering.title,
                            offering.year ? `${offering.year}年` : "",
                            offering.termLabel || (offering.term ? `第${offering.term}期` : ""),
                          ]
                            .filter(Boolean)
                            .join("｜")}
                        </option>
                      ))}
                  </select>
                  <button className="rounded-2xl bg-[#ef6c00] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d65f00]">
                    查詢
                  </button>
                </div>
              </div>
            </form>

            {eligibilityOffering ? (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="mode" value="eligibility" />
                <input type="hidden" name="offeringId" value={eligibilityOfferingId} />
                <input type="hidden" name="filter" value={currentFilter} />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="搜尋姓名、會員編號、手機"
                  className="h-12 flex-1 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
                <button className="rounded-2xl bg-[#ef6c00] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d65f00]">
                  搜尋
                </button>
              </form>
            ) : null}
          </div>

          {eligibilityOffering ? (
            <>
              <div className="flex gap-2 border-b border-[#ead7c6] bg-[#fffaf5] px-5 py-3">
                {[
                  ["available", "可加入"],
                  ["enrolled", "已在班級"],
                  ["all", "全部"],
                ].map(([key, label]) => (
                  <Link
                    key={key}
                    href={buildHref({ mode: "eligibility", offeringId: eligibilityOfferingId, filter: key, q })}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      currentFilter === key
                        ? "bg-[#ef6c00] text-white shadow-sm"
                        : "border border-[#ead7c6] bg-white text-zinc-600 hover:border-[#ef6c00]"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              {(currentFilter === "available" || currentFilter === "all") && (
                <div className="border-b border-[#ead7c6] bg-white px-5 py-3">
                  <button
                    type="submit"
                    form="batch-enroll-form"
                    className="rounded-2xl bg-[#ef6c00] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#d65f00] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!eligibilityOfferingId}
                  >
                    加入指定班級
                  </button>
                </div>
              )}

              <form
                id="batch-enroll-form"
                action={assignStudentsToCourseEligibilityAction}
              >
                <input type="hidden" name="seriesId" value={eligibilitySeriesId} />
                <input type="hidden" name="year" value={eligibilityYear} />
                <input type="hidden" name="targetOfferingId" value={eligibilityOfferingId} />
                <input type="hidden" name="eligibilityStatus" value="上課中" />
                <input type="hidden" name="note" value="" />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={buildHref({ mode: "eligibility", offeringId: eligibilityOfferingId, filter: currentFilter, q })}
                />
              </form>

              <div className="hidden grid-cols-[40px_1fr_150px_150px_120px_1fr_100px] border-b border-[#ead7c6] bg-[#fff7ed] px-5 py-3 text-sm font-bold text-[#6b3b25] md:grid">
                {(currentFilter === "available" || currentFilter === "all") && (
                  <span className="text-center text-xs text-zinc-400">選</span>
                )}
                <span>學員</span>
                <span>手機</span>
                <span>會員編號</span>
                <span>目前狀態</span>
                <span>目前班級</span>
                <span className="text-right">操作</span>
              </div>

              <div className="divide-y divide-[#f0dfcf]">
                {currentFilter === "available" ? (
                  availableStudents.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">
                      {norm(q)
                        ? "沒有符合搜尋條件的學員。"
                        : "目前沒有可加入此班級的學員。"}
                    </p>
                  ) : (
                    availableStudents.map((student) => {
                      const currentClasses = activeClassChipsByStudentId.get(student.id) ?? [];
                      return (
                        <div
                          key={student.id}
                          className="grid items-center gap-3 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px_120px_1fr_100px]"
                        >
                          <input
                            type="checkbox"
                            form="batch-enroll-form"
                            name="studentIds"
                            value={student.id}
                            className="h-4 w-4 accent-[#ef6c00]"
                          />
                          <div>
                            <p className="font-black text-zinc-950">{student.name}</p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "末三碼 未填"}
                            </p>
                          </div>
                          <div className="text-sm text-zinc-700">{student.phone || "未填"}</div>
                          <div className="text-sm text-zinc-700">{student.memberNo || "未填"}</div>
                          <div>
                            <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              可加入
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {currentClasses.length > 0 ? (
                              currentClasses.slice(0, 2).map((chip) => (
                                <span
                                  key={chip.offeringId}
                                  className="inline-block max-w-[160px] truncate rounded-full border border-[#ead7c6] bg-[#fffaf5] px-2 py-0.5 text-xs text-zinc-600"
                                  title={chip.label}
                                >
                                  {chip.label}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                            {currentClasses.length > 2 ? (
                              <span className="text-xs text-zinc-400">
                                +{currentClasses.length - 2}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <form action={assignStudentsToCourseEligibilityAction}>
                              <input type="hidden" name="studentIds" value={student.id} />
                              <input type="hidden" name="seriesId" value={eligibilitySeriesId} />
                              <input type="hidden" name="year" value={eligibilityYear} />
                              <input type="hidden" name="targetOfferingId" value={eligibilityOfferingId} />
                              <input type="hidden" name="eligibilityStatus" value="上課中" />
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={buildHref({ mode: "eligibility", offeringId: eligibilityOfferingId, filter: currentFilter, q })}
                              />
                              <button className="rounded-full border border-[#ef6c00] bg-white px-3 py-1 text-xs font-bold text-[#ef6c00] transition hover:bg-[#fff7ed]">
                                加入
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : currentFilter === "enrolled" ? (
                  enrolledStudentRows.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">
                      {norm(q) ? "沒有符合搜尋條件的學員。" : "目前沒有學員加入此班級。"}
                    </p>
                  ) : (
                    enrolledStudentRows.map(({ student, enrollmentLabel }) => {
                      const currentClasses = activeClassChipsByStudentId.get(student.id) ?? [];
                      return (
                        <div
                          key={student.id}
                          className="grid items-center gap-3 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px_120px_1fr_100px]"
                        >
                          <div />
                          <div>
                            <p className="font-black text-zinc-950">{student.name}</p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "末三碼 未填"}
                            </p>
                          </div>
                          <div className="text-sm text-zinc-700">{student.phone || "未填"}</div>
                          <div className="text-sm text-zinc-700">{student.memberNo || "未填"}</div>
                          <div>
                            <span
                              className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${
                                enrollmentLabel === "已結訓"
                                  ? "border-sky-200 bg-sky-50 text-sky-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {enrollmentLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {currentClasses.length > 0 ? (
                              currentClasses.slice(0, 2).map((chip) => (
                                <span
                                  key={chip.offeringId}
                                  className="inline-block max-w-[160px] truncate rounded-full border border-[#ead7c6] bg-[#fffaf5] px-2 py-0.5 text-xs text-zinc-600"
                                  title={chip.label}
                                >
                                  {chip.label}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                            {currentClasses.length > 2 ? (
                              <span className="text-xs text-zinc-400">
                                +{currentClasses.length - 2}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <span className="inline-block rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#a65f3b]">
                              已加入
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* all mode: show available then enrolled with clear labels */
                  <>
                    {availableStudents.length === 0 && enrolledStudentRows.length === 0 ? (
                      <p className="p-6 text-sm text-zinc-500">
                        {norm(q) ? "沒有符合搜尋條件的學員。" : "目前沒有可加入此班級的學員。"}
                      </p>
                    ) : (
                      <>
                        {availableStudents.map((student) => {
                          const currentClasses = activeClassChipsByStudentId.get(student.id) ?? [];
                          return (
                            <div
                              key={student.id}
                              className="grid items-center gap-3 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px_120px_1fr_100px]"
                            >
                              <input
                                type="checkbox"
                                form="batch-enroll-form"
                                name="studentIds"
                                value={student.id}
                                className="h-4 w-4 accent-[#ef6c00]"
                              />
                              <div>
                                <p className="font-black text-zinc-950">{student.name}</p>
                                <p className="mt-0.5 text-xs text-zinc-500">
                                  {student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "末三碼 未填"}
                                </p>
                              </div>
                              <div className="text-sm text-zinc-700">{student.phone || "未填"}</div>
                              <div className="text-sm text-zinc-700">{student.memberNo || "未填"}</div>
                              <div>
                                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                  可加入
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {currentClasses.length > 0 ? (
                                  currentClasses.slice(0, 2).map((chip) => (
                                    <span
                                      key={chip.offeringId}
                                      className="inline-block max-w-[160px] truncate rounded-full border border-[#ead7c6] bg-[#fffaf5] px-2 py-0.5 text-xs text-zinc-600"
                                      title={chip.label}
                                    >
                                      {chip.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-zinc-400">—</span>
                                )}
                                {currentClasses.length > 2 ? (
                                  <span className="text-xs text-zinc-400">
                                    +{currentClasses.length - 2}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <form action={assignStudentsToCourseEligibilityAction}>
                                  <input type="hidden" name="studentIds" value={student.id} />
                                  <input type="hidden" name="seriesId" value={eligibilitySeriesId} />
                                  <input type="hidden" name="year" value={eligibilityYear} />
                                  <input type="hidden" name="targetOfferingId" value={eligibilityOfferingId} />
                                  <input type="hidden" name="eligibilityStatus" value="上課中" />
                                  <input
                                    type="hidden"
                                    name="redirectTo"
                                    value={buildHref({ mode: "eligibility", offeringId: eligibilityOfferingId, filter: currentFilter, q })}
                                  />
                                  <button className="rounded-full border border-[#ef6c00] bg-white px-3 py-1 text-xs font-bold text-[#ef6c00] transition hover:bg-[#fff7ed]">
                                    加入
                                  </button>
                                </form>
                              </div>
                            </div>
                          );
                        })}
                        {enrolledStudentRows.map(({ student, enrollmentLabel }) => {
                          const currentClasses = activeClassChipsByStudentId.get(student.id) ?? [];
                          return (
                            <div
                              key={`enrolled-${student.id}`}
                              className="grid items-center gap-3 border-t border-[#f0dfcf] bg-[#fffaf5]/50 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px_120px_1fr_100px]"
                            >
                              <div />
                              <div>
                                <p className="font-black text-zinc-950">{student.name}</p>
                                <p className="mt-0.5 text-xs text-zinc-500">
                                  {student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "末三碼 未填"}
                                </p>
                              </div>
                              <div className="text-sm text-zinc-700">{student.phone || "未填"}</div>
                              <div className="text-sm text-zinc-700">{student.memberNo || "未填"}</div>
                              <div>
                                <span
                                  className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${
                                    enrollmentLabel === "已結訓"
                                      ? "border-sky-200 bg-sky-50 text-sky-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {enrollmentLabel}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {currentClasses.length > 0 ? (
                                  currentClasses.slice(0, 2).map((chip) => (
                                    <span
                                      key={chip.offeringId}
                                      className="inline-block max-w-[160px] truncate rounded-full border border-[#ead7c6] bg-[#fffaf5] px-2 py-0.5 text-xs text-zinc-600"
                                      title={chip.label}
                                    >
                                      {chip.label}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-zinc-400">—</span>
                                )}
                                {currentClasses.length > 2 ? (
                                  <span className="text-xs text-zinc-400">
                                    +{currentClasses.length - 2}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <span className="inline-block rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#a65f3b]">
                                  已加入
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-zinc-500">請先選擇一個指定班級。</p>
            </div>
          )}
        </section>
      ) : null}

      {currentMode === "instructors" ? (
        <>
          <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
            <details open>
              <summary className="cursor-pointer list-none">
                <p className="text-sm font-semibold text-[#a65f3b]">單一新增</p>
                <h2 className="mt-1 text-xl font-black text-zinc-950">
                  新增講師資料
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  先建立講師姓名與手機；授課專長直接勾選既有課程類別，避免自由輸入造成名稱不一致。
                </p>
              </summary>
              <form
                action={saveInstructorIdentityAction}
                className="mt-5 grid gap-3 border-t border-[#ead7c6] pt-5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    講師姓名
                    <input
                      name="name"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700">
                    手機
                    <input
                      name="phone"
                      className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                    />
                  </label>
                </div>
                <div className="grid gap-2 text-sm font-bold text-zinc-700">
                  授課專長
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-[#e8d4c2] bg-[#fffaf5] p-3">
                    {instructorSpecialtyCategories.length > 0 ? (
                      instructorSpecialtyCategories.map((category) => (
                        <label
                          key={category.id}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead7c6] bg-white px-3 py-2 text-xs font-bold text-[#6b3b25] transition hover:border-[#ef6c00]"
                        >
                          <input
                            type="checkbox"
                            name="specialties"
                            value={category.name}
                            className="h-3.5 w-3.5 accent-[#ef6c00]"
                          />
                          {category.name}
                        </label>
                      ))
                    ) : (
                      <span className="text-xs font-medium text-zinc-500">
                        目前沒有課程類別，請先到課程類別建立資料。
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-zinc-500">
                    專長來源連結課程類別，例如美容、美體、美甲；實際指派講師到哪一班，之後在年度課程或課堂場次處理。
                  </span>
                </div>
                <label className="grid gap-2 text-sm font-bold text-zinc-700">
                  備註
                  <input
                    name="note"
                    className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                  />
                </label>
                <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
                  建立講師
                </button>
              </form>
            </details>
          </section>

          <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm">
            <div className="border-b border-[#ead7c6] p-5">
              <p className="text-sm font-semibold text-[#a65f3b]">講師名冊</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">
                所有講師基本資料
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                目前先管理講師姓名、電話、授課專長與備註，不建立講師登入帳號。授課專長連結課程類別。
              </p>
            </div>
            <div className="hidden grid-cols-[1.1fr_150px_1.5fr_1fr_120px] border-b border-[#ead7c6] bg-[#fff7ed] px-5 py-3 text-sm font-bold text-[#6b3b25] md:grid">
              <span>講師</span>
              <span>手機</span>
              <span>授課專長</span>
              <span>備註</span>
              <span>操作</span>
            </div>
            <div className="divide-y divide-[#f0dfcf]">
              {visibleInstructors.map((instructor) => (
                <div
                  key={instructor.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_150px_1.5fr_1fr_120px] md:items-center"
                >
                  <div>
                    <p className="font-black text-zinc-950">
                      {instructor.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      來源：{instructor.source || "手動建立"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#6b3b25]">
                    {instructor.phone || "未填"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-[#6b3b25]">
                    {instructor.specialties && instructor.specialties.length > 0 ? (
                      instructor.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="rounded-full border border-[#ead7c6] bg-[#fff7ed] px-3 py-1"
                        >
                          {specialty}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-medium text-zinc-400">未設定</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {instructor.note || "—"}
                  </p>
                  <Link
                    href={buildHref({
                      mode: "instructors",
                      q,
                      instructorId: instructor.id,
                    })}
                    className="w-fit rounded-full border border-[#ead7c6] bg-white px-4 py-2 text-xs font-bold text-[#6b3b25] transition hover:border-[#ef6c00] hover:text-[#ef6c00]"
                  >
                    編輯
                  </Link>
                </div>
              ))}
              {visibleInstructors.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">
                  目前沒有講師資料。請先新增講師。
                </p>
              ) : null}
            </div>
          </section>

          {editingInstructor ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
              <Link
                href={buildHref({ mode: "instructors", q })}
                aria-label="關閉講師編輯視窗"
                className="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm"
              />
              <article className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[#ead7c6] p-6">
                  <div>
                    <p className="text-sm font-bold text-[#a65f3b]">編輯講師資料</p>
                    <h2 className="mt-1 text-2xl font-black text-zinc-950">
                      {editingInstructor.name}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      修改講師基本資料、授課專長與狀態。
                    </p>
                  </div>
                  <Link
                    href={buildHref({ mode: "instructors", q })}
                    className="shrink-0 rounded-2xl border border-[#ead7c6] bg-white px-4 py-2 text-sm font-black text-[#6b3b25] transition hover:border-[#ef6c00] hover:text-[#ef6c00]"
                  >
                    關閉
                  </Link>
                </div>

                <div className="max-h-[calc(90vh-112px)] overflow-y-auto p-6">
                  <form action={saveInstructorIdentityAction} className="grid gap-5">
                    <input type="hidden" name="instructorId" value={editingInstructor.id} />
                    <input type="hidden" name="isActive" value="false" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        講師姓名
                        <input
                          name="name"
                          defaultValue={editingInstructor.name}
                          className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold text-zinc-700">
                        手機
                        <input
                          name="phone"
                          defaultValue={editingInstructor.phone ?? ""}
                          className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                        />
                      </label>
                    </div>

                    <div className="grid gap-2 text-sm font-bold text-zinc-700">
                      授課專長
                      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#e8d4c2] bg-[#fffaf5] p-3">
                        {instructorSpecialtyCategories.length > 0 ? (
                          instructorSpecialtyCategories.map((category) => (
                            <label
                              key={category.id}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead7c6] bg-white px-3 py-2 text-xs font-bold text-[#6b3b25] transition hover:border-[#ef6c00]"
                            >
                              <input
                                type="checkbox"
                                name="specialties"
                                value={category.name}
                                defaultChecked={(editingInstructor.specialties ?? []).includes(category.name)}
                                className="h-3.5 w-3.5 accent-[#ef6c00]"
                              />
                              {category.name}
                            </label>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-zinc-500">
                            目前沒有課程類別，請先到課程類別建立資料。
                          </span>
                        )}
                      </div>
                    </div>

                    <label className="grid gap-2 text-sm font-bold text-zinc-700">
                      備註
                      <input
                        name="note"
                        defaultValue={editingInstructor.note ?? ""}
                        className="rounded-2xl border border-[#e8d4c2] px-4 py-3 outline-none focus:border-[#ef6c00]"
                      />
                    </label>

                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-2xl border border-[#ead7c6] bg-[#fffaf5] px-4 py-3 text-sm font-bold text-[#6b3b25]">
                      <input
                        type="checkbox"
                        name="isActive"
                        value="true"
                        defaultChecked={editingInstructor.isActive !== false}
                        className="h-4 w-4 accent-[#ef6c00]"
                      />
                      啟用此講師
                    </label>

                    <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
                      儲存講師資料
                    </button>
                  </form>

                  <div className="mt-5 rounded-3xl border border-rose-100 bg-rose-50/40 p-5">
                    <p className="text-sm font-black text-rose-700">停用講師</p>
                    <p className="mt-1 text-xs leading-5 text-rose-600">
                      停用後不會再作為新課堂的主要指派選項，但既有課堂紀錄仍會保留。
                    </p>
                    <form action={deleteInstructorIdentityAction} className="mt-4">
                      <input
                        type="hidden"
                        name="instructorId"
                        value={editingInstructor.id}
                      />
                      <button className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-100">
                        停用此講師
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            </div>
          ) : null}
        </>
      ) : null}

      {currentMode === "history" ? (
        <section className="mt-6 space-y-5">
          {!norm(q) ? (
            <div className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#a65f3b]">學習履歷查詢</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">
                先搜尋一位學員
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-500">
                請使用上方搜尋框輸入學員姓名、會員編號或手機。這一頁只顯示單一學員的課程狀態、出席與最近紀錄，避免全部紀錄混在一起。
              </p>
            </div>
          ) : selectedHistoryStudent ? (
            <>
              <section className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#a65f3b]">學員摘要</p>
                    <h2 className="mt-1 text-3xl font-black text-zinc-950">
                      {selectedHistoryStudent.name}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      會員編號：{selectedHistoryStudent.memberNo || "未填"}｜手機：{selectedHistoryStudent.phone || "未填"}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${getRosterStatus(selectedHistoryStudent).className}`}>
                    {getRosterStatus(selectedHistoryStudent).label}
                  </span>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm">
                <div className="border-b border-[#ead7c6] p-5">
                  <p className="text-sm font-semibold text-[#a65f3b]">課程履歷</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-950">
                    目前課程狀態
                  </h2>
                </div>
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {historyCourseCards.map((card) => (
                    <article
                      key={card.id}
                      className="rounded-3xl border border-[#ead7c6] bg-[#fffaf5] p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-zinc-950">{card.title}</h3>
                          <p className="mt-2 text-sm text-zinc-500">
                            最近紀錄：{card.latestActivity}
                          </p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusTone(card.status)}`}>
                          {card.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full border border-[#e8d4c2] bg-white px-3 py-1 font-bold text-[#6b3b25]">
                          出席：{card.attendanceText}
                        </span>
                        {card.note ? (
                          <span className="rounded-full border border-[#e8d4c2] bg-white px-3 py-1 text-zinc-500">
                            {card.note}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {historyCourseCards.length === 0 ? (
                    <p className="rounded-3xl border border-dashed border-[#ead7c6] bg-[#fffaf5] p-5 text-sm text-zinc-500 lg:col-span-2">
                      這位學員目前沒有課程資格紀錄。
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm">
                <div className="border-b border-[#ead7c6] p-5">
                  <p className="text-sm font-semibold text-[#a65f3b]">最近紀錄</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-950">
                    最近 8 筆活動
                  </h2>
                </div>
                <div className="divide-y divide-[#f0dfcf]">
                  {recentHistoryRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-3 px-5 py-4 md:grid-cols-[120px_1fr_110px_150px] md:items-center"
                    >
                      <span className="w-fit rounded-full border border-[#e8d4c2] bg-[#fffaf5] px-3 py-1 text-xs font-bold text-[#6b3b25]">
                        {row.type}
                      </span>
                      <div>
                        <p className="font-bold text-zinc-800">{row.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{row.note || "無備註"}</p>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                      <p className="text-sm text-zinc-500">{row.occurredAt}</p>
                    </div>
                  ))}
                  {recentHistoryRows.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">
                      這位學員目前沒有最近活動紀錄。
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#a65f3b]">查無學員</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">
                沒有找到符合「{q}」的學員
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                請改用姓名、會員編號或手機搜尋。
              </p>
            </div>
          )}
        </section>
      ) : null}

      {currentMode === "offering" ? (
        <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm">
          <div className="border-b border-[#ead7c6] p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#a65f3b]">
                  {currentMode === "offering" ? "梯次分配名冊" : "課程狀態名冊"}
                </p>
                <h2 className="mt-1 text-2xl font-black text-zinc-950">
                  {selectedCourse?.title ?? "課程"}｜{selectedYear} 年度
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  在這裡調整學生課程狀態，或將學生分配到特定梯次。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "全部"],
                    ["bookable", "可預約"],
                    ["blocked", "不可預約"],
                  ] as const
                ).map(([key, label]) => (
                  <Link
                    key={key}
                    href={buildHref({
                      mode: currentMode,
                      seriesId: selectedSeriesId,
                      year: selectedYear,
                      status: key,
                      q,
                    })}
                    className={`rounded-full border px-4 py-2 text-sm font-bold ${status === key ? "border-[#ef6c00] bg-[#ef6c00] text-white" : "border-[#e8d4c2] bg-white text-[#6b3b25]"}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <form
            action={bulkUpdateStudentCourseEligibilityAction}
            className="border-b border-[#ead7c6] bg-[#fffaf5] p-5"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={
                buildHref({
                  mode: currentMode,
                  seriesId: selectedSeriesId,
                  year: selectedYear,
                  status,
                  q,
                }) + "#qualification-bulk"
              }
            />
            <input
              type="hidden"
              name="seriesId"
              value={selectedSeriesId || ""}
            />
            <input type="hidden" name="year" value={selectedYear || ""} />
            <div
              id="qualification-bulk"
              className="rounded-2xl border border-[#ead7c6] bg-white p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-[#6b3b25]">
                    批次修改課程狀態
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    勾選下方資格名冊後，可以批次改為上課中、停用、已結訓；若工作人員加錯資格，請改為「未加入」，系統會清空該課程狀態與梯次。
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[160px_1fr_1fr_auto]">
                <select
                  name="eligibilityStatus"
                  defaultValue="上課中"
                  className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm font-bold text-[#4a2a1a] shadow-sm outline-none transition focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                >
                  {ELIGIBILITY_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  name="targetOfferingId"
                  defaultValue=""
                  className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm font-bold text-[#4a2a1a] shadow-sm outline-none transition focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                >
                  <option value="">不調整梯次 / 尚未分配</option>
                  {selectedOfferings.map((offering) => (
                    <option key={offering.id} value={offering.id}>
                      {offering.displayTitle ?? offering.title}
                    </option>
                  ))}
                </select>
                <input
                  name="note"
                  placeholder="批次備註，可留空"
                  className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />

                <button className="rounded-2xl bg-[#6b3b25] px-6 py-3 text-sm font-bold text-white">
                  批次修改資格
                </button>
              </div>
            </div>
            <div className="mt-4 hidden grid-cols-[48px_1.1fr_110px_150px_1fr_150px] border border-[#ead7c6] bg-[#fff7ed] px-5 py-3 text-sm font-bold text-[#6b3b25] md:grid">
              <span>選</span>
              <span>學員</span>
              <span>末三碼</span>
              <span>手機</span>
              <span>目前資格</span>
              <span>狀態</span>
            </div>
            <div className="divide-y divide-[#f0dfcf] rounded-b-2xl border-x border-b border-[#ead7c6] bg-white">
              {qualificationRows.map(
                ({ student, record, status: rowStatus }) => (
                  <label
                    key={record?.id ?? student.id}
                    className="grid cursor-pointer gap-3 px-5 py-4 transition hover:bg-[#fffaf5] md:grid-cols-[48px_1.1fr_110px_150px_1fr_150px] md:items-center"
                  >
                    <input
                      type="checkbox"
                      name="recordIds"
                      value={record?.id ?? ""}
                      disabled={!record}
                      className="h-5 w-5 rounded border-[#d8bda4] accent-[#ef6c00]"
                    />
                    <div>
                      <p className="font-black text-zinc-950">{student.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        生日：{text(student.birthday) || "未填"}｜會員：
                        {student.memberNo || "未填"}
                      </p>
                    </div>
                    <div className="font-bold text-zinc-950">
                      {student.idNumberLast3}
                    </div>
                    <div className="text-sm text-zinc-700">
                      {student.phone || "未填"}
                    </div>
                    <div className="text-sm text-zinc-700">
                      {record?.classDisplayName ||
                        record?.termLabel ||
                        "尚未分配梯次"}
                    </div>
                    <div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone(rowStatus)}`}
                      >
                        {rowStatus}
                      </span>
                    </div>
                  </label>
                ),
              )}
              {qualificationRows.length === 0 ? (
                <p className="p-6 text-sm text-zinc-500">
                  目前沒有符合條件的課程狀態。請先切到「課程狀態」勾選學員加入。
                </p>
              ) : null}
            </div>
          </form>

          <div className="border-b border-[#ead7c6] bg-white px-5 py-4">
            <p className="text-sm font-black text-[#6b3b25]">逐筆調整</p>
            <p className="mt-1 text-xs text-zinc-500">
              需要查看單一學員備註或只改一筆時，可展開下方列項目。
            </p>
          </div>
          <div className="divide-y divide-[#f0dfcf]">
            {qualificationRows.map(({ student, record, status: rowStatus }) => (
              <details key={record?.id ?? student.id} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-zinc-950">
                        {student.name}
                      </p>
                      <span className="rounded-full bg-[#fff3e6] px-3 py-1 text-xs font-bold text-[#8b5035]">
                        末三碼 {student.idNumberLast3}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone(rowStatus)}`}
                      >
                        {rowStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {record?.classDisplayName ||
                        record?.termLabel ||
                        "尚未分配梯次"}
                      ｜手機 {student.phone || "未填"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#e8d4c2] px-4 py-2 text-sm font-bold text-[#6b3b25] group-open:bg-[#fff3e6]">
                    調整資格
                  </span>
                </summary>
                <form
                  action={updateStudentCourseEligibilityAction}
                  className="mt-4 grid gap-3 rounded-2xl border border-[#ead7c6] bg-[#fffaf5] p-4 lg:grid-cols-[160px_1fr_1fr_auto]"
                >
                  <input type="hidden" name="recordId" value={record?.id ?? ""} />
                  <input
                    type="hidden"
                    name="seriesId"
                    value={selectedSeriesId}
                  />
                  <input type="hidden" name="year" value={selectedYear || ""} />
                  <select
                    name="eligibilityStatus"
                    defaultValue={rowStatus}
                    className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm font-bold text-[#4a2a1a] shadow-sm outline-none transition focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                  >
                    {ELIGIBILITY_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    name="targetOfferingId"
                    defaultValue={record?.offeringId ?? ""}
                    className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm font-bold text-[#4a2a1a] shadow-sm outline-none transition focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                  >
                    <option value="">尚未分配梯次</option>
                    {selectedOfferings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.displayTitle ?? offering.title}
                      </option>
                    ))}
                  </select>
                  <input
                    name="note"
                    defaultValue={record?.note ?? ""}
                    placeholder="備註"
                    className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                  />
                  <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
                    儲存
                  </button>
                </form>
              </details>
            ))}
            {qualificationRows.length === 0 ? (
              <p className="p-6 text-sm text-zinc-500">
                目前沒有符合條件的課程狀態。請先切到「課程狀態」勾選學員加入。
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
