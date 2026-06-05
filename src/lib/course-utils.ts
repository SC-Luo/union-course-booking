import type {
  Course,
  CourseCategory,
  CourseOffering,
  CourseSeries,
  CourseSession,
  CourseStatus,
  Enrollment,
  Student,
} from "@/lib/types";

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  B: "#ec4899",
  S: "#10b981",
  N: "#8b5cf6",
  E: "#3b82f6",
  H: "#f97316",
  T: "#ef4444",
  W: "#92400e",
  O: "#6b7280",
  D: "#06b6d4",
  M: "#1d4ed8",
  R: "#f59e0b",
};

export function resolveCategoryColor(
  categoryId?: string,
  categoryColor?: string,
) {
  if (categoryColor) return categoryColor;
  if (categoryId && DEFAULT_CATEGORY_COLORS[categoryId])
    return DEFAULT_CATEGORY_COLORS[categoryId];
  return "#6b7280";
}

export function resolveCourseColor(
  course?: Pick<Course, "color" | "categoryId"> | null,
  category?: Pick<CourseCategory, "color" | "id"> | null,
) {
  if (course?.color) return course.color;
  return resolveCategoryColor(
    category?.id ?? course?.categoryId,
    category?.color,
  );
}

export function getCategoryName(
  categoryId: string,
  categories: CourseCategory[],
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    categoryId
  );
}

export type NormalizedCourseMode =
  | "booking_flexible"
  | "fixed_roster"
  | "subsidy_roster";

export type CourseModeInfo = {
  mode: NormalizedCourseMode;
  label: string;
  shortLabel: string;
  frontTitle: string;
  frontDescription: string;
  badgeClassName: string;
  isBookingEnabled: boolean;
};

function normalizeModeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getNormalizedCourseMode(
  course?: Partial<
    Pick<Course, "courseMode" | "rosterType" | "bookingOpen">
  > | null,
): NormalizedCourseMode {
  const mode = normalizeModeText(course?.courseMode);

  if (
    [
      "booking_flexible",
      "booking",
      "reservation",
      "booking_flex",
      "flexible_booking",
    ].includes(mode)
  ) {
    return "booking_flexible";
  }

  if (
    [
      "subsidy_roster",
      "subsidy_fixed_roster",
      "grant_roster",
      "funded_roster",
    ].includes(mode)
  ) {
    return "subsidy_roster";
  }

  if (
    [
      "fixed_roster",
      "roster_fixed",
      "fixed_roster_exam",
      "roster",
      "attendance_roster",
    ].includes(mode)
  ) {
    return "fixed_roster";
  }

  const rosterType = normalizeModeText(course?.rosterType);

  if (["booking", "reservation"].includes(rosterType)) {
    return "booking_flexible";
  }

  if (["subsidy", "subsidy_roster", "grant", "funded"].includes(rosterType)) {
    return "subsidy_roster";
  }

  if (["fixed", "roster_fixed", "fixed_roster"].includes(rosterType)) {
    return "fixed_roster";
  }

  // Legacy data did not always store courseMode. Keep old public booking behavior
  // until the course offering is explicitly marked as a fixed roster course.
  if (course?.bookingOpen === false) {
    return "fixed_roster";
  }

  return "booking_flexible";
}

export function isBookingCourse(
  course?: Partial<
    Pick<Course, "courseMode" | "rosterType" | "bookingOpen">
  > | null,
) {
  return getNormalizedCourseMode(course) === "booking_flexible";
}

export function isFixedRosterCourse(
  course?: Partial<
    Pick<Course, "courseMode" | "rosterType" | "bookingOpen">
  > | null,
) {
  return !isBookingCourse(course);
}

export function getCourseModeInfo(
  course?: Partial<
    Pick<Course, "courseMode" | "rosterType" | "bookingOpen">
  > | null,
): CourseModeInfo {
  const mode = getNormalizedCourseMode(course);

  if (mode === "booking_flexible") {
    return {
      mode,
      label: "預約制課程",
      shortLabel: "預約制",
      frontTitle: "選擇上課單元與時段",
      frontDescription:
        "這類課程可由學員自行選擇可預約時段；名額額滿、鎖定或停課時不可預約。",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
      isBookingEnabled: true,
    };
  }

  if (mode === "subsidy_roster") {
    return {
      mode,
      label: "補助固定名冊",
      shortLabel: "補助名冊",
      frontTitle: "固定課表與出席紀錄",
      frontDescription:
        "這類課程以正式名冊為準，不開放自行預約。系統將用於每堂點名、出缺勤累計與補助課程紀錄。",
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
      isBookingEnabled: false,
    };
  }

  return {
    mode,
    label: "固定名冊課程",
    shortLabel: "固定名冊",
    frontTitle: "固定課表與出席紀錄",
    frontDescription:
      "這類課程以班級名冊為準，不開放自行預約。學員依既定課表出席，系統將用於每堂點名與出缺勤累計。",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
    isBookingEnabled: false,
  };
}

function normalizeLookupValue(value: string | undefined) {
  return decodeURIComponent(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCourse(courseId: string, courses: Course[]) {
  const lookup = normalizeLookupValue(courseId);

  return courses.find((course) => {
    const candidates = [
      course.id,
      course.code,
      `${course.code ?? ""}-${course.title}`,
      course.title,
    ];

    return candidates.some(
      (candidate) => normalizeLookupValue(candidate) === lookup,
    );
  });
}

export function getCourseSeriesId(
  course: Pick<Course, "seriesId" | "courseSeriesId" | "courseMasterId" | "id">,
) {
  return (
    course.seriesId ??
    course.courseSeriesId ??
    course.courseMasterId ??
    `series-${course.id}`
  );
}

export function getOfferingId(course: Pick<Course, "offeringId" | "id">) {
  return course.offeringId ?? course.id;
}

export function getSeriesForCourse(
  course: Pick<
    Course,
    | "seriesId"
    | "courseSeriesId"
    | "courseMasterId"
    | "id"
    | "title"
    | "categoryId"
    | "description"
    | "color"
  >,
  seriesList: CourseSeries[],
) {
  const seriesId = getCourseSeriesId(course);
  return (
    seriesList.find((series) => series.id === seriesId) ?? {
      id: seriesId,
      title: course.title,
      categoryId: course.categoryId,
      description: course.description,
      color: course.color,
      isActive: true,
    }
  );
}

export function getOfferingForCourse(
  course: Pick<
    Course,
    | "id"
    | "offeringId"
    | "seriesId"
    | "courseSeriesId"
    | "courseMasterId"
    | "title"
    | "displayTitle"
    | "year"
    | "termLabel"
    | "shortName"
  >,
  offerings: CourseOffering[],
) {
  const offeringId = getOfferingId(course);
  return (
    offerings.find(
      (offering) =>
        offering.id === offeringId || offering.legacyCourseId === course.id,
    ) ?? {
      id: offeringId,
      seriesId: getCourseSeriesId(course as Course),
      legacyCourseId: course.id,
      title: course.title,
      displayTitle: course.displayTitle,
      year: course.year,
      termLabel: course.termLabel,
      shortName: course.shortName,
      status: "active",
    }
  );
}

export function getOfferingDisplayName(
  offering?: Pick<
    CourseOffering,
    "displayTitle" | "displayName" | "classDisplayName" | "title"
  >,
) {
  return (
    offering?.displayTitle ??
    offering?.displayName ??
    offering?.classDisplayName ??
    offering?.title ??
    "未設定年度期別班級"
  );
}

export function getOfferingPeriodLabel(
  offering?: Pick<
    CourseOffering,
    "year" | "termLabel" | "displayTitle" | "displayName" | "title"
  >,
) {
  if (!offering) return "未設定年度期別";
  const parts = [
    offering.year ? `${offering.year}年` : "",
    offering.termLabel ?? "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join("｜");
  return (
    offering.displayTitle ??
    offering.displayName ??
    offering.title ??
    "未設定年度期別"
  );
}

export function getEnrollmentOfferingId(
  enrollment: Pick<Enrollment, "offeringId" | "courseOfferingId">,
) {
  return enrollment.offeringId ?? enrollment.courseOfferingId ?? "";
}

export function getEnrollmentSeatLabel(
  enrollment?: Pick<Enrollment, "seatNo" | "seatNumber">,
  student?: Pick<Student, "seatNumber">,
) {
  return (
    enrollment?.seatNo ??
    (enrollment?.seatNumber != null
      ? String(enrollment.seatNumber)
      : student?.seatNumber != null
        ? String(student.seatNumber)
        : "")
  );
}

export function getStudentEnrollments(
  student: Pick<
    Student,
    | "id"
    | "offeringId"
    | "classId"
    | "seatNumber"
    | "source"
    | "sourceSheet"
    | "sourceRow"
    | "isActive"
  >,
  enrollments: Enrollment[],
  courses: Course[],
) {
  const direct = enrollments.filter(
    (enrollment) => enrollment.studentId === student.id,
  );
  if (direct.length > 0) return direct;

  const legacyCourse = student.classId
    ? courses.find((course) => course.id === student.classId)
    : undefined;
  const offeringId =
    student.offeringId ?? legacyCourse?.offeringId ?? student.classId;
  if (!offeringId) return [];

  return [
    {
      id: `legacy-enroll-${student.id}-${offeringId}`,
      studentId: student.id,
      offeringId,
      courseId: legacyCourse?.id ?? student.classId,
      seriesId: legacyCourse ? getCourseSeriesId(legacyCourse) : undefined,
      seatNumber: student.seatNumber,
      source: student.source,
      sourceSheet: student.sourceSheet,
      sourceRow: student.sourceRow,
      status: student.isActive === false ? "withdrawn" : "active",
    },
  ];
}

export function getRemainingSeats(session: CourseSession) {
  return Math.max(session.capacity - session.bookedCount, 0);
}

export function isSessionBookableByStatus(session: CourseSession) {
  const status = session.status ?? session.sessionStatus ?? "scheduled";
  return (
    session.isActive !== false &&
    status !== "cancelled" &&
    status !== "suspended"
  );
}

export function getSessionStatus(session: CourseSession): CourseStatus {
  if (!isSessionBookableByStatus(session)) return "closed";
  if (getRemainingSeats(session) <= 0) return "full";
  return "available";
}

export function getCourseStatus(course: Course): CourseStatus {
  if (!course.isActive) return "closed";
  const activeSessions = course.sessions.filter((session) =>
    isSessionBookableByStatus(session),
  );
  if (activeSessions.length === 0) return "closed";
  if (activeSessions.every((session) => getRemainingSeats(session) <= 0))
    return "full";
  return "available";
}

function parseDateTimeValue(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getReservationCutoff(
  session: Pick<CourseSession, "date"> &
    Partial<Pick<CourseSession, "bookingDeadline">>,
) {
  const courseDate = parseDateTimeValue(`${session.date}T00:00:00`);
  if (!courseDate) return new Date(0);

  const weeklyLockDeadline = new Date(courseDate);
  weeklyLockDeadline.setDate(weeklyLockDeadline.getDate() - 7);
  weeklyLockDeadline.setHours(18, 0, 0, 0);

  if (session.bookingDeadline) {
    const parsedDeadline = parseDateTimeValue(session.bookingDeadline);
    if (parsedDeadline) {
      return parsedDeadline.getTime() < weeklyLockDeadline.getTime()
        ? parsedDeadline
        : weeklyLockDeadline;
    }
  }

  return weeklyLockDeadline;
}

export function canChangeReservation(
  session: Pick<CourseSession, "date"> &
    Partial<Pick<CourseSession, "bookingDeadline">>,
) {
  return new Date() <= getReservationCutoff(session);
}

export function formatReservationCutoff(
  session: Pick<CourseSession, "date"> &
    Partial<Pick<CourseSession, "bookingDeadline">>,
) {
  const cutoff = getReservationCutoff(session);
  if (Number.isNaN(cutoff.getTime()) || cutoff.getTime() === 0)
    return "未設定截止時間";

  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, "0");
  const day = String(cutoff.getDate()).padStart(2, "0");
  const hour = String(cutoff.getHours()).padStart(2, "0");
  const minute = String(cutoff.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function getSession(
  sessionId: string,
  courses: Course[],
): CourseSession | undefined;
export function getSession(
  course: Pick<Course, "sessions"> | null | undefined,
  sessionId: string,
): CourseSession | undefined;
export function getSession(
  first: string | Pick<Course, "sessions"> | null | undefined,
  second: Course[] | string,
): CourseSession | undefined {
  if (typeof first === "string" && Array.isArray(second)) {
    const lookup = normalizeLookupValue(first);
    return second
      .flatMap((course) => course.sessions)
      .find(
        (session) =>
          session.id === first || normalizeLookupValue(session.id) === lookup,
      );
  }

  if (typeof second === "string" && first && typeof first !== "string") {
    const lookup = normalizeLookupValue(second);
    return first.sessions.find(
      (session) =>
        session.id === second || normalizeLookupValue(session.id) === lookup,
    );
  }

  return undefined;
}

export function getWeekday(date: string) {
  const parsed = parseDateTimeValue(`${date}T00:00:00`);
  if (!parsed) return "";
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `週${weekdays[parsed.getDay()]}`;
}
