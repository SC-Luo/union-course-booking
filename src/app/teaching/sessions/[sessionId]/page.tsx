import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceStatusControls } from "@/app/admin/sessions/[sessionId]/reservations/attendance-status-controls";
import { ReservationNoteAutosave } from "@/app/admin/sessions/[sessionId]/reservations/reservation-note-autosave";
import { SessionJournalAutosave } from "@/app/admin/sessions/[sessionId]/reservations/session-journal-autosave";
import { SessionInfoModalCard } from "@/app/admin/sessions/[sessionId]/reservations/session-info-modal-card";
import { completeTeachingAttendanceAction, saveTeachingJournalAction, updateTeachingAttendanceAction } from "@/app/teaching/actions";
import { getBookingData } from "@/lib/booking-repository";
import { TeachingSectionTabs } from "./teaching-section-tabs";
import type {
  Course,
  CourseSession,
  Enrollment,
  Instructor,
  Reservation,
  Student,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ name?: string; attendance?: string; q?: string; code?: string }>;
};

type AttendanceRow = Reservation & { isRosterOnly?: boolean };

type AttendanceListExtraFields = {
  homework?: string;
  homeworkStatus?: string;
  assignment?: string;
  assignmentStatus?: string;
  attendanceNote?: string;
  adminNote?: string;
  notes?: string;
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

  return Array.from(
    new Set(
      [
        value,
        restored,
        onceDecoded,
        twiceDecoded,
        value.replace(/~2F/gi, "/").replace(/~5C/gi, "\\"),
      ].filter(Boolean),
    ),
  );
}

function resolveSessionWithCourseFromRouteParam(
  sessionId: string,
  courses: Course[],
) {
  const candidates = getSessionRouteCandidates(sessionId);

  for (const course of courses) {
    const session = (course.sessions ?? []).find((item) => {
      const id = String(item.id ?? "");
      return (
        candidates.includes(id) ||
        candidates.includes(encodeURIComponent(id)) ||
        candidates.includes(
          encodeURIComponent(id)
            .replace(/%2F/gi, "~2F")
            .replace(/%5C/gi, "~5C"),
        )
      );
    });

    if (session) {
      return { course, session };
    }
  }

  return undefined;
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function normalizeName(value?: string) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function splitNames(values: Array<string | undefined> = []) {
  return values
    .flatMap((value) => String(value ?? "").split(/[,、，\/]/g))
    .map((value) => normalizeName(value))
    .filter(Boolean);
}

function instructorIdsByName(instructors: Instructor[], teacherName: string) {
  const normalized = normalizeName(teacherName);
  return new Set(
    instructors
      .filter(
        (item) =>
          item.isActive !== false && normalizeName(item.name) === normalized,
      )
      .map((item) => item.id),
  );
}

function isTeachingSessionForName(
  course: Course,
  session: CourseSession,
  instructors: Instructor[],
  teacherName: string,
) {
  const normalized = normalizeName(teacherName);
  if (!normalized) return false;

  const matchedInstructorIds = instructorIdsByName(instructors, teacherName);
  const idCandidates = [
    session.instructorId,
    ...(session.assistantInstructorIds ?? []),
    course.primaryInstructorId,
    ...(course.assistantInstructorIds ?? []),
  ]
    .filter(Boolean)
    .map(String);

  if (idCandidates.some((id) => matchedInstructorIds.has(id))) return true;

  const nameCandidates = splitNames([
    session.instructorName,
    ...(session.assistantInstructorNames ?? []),
    course.primaryInstructorName,
    ...(course.assistantInstructorNames ?? []),
  ]);

  return nameCandidates.includes(normalized);
}

function formatDateText(date?: string) {
  if (!date) return "\u672a\u8a2d\u5b9a\u65e5\u671f";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  const weekdays = ["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"];
  return `${date.replaceAll("-", "/")} (${weekdays[parsed.getDay()]})`;
}

function displayCourseTitle(course: Course) {
  return (
    course.displayTitle ||
    course.displayName ||
    course.shortTitle ||
    course.shortName ||
    course.title
  );
}

function normalizeAttendanceStatus(status?: string) {
  return status === "pending" ||
    status === "attended" ||
    status === "late" ||
    status === "absent" ||
    status === "leave"
    ? status
    : "unchecked";
}

function getDisplayAttendanceStatus(reservation: AttendanceRow) {
  const normalized = normalizeAttendanceStatus(reservation.attendanceStatus);
  if (normalized === "pending") return "reserved";
  if (normalized !== "unchecked") return normalized;
  return reservation.isRosterOnly ? "unchecked" : "reserved";
}

function attendanceStatusText(status?: string) {
  if (status === "attended") return "\u5df2\u5230";
  if (status === "late") return "\u9072\u5230";
  if (status === "absent") return "\u672a\u5230";
  if (status === "leave") return "\u8acb\u5047";
  if (status === "reserved") return "\u5df2\u9810\u7d04";
  return "\u672a\u78ba\u8a8d";
}

function attendanceStatusPillClass(status?: string) {
  if (status === "attended")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "late") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "absent") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "leave")
    return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "reserved") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-[#ead8ca] bg-[#fffaf5] text-[#8a7c72]";
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
  if (status === "suspended" || status === "cancelled") {
    return active
      ? "border-rose-500 bg-rose-600 text-white shadow-sm"
      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
  }
  if (status === "makeup") {
    return active
      ? "border-sky-500 bg-sky-600 text-white shadow-sm"
      : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
  }
  if (status === "rescheduled") {
    return active
      ? "border-amber-500 bg-amber-500 text-white shadow-sm"
      : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  }
  return active
    ? "border-[#5A3726] bg-[#5A3726] text-white shadow-sm"
    : "border-[#dbcabd] bg-white text-[#5A3726] hover:bg-[#fff6ed]";
}

