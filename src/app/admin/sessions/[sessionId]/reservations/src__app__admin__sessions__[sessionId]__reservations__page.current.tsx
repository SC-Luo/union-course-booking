import Link from "next/link";
import { notFound } from "next/navigation";
import { bookRosterStudentByStaffAction, markAllSessionStudentsAttendedAction, saveSessionJournalAction } from "@/app/admin/actions";
import { AttendanceStatusControls } from "./attendance-status-controls";
import { ReservationNoteAutosave } from "./reservation-note-autosave";
import { SessionInfoModalCard } from "./session-info-modal-card";
import { SessionJournalAutosave } from "./session-journal-autosave";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse } from "@/lib/course-utils";
import type { Course, CourseSession, Enrollment, Reservation, Student } from "@/lib/types";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ attendance?: string; q?: string; rosterBooking?: string }>;
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSessionRouteCandidates(value: string) {
  const restored = value.replace(/~2F/gi, "%2F").replace(/~5C/gi, "%5C");
  const onceDecoded = safeDecodeURIComponent(restored);
  const twiceDecoded = safeDecodeURIComponent(onceDecoded);

  return Array.from(new Set([
    value,
    restored,
    onceDecoded,
    twiceDecoded,
    value.replace(/~2F/gi, "/").replace(/~5C/gi, "\\"),
  ].filter(Boolean)));
}

function resolveSessionFromRouteParam(sessionId: string, courses: any[]) {
  const candidates = getSessionRouteCandidates(sessionId);
  const allSessions = courses.flatMap((course) => course.sessions ?? []);

  return allSessions.find((session) => {
    const id = String(session.id ?? "");
    return (
      candidates.includes(id) ||
      candidates.includes(encodeURIComponent(id)) ||
      candidates.includes(encodeURIComponent(id).replace(/%2F/gi, "~2F").replace(/%5C/gi, "~5C"))
    );
  });
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function formatDateText(date?: string) {
  if (!date) return "未設定日期";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return `${date.replaceAll("-", "/")}（${weekdays[parsed.getDay()]}）`;
}

function sessionStatusLabel(status?: string) {
  if (status === "suspended") return "停課";
  if (status === "makeup") return "補課";
  if (status === "rescheduled") return "調課";
  if (status === "cancelled") return "取消";
  return "正常上課";
}

function attendanceWorkflowLabel(status?: string) {
  if (status === "in_progress") return "點名中";
  if (status === "completed") return "已完成";
  return "尚未開始";
}

function abnormalLabel(status?: string) {
  if (status === "processing") return "處理中";
  if (status === "resolved") return "已處理";
  return "無異常";
}

function abnormalStatusTone(status?: string) {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-[#ead8ca] bg-[#fffaf5] text-[#8a7c72]";
}

function sessionStatusButtonClass(status: string, current: string) {
  const active = status === current;
  if (status === "suspended" || status === "cancelled") return active ? "border-rose-500 bg-rose-600 text-white shadow-sm" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
  if (status === "makeup") return active ? "border-sky-500 bg-sky-600 text-white shadow-sm" : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
  if (status === "rescheduled") return active ? "border-amber-500 bg-amber-500 text-white shadow-sm" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  return active ? "border-[#5A3726] bg-[#5A3726] text-white shadow-sm" : "border-[#dbcabd] bg-white text-[#5A3726] hover:bg-[#fff6ed]";
}

function attendanceWorkflowButtonClass(status: string, current: string) {
  const active = status === current;
  if (status === "completed") return active ? "border-emerald-500 bg-emerald-600 text-white shadow-sm" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  if (status === "in_progress") return active ? "border-sky-500 bg-sky-600 text-white shadow-sm" : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
  return active ? "border-[#8a7c72] bg-[#8a7c72] text-white shadow-sm" : "border-[#dbcabd] bg-white text-[#8a7c72] hover:bg-[#fff6ed]";
}

function sessionStatusBadgeClass(status?: string) {
  if (status === "suspended") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "makeup") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "rescheduled") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function attendanceWorkflowBadgeClass(status?: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-[#ead8ca] bg-[#fffaf5] text-[#8a7c72]";
}


function autoResolveAbnormalStatus(abnormalStatus?: string, followUpNote?: string) {
  if (String(followUpNote ?? "").trim()) return "resolved";
  if (String(abnormalStatus ?? "").trim()) return "processing";
  return "unresolved";
}

function normalizeAttendanceStatus(status?: string) {
  return status === "pending" || status === "attended" || status === "late" || status === "absent" || status === "leave" ? status : "unchecked";
}

function getDisplayAttendanceStatus(reservation: AttendanceRow) {
  const normalized = normalizeAttendanceStatus(reservation.attendanceStatus);
  if (normalized === "pending") return "reserved";
  if (normalized !== "unchecked") return normalized;
  return reservation.isRosterOnly ? "unchecked" : "reserved";
}


function attendanceStatusText(status?: string) {
  if (status === "attended") return "已到";
  if (status === "late") return "遲到";
  if (status === "absent") return "未到";
  if (status === "leave") return "請假";
  if (status === "reserved") return "已預約";
  return "未確認";
}

function attendanceStatusCompactClass(status?: string) {
  if (status === "attended") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "late") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "absent") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "leave") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "reserved") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-[#ead8ca] bg-[#fffaf5] text-[#8a7c72]";
}

