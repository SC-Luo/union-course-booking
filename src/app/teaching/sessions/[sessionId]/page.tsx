import Link from "next/link";
import { AttendanceStatusControls } from "@/app/admin/sessions/[sessionId]/reservations/attendance-status-controls";
import { ReservationNoteAutosave } from "@/app/admin/sessions/[sessionId]/reservations/reservation-note-autosave";
import { SessionJournalAutosave } from "@/app/admin/sessions/[sessionId]/reservations/session-journal-autosave";
import { updateTeachingAttendanceAction } from "@/app/teaching/actions";
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
  searchParams: Promise<{ name?: string; attendance?: string; q?: string }>;
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
    items.push(`?脣 ${reservation.lateTime}`);
  }

  if (reservation.leaveStartTime && reservation.leaveEndTime) {
    items.push(
      `隢? ${reservation.leaveStartTime}??{reservation.leaveEndTime}`,
    );
  } else if (reservation.leaveHours != null) {
    items.push(`隢? ${reservation.leaveHours} 撠?`);
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
          .replace(/^蝚洱??/g, "")
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
      .replace(/^蝚洱??/g, "")
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
  const { name = "", attendance = "all", q = "" } = await searchParams;
  const teacherName = name.trim();
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
            href={`/teaching?name=${encodeURIComponent(teacherName)}`}
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
  const currentUrl = `/teaching/sessions/${encodedSessionId}?name=${encodeURIComponent(teacherName)}&attendance=${encodeURIComponent(attendance)}&q=${encodeURIComponent(q)}#attendance-list`;
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

  return (
    <main className="min-h-screen bg-[#f7efe7] px-4 py-5 pb-24 text-[#1f1712] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header
          id="summary"
          className="scroll-mt-24 rounded-[32px] border border-[#ead8ca] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/teaching?name=${encodeURIComponent(teacherName)}`}
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
              <p className="mt-2 text-sm font-bold text-[#5A3726]">
                {formatDateText(session.date)} {session.startTime || "--:--"} - {session.endTime || "--:--"}
              </p>
              <p className="mt-1 text-sm text-[#8a7c72]">
                {session.location || course.defaultLocation || "\u672a\u8a2d\u5b9a\u5730\u9ede"}
                {" / 授課人員："}{teacherName}
              </p>
            </div>
            <div className="grid w-full grid-cols-5 gap-1.5 text-center lg:w-auto lg:gap-2">
              <div className="rounded-xl border border-[#ead8ca] bg-[#fffaf5] px-1.5 py-2 sm:rounded-2xl sm:px-3">
                <p className="text-[11px] font-bold text-[#8a7c72]">未確認</p>
                <p className="text-xl font-black text-[#5A3726]">{unchecked}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-1.5 py-2 sm:rounded-2xl sm:px-3">
                <p className="text-[11px] font-bold text-emerald-700">已到</p>
                <p className="text-xl font-black text-emerald-700">
                  {attended}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-1.5 py-2 sm:rounded-2xl sm:px-3">
                <p className="text-[11px] font-bold text-amber-800">遲到</p>
                <p className="text-xl font-black text-amber-800">{late}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-1.5 py-2 sm:rounded-2xl sm:px-3">
                <p className="text-[11px] font-bold text-rose-700">未到</p>
                <p className="text-xl font-black text-rose-700">{absent}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-1.5 py-2 sm:rounded-2xl sm:px-3">
                <p className="text-[11px] font-bold text-violet-700">請假</p>
                <p className="text-xl font-black text-violet-700">{leave}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-[28px] border border-[#ead8ca] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#1f1712]">
                暺??飛?∠???              </p>
              <p className="mt-1 text-xs text-[#8a7c72]">
                ?玨鈭箏?舐?仿?????撣嗅雿??芾??餉?隢蝘???餃?????              </p>
            </div>
            <form className="w-full lg:max-w-xs">
              <input type="hidden" name="name" value={teacherName} />
              <input type="hidden" name="attendance" value={attendanceFilter} />
              <input
                name="q"
                defaultValue={q}
                placeholder="搜尋姓名、電話或學號"
                className="h-11 w-full rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 text-sm outline-none focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100"
              />
            </form>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {attendanceFilters.map((item) => (
              <Link
                key={item.value}
                href={`/teaching/sessions/${encodedSessionId}?name=${encodeURIComponent(teacherName)}&attendance=${item.value}&q=${encodeURIComponent(q)}#attendance-list`}
                className={`min-w-[92px] rounded-[18px] border px-3 py-2 text-left transition ${attendanceFilter === item.value ? "border-[#5A3726] bg-[#5A3726] text-white" : "border-[#ead8ca] bg-[#fffdf9] text-[#5A3726] hover:bg-[#fff7ed]"}`}
              >
                <p className="text-[11px] font-black">{item.label}</p>
                <p className="mt-0.5 text-lg font-black">{item.count}</p>
              </Link>
            ))}
          </div>

          <div id="attendance-list" className="mt-5 grid scroll-mt-24 gap-3">
            {displayedReservations.length === 0 ? (
              <p className="rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm text-[#8a7c72]">
                瘝?蝚血?璇辣?飛?～?              </p>
            ) : null}
            {displayedReservations.map((reservation) => {
              const student = students.find(
                (item) => item.id === reservation.studentId,
              );
              const displayStatus = getDisplayAttendanceStatus(reservation);
              const detailItems = attendanceDetailItems(reservation);
              const homeworkText = attendanceHomeworkText(reservation);
              const noteText = attendanceNoteText(reservation);

              return (
                <article
                  key={reservation.id}
                  id={`student-${reservation.studentId ?? reservation.id}`}
                  className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black text-[#1f1712]">
                          {reservation.studentName}
                        </h2>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${attendanceStatusPillClass(displayStatus)}`}
                        >
                          {attendanceStatusText(displayStatus)}
                        </span>
                        <span className="text-[11px] font-bold text-[#9b8a7d]">
                          {reservation.isRosterOnly ? "\u540d\u518a\u5e36\u5165" : "\u5df2\u9810\u7d04"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#8a7c72]">
                        {student?.memberNo || student?.studentNo
                          ? `學號：${student?.memberNo ?? student?.studentNo}`
                          : "未填學號"}
                        {" / 末三碼："}{reservation.phoneLastThree || "---"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {reservation.isRosterOnly ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                        甇文飛?∠??撣嗅嚗??梁??貉?鋆??敺??賡???                      </div>
                    ) : (
                      <AttendanceStatusControls
                        reservationId={reservation.id}
                        sessionId={session.id}
                        courseId={course.id}
                        studentId={reservation.studentId}
                        teacherName={teacherName}
                        currentStatus={reservation.attendanceStatus}
                        redirectTo={currentUrl}
                        lateTime={reservation.lateTime}
                        leaveStartTime={reservation.leaveStartTime}
                        leaveEndTime={reservation.leaveEndTime}
                        timeOptions={timeOptions}
                        action={updateTeachingAttendanceAction}
                      />
                    )}
                  </div>

                  {detailItems.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-[#6f6259]">
                      {detailItems.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white px-2.5 py-1"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <details className="mt-3 border-t border-[#f1e2d6] pt-2">
                    <summary className="cursor-pointer list-none text-xs font-black text-[#B46F4A] marker:hidden">
                      補充資料
                      <span className="ml-2 font-medium text-[#8a7c72]">
                        {homeworkText || noteText
                          ? [
                              homeworkText ? "\u4f5c\u696d\u5df2\u586b" : "",
                              noteText ? "\u5099\u8a3b\u5df2\u586b" : "",
                            ]
                              .filter(Boolean)
                              .join(" / ")
                          : "\u7121"}
                      </span>
                    </summary>
                    <div className="mt-3">
                      <ReservationNoteAutosave
                        reservationId={reservation.id}
                        sessionId={session.id}
                        field="homework"
                        defaultValue={homeworkText}
                        label="\u4f5c\u696d"
                        placeholder="\u8f38\u5165\u4f5c\u696d"
                        mobileMode="inline"
                      />
                      <ReservationNoteAutosave
                        reservationId={reservation.id}
                        sessionId={session.id}
                        field="note"
                        defaultValue={noteText}
                        label="\u5099\u8a3b"
                        placeholder="\u8f38\u5165\u5099\u8a3b"
                        mobileMode="inline"
                      />
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </section>

        <details
          id="lesson-journal"
          className="mt-4 scroll-mt-24 rounded-[28px] border border-[#ead8ca] bg-white shadow-sm"
        >
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-[#5A3726] marker:hidden">
            上課紀錄
            <span className="ml-2 text-xs font-medium text-[#8a7c72]">
              授課內容、助教紀錄與異常追蹤
            </span>
          </summary>
          <div className="border-t border-[#f1e2d6] px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4">
                <p className="text-sm font-bold text-[#B46F4A]">授課紀錄</p>
                <div className="mt-4 grid gap-4">
                  <SessionJournalAutosave
                    sessionId={session.id}
                    field="teachingContent"
                    defaultValue={session.teachingContent ?? ""}
                    label="\u4eca\u65e5\u6388\u8ab2\u5167\u5bb9"
                    placeholder="\u8a18\u9304\u4eca\u65e5\u9032\u5ea6\u3001\u7df4\u7fd2\u6216\u88dc\u5145\u8aaa\u660e"
                    rows={4}
                  />
                  <SessionJournalAutosave
                    sessionId={session.id}
                    field="teacherNote"
                    defaultValue={session.teacherNote ?? ""}
                    label="\u6388\u8ab2\u5099\u8a3b"
                    placeholder="\u8a18\u9304\u6388\u8ab2\u72c0\u6cc1\u6216\u5f8c\u7e8c\u9700\u6ce8\u610f\u4e8b\u9805"
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
                    label="\u52a9\u6559\u7d00\u9304"
                    placeholder="\u8a18\u9304\u73fe\u5834\u5354\u52a9\u3001\u5b78\u54e1\u72c0\u6cc1\u6216\u88dc\u5145\u4e8b\u9805"
                    rows={4}
                  />
                  <SessionJournalAutosave
                    sessionId={session.id}
                    field="adminNote"
                    defaultValue={session.adminNote ?? ""}
                    label="\u884c\u653f\u5099\u8a3b"
                    placeholder="\u884c\u653f\u53ef\u8a18\u9304\u88dc\u4ef6\u3001\u806f\u7e6b\u6216\u5f8c\u7e8c\u901a\u77e5"
                    rows={4}
                  />
                </div>
              </section>
            </div>

            <section className="mt-5 rounded-[22px] border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-sm font-bold text-rose-700">TTQS ?啣虜餈質馱</p>
              <p className="mt-1 text-xs leading-5 text-rose-700/80">
                若無異常可留空；有狀況時記錄原因與後續處理。
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SessionJournalAutosave
                  sessionId={session.id}
                  field="abnormalStatus"
                  defaultValue={session.abnormalStatus ?? ""}
                  label="\u7570\u5e38\u72c0\u6cc1"
                  placeholder="\u8a18\u9304\u7f3a\u8ab2\u3001\u8a2d\u5099\u3001\u73fe\u5834\u6216\u5b78\u54e1\u7279\u6b8a\u72c0\u6cc1"
                  rows={3}
                  tone="rose"
                />
                <SessionJournalAutosave
                  sessionId={session.id}
                  field="followUpNote"
                  defaultValue={session.followUpNote ?? ""}
                  label="\u5f8c\u7e8c\u8655\u7406"
                  placeholder="\u8a18\u9304\u5df2\u806f\u7e6b\u5b78\u54e1\u3001\u88dc\u8ab2\u5b89\u6392\u6216\u884c\u653f\u5f85\u8fa6"
                  rows={3}
                  tone="rose"
                />
              </div>
            </section>
          </div>
        </details>
        <TeachingSectionTabs />
      </div>
    </main>
  );
}