function attendanceWorkflowButtonClass(status: string, current: string) {
  const active = status === current;
  if (status === "completed") {
    return active
      ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  }
  if (status === "in_progress") {
    return active
      ? "border-sky-500 bg-sky-600 text-white shadow-sm"
      : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
  }
  return active
    ? "border-[#8a7c72] bg-[#8a7c72] text-white shadow-sm"
    : "border-[#dbcabd] bg-white text-[#8a7c72] hover:bg-[#fff6ed]";
}

function autoResolveAbnormalStatus(abnormalStatus?: string, followUpNote?: string) {
  if (String(followUpNote ?? "").trim()) return "resolved";
  if (String(abnormalStatus ?? "").trim()) return "processing";
  return "unresolved";
}

function compactSupplementSummary(detailCount: number, homeworkText: string, noteText: string) {
  const items = [];
  if (detailCount > 0) items.push("出席補充");
  if (homeworkText) items.push("作業已填");
  if (noteText) items.push("備註已填");
  return items.length > 0 ? items.join(" / ") : "無補充";
}

function hasLeaveDetail(
  reservation: Pick<
    Reservation,
    "leaveStartTime" | "leaveEndTime" | "leaveHours"
  >,
) {
  return Boolean(
    reservation.leaveStartTime ||
    reservation.leaveEndTime ||
    reservation.leaveHours != null,
  );
}

function attendanceDetailItems(
  reservation: Pick<
    Reservation,
    | "attendanceStatus"
    | "lateTime"
    | "leaveStartTime"
    | "leaveEndTime"
    | "leaveHours"
  >,
) {
  const items: string[] = [];

  if (reservation.attendanceStatus === "late" && reservation.lateTime) {
    items.push(`遲到：${reservation.lateTime}`);
  }

  if (reservation.leaveStartTime && reservation.leaveEndTime) {
    items.push(
      `請假：${reservation.leaveStartTime} - ${reservation.leaveEndTime}`,
    );
  } else if (reservation.leaveHours != null) {
    items.push(`請假：${reservation.leaveHours} 小時`);
  }

  return items;
}

function attendanceHomeworkText(
  reservation: Reservation & AttendanceListExtraFields,
) {
  return String(
    reservation.homework ??
      reservation.homeworkStatus ??
      reservation.assignment ??
      reservation.assignmentStatus ??
      "",
  ).trim();
}

function attendanceNoteText(
  reservation: Reservation & AttendanceListExtraFields,
) {
  const note = String(
    reservation.note ??
      reservation.attendanceNote ??
      reservation.adminNote ??
      reservation.notes ??
      "",
  ).trim();
  if (note.includes("roster only")) return "";
  return note;
}

function buildTimeOptions(startTime?: string, endTime?: string) {
  const fallback = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
  ];
  const match = (value?: string) =>
    String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  const start = match(startTime);
  const end = match(endTime);
  if (!start || !end) return fallback;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    endMinutes <= startMinutes
  )
    return fallback;
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
  const text = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!text) return true;
  return ["active", "booked", "enrolled"].some((item) =>
    text.includes(item),
  );
}

