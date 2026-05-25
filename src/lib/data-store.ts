import fs from "node:fs";
import path from "node:path";
import type {
  AttendanceRecord,
  BookingData,
  Course,
  CourseMode,
  CourseOffering,
  CourseSeries,
  CourseSessionRecord,
  Entitlement,
  Enrollment,
  Reservation,
  Student,
  StudentCourseRecord,
} from "./types";

const dataFilePath = path.join(process.cwd(), "data", "booking-data.json");

const emptyBookingData: BookingData = {
  categories: [],
  courses: [],
  reservations: [],
  students: [],
  courseSeries: [],
  courseOfferings: [],
  courseSessions: [],
  studentCourseRecords: [],
  enrollments: [],
  attendanceRecords: [],
  entitlements: [],
  importBatches: [],
};

export function readBookingData(): BookingData {
  try {
    const raw = fs.readFileSync(dataFilePath, "utf8");
    return normalizeBookingData(JSON.parse(raw) as Partial<BookingData>);
  } catch (error) {
    console.warn("Local booking data read failed; returning empty fallback data.", error);
    return normalizeBookingData(emptyBookingData);
  }
}

export function writeBookingData(data: BookingData) {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
  fs.writeFileSync(dataFilePath, `${JSON.stringify(normalizeBookingData(data), null, 2)}\n`, "utf8");
}

export function normalizeBookingData(input: Partial<BookingData>): BookingData {
  const base: BookingData = {
    ...emptyBookingData,
    ...input,
    categories: input.categories ?? [],
    courses: input.courses ?? [],
    reservations: input.reservations ?? [],
    students: input.students ?? [],
    courseSeries: input.courseSeries ?? [],
    courseOfferings: input.courseOfferings ?? [],
    courseSessions: input.courseSessions ?? [],
    studentCourseRecords: input.studentCourseRecords ?? [],
    enrollments: input.enrollments ?? [],
    attendanceRecords: input.attendanceRecords ?? [],
    entitlements: input.entitlements ?? [],
    importBatches: input.importBatches ?? [],
  };

  const normalizedCourses = base.courses.map((course) => normalizeLegacyCourse(course));
  const normalizedStudents = ensureStudentsFromReservations(base.students, base.reservations);
  const courseSeries = mergeById(base.courseSeries, buildCourseSeriesFromLegacy(normalizedCourses));
  const courseOfferings = mergeById(base.courseOfferings, buildCourseOfferingsFromLegacy(normalizedCourses));
  const courseSessions = mergeById(base.courseSessions, buildCourseSessionsFromLegacy(normalizedCourses));
  const studentCourseRecords = normalizeStudentCourseRecords(base.studentCourseRecords);
  const reservations = base.reservations.map((reservation) => normalizeReservation(reservation, normalizedCourses, normalizedStudents));
  const enrollments = mergeById(base.enrollments, buildEnrollmentsFromReservations(reservations));
  const attendanceRecords = mergeById(base.attendanceRecords, buildAttendanceRecordsFromReservations(reservations));
  const entitlements = mergeById(base.entitlements, buildEntitlementsFromAttendance(attendanceRecords, normalizedCourses));

  return {
    ...base,
    courses: normalizedCourses,
    students: normalizedStudents,
    courseSeries,
    courseOfferings,
    courseSessions,
    studentCourseRecords,
    reservations,
    enrollments,
    attendanceRecords,
    entitlements,
    importBatches: base.importBatches,
  };
}