function compactSupplementSummary(detailCount: number, homeworkText: string, noteText: string) {
  const items = [];
  if (detailCount > 0) items.push(`出席 ${detailCount} 筆`);
  if (homeworkText.trim()) items.push("作業已填");
  if (noteText.trim()) items.push("備註已填");
  return items.length > 0 ? items.join("｜") : "無補充";
}

function hasLeaveDetail(reservation: Pick<Reservation, "leaveStartTime" | "leaveEndTime" | "leaveHours">) {
  return Boolean(reservation.leaveStartTime || reservation.leaveEndTime || reservation.leaveHours != null);
}

function attendanceDetailItems(reservation: Pick<Reservation, "attendanceStatus" | "lateTime" | "leaveStartTime" | "leaveEndTime" | "leaveHours">) {
  const items: string[] = [];

  if (reservation.attendanceStatus === "late" && reservation.lateTime) {
    items.push(`遲到 ${reservation.lateTime}`);
  }

  if (reservation.leaveStartTime && reservation.leaveEndTime) {
    items.push(`請假 ${reservation.leaveStartTime}–${reservation.leaveEndTime}`);
  } else if (reservation.leaveHours != null) {
    items.push(`請假 ${reservation.leaveHours} 小時`);
  }

  return items;
}

type AttendanceListExtraFields = {
  homework?: string;
  homeworkStatus?: string;
  assignment?: string;
  assignmentStatus?: string;
  attendanceNote?: string;
  adminNote?: string;
  notes?: string;
};

function attendanceHomeworkText(reservation: Reservation & AttendanceListExtraFields) {
  return String(reservation.homework ?? reservation.homeworkStatus ?? reservation.assignment ?? reservation.assignmentStatus ?? "").trim();
}

function attendanceNoteText(reservation: Reservation & AttendanceListExtraFields) {
  const note = String(reservation.note ?? reservation.attendanceNote ?? reservation.adminNote ?? reservation.notes ?? "").trim();
  if (/年度課程名單.*帶入|名冊帶入|自動帶入課堂點名/.test(note)) return "";
  return note;
}

function buildTimeOptions(startTime?: string, endTime?: string) {
  const fallback = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
  const match = (value?: string) => String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  const start = match(startTime);
  const end = match(endTime);
  if (!start || !end) return fallback;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) return fallback;
  const options: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    options.push(`${hour}:${minute}`);
  }
  return options;
}

function cleanDigits(value?: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function isActiveEnrollmentStatus(status?: string) {
  const text = String(status ?? "").trim().toLowerCase();
  if (!text) return true;
  return ["active", "booked", "enrolled", "上課中", "已加入"].some((item) => text.includes(item));
}

function getCourseOfferingCandidates(course: Course, session: CourseSession) {
  const legacyCourse = course as Course & { courseOfferingId?: string; legacyCourseId?: string };
  return new Set([
    course.id,
    course.offeringId,
    legacyCourse.courseOfferingId,
    legacyCourse.legacyCourseId,
    session.offeringId,
  ].filter(Boolean).map(String));
}

function getCourseSeriesCandidates(course: Course, session: CourseSession) {
  const legacyCourse = course as Course & { courseSeriesId?: string };
  return new Set([
    course.seriesId,
    course.courseMasterId,
    legacyCourse.courseSeriesId,
    session.seriesId,
  ].filter(Boolean).map(String));
}

function getCourseYear(course: Course, session: CourseSession) {
  return course.year ?? (session.date ? Number(session.date.slice(0, 4)) - 1911 : undefined);
}

function getCourseTermCandidates(course: Course) {
  return new Set([
    course.term,
    course.termNumber,
    course.termLabel,
  ].filter((value) => value !== undefined && value !== null && String(value).trim()).map((value) => String(value).replace(/^第|期$/g, "").trim()));
}


function findOfferingForSession(course: Course, session: CourseSession, offerings: any[]) {
  return offerings.find((offering) =>
    offering.id === session.offeringId ||
    offering.id === course.offeringId ||
    offering.legacyCourseId === course.id ||
    offering.id === (course as any).courseOfferingId,
  );
}

function findSeriesForSession(course: Course, offering: any, session: CourseSession, seriesList: any[]) {
  return seriesList.find((series) =>
    series.id === course.seriesId ||
    series.id === course.courseMasterId ||
    series.id === (course as any).courseSeriesId ||
    series.id === offering?.seriesId ||
    series.id === offering?.courseMasterId ||
    series.id === session.seriesId,
  );
}

function getInstructorNameById(instructors: any[], id?: string) {
  if (!id) return "";
  return String(instructors.find((instructor) => instructor.id === id)?.name ?? "").trim();
}

function resolveEffectiveSessionTeachers(course: Course, session: CourseSession, offering: any, series: any, instructors: any[]) {
  const primaryInstructorId =
    session.instructorId ||
    offering?.primaryInstructorId ||
    course.primaryInstructorId ||
    (course as { defaultInstructorId?: string }).defaultInstructorId ||
    series?.defaultInstructorId ||
    "";
  const primaryInstructorName =
    getInstructorNameById(instructors, primaryInstructorId) ||
    session.instructorName ||
    offering?.primaryInstructorName ||
    course.primaryInstructorName ||
    (course as { defaultInstructorName?: string }).defaultInstructorName ||
    series?.defaultInstructorName ||
    "";
  const assistantInstructorIds =
    session.assistantInstructorIds?.length ? session.assistantInstructorIds :
    offering?.assistantInstructorIds?.length ? offering.assistantInstructorIds :
    course.assistantInstructorIds?.length ? course.assistantInstructorIds :
    [];
  const assistantInstructorNamesFromIds = assistantInstructorIds.map((id: string) => getInstructorNameById(instructors, id)).filter(Boolean);
  const assistantInstructorNames = assistantInstructorNamesFromIds.length ? assistantInstructorNamesFromIds : (
    session.assistantInstructorNames?.length ? session.assistantInstructorNames :
    offering?.assistantInstructorNames?.length ? offering.assistantInstructorNames :
    course.assistantInstructorNames?.length ? course.assistantInstructorNames :
    []
  );

  return {
    primaryInstructorId,
    primaryInstructorName,
    assistantInstructorIds,
    assistantInstructorNames,
  };
}

function normalizeKeyword(value?: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s｜|、，,／/\-＿_]+/g, "");
}