function getCourseOfferingCandidates(course: Course, session: CourseSession) {
  const legacyCourse = course as Course & {
    courseOfferingId?: string;
    legacyCourseId?: string;
  };
  return new Set(
    [
      course.id,
      course.offeringId,
      legacyCourse.courseOfferingId,
      legacyCourse.legacyCourseId,
      session.offeringId,
    ]
      .filter(Boolean)
      .map(String),
  );
}

function getCourseSeriesCandidates(course: Course, session: CourseSession) {
  const legacyCourse = course as Course & { courseSeriesId?: string };
  return new Set(
    [
      course.seriesId,
      course.courseMasterId,
      legacyCourse.courseSeriesId,
      session.seriesId,
    ]
      .filter(Boolean)
      .map(String),
  );
}

function getCourseYear(course: Course, session: CourseSession) {
  return (
    course.year ??
    (session.date ? Number(session.date.slice(0, 4)) - 1911 : undefined)
  );
}

function getCourseTermCandidates(course: Course) {
  return new Set(
    [course.term, course.termNumber, course.termLabel]
      .filter(
        (value) =>
          value !== undefined && value !== null && String(value).trim(),
      )
      .map((value) =>
        String(value)
          .replace(/^第/g, "")
          .replace(/期$/g, "")
          .trim(),
      ),
  );
}

function isEnrollmentForSession(
  enrollment: Enrollment,
  course: Course,
  session: CourseSession,
) {
  if (!isActiveEnrollmentStatus(enrollment.status)) return false;

  const offeringCandidates = getCourseOfferingCandidates(course, session);
  const seriesCandidates = getCourseSeriesCandidates(course, session);
  const enrollmentOfferingIds = [
    enrollment.offeringId,
    enrollment.courseOfferingId,
    enrollment.courseId,
  ]
    .filter(Boolean)
    .map(String);
  const hasOfferingId = enrollmentOfferingIds.length > 0;
  const offeringMatches = enrollmentOfferingIds.some((id) =>
    offeringCandidates.has(id),
  );
  if (hasOfferingId) return offeringMatches;

  const enrollmentSeriesIds = [enrollment.seriesId, enrollment.courseMasterId]
    .filter(Boolean)
    .map(String);
  const seriesMatches = enrollmentSeriesIds.some((id) =>
    seriesCandidates.has(id),
  );
  if (!seriesMatches) return false;

  const courseYear = getCourseYear(course, session);
  const enrollmentYear = enrollment.year;
  if (
    courseYear != null &&
    enrollmentYear != null &&
    String(courseYear) !== String(enrollmentYear)
  )
    return false;

  const courseTerms = getCourseTermCandidates(course);
  const enrollmentTerm = enrollment.term ?? enrollment.termLabel;
  if (
    courseTerms.size > 0 &&
    enrollmentTerm != null &&
    String(enrollmentTerm).trim()
  ) {
    const normalizedEnrollmentTerm = String(enrollmentTerm)
      .replace(/^第/g, "")
      .replace(/期$/g, "")
      .trim();
    return courseTerms.has(normalizedEnrollmentTerm);
  }

  return true;
}

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
  const bookedReservations = reservations.filter(
    (reservation) =>
      reservation.sessionId === session.id && reservation.status === "booked",
  );
  const rowsByStudentId = new Map<string, AttendanceRow>();

  bookedReservations.forEach((reservation) => {
    if (reservation.studentId)
      rowsByStudentId.set(reservation.studentId, reservation);
  });

  enrollments
    .filter((enrollment) => isEnrollmentForSession(enrollment, course, session))
    .forEach((enrollment) => {
      if (rowsByStudentId.has(enrollment.studentId)) return;
      const student = students.find(
        (item) => item.id === enrollment.studentId && item.isActive !== false,
      );
      if (!student) return;
      const last3 =
        cleanDigits(student.idNumberLast3).slice(0, 3) ||
        cleanDigits(student.phone).slice(-3);
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
        source: "manual",
        note: "roster only",
        isRosterOnly: true,
      });
    });

  return Array.from(rowsByStudentId.values()).sort((a, b) => {
    const studentA = students.find((student) => student.id === a.studentId);
    const studentB = students.find((student) => student.id === b.studentId);
    return String(
      studentA?.memberNo ?? studentA?.studentNo ?? a.studentName,
    ).localeCompare(
      String(studentB?.memberNo ?? studentB?.studentNo ?? b.studentName),
      "zh-Hant",
    );
  });
}