function normalizeLegacyCourse(course: Course): Course {
  const seriesId = course.seriesId ?? `series-${course.id}`;
  const offeringId = course.offeringId ?? course.id;
  const courseMode = course.courseMode ?? inferCourseMode(course.courseType);
  const year = course.year ?? inferYear(course.sessions.map((session) => session.date));
  const termLabel = course.termLabel ?? inferTermLabel(course.title, year);
  const totalCapacity = course.totalCapacity ?? maxCapacity(course);
  const status = course.status ?? (course.isActive ? "open" : "closed");

  return {
    ...course,
    seriesId,
    offeringId,
    year,
    termLabel,
    displayTitle: course.displayTitle ?? `${course.title}｜${termLabel}`,
    courseMode,
    bookingOpen: course.bookingOpen ?? course.isActive,
    status,
    totalCapacity,
    sessions: course.sessions.map((session) => ({
      ...session,
      offeringId: session.offeringId ?? offeringId,
      seriesId: session.seriesId ?? seriesId,
      categoryId: session.categoryId ?? course.categoryId,
      status: session.status ?? (session.isActive ? "scheduled" : "cancelled"),
    })),
    entitlementPolicy:
      course.entitlementPolicy ??
      (courseMode === "booking_flexible"
        ? {
            enabled: true,
            validMonths: 12,
            startFrom: "first_attendance",
          }
        : undefined),
    rosterPolicy:
      course.rosterPolicy ??
      (courseMode === "roster_fixed"
        ? {
            requireRosterBeforeAttendance: true,
            allowWalkIn: false,
          }
        : undefined),
  };
}

function buildCourseSeriesFromLegacy(courses: Course[]): CourseSeries[] {
  return courses.map((course) => ({
    id: course.seriesId ?? `series-${course.id}`,
    code: course.code?.split("-").slice(0, 2).join("-") || course.courseType || course.id,
    title: stripTermFromTitle(course.title),
    categoryId: course.categoryId,
    defaultCourseMode: course.courseMode ?? inferCourseMode(course.courseType),
    description: course.description,
    defaultLocation: course.defaultLocation,
    defaultCapacity: course.totalCapacity ?? maxCapacity(course),
    color: course.color,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }));
}

function buildCourseOfferingsFromLegacy(courses: Course[]): CourseOffering[] {
  return courses.map((course) => ({
    id: course.offeringId ?? course.id,
    seriesId: course.seriesId ?? `series-${course.id}`,
    categoryId: course.categoryId,
    code: course.code ?? course.id,
    title: course.title,
    displayTitle: course.displayTitle ?? `${course.title}｜${course.termLabel ?? ""}`.replace(/｜$/, ""),
    year: course.year ?? inferYear(course.sessions.map((session) => session.date)),
    termLabel: course.termLabel ?? inferTermLabel(course.title, course.year),
    courseMode: course.courseMode ?? inferCourseMode(course.courseType),
    location: course.defaultLocation,
    capacity: course.totalCapacity ?? maxCapacity(course),
    color: course.color,
    startDate: minDate(course.sessions.map((session) => session.date)),
    endDate: maxDate(course.sessions.map((session) => session.date)),
    bookingOpen: course.bookingOpen ?? course.isActive,
    status: course.status ?? (course.isActive ? "open" : "closed"),
    entitlementPolicy: course.entitlementPolicy,
    rosterPolicy: course.rosterPolicy,
    notes: course.notes,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }));
}

function buildCourseSessionsFromLegacy(courses: Course[]): CourseSessionRecord[] {
  return courses.flatMap((course) =>
    course.sessions.map((session) => ({
      id: session.id,
      offeringId: session.offeringId ?? course.offeringId ?? course.id,
      seriesId: session.seriesId ?? course.seriesId ?? `series-${course.id}`,
      categoryId: session.categoryId ?? course.categoryId,
      title: session.topic,
      unitName: session.topic,
      location: session.location,
      startsAt: toDateTime(session.date, session.startTime),
      endsAt: toDateTime(session.date, session.endTime),
      date: session.date,
      capacity: session.capacity,
      bookingDeadline: session.bookingDeadline,
      status: session.status ?? (session.isActive ? "scheduled" : "cancelled"),
      instructorId: session.instructorId,
      instructorName: session.instructorName,
      assistantInstructorIds: session.assistantInstructorIds,
      assistantInstructorNames: session.assistantInstructorNames,
      changeReason: session.changeReason,
      originalSessionId: session.originalSessionId,
      rescheduledToSessionId: session.rescheduledToSessionId,
      makeupForSessionId: session.makeupForSessionId,
      stats: {
        reservedCount: session.bookedCount ?? 0,
        attendedCount: 0,
        absentCount: 0,
        uncheckedCount: Math.max((session.bookedCount ?? 0), 0),
      },
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })),
  );
}

function ensureStudentsFromReservations(students: Student[], reservations: Reservation[]): Student[] {
  const merged = [...students];
  for (const reservation of reservations) {
    const id = reservation.studentId ?? buildStudentId(reservation.studentName, reservation.phoneLastThree);
    if (merged.some((student) => student.id === id)) continue;

    merged.push({
      id,
      name: reservation.studentName,
      phone: reservation.phoneLastThree,
      idNumberLast3: reservation.phoneLastThree,
      source: "front_booking",
      examGroup: "",
      seatNumber: merged.length + 1,
      isActive: true,
      createdAt: reservation.bookedAt,
      updatedAt: reservation.bookedAt,
    });
  }

  return merged.map((student, index) => ({
    ...student,
    examGroup: student.examGroup ?? "",
    seatNumber: student.seatNumber ?? index + 1,
    source: student.source ?? "manual",
    isActive: student.isActive ?? true,
  }));
}

function normalizeStudentCourseRecords(records: StudentCourseRecord[]): StudentCourseRecord[] {
  return records.map((record) => ({
    ...record,
    sourceColumn: normalizeCourseColumnName(record.sourceColumn),
    rawValue: String(record.rawValue ?? ""),
    normalizedValue: record.normalizedValue ?? String(record.rawValue ?? "").trim(),
    importedAt: record.importedAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? record.importedAt ?? new Date().toISOString(),
  }));
}

function normalizeCourseColumnName(value: string) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function normalizeReservation(reservation: Reservation, courses: Course[], students: Student[]): Reservation {
  const course = courses.find((item) => item.id === reservation.courseId || item.offeringId === reservation.offeringId);
  const studentId = reservation.studentId ?? students.find((student) => student.name === reservation.studentName && (student.idNumberLast3 ?? student.phone) === reservation.phoneLastThree)?.id ?? buildStudentId(reservation.studentName, reservation.phoneLastThree);

  return {
    ...reservation,
    studentId,
    offeringId: reservation.offeringId ?? course?.offeringId ?? reservation.courseId,
    seriesId: reservation.seriesId ?? course?.seriesId ?? `series-${reservation.courseId}`,
    reservationType: reservation.reservationType ?? "front_booking",
    source: reservation.source ?? "online",
    createdAt: reservation.createdAt ?? reservation.bookedAt,
    updatedAt: reservation.updatedAt ?? reservation.bookedAt,
  };
}

function buildEnrollmentsFromReservations(reservations: Reservation[]): Enrollment[] {
  const keys = new Set<string>();
  const enrollments: Enrollment[] = [];

  for (const reservation of reservations) {
    if (!reservation.studentId || !reservation.seriesId || !reservation.offeringId) continue;
    const key = `${reservation.studentId}:${reservation.offeringId}`;
    if (keys.has(key)) continue;
    keys.add(key);

    enrollments.push({
      id: `enroll-${reservation.studentId}-${reservation.offeringId}`,
      studentId: reservation.studentId,
      offeringId: reservation.offeringId,
      seriesId: reservation.seriesId,
      enrollmentType: "booking_access",
      status: reservation.status === "cancelled" ? "withdrawn" : "active",
      joinedAt: reservation.bookedAt,
      createdAt: reservation.bookedAt,
      updatedAt: reservation.updatedAt ?? reservation.bookedAt,
    });
  }

  return enrollments;
}

function buildAttendanceRecordsFromReservations(reservations: Reservation[]): AttendanceRecord[] {
  return reservations
    .filter((reservation) => reservation.status !== "cancelled")
    .map((reservation) => ({
      id: `att-${reservation.id}`,
      studentId: reservation.studentId ?? buildStudentId(reservation.studentName, reservation.phoneLastThree),
      offeringId: reservation.offeringId ?? reservation.courseId,
      seriesId: reservation.seriesId ?? `series-${reservation.courseId}`,
      sessionId: reservation.sessionId,
      reservationId: reservation.id,
      source: "reservation",
      status: normalizeAttendanceStatus(reservation.attendanceStatus),
      checkedAt: reservation.attendanceStatus && reservation.attendanceStatus !== "pending" ? reservation.updatedAt ?? reservation.bookedAt : undefined,
      createdAt: reservation.bookedAt,
      updatedAt: reservation.updatedAt ?? reservation.bookedAt,
    }));
}

function buildEntitlementsFromAttendance(attendanceRecords: AttendanceRecord[], courses: Course[]): Entitlement[] {
  const entitlements: Entitlement[] = [];
  const keys = new Set<string>();

  for (const record of attendanceRecords) {
    if (record.status !== "attended") continue;
    if (!record.seriesId) continue;
    const course = courses.find((item) => item.seriesId === record.seriesId || item.id === record.offeringId);
    if (course?.courseMode !== "booking_flexible") continue;

    const key = `${record.studentId}:${record.seriesId}`;
    if (keys.has(key)) continue;
    keys.add(key);

    const sessionDate = course.sessions.find((session) => session.id === record.sessionId)?.date ?? new Date().toISOString().slice(0, 10);
    const endsAt = addMonths(sessionDate, course.entitlementPolicy?.validMonths ?? 12);

    entitlements.push({
      id: `ent-${record.studentId}-${record.seriesId}`,
      studentId: record.studentId,
      seriesId: record.seriesId,
      offeringId: record.offeringId,
      entitlementType: "one_year_retake",
      activatedBySessionId: record.sessionId,
      activatedByAttendanceId: record.id,
      startsAt: sessionDate,
      endsAt,
      status: "active",
      createdAt: record.checkedAt ?? record.updatedAt ?? record.createdAt,
      updatedAt: record.updatedAt ?? record.createdAt,
    });
  }

  return entitlements;
}

function inferCourseMode(courseType?: string): CourseMode {
  return courseType === "PT" ? "roster_fixed" : "booking_flexible";
}

function inferYear(dates: string[]) {
  const first = dates.find(Boolean);
  if (!first) return new Date().getFullYear();
  const year = Number(first.slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function inferTermLabel(title: string, year?: number) {
  const monthMatch = title.match(/(\d+\s*月[^｜\s]*)/);
  if (monthMatch) return monthMatch[1].replace(/\s+/g, "");
  const rangeMatch = title.match(/(\d+\s*[-~]\s*\d+\s*月[^｜\s]*)/);
  if (rangeMatch) return rangeMatch[1].replace(/\s+/g, "");
  return `${year ?? new Date().getFullYear()}年度`;
}

function stripTermFromTitle(title: string) {
  return title.replace(/\s*\d+\s*月課表\s*$/u, "").replace(/\s*\d+\s*[-~]\s*\d+\s*月班\s*$/u, "");
}

function maxCapacity(course: Course) {
  return course.totalCapacity ?? Math.max(...course.sessions.map((session) => session.capacity), 0);
}

function minDate(dates: string[]) {
  return dates.filter(Boolean).sort()[0];
}

function maxDate(dates: string[]) {
  return dates.filter(Boolean).sort().at(-1);
}

function toDateTime(date: string, time: string) {
  return `${date}T${time}:00+08:00`;
}

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00+08:00`);
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
}

function buildStudentId(name: string, phoneLastThree: string) {
  return `student-${slugify(name)}-${phoneLastThree}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function normalizeAttendanceStatus(status: string): "unchecked" | "attended" | "absent" | "leave" {
  if (status === "attended" || status === "absent" || status === "leave") return status;
  return "unchecked";
}

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const map = new Map<string, T>();
  for (const item of fallback) map.set(item.id, item);
  for (const item of primary) map.set(item.id, item);
  return Array.from(map.values());
}