function collectCourseSpecialtyKeywords(course: Course, offering: any, series: any, categories: any[]) {
  const category = categories.find((item) => item?.id === (sessionCategoryId(course, offering, series)));
  const rawText = [
    category?.name,
    category?.code,
    course.categoryId,
    course.title,
    course.displayTitle,
    course.displayName,
    course.shortTitle,
    course.shortName,
    course.courseType,
    offering?.categoryId,
    offering?.title,
    offering?.displayTitle,
    offering?.displayName,
    offering?.shortName,
    offering?.courseType,
    series?.categoryId,
    series?.title,
    series?.name,
    series?.courseType,
  ].filter(Boolean).join(" ");

  const normalizedText = normalizeKeyword(rawText);
  const keywords = new Set<string>();

  ["美容", "美甲", "手足", "凝膠", "芳療", "美睫", "彩妝", "髮", "紋繡"].forEach((keyword) => {
    if (normalizedText.includes(normalizeKeyword(keyword))) keywords.add(normalizeKeyword(keyword));
  });

  // If the category itself is meaningful but not in the common keyword list, use it as a fallback.
  [category?.name, category?.code, course.categoryId, offering?.categoryId, series?.categoryId]
    .filter(Boolean)
    .map((value) => normalizeKeyword(String(value)))
    .filter((value) => value.length >= 2 && !["all", "default", "other"].includes(value))
    .forEach((value) => keywords.add(value));

  return Array.from(keywords);
}

function sessionCategoryId(course: Course, offering: any, series: any) {
  return String(course.categoryId || offering?.categoryId || series?.categoryId || "");
}

function instructorMatchesCourse(instructor: any, course: Course, offering: any, series: any, courseKeywords: string[]) {
  const directCourseMatches = [
    ...(instructor?.courseSeriesIds ?? []),
    ...(instructor?.courseOfferingIds ?? []),
  ].map((value) => String(value));

  if (directCourseMatches.includes(String(series?.id ?? "")) || directCourseMatches.includes(String(offering?.id ?? "")) || directCourseMatches.includes(String(course.seriesId ?? "")) || directCourseMatches.includes(String(course.offeringId ?? ""))) {
    return true;
  }

  if (courseKeywords.length === 0) return true;

  const specialtyKeywords: string[] = ((instructor?.specialties ?? []) as string[])
    .map((specialty: string) => normalizeKeyword(specialty))
    .filter(Boolean);

  if (specialtyKeywords.length === 0) return false;

  return courseKeywords.some((courseKeyword) => specialtyKeywords.some((specialty) => specialty.includes(courseKeyword) || courseKeyword.includes(specialty)));
}

function getEligibleInstructors(course: Course, offering: any, series: any, instructors: any[], categories: any[]) {
  const courseKeywords = collectCourseSpecialtyKeywords(course, offering, series, categories);

  return instructors
    .filter((instructor) => instructor?.isActive !== false)
    .filter((instructor) => instructorMatchesCourse(instructor, course, offering, series, courseKeywords))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hant"));
}

function isEnrollmentForSession(enrollment: Enrollment, course: Course, session: CourseSession) {
  if (!isActiveEnrollmentStatus(enrollment.status)) return false;

  const offeringCandidates = getCourseOfferingCandidates(course, session);
  const seriesCandidates = getCourseSeriesCandidates(course, session);
  const enrollmentOfferingIds = [enrollment.offeringId, enrollment.courseOfferingId, enrollment.courseId].filter(Boolean).map(String);
  const hasOfferingId = enrollmentOfferingIds.length > 0;
  const offeringMatches = enrollmentOfferingIds.some((id) => offeringCandidates.has(id));
  if (hasOfferingId) return offeringMatches;

  const enrollmentSeriesIds = [enrollment.seriesId, enrollment.courseMasterId].filter(Boolean).map(String);
  const seriesMatches = enrollmentSeriesIds.some((id) => seriesCandidates.has(id));
  if (!seriesMatches) return false;

  const courseYear = getCourseYear(course, session);
  const enrollmentYear = enrollment.year;
  if (courseYear != null && enrollmentYear != null && String(courseYear) !== String(enrollmentYear)) return false;

  const courseTerms = getCourseTermCandidates(course);
  const enrollmentTerm = enrollment.term ?? enrollment.termLabel;
  if (courseTerms.size > 0 && enrollmentTerm != null && String(enrollmentTerm).trim()) {
    const normalizedEnrollmentTerm = String(enrollmentTerm).replace(/^第|期$/g, "").trim();
    return courseTerms.has(normalizedEnrollmentTerm);
  }

  return true;
}

type AttendanceRow = Reservation & { isRosterOnly?: boolean };

function buildAttendanceRows({
  course,
  session,
  reservations,
  students,
  enrollments,
}: {
  course: Course;
  session: CourseSession;
  reservations: Reservation[];
  students: Student[];
  enrollments: Enrollment[];
}) {
  const bookedReservations = reservations.filter((reservation) => reservation.sessionId === session.id && reservation.status === "booked");
  const rowsByStudentId = new Map<string, AttendanceRow>();

  bookedReservations.forEach((reservation) => {
    if (reservation.studentId) rowsByStudentId.set(reservation.studentId, reservation);
  });

  enrollments
    .filter((enrollment) => isEnrollmentForSession(enrollment, course, session))
    .forEach((enrollment) => {
      if (rowsByStudentId.has(enrollment.studentId)) return;
      const student = students.find((item) => item.id === enrollment.studentId && item.isActive !== false);
      if (!student) return;
      const last3 = cleanDigits(student.idNumberLast3).slice(0, 3) || cleanDigits(student.phone).slice(-3);
      rowsByStudentId.set(student.id, {
        id: `roster-${String(session.id).replace(/[\/]/g, "~")}-${student.id}`,
        courseId: course.id,
        sessionId: session.id,
        studentId: student.id,
        studentName: student.name,
        phoneLastThree: last3,
        idNumberLast3: last3,
        offeringId: session.offeringId ?? course.offeringId,
        seriesId: session.seriesId ?? course.seriesId ?? course.courseMasterId,
        bookedAt: enrollment.joinedAt ?? enrollment.createdAt ?? "",
        status: "booked",
        attendanceStatus: "unchecked",
        leaveHours: undefined,
        source: "manual",
        note: "由年度課程名單帶入",
        isRosterOnly: true,
      });
    });

  return Array.from(rowsByStudentId.values()).sort((a, b) => {
    const studentA = students.find((student) => student.id === a.studentId);
    const studentB = students.find((student) => student.id === b.studentId);
    return String(studentA?.memberNo ?? studentA?.studentNo ?? a.studentName).localeCompare(String(studentB?.memberNo ?? studentB?.studentNo ?? b.studentName), "zh-Hant");
  });
}

export default async function AdminReservationsPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const { attendance = "all", q = "", rosterBooking = "" } = await searchParams;
  const { courses, reservations, students = [], enrollments = [], courseOfferings = [], courseSeries = [], instructors = [], categories = [] } = await getBookingData();
  const session = resolveSessionFromRouteParam(sessionId, courses);
  const course = session ? getCourse(session.courseId, courses) : undefined;

  if (!session || !course) {
    notFound();
  }

  const offering = findOfferingForSession(course, session, courseOfferings);
  const series = findSeriesForSession(course, offering, session, courseSeries);
  const effectiveTeachers = resolveEffectiveSessionTeachers(course, session, offering, series, instructors);
  const eligibleInstructors = getEligibleInstructors(course, offering, series, instructors, categories);
  const effectiveLocation = session.location || offering?.location || course.defaultLocation || series?.defaultLocation || "";

  const encodedSessionId = encodeRouteSegment(session.id);
  const currentUrl = `/admin/sessions/${encodedSessionId}/reservations?attendance=${encodeURIComponent(attendance)}&q=${encodeURIComponent(q)}#attendance-list`;
  const attendanceRows = buildAttendanceRows({ course, session, reservations, students, enrollments });
  const attended = attendanceRows.filter((reservation) => reservation.attendanceStatus === "attended").length;
  const late = attendanceRows.filter((reservation) => reservation.attendanceStatus === "late").length;
  const absent = attendanceRows.filter((reservation) => reservation.attendanceStatus === "absent").length;
  const leave = attendanceRows.filter((reservation) => reservation.attendanceStatus === "leave" || hasLeaveDetail(reservation)).length;
  const reserved = attendanceRows.filter((reservation) => getDisplayAttendanceStatus(reservation) === "reserved").length;
  const unchecked = attendanceRows.filter((reservation) => getDisplayAttendanceStatus(reservation) === "unchecked").length;
  const normalizedQuery = q.trim().toLowerCase();
  const attendanceFilter = attendance === "reserved" || attendance === "unchecked" || attendance === "attended" || attendance === "late" || attendance === "absent" || attendance === "leave" ? attendance : "all";
  const displayedReservations = attendanceRows.filter((reservation) => {
    const statusMatches = attendanceFilter === "all" || getDisplayAttendanceStatus(reservation) === attendanceFilter || (attendanceFilter === "leave" && hasLeaveDetail(reservation));
    const student = students.find((item) => item.id === reservation.studentId);
    const queryText = [
      reservation.studentName,
      reservation.phoneLastThree,
      student?.phone,
      student?.memberNo,
      student?.studentNo,
      reservation.note,
    ].filter(Boolean).join(" ").toLowerCase();
    return statusMatches && (!normalizedQuery || queryText.includes(normalizedQuery));
  });
  const assistantNames = effectiveTeachers.assistantInstructorNames.filter(Boolean).join("、") || "未設定";
  const sessionStatus = session.sessionStatus ?? session.status ?? "scheduled";
  const attendanceStatus = session.attendanceStatus ?? (attendanceRows.length === 0 || unchecked === attendanceRows.length ? "not_started" : unchecked > 0 ? "in_progress" : "completed");
  const abnormalResolvedStatus = autoResolveAbnormalStatus(session.abnormalStatus, session.followUpNote);
  const hasAbnormal = Boolean(String(session.abnormalStatus ?? "").trim());
  const hasFollowUp = Boolean(String(session.followUpNote ?? "").trim());

  const timeOptions = buildTimeOptions(session.startTime, session.endTime);
  const attendanceFilters = [
    { label: "全部", value: "all", count: attendanceRows.length },
    { label: "已預約", value: "reserved", count: reserved },
    { label: "未確認", value: "unchecked", count: unchecked },
    { label: "已到", value: "attended", count: attended },
    { label: "遲到", value: "late", count: late },
    { label: "未到", value: "absent", count: absent },
    { label: "請假", value: "leave", count: leave },
  ];

  return (
    <AdminShell currentSection="attendance.dashboard">
      <section className="mb-4 rounded-[26px] border border-[#ead8ca] bg-[#fffaf5] px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin/course-sessions" className="inline-flex text-xs font-bold text-[#8a7c72] hover:text-[#1f1712]">
              ← 返回課堂日誌總覽
            </Link>
            <p className="mt-3 text-xs font-black text-[#B46F4A]">單堂課工作台</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#1f1712]">{course.title}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#66584f]">
              本頁集中處理點名、授課紀錄、助教現場紀錄與 TTQS 異常追蹤。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/course-sessions" className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2.5 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">
              返回總覽
            </Link>
          </div>
        </div>
      </section>

      <form action={saveSessionJournalAction} className="mb-4">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="redirectTo" value={`/admin/sessions/${encodedSessionId}/reservations#session-workspace`} />

        <section id="session-workspace" className="scroll-mt-24 rounded-[26px] border border-[#ead8ca] bg-white px-5 py-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(230px,0.46fr)] xl:items-center">
            <div>
              <p className="text-xs font-black text-[#B46F4A]">課堂摘要</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1f1712]">
                {formatDateText(session.date)}｜{session.startTime}-{session.endTime}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-6 text-[#66584f]">
                <span>單元：<strong className="text-[#1f1712]">{session.topic || "未填單元"}</strong></span>
                <span>地點：<strong className="text-[#1f1712]">{effectiveLocation || "未設定"}</strong></span>
                <span>講師：<strong className="text-[#1f1712]">{effectiveTeachers.primaryInstructorName || "未設定"}</strong></span>
                <span>助教：<strong className="text-[#1f1712]">{assistantNames}</strong></span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-[#5A3726] sm:grid-cols-5 xl:hidden">
                <span className="rounded-2xl border border-[#ead8ca] bg-[#fffdf9] px-3 py-2">未確認 {unchecked}</span>
                <span className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">已到 {attended}</span>
                <span className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">遲到 {late}</span>
                <span className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">未到 {absent}</span>
                <span className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">請假 {leave}</span>
              </div>
              <a href="#attendance-list" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#E85F00] text-sm font-black text-white shadow-sm hover:brightness-105 sm:w-auto xl:hidden">
                前往點名
              </a>
            </div>

            <SessionInfoModalCard title="編輯課堂資料" description="調整日期、時間、單元、地點、講師與助教。">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  上課日期
                  <input type="date" name="date" defaultValue={session.date} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-normal outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  單元名稱
                  <input name="topic" defaultValue={session.topic ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-normal outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" placeholder="例如：彩妝、底妝練習" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  開始時間
                  <input type="time" name="startTime" defaultValue={session.startTime} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-normal outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  結束時間
                  <input type="time" name="endTime" defaultValue={session.endTime} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-normal outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#5A3726] lg:col-span-2">
                  上課地點
                  <input name="location" defaultValue={effectiveLocation} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-normal outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" placeholder="例如：工會教室" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  主要講師
                  <select name="instructorId" defaultValue={effectiveTeachers.primaryInstructorId} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-black text-[#1f1712] outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100">
                    <option value="">未設定</option>
                    {eligibleInstructors.map((instructor) => (
                      <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 text-sm font-bold text-[#5A3726]">
                  助教／協同講師
                  <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-2xl border border-[#dbcabd] bg-white px-3 py-2">
                    {eligibleInstructors.map((instructor) => (
                      <label key={instructor.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead8ca] bg-[#fffaf5] px-3 py-2 text-xs font-bold text-[#5A3726] transition hover:border-[#E85F00] has-[:checked]:border-[#E85F00] has-[:checked]:bg-[#fff1e7] has-[:checked]:text-[#E85F00]">
                        <input type="checkbox" name="assistantInstructorIds" value={instructor.id} defaultChecked={effectiveTeachers.assistantInstructorIds.includes(instructor.id)} className="h-4 w-4 rounded border-[#dbcabd] accent-[#E85F00]" />
                        {instructor.name}
                      </label>
                    ))}
                    {eligibleInstructors.length === 0 ? <span className="text-sm font-normal text-[#8a7c72]">目前沒有符合本課程專業項目的講師可選，請先到 <Link href="/admin/students?mode=instructors" className="font-black text-[#E85F00] underline">名冊資料／講師名冊</Link> 補上講師專業項目。</span> : null}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2 border-t border-[#f1e2d6] pt-4">
                <button className="rounded-2xl bg-[#5A3726] px-5 py-3 text-sm font-black text-white shadow-sm hover:brightness-105">
                  儲存課堂資料
                </button>
              </div>
            </SessionInfoModalCard>

            <div className="grid gap-2 rounded-[20px] border border-[#f1e2d6] bg-[#fffaf5] px-4 py-3 text-sm text-[#66584f]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold">課堂</span>
                <strong className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${sessionStatusBadgeClass(sessionStatus)}`}>{sessionStatusLabel(sessionStatus)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold">點名</span>
                <strong className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${attendanceWorkflowBadgeClass(attendanceStatus)}`}>{attendanceWorkflowLabel(attendanceStatus)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold">TTQS</span>
                <strong className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${abnormalStatusTone(abnormalResolvedStatus)}`}>{abnormalLabel(abnormalResolvedStatus)}</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-[#f5e8dc] pt-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_1fr_0.75fr]">
              <div className="grid gap-2 text-xs font-black text-[#B46F4A]">
                課堂狀態
                <div className="flex flex-wrap gap-1.5 rounded-[18px] border border-[#ead8ca] bg-[#fffdf9] p-2">
                  {[
                    { value: "scheduled", label: "正常上課" },
                    { value: "suspended", label: "停課" },
                    { value: "makeup", label: "補課" },
                    { value: "rescheduled", label: "調課" },
                  ].map((item) => (
                    <button key={item.value} type="submit" name="sessionStatus" value={item.value} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${sessionStatusButtonClass(item.value, sessionStatus)}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 text-xs font-black text-[#B46F4A]">
                點名狀態
                <div className="flex flex-wrap gap-1.5 rounded-[18px] border border-[#ead8ca] bg-[#fffdf9] p-2">
                  {[
                    { value: "not_started", label: "尚未開始" },
                    { value: "in_progress", label: "點名中" },
                    { value: "completed", label: "已完成" },
                  ].map((item) => (
                    <button key={item.value} type="submit" name="attendanceStatus" value={item.value} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${attendanceWorkflowButtonClass(item.value, attendanceStatus)}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 text-xs font-black text-[#B46F4A]">
                異常處理
                <input type="hidden" name="abnormalResolvedStatus" value={abnormalResolvedStatus} />
                <div className={`flex min-h-10 items-center rounded-[18px] border px-3 py-2 text-xs font-black ${abnormalStatusTone(abnormalResolvedStatus)}`}>
                  {abnormalLabel(abnormalResolvedStatus)}
                  <span className="ml-2 font-medium text-current opacity-70">
                    {hasFollowUp ? "已填後續" : hasAbnormal ? "處理中" : "自動判定"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>

      <div className="flex flex-col">
      <details id="lesson-journal" className="scroll-mt-24 order-2 mb-4 rounded-[24px] border border-[#ead8ca] bg-white shadow-sm xl:order-1">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-[#5A3726] marker:hidden">
          課堂日誌與 TTQS 紀錄
          <span className="ml-2 text-xs font-medium text-[#8a7c72]">展開後輸入，系統會自動儲存</span>
        </summary>
        <div className="border-t border-[#f1e2d6] px-5 py-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4">
              <p className="text-sm font-bold text-[#B46F4A]">講師授課紀錄</p>
              <div className="mt-4 grid gap-4">
                <SessionJournalAutosave sessionId={session.id} field="teachingContent" defaultValue={session.teachingContent ?? ""} label="今日授課內容" placeholder="例如：彩妝工具介紹、底妝練習、眉型修整" rows={4} />
                <SessionJournalAutosave sessionId={session.id} field="teacherNote" defaultValue={session.teacherNote ?? ""} label="講師備註" placeholder="講師可記錄學員學習狀況、下次提醒或課程調整建議" rows={4} />
              </div>
            </section>

            <section className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4">
              <p className="text-sm font-bold text-[#B46F4A]">助教與行政紀錄</p>
              <div className="mt-4 grid gap-4">
                <SessionJournalAutosave sessionId={session.id} field="assistantNote" defaultValue={session.assistantNote ?? ""} label="助教現場紀錄" placeholder="例如：設備狀況、學員問題、現場突發事件" rows={4} />
                <SessionJournalAutosave sessionId={session.id} field="adminNote" defaultValue={session.adminNote ?? ""} label="行政備註" placeholder="行政可記錄補件、聯繫、後續通知或內部提醒" rows={4} />
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-[22px] border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-sm font-bold text-rose-700">TTQS 異常追蹤</p>
            <p className="mt-1 text-xs leading-5 text-rose-700/80">未填為無異常；填寫異常狀態後為處理中；填寫後續追蹤後為已處理。</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SessionJournalAutosave sessionId={session.id} field="abnormalStatus" defaultValue={session.abnormalStatus ?? ""} label="異常狀態" placeholder="例如：講師遲到、設備故障、學員爭議、臨時調課；無異常可留空" rows={3} tone="rose" />
              <SessionJournalAutosave sessionId={session.id} field="followUpNote" defaultValue={session.followUpNote ?? ""} label="後續追蹤" placeholder="例如：通知學員、補課安排、設備報修、主管確認" rows={3} tone="rose" />
            </div>
          </section>
        </div>
      </details>

      <section id="attendance-list" className="scroll-mt-24 order-1 mb-6 rounded-[26px] border border-[#ead8ca] bg-white p-4 shadow-sm sm:p-5 xl:order-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black text-[#B46F4A]">點名管理</p>
            <h2 className="mt-1 text-2xl font-black text-[#1f1712]">本堂學員出席狀態</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">快速完成出席狀態、出席補充、作業與備註。</p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[440px]">
            <input type="hidden" name="attendance" value={attendanceFilter} />
            <input name="q" defaultValue={q} className="h-11 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100" placeholder="搜尋姓名、手機" />
            <button className="h-11 rounded-2xl bg-[#5A3726] px-5 text-sm font-bold text-white hover:brightness-105">搜尋</button>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap">
          {attendanceFilters.map((item) => {
            const isActive = attendanceFilter === item.value;
            const toneClass =
              item.value === "attended"
                ? isActive
                  ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                  : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : item.value === "late"
                  ? isActive
                    ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                    : "border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : item.value === "absent"
                    ? isActive
                      ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                      : "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : item.value === "leave"
                      ? isActive
                        ? "border-violet-500 bg-violet-500 text-white shadow-sm"
                        : "border-violet-100 bg-violet-50 text-violet-700 hover:bg-violet-100"
                      : item.value === "unchecked"
                        ? isActive
                          ? "border-[#E85F00] bg-[#E85F00] text-white shadow-sm"
                          : "border-[#ead8ca] bg-[#fffaf5] text-[#5A3726] hover:bg-[#fff6ed]"
                        : item.value === "reserved"
                          ? isActive
                            ? "border-sky-500 bg-sky-500 text-white shadow-sm"
                            : "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          : isActive
                            ? "border-[#E85F00] bg-[#E85F00] text-white shadow-sm"
                            : "border-[#dbcabd] bg-white text-[#5A3726] hover:bg-[#fff6ed]";

            return (
              <Link
                key={item.value}
                href={`/admin/sessions/${encodedSessionId}/reservations?attendance=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ""}#attendance-list`}
                className={`rounded-2xl border px-3 py-2 text-center text-sm font-black transition lg:min-w-[88px] ${toneClass}`}
              >
                <span className="block leading-5">{item.label}</span>
                <span className="block text-base leading-5">{item.count}</span>
              </Link>
            );
          })}
        </div>

        {rosterBooking ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${
              rosterBooking === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : rosterBooking === "full"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {rosterBooking === "success"
              ? "已補登為本堂預約。"
              : rosterBooking === "full"
                ? "本堂名額已滿，未完成補登預約。"
                : "補登預約失敗，請確認學員與課堂資料。"}
          </div>
        ) : null}

        {attendanceRows.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-[#dbcabd] bg-[#fffaf5] p-5 text-sm leading-6 text-[#8a7c72]">
            目前沒有有效名單。目前沒有可帶入的年度課程名單。請先回到年度課程「名冊」頁，把學員加入這個班級。
          </div>
        ) : (
          <div className="mt-5 rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] md:overflow-x-auto md:bg-white">
            <div className="hidden min-w-[1180px] grid-cols-[0.68fr_minmax(410px,2.2fr)_1fr_0.95fr_0.95fr] border-b border-[#ead8ca] bg-[#fff9f3] px-4 py-3 text-sm font-bold text-[#66584f] md:grid">
              <span>學員</span>
              <span>狀態列</span>
              <span>出席狀況</span>
              <span>作業</span>
              <span>備註</span>
            </div>
            {displayedReservations.map((reservation) => {
              const displayStatus = getDisplayAttendanceStatus(reservation);
              const detailItems = attendanceDetailItems(reservation);
              const homeworkText = attendanceHomeworkText(reservation);
              const noteText = attendanceNoteText(reservation);

              const supplementSummary = compactSupplementSummary(detailItems.length, homeworkText, noteText);

              return (
                <div key={reservation.id}>
                  <div className="m-1.5 rounded-[18px] border border-[#ead8ca] bg-white px-3 py-2.5 shadow-sm md:hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-base font-black text-[#1f1712]">{reservation.studentName}</p>
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${attendanceStatusCompactClass(displayStatus)}`}>
                        {attendanceStatusText(displayStatus)}
                      </span>
                      {reservation.isRosterOnly ? (
                        <form action={bookRosterStudentByStaffAction} className="shrink-0">
                          <input type="hidden" name="studentId" value={reservation.studentId ?? ""} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="redirectTo" value={`${currentUrl}#attendance-list`} />
                          <button
                            type="submit"
                            className="rounded-full border border-[#E85F00]/25 bg-[#fff7ed] px-2.5 py-1 text-[11px] font-black text-[#B54B00] transition hover:bg-[#ffedd5]"
                          >
                            補登預約
                          </button>
                        </form>
                      ) : (
                        <span className="shrink-0 text-[11px] font-bold text-[#8a7c72]">已預約</span>
                      )}
                    </div>

                    <div className="mt-2">
                      <AttendanceStatusControls
                        reservationId={reservation.id}
                        sessionId={session.id}
                        courseId={course.id}
                        studentId={reservation.studentId}
                        currentStatus={displayStatus}
                        redirectTo={currentUrl}
                        lateTime={reservation.lateTime}
                        leaveStartTime={reservation.leaveStartTime}
                        leaveEndTime={reservation.leaveEndTime}
                        timeOptions={timeOptions}
                      />
                    </div>

                    <details className="mt-2 border-t border-[#f1e2d6] pt-1.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1.5 text-xs font-black text-[#8B4A2F] marker:hidden">
                        <span>{supplementSummary === "無補充" ? "＋ 補充資料" : "補充資料"}</span>
                        <span className="min-w-0 truncate text-right font-bold text-[#8a7c72]">{supplementSummary}</span>
                      </summary>
                      <div className="grid gap-2 pt-2">
                        <div className="rounded-[14px] border border-[#f1e2d6] bg-[#fffaf5] px-3 py-2 text-xs font-bold leading-6 text-[#B46F4A]">
                          <p className="font-black text-[#B46F4A]">出席補充</p>
                          {detailItems.length > 0 ? (
                            <div className="mt-1 grid gap-1">
                              {detailItems.map((item) => (
                                <p key={item}>{item}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-[#8a7c72]">目前沒有遲到、請假或其他補充紀錄。</p>
                          )}
                        </div>
                        <ReservationNoteAutosave
                          reservationId={reservation.id}
                          sessionId={session.id}
                          field="homework"
                          defaultValue={homeworkText}
                          label="作業"
                          placeholder="輸入作業"
                          mobileMode="inline"
                        />
                        <ReservationNoteAutosave
                          reservationId={reservation.id}
                          sessionId={session.id}
                          field="note"
                          defaultValue={noteText}
                          label="備註"
                          placeholder="輸入備註"
                          mobileMode="inline"
                        />
                      </div>
                    </details>
                  </div>

                  <div className="hidden md:grid md:min-w-[1180px] md:grid-cols-[0.68fr_minmax(410px,2.2fr)_1fr_0.95fr_0.95fr] md:items-stretch md:border-b md:border-[#ead8ca] md:bg-white md:px-4 md:py-3">
                    <div>
                      <p className="text-base font-black text-[#1f1712]">{reservation.studentName}</p>
                      {reservation.isRosterOnly ? (
                        <div className="mt-2 grid gap-2">
                          <p className="text-xs font-bold text-[#8a7c72]">由名冊帶入，尚未正式預約</p>
                          <form action={bookRosterStudentByStaffAction}>
                            <input type="hidden" name="studentId" value={reservation.studentId ?? ""} />
                            <input type="hidden" name="courseId" value={course.id} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="redirectTo" value={`${currentUrl}#attendance-list`} />
                            <button
                              type="submit"
                              className="rounded-full border border-[#E85F00]/25 bg-[#fff7ed] px-3 py-1.5 text-xs font-black text-[#B54B00] transition hover:bg-[#ffedd5]"
                            >
                              補登預約
                            </button>
                          </form>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs font-bold text-[#8a7c72]">已預約</p>
                      )}
                    </div>
                    <div className="flex items-center px-1 py-1">
                      <AttendanceStatusControls
                        reservationId={reservation.id}
                        sessionId={session.id}
                        courseId={course.id}
                        studentId={reservation.studentId}
                        currentStatus={displayStatus}
                        redirectTo={currentUrl}
                        lateTime={reservation.lateTime}
                        leaveStartTime={reservation.leaveStartTime}
                        leaveEndTime={reservation.leaveEndTime}
                        timeOptions={timeOptions}
                      />
                    </div>
                    <div className="h-[60px] min-h-[60px] overflow-hidden rounded-xl border border-[#ead8ca]/55 bg-[#fffdf9]/60 px-3 py-2 text-sm font-medium leading-5 text-[#8B4A2F]">
                      {detailItems.length > 0 ? (
                        <div className="grid gap-1">
                          {detailItems.map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <ReservationNoteAutosave
                      reservationId={reservation.id}
                      sessionId={session.id}
                      field="homework"
                      defaultValue={homeworkText}
                      label="作業"
                      placeholder="輸入作業"
                    />
                    <ReservationNoteAutosave
                      reservationId={reservation.id}
                      sessionId={session.id}
                      field="note"
                      defaultValue={noteText}
                      label="備註"
                      placeholder="輸入備註"
                    />
                  </div>
                </div>
              );
            })}
            {displayedReservations.length === 0 ? (
              <div className="px-5 py-8 text-sm leading-6 text-[#8a7c72]">目前沒有符合篩選條件的學員。</div>
            ) : null}
          </div>
        )}
      </section>
      </div>

      <details className="fixed bottom-4 right-4 z-40 xl:hidden">
        <summary className="flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full bg-[#E85F00] text-3xl font-black leading-none text-white shadow-xl shadow-orange-950/20 marker:hidden">
          +
        </summary>
        <div className="absolute bottom-16 right-0 w-64 overflow-hidden rounded-[22px] border border-[#ead8ca] bg-white p-2 shadow-2xl shadow-orange-950/15">
          <p className="px-3 py-2 text-xs font-black text-[#B46F4A]">快速操作</p>
          <a href="#session-workspace" className="block rounded-2xl px-3 py-3 text-sm font-black text-[#1f1712] hover:bg-[#fff6ed]">回到課堂摘要</a>
          <a href="#lesson-journal" className="block rounded-2xl px-3 py-3 text-sm font-black text-[#1f1712] hover:bg-[#fff6ed]">填寫課堂日誌</a>
          <a href="#attendance-list" className="block rounded-2xl px-3 py-3 text-sm font-black text-[#1f1712] hover:bg-[#fff6ed]">回到點名區</a>
          <form action={markAllSessionStudentsAttendedAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="courseId" value={course.id} />
            <input type="hidden" name="redirectTo" value={currentUrl} />
            <button type="submit" className="mt-1 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm font-black text-emerald-700 hover:bg-emerald-100">
              一鍵全到
            </button>
          </form>
          <form action={saveSessionJournalAction}>
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="attendanceStatus" value="completed" />
            <input type="hidden" name="redirectTo" value={currentUrl} />
            <button type="submit" className="mt-1 w-full rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-3 py-3 text-left text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">
              完成點名
            </button>
          </form>
        </div>
      </details>
    </AdminShell>
  );
}