export default async function TeachingSessionPage({
  params,
  searchParams,
}: PageProps) {
  const { sessionId } = await params;
  const { name = "", attendance = "all", q = "", code = "" } = await searchParams;
  const teacherName = name.trim();

  // 驗證 TEACHING_ACCESS_CODE
  const accessCode = process.env.TEACHING_ACCESS_CODE;
  if (teacherName && accessCode && code !== accessCode) {
    redirect(`/teaching/login?error=invalid&name=${encodeURIComponent(teacherName)}`);
  }
  const {
    courses,
    reservations,
    students = [],
    enrollments = [],
    instructors = [],
  } = await getBookingData();
  const resolved = resolveSessionWithCourseFromRouteParam(sessionId, courses);

  if (!resolved) {
    return (
      <main className="min-h-screen bg-[#f7efe7] px-4 py-8 text-[#1f1712]">
        <section className="mx-auto max-w-xl rounded-[32px] border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <p className="text-sm font-black">找不到課堂</p>
          <p className="mt-2 text-sm leading-6">
            這堂課不存在或已無法讀取，請回授課工作台重新選擇課堂。
          </p>
          <Link
            href={`/teaching?name=${encodeURIComponent(teacherName)}${code ? `&code=${encodeURIComponent(code)}` : ""}`}
            className="mt-5 inline-flex rounded-2xl bg-[#5A3726] px-5 py-3 text-sm font-black text-white"
          >
            回授課工作台
          </Link>
        </section>
      </main>
    );
  }

  const { course, session } = resolved;

  if (
    !teacherName ||
    !isTeachingSessionForName(course, session, instructors, teacherName)
  ) {
    return (
      <main className="min-h-screen bg-[#f7efe7] px-4 py-8 text-[#1f1712]">
        <section className="mx-auto max-w-xl rounded-[32px] border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <p className="text-sm font-black">沒有授課權限</p>
          <p className="mt-2 text-sm leading-6">
            目前登入姓名不是這堂課的授課人員，無法查看或操作本堂點名。
          </p>
          <Link
            href={`/teaching/login?name=${encodeURIComponent(teacherName)}`}
            className="mt-5 inline-flex rounded-2xl bg-[#5A3726] px-5 py-3 text-sm font-black text-white"
          >
            回授課登入
          </Link>
        </section>
      </main>
    );
  }

  const encodedSessionId = encodeRouteSegment(session.id);
  const currentUrl = `/teaching/sessions/${encodedSessionId}?name=${encodeURIComponent(teacherName)}&attendance=${encodeURIComponent(attendance)}&q=${encodeURIComponent(q)}${code ? `&code=${encodeURIComponent(code)}` : ""}#attendance-list`;
  const attendanceRows = buildAttendanceRows({
    course,
    session,
    reservations,
    students,
    enrollments,
  });
  const attended = attendanceRows.filter(
    (reservation) => reservation.attendanceStatus === "attended",
  ).length;
  const late = attendanceRows.filter(
    (reservation) => reservation.attendanceStatus === "late",
  ).length;
  const absent = attendanceRows.filter(
    (reservation) => reservation.attendanceStatus === "absent",
  ).length;
  const leave = attendanceRows.filter(
    (reservation) =>
      reservation.attendanceStatus === "leave" || hasLeaveDetail(reservation),
  ).length;
  const reserved = attendanceRows.filter(
    (reservation) => getDisplayAttendanceStatus(reservation) === "reserved",
  ).length;
  const unchecked = attendanceRows.filter(
    (reservation) => getDisplayAttendanceStatus(reservation) === "unchecked",
  ).length;
  const normalizedQuery = q.trim().toLowerCase();
  const attendanceFilter =
    attendance === "reserved" ||
    attendance === "unchecked" ||
    attendance === "attended" ||
    attendance === "late" ||
    attendance === "absent" ||
    attendance === "leave"
      ? attendance
      : "all";
  const displayedReservations = attendanceRows.filter((reservation) => {
    const statusMatches =
      attendanceFilter === "all" ||
      getDisplayAttendanceStatus(reservation) === attendanceFilter ||
      (attendanceFilter === "leave" && hasLeaveDetail(reservation));
    const student = students.find((item) => item.id === reservation.studentId);
    const queryText = [
      reservation.studentName,
      reservation.phoneLastThree,
      student?.phone,
      student?.memberNo,
      student?.studentNo,
      reservation.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      statusMatches && (!normalizedQuery || queryText.includes(normalizedQuery))
    );
  });
  const timeOptions = buildTimeOptions(session.startTime, session.endTime);
  const attendanceFilters = [
    { label: "\u5168\u90e8", value: "all", count: attendanceRows.length },
    { label: "\u5df2\u9810\u7d04", value: "reserved", count: reserved },
    { label: "\u672a\u78ba\u8a8d", value: "unchecked", count: unchecked },
    { label: "\u5df2\u5230", value: "attended", count: attended },
    { label: "\u9072\u5230", value: "late", count: late },
    { label: "\u672a\u5230", value: "absent", count: absent },
    { label: "\u8acb\u5047", value: "leave", count: leave },
  ];
  const effectiveLocation = session.location || course.defaultLocation || "未設定";
  const assistantNames = Array.from(
    new Set(
      [
        ...(session.assistantInstructorNames ?? []),
        ...(course.assistantInstructorNames ?? []),
      ].filter(Boolean),
    ),
  ).join("、") || "未設定";
  const primaryInstructorName =
    session.instructorName || course.primaryInstructorName || teacherName || "未設定";
  const sessionStatus = session.sessionStatus ?? session.status ?? "scheduled";
  const attendanceStatus =
    session.attendanceStatus ??
    (attendanceRows.length === 0 || unchecked === attendanceRows.length
      ? "not_started"
      : unchecked > 0
        ? "in_progress"
        : "completed");
  const abnormalResolvedStatus = autoResolveAbnormalStatus(
    session.abnormalStatus,
    session.followUpNote,
  );
  const hasAbnormal = Boolean(String(session.abnormalStatus ?? "").trim());
  const hasFollowUp = Boolean(String(session.followUpNote ?? "").trim());
  const sessionStatusOptions = [
    { value: "scheduled", label: "正常上課" },
    { value: "suspended", label: "停課" },
    { value: "makeup", label: "補課" },
    { value: "rescheduled", label: "調課" },
    { value: "cancelled", label: "取消" },
  ];
  const attendanceWorkflowOptions = [
    { value: "not_started", label: "尚未開始" },
    { value: "in_progress", label: "點名中" },
    { value: "completed", label: "已完成" },
  ];
  const currentSessionStatusLabel =
    sessionStatusOptions.find((item) => item.value === sessionStatus)?.label ??
    "正常上課";
  const currentAttendanceStatusLabel =
    attendanceWorkflowOptions.find((item) => item.value === attendanceStatus)
      ?.label ?? "尚未開始";

  const primaryAttendanceActionLabel =
    attendanceStatus === "not_started"
      ? "開始點名"
      : attendanceStatus === "completed"
        ? "查看點名"
        : "繼續點名";

  const sessionStatusModal = (
    <SessionInfoModalCard
      title="課堂狀態"
      eyebrow="狀態管理"
      triggerLabel="調整"
      closeLabel="關閉"
      triggerClassName="inline-flex h-9 items-center justify-center rounded-full border border-[#dbcabd] bg-white px-3 text-xs font-black text-[#5A3726] shadow-sm transition hover:bg-[#fff6ed]"
      panelClassName="max-w-4xl"
    >
      <form action={saveTeachingJournalAction} className="grid gap-5">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="teacherName" value={teacherName} />
        <input type="hidden" name="code" value={code} />
        <input
          type="hidden"
          name="redirectTo"
          value={`/teaching/sessions/${encodedSessionId}?name=${encodeURIComponent(teacherName)}${code ? `&code=${encodeURIComponent(code)}` : ""}#session-workspace`}
        />

        <section className="rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#5A3726]">課堂狀態</p>
              <p className="mt-1 text-sm font-bold text-[#8a7c72]">
                目前：<span className="text-[#1f1712]">{currentSessionStatusLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionStatusOptions.map((item) => (
                <button
        key={item.value}
        type="submit"
        name="sessionStatus"
        value={item.value}
        className={`rounded-full border px-4 py-2 text-sm font-black transition ${sessionStatusButtonClass(item.value, sessionStatus)}`}
                >
        {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#5A3726]">點名流程</p>
              <p className="mt-1 text-sm font-bold text-[#8a7c72]">
                目前：<span className="text-[#1f1712]">{currentAttendanceStatusLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {attendanceWorkflowOptions.map((item) => (
                <button
        key={item.value}
        type="submit"
        name="attendanceStatus"
        value={item.value}
        className={`rounded-full border px-4 py-2 text-sm font-black transition ${attendanceWorkflowButtonClass(item.value, attendanceStatus)}`}
                >
        {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
          <p className="text-sm font-black text-[#5A3726]">異常處理</p>
          <div className={`mt-3 inline-flex items-center rounded-full border px-4 py-2 text-sm font-black ${abnormalStatusTone(abnormalResolvedStatus)}`}>
            {abnormalLabel(abnormalResolvedStatus)}
            <span className="ml-2 font-medium text-current opacity-70">
              {hasFollowUp ? "已填後續" : hasAbnormal ? "處理中" : "自動判定"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#8a7c72]">
            異常內容與後續追蹤請到「紀錄」補充。
          </p>
        </section>
      </form>
    </SessionInfoModalCard>
  );

  const teachingJournalModal = (
    <SessionInfoModalCard
      title="課堂日誌與 TTQS 紀錄"
      eyebrow="授課紀錄"
      triggerLabel="開啟紀錄"
      closeLabel="關閉"
      triggerClassName="inline-flex h-11 items-center justify-center rounded-2xl bg-[#E85F00] px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md"
      panelClassName="max-w-5xl"
    >
      <div className="grid gap-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4">
            <p className="text-sm font-bold text-[#B46F4A]">講師授課紀錄</p>
            <div className="mt-4 grid gap-4">
              <SessionJournalAutosave
                sessionId={session.id}
                field="teachingContent"
                defaultValue={session.teachingContent ?? ""}
                label="今日授課內容"
                placeholder="例如：彩妝工具介紹、底妝練習、眉型修整"
                rows={4}
              />
              <SessionJournalAutosave
                sessionId={session.id}
                field="teacherNote"
                defaultValue={session.teacherNote ?? ""}
                label="講師備註"
                placeholder="講師可記錄學員學習狀況、下次提醒或課程調整建議"
                rows={4}
              />
            </div>
          </section>
          <section className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4">
            <p className="text-sm font-bold text-[#B46F4A]">
              助教與行政紀錄
            </p>
            <div className="mt-4 grid gap-4">
              <SessionJournalAutosave
                sessionId={session.id}
                field="assistantNote"
                defaultValue={session.assistantNote ?? ""}
                label="助教現場紀錄"
                placeholder="例如：設備狀況、學員問題、現場突發事件"
                rows={4}
              />
              <SessionJournalAutosave
                sessionId={session.id}
                field="adminNote"
                defaultValue={session.adminNote ?? ""}
                label="行政備註"
                placeholder="行政可記錄補件、聯繫、後續通知或內部提醒"
                rows={4}
              />
            </div>
          </section>
        </div>

        <section className="rounded-[22px] border border-rose-100 bg-rose-50/40 p-4">
          <p className="text-sm font-bold text-rose-700">TTQS 異常追蹤</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SessionJournalAutosave
              sessionId={session.id}
              field="abnormalStatus"
              defaultValue={session.abnormalStatus ?? ""}
              label="異常狀態"
              placeholder="例如：講師遲到、設備故障、學員爭議、臨時調課；無異常可留空"
              rows={3}
              tone="rose"
            />
            <SessionJournalAutosave
              sessionId={session.id}
              field="followUpNote"
              defaultValue={session.followUpNote ?? ""}
              label="後續追蹤"
              placeholder="例如：通知學員、補課安排、設備報修、主管確認"
              rows={3}
              tone="rose"
            />
          </div>
        </section>
      </div>
    </SessionInfoModalCard>
  );


  return (
    <main className="min-h-screen bg-[#f7efe7] px-4 py-5 pb-24 text-[#1f1712] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header
          id="summary"
          className="scroll-mt-24 rounded-[32px] border border-[#ead8ca] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href={`/teaching?name=${encodeURIComponent(teacherName)}${code ? `&code=${encodeURIComponent(code)}` : ""}`}
                className="text-xs font-black text-[#E85F00] hover:underline"
              >
                回授課工作台
              </Link>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-[#B46F4A]">
                授課單堂
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                {displayCourseTitle(course)}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#8a7c72]">
                授課人員：<strong className="text-[#5A3726]">{teacherName}</strong>
                <span className="mx-2 text-[#dbcabd]">｜</span>
                本堂學員：<strong className="text-[#5A3726]">{attendanceRows.length}</strong> 人
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <a
                href="#attendance-list"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#E85F00] px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md"
              >
                {primaryAttendanceActionLabel}
              </a>
            </div>
          </div>
        </header>

        <section
          id="session-workspace"
          className="mt-4 scroll-mt-24 rounded-[28px] border border-[#ead8ca] bg-white px-5 py-4 shadow-sm"
        >
          <div className="grid gap-4">
            <div>
              <p className="text-xs font-black text-[#B46F4A]">課堂摘要</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1f1712]">
                {formatDateText(session.date)}｜{session.startTime || "--:--"}-{session.endTime || "--:--"}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-6 text-[#66584f]">
                <span>單元：<strong className="text-[#1f1712]">{session.topic || "未填單元"}</strong></span>
                <span>地點：<strong className="text-[#1f1712]">{effectiveLocation}</strong></span>
                <span>講師：<strong className="text-[#1f1712]">{primaryInstructorName}</strong></span>
                <span>助教：<strong className="text-[#1f1712]">{assistantNames}</strong></span>
              </div>
            </div>

          </div>

          <div className="mt-4 border-t border-[#f5e8dc] pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-[#ead8ca] bg-[#fffdf9] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[#B46F4A]">課堂狀態</p>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${sessionStatusButtonClass(sessionStatus, sessionStatus)}`}>
                      {currentSessionStatusLabel}
                    </span>
                  </div>
                  {sessionStatusModal}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#ead8ca] bg-[#fffdf9] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[#B46F4A]">點名進度</p>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${attendanceWorkflowButtonClass(attendanceStatus, attendanceStatus)}`}>
                      {currentAttendanceStatusLabel}
                    </span>
                  </div>
                  <a
                    href="#attendance-list"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-[#E85F00] px-3 text-xs font-black text-white shadow-sm"
                  >
                    {primaryAttendanceActionLabel}
                  </a>
                </div>
              </div>
              <div className="rounded-[18px] border border-[#ead8ca] bg-[#fffdf9] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[#B46F4A]">異常紀錄</p>
                    <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${abnormalStatusTone(abnormalResolvedStatus)}`}>
                      {abnormalLabel(abnormalResolvedStatus)}
                    </div>
                  </div>
                  <a
                    href="#lesson-journal"
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[#dbcabd] bg-white px-3 text-xs font-black text-[#5A3726] shadow-sm"
                  >
                    紀錄
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="attendance-list"
          className="mt-4 scroll-mt-24 rounded-[28px] border border-[#ead8ca] bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black text-[#B46F4A]">點名</p>
              <h2 className="mt-1 text-2xl font-black text-[#1f1712]">
                本堂學員出席狀態
              </h2>
            </div>
            <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[440px]">
              <input type="hidden" name="name" value={teacherName} />
              <input type="hidden" name="attendance" value={attendanceFilter} />
              <input type="hidden" name="code" value={code} />
              <input
                name="q"
                defaultValue={q}
                placeholder="搜尋姓名、手機或學號"
                className="h-11 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100"
              />
              <button className="h-11 rounded-2xl bg-[#5A3726] px-5 text-sm font-bold text-white hover:brightness-105">
                搜尋
              </button>
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
                  href={`/teaching/sessions/${encodedSessionId}?name=${encodeURIComponent(teacherName)}&attendance=${item.value}&q=${encodeURIComponent(q)}${code ? `&code=${encodeURIComponent(code)}` : ""}#attendance-list`}
                  className={`rounded-2xl border px-3 py-2 text-center text-sm font-black transition lg:min-w-[88px] ${toneClass}`}
                >
                  <span className="block leading-5">{item.label}</span>
                  <span className="block text-base leading-5">{item.count}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <form action={completeTeachingAttendanceAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="teacherName" value={teacherName} />
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="redirectTo" value={currentUrl} />
              <button
                type="submit"
                className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 sm:w-auto"
              >
                一鍵全到
              </button>
            </form>
            <form action={saveTeachingJournalAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="teacherName" value={teacherName} />
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="attendanceStatus" value="completed" />
              <input type="hidden" name="redirectTo" value={currentUrl} />
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-black text-white shadow-sm hover:brightness-105 sm:w-auto"
              >
                完成點名
              </button>
            </form>
          </div>

          {attendanceRows.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-[#dbcabd] bg-[#fffaf5] p-5 text-sm leading-6 text-[#8a7c72]">
              目前沒有有效名單。請先確認本班年度課程名冊或預約資料。
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-[22px] border border-[#ead8ca] bg-white">
              <div className="hidden w-full grid-cols-[minmax(140px,0.9fr)_minmax(280px,1.55fr)_minmax(160px,1fr)_minmax(160px,1fr)] border-b border-[#ead8ca] bg-[#fff9f3] px-4 py-3 text-sm font-bold text-[#66584f] md:grid">
                <span>學員</span>
                <span>狀態列</span>
                <span>作業</span>
                <span>備註</span>
              </div>

              {displayedReservations.map((reservation) => {
                const student = students.find(
                  (item) => item.id === reservation.studentId,
                );
                const displayStatus = getDisplayAttendanceStatus(reservation);
                const detailItems = attendanceDetailItems(reservation);
                const homeworkText = attendanceHomeworkText(reservation);
                const noteText = attendanceNoteText(reservation);
                const supplementSummary = compactSupplementSummary(
                  detailItems.length,
                  homeworkText,
                  noteText,
                );

                return (
                  <div key={reservation.id}>
                    <div className="m-1.5 rounded-[18px] border border-[#ead8ca] bg-white px-3 py-2.5 shadow-sm md:hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-base font-black text-[#1f1712]">{reservation.studentName}</p>
                        <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${attendanceStatusPillClass(displayStatus)}`}>
                          {attendanceStatusText(displayStatus)}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-[#8a7c72]">
                          {reservation.isRosterOnly ? "名冊帶入" : "已預約"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8a7c72]">
                        {student?.memberNo || student?.studentNo
                          ? `學號：${student?.memberNo ?? student?.studentNo}`
                          : "未填學號"}
                        {" / 末三碼："}{reservation.phoneLastThree || "---"}
                      </p>

                      <div className="mt-2">
                        <AttendanceStatusControls
                          reservationId={reservation.id}
                          sessionId={session.id}
                          courseId={course.id}
                          studentId={reservation.studentId}
                          teacherName={teacherName}
                          currentStatus={displayStatus}
                          redirectTo={currentUrl}
                          lateTime={reservation.lateTime}
                          leaveStartTime={reservation.leaveStartTime}
                          leaveEndTime={reservation.leaveEndTime}
                          timeOptions={timeOptions}
                          action={updateTeachingAttendanceAction}
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

                    <div className="hidden md:grid md:w-full md:min-w-0 md:grid-cols-[minmax(140px,0.9fr)_minmax(280px,1.55fr)_minmax(160px,1fr)_minmax(160px,1fr)] md:items-stretch md:border-b md:border-[#ead8ca] md:bg-white md:px-4 md:py-3">
                      <div>
                        <p className="text-base font-black text-[#1f1712]">{reservation.studentName}</p>
                        <p className="mt-1 text-xs font-bold text-[#8a7c72]">
                          {reservation.isRosterOnly ? "由名冊帶入，點名時會建立正式紀錄" : "已預約"}
                        </p>
                        <p className="mt-1 text-xs text-[#8a7c72]">
                          {student?.memberNo || student?.studentNo
                            ? `學號：${student?.memberNo ?? student?.studentNo}`
                            : "未填學號"}
                          {" / 末三碼："}{reservation.phoneLastThree || "---"}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col justify-center gap-2 px-1 py-1">
                        <AttendanceStatusControls
                          reservationId={reservation.id}
                          sessionId={session.id}
                          courseId={course.id}
                          studentId={reservation.studentId}
                          teacherName={teacherName}
                          currentStatus={displayStatus}
                          redirectTo={currentUrl}
                          lateTime={reservation.lateTime}
                          leaveStartTime={reservation.leaveStartTime}
                          leaveEndTime={reservation.leaveEndTime}
                          timeOptions={timeOptions}
                          action={updateTeachingAttendanceAction}
                        />
                        {detailItems.length > 0 ? (
                          <div className="grid gap-1 rounded-xl border border-[#ead8ca]/55 bg-[#fffdf9]/60 px-3 py-2 text-xs font-medium leading-5 text-[#8B4A2F]">
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

        <section
          id="lesson-journal"
          className="mt-4 scroll-mt-24 rounded-[28px] border border-[#ead8ca] bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-[#B46F4A]">紀錄</p>
              <h2 className="mt-1 text-2xl font-black text-[#1f1712]">
                課堂日誌與 TTQS 紀錄
              </h2>
            </div>
            {teachingJournalModal}
          </div>
        </section>

        <TeachingSectionTabs />


      </div>
    </main>
  );
}