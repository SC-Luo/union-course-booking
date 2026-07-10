import { randomUUID } from "node:crypto";
import { normalizeBookingData, readBookingData, writeBookingData } from "./data-store";
import { getAdminDb } from "./firebase-admin";
import {
  canChangeReservation,
  getBookingCycleKey,
  getCourse,
  getReservationCutoff,
  getSession,
  resolveEffectiveBookingPolicy,
} from "./course-utils";
import type { AttendanceRecord, AttendanceStatus, BookingData, Course, CourseCategory, CourseOffering, CourseSeries, CourseSession, Enrollment, Reservation, Student, StudentCourseRecord, Instructor } from "./types";

function shouldUseFirestore() {
  return process.env.BOOKING_DATA_SOURCE === "firestore";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function allowJsonFallback() {
  if (process.env.STRICT_FIRESTORE === "true") {
    return false;
  }
  return !isProduction();
}

function shouldFallbackToJson() {
  return !shouldUseFirestore() || allowJsonFallback();
}

function createFirestoreRequiredError(context: string, error?: unknown) {
  const detail =
    error instanceof Error ? error.message : error ? String(error) : "";
  return new Error(
    `Firestore is required in production but is not available. ${context}${
      detail ? ` Error: ${detail}` : ""
    }`,
  );
}

export function getFirestoreDb() {
  if (!shouldUseFirestore()) {
    return null;
  }

  try {
    const db = getAdminDb();
    if (!db) {
      if (!allowJsonFallback()) {
        throw new Error("Firebase Admin initialization returned null.");
      }
      console.warn("[DATA_SOURCE] ⚠️ Firebase Admin initialization returned null, falling back to local JSON.");
      return null;
    }
    return db;
  } catch (error) {
    if (!allowJsonFallback()) {
      throw createFirestoreRequiredError("Firebase Admin initialization failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore initialization failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return null;
  }
}

type FirestoreStudentDocument = Partial<Student> & {
  memberNumber?: string;
  phoneLastThree?: string;
  status?: string;
};

function normalizeFirestoreStudent(
  id: string,
  data: FirestoreStudentDocument,
): Student {
  const status = String(data.status ?? "").trim().toLowerCase();
  const isActive =
    data.isActive ?? (status ? !["inactive", "deleted"].includes(status) : true);
  const needsReview = data.needsReview ?? status === "review";

  return {
    ...data,
    id: String(data.id || id),
    name: String(data.name ?? "").trim(),
    memberNo: data.memberNo ?? data.memberNumber ?? (data as any).memberId ?? (data as any).externalMemberNo ?? (data as any).studentNo,
    idNumberLast3: data.idNumberLast3 ?? data.phoneLastThree,
    isActive,
    needsReview,
    plannedBusinessCategories: data.plannedBusinessCategories ?? [],
    plannedBusinessCategoryOther: data.plannedBusinessCategoryOther ?? "",
    basicConfirmed: data.basicConfirmed ?? false,
    contactConfirmed: data.contactConfirmed ?? false,
    backgroundConfirmed: data.backgroundConfirmed ?? false,
    businessConfirmed: data.businessConfirmed ?? false,
    noteConfirmed: data.noteConfirmed ?? false,
  } as Student;
}

function compareStudentsForRoster(a: Student, b: Student) {
  const seatA = Number(a.seatNumber);
  const seatB = Number(b.seatNumber);
  if (Number.isFinite(seatA) && Number.isFinite(seatB) && seatA !== seatB) {
    return seatA - seatB;
  }
  if (Number.isFinite(seatA)) return -1;
  if (Number.isFinite(seatB)) return 1;

  const keyA = String(a.memberNo || a.studentNo || a.name || a.id);
  const keyB = String(b.memberNo || b.studentNo || b.name || b.id);
  return keyA.localeCompare(keyB, "zh-Hant", { numeric: true });
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedFields(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined) return;
      cleaned[key] = removeUndefinedFields(item);
    });
    return cleaned as T;
  }

  return value;
}

export async function getBookingData(): Promise<BookingData> {
  const db = getFirestoreDb();

  if (!db) {
    return readBookingData();
  }

  try {
    const [
      categorySnapshot,
      courseSnapshot,
      sessionSnapshot,
      reservationSnapshot,
      studentSnapshot,
      courseSeriesSnapshot,
      courseOfferingSnapshot,
      courseSessionSnapshot,
      studentCourseRecordSnapshot,
      enrollmentSnapshot,
      attendanceRecordSnapshot,
      instructorSnapshot,
    ] = await Promise.all([
      db.collection("categories").orderBy("sortOrder", "asc").get(),
      db.collection("courses").get(),
      db.collection("sessions").get(),
      db.collection("reservations").get(),
      db.collection("students").get(),
      db.collection("courseSeries").get(),
      db.collection("courseOfferings").get(),
      db.collection("courseSessions").get(),
      db.collection("studentCourseRecords").get(),
      db.collection("enrollments").get(),
      db.collection("attendanceRecords").get(),
      db.collection("instructors").get(),
    ]);

    const categories = categorySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseCategory);
    const sessions = sessionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseSession);
    const reservations = reservationSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reservation);
    const students = studentSnapshot.docs
      .map((doc) =>
        normalizeFirestoreStudent(doc.id, doc.data() as FirestoreStudentDocument),
      )
      .sort(compareStudentsForRoster);
    const courseSeries = courseSeriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseSeries);
    const courseOfferings = courseOfferingSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseOffering);
    const courseSessions = courseSessionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingData["courseSessions"][number]);
    const studentCourseRecords = studentCourseRecordSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as StudentCourseRecord);
    const enrollments = enrollmentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Enrollment);
    const attendanceRecords = attendanceRecordSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BookingData["attendanceRecords"][number]);
    const instructors = instructorSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Instructor);
    const courses = courseSnapshot.docs.map((doc) => {
      const course = { id: doc.id, ...doc.data() } as Omit<Course, "sessions">;

      return {
        ...course,
        sessions: sessions.filter((session) => session.courseId === course.id),
      };
    });

    return normalizeBookingData({
      categories,
      courses,
      reservations,
      students,
      courseSeries,
      courseOfferings,
      courseSessions,
      studentCourseRecords,
      enrollments,
      attendanceRecords,
      instructors,
    });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Booking data read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return readBookingData();
  }
}

export async function getStudentById(studentId: string): Promise<Student | null> {
  const start = performance.now();
  const id = String(studentId ?? "").trim();

  if (!id) {
    console.info("[admin/students/edit] getStudentById", {
      durationMs: Math.round(performance.now() - start),
      usedFullDataRead: false,
      found: false,
    });
    return null;
  }

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const student = data.students.find((item) => item.id === id) ?? null;
    console.info("[admin/students/edit] getStudentById", {
      durationMs: Math.round(performance.now() - start),
      usedFullDataRead: true,
      studentsCount: data.students.length,
      found: Boolean(student),
    });
    return student;
  }

  try {
    const doc = await db.collection("students").doc(id).get();
    const student = doc.exists
      ? normalizeFirestoreStudent(
          doc.id,
          doc.data() as FirestoreStudentDocument,
        )
      : null;
    console.info("[admin/students/edit] getStudentById", {
      durationMs: Math.round(performance.now() - start),
      usedFullDataRead: false,
      studentsCount: student ? 1 : 0,
      relatedRecordsCount: 0,
      found: Boolean(student),
    });
    return student;
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student document read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const student = data.students.find((item) => item.id === id) ?? null;
    console.info("[admin/students/edit] getStudentById", {
      durationMs: Math.round(performance.now() - start),
      usedFullDataRead: true,
      studentsCount: data.students.length,
      found: Boolean(student),
    });
    return student;
  }
}

export async function getCourseCatalog(): Promise<Pick<BookingData, "categories" | "courses">> {
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    return {
      categories: data.categories,
      courses: data.courses.filter((course) => course.status !== "archived" && course.isActive !== false),
    };
  }

  try {
    const [categorySnapshot, courseSnapshot, sessionSnapshot] = await Promise.all([
      db.collection("categories").orderBy("sortOrder", "asc").get(),
      db.collection("courses").get(),
      db.collection("sessions").get(),
    ]);

    const categories = categorySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseCategory);
    const sessions = sessionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseSession);
    const courses = courseSnapshot.docs.map((doc) => {
      const course = { id: doc.id, ...doc.data() } as Omit<Course, "sessions">;

      return {
        ...course,
        sessions: sessions.filter((session) => session.courseId === course.id),
      };
    });

    const normalized = normalizeBookingData({ categories, courses, reservations: [], students: [] });
    return {
      categories: normalized.categories,
      courses: normalized.courses.filter((course) => course.status !== "archived" && course.isActive !== false),
    };
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course catalog read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore catalog read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    return {
      categories: data.categories,
      courses: data.courses.filter((course) => course.status !== "archived" && course.isActive !== false),
    };
  }
}

function buildNormalizedCourse(course: Omit<Course, "sessions">, sessions: CourseSession[]) {
  return normalizeBookingData({
    courses: [
      {
        ...course,
        sessions,
      },
    ],
  }).courses[0] ?? null;
}

export async function getCourseDetailById(courseId: string): Promise<{
  category?: CourseCategory;
  course: Course;
} | null> {
  const lookupId = decodeURIComponent(String(courseId ?? "").trim());
  if (!lookupId) return null;

  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const course = getCourse(lookupId, data.courses);
    if (!course) return null;
    return {
      category: data.categories.find((item) => item.id === course.categoryId),
      course,
    };
  }

  try {
    const courseDoc = await db.collection("courses").doc(lookupId).get();
    if (!courseDoc.exists) return null;

    const rawCourse = { id: courseDoc.id, ...courseDoc.data() } as Omit<Course, "sessions">;
    const [sessionSnapshot, categoryDoc] = await Promise.all([
      db.collection("sessions").where("courseId", "==", rawCourse.id).get(),
      rawCourse.categoryId
        ? db.collection("categories").doc(rawCourse.categoryId).get()
        : Promise.resolve(null),
    ]);

    const sessions = sessionSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CourseSession,
    );
    const course = buildNormalizedCourse(rawCourse, sessions);
    if (!course) return null;

    return {
      category:
        categoryDoc && categoryDoc.exists
          ? ({ id: categoryDoc.id, ...categoryDoc.data() } as CourseCategory)
          : undefined,
      course,
    };
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course detail read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course detail read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const course = getCourse(lookupId, data.courses);
    if (!course) return null;
    return {
      category: data.categories.find((item) => item.id === course.categoryId),
      course,
    };
  }
}

export async function getBookingPageData(courseId: string, sessionId: string): Promise<{
  course: Course;
  session: CourseSession;
} | null> {
  const decodedCourseId = decodeURIComponent(String(courseId ?? "").trim());
  const decodedSessionId = decodeURIComponent(String(sessionId ?? "").trim());
  if (!decodedCourseId || !decodedSessionId) return null;

  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const course = getCourse(decodedCourseId, data.courses);
    const session = course
      ? getSession(course, decodedSessionId) ?? getSession(decodedSessionId, data.courses)
      : undefined;
    return course && session ? { course, session } : null;
  }

  try {
    const [courseDoc, sessionDoc] = await Promise.all([
      db.collection("courses").doc(decodedCourseId).get(),
      db.collection("sessions").doc(decodedSessionId).get(),
    ]);

    if (!courseDoc.exists || !sessionDoc.exists) return null;

    const rawCourse = { id: courseDoc.id, ...courseDoc.data() } as Omit<Course, "sessions">;
    const session = { id: sessionDoc.id, ...sessionDoc.data() } as CourseSession;
    if (session.courseId !== rawCourse.id) return null;

    const course = buildNormalizedCourse(rawCourse, [session]);
    if (!course) return null;

    return {
      course,
      session: course.sessions[0] ?? session,
    };
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Booking page read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore booking page read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const course = getCourse(decodedCourseId, data.courses);
    const session = course
      ? getSession(course, decodedSessionId) ?? getSession(decodedSessionId, data.courses)
      : undefined;
    return course && session ? { course, session } : null;
  }
}

export async function getStudentEligibilityPageData(
  offeringId?: string,
): Promise<BookingData> {
  const targetOfferingId = String(offeringId ?? "").trim();
  const matchesTargetOffering = (
    item:
      | Pick<Enrollment, "offeringId" | "courseOfferingId" | "courseId">
      | undefined,
    legacyCourseId?: string,
  ) =>
    Boolean(
      targetOfferingId &&
        item &&
        (item.offeringId === targetOfferingId ||
          item.courseOfferingId === targetOfferingId ||
          (legacyCourseId && item.courseId === legacyCourseId)),
    );
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const selectedOffering = targetOfferingId
      ? data.courseOfferings.find((item) => item.id === targetOfferingId)
      : undefined;
    const legacyCourseId = selectedOffering?.legacyCourseId;
    return normalizeBookingData({
      categories: data.categories,
      students: data.students,
      courseSeries: data.courseSeries,
      courseOfferings: data.courseOfferings,
      studentCourseRecords: data.studentCourseRecords,
      enrollments: targetOfferingId
        ? (data.enrollments ?? []).filter(
            (item) => matchesTargetOffering(item, legacyCourseId),
          )
        : [],
    });
  }

  try {
    const [categorySnapshot, studentSnapshot, courseSeriesSnapshot, courseOfferingSnapshot] =
      await Promise.all([
        db.collection("categories").orderBy("sortOrder", "asc").get(),
        db.collection("students").get(),
        db.collection("courseSeries").get(),
        db.collection("courseOfferings").get(),
      ]);

    const categories = categorySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CourseCategory,
    );
    const students = studentSnapshot.docs
      .map((doc) =>
        normalizeFirestoreStudent(doc.id, doc.data() as FirestoreStudentDocument),
      )
      .sort(compareStudentsForRoster);
    const courseSeries = courseSeriesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CourseSeries,
    );
    const courseOfferings = courseOfferingSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as CourseOffering,
    );

    const selectedOffering = targetOfferingId
      ? courseOfferings.find((item) => item.id === targetOfferingId)
      : undefined;
    const legacyCourseId = selectedOffering?.legacyCourseId;
    const selectedSeriesId =
      selectedOffering?.seriesId ||
      selectedOffering?.courseSeriesId ||
      selectedOffering?.courseMasterId ||
      "";

    const enrollmentQueries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
    if (targetOfferingId) {
      enrollmentQueries.push(
        db.collection("enrollments").where("offeringId", "==", targetOfferingId).get(),
        db.collection("enrollments").where("courseOfferingId", "==", targetOfferingId).get(),
      );
      if (legacyCourseId) {
        enrollmentQueries.push(
          db.collection("enrollments").where("courseId", "==", legacyCourseId).get(),
        );
      }
    }

    const [enrollmentSnapshots, recordSnapshots] = await Promise.all([
      Promise.all(enrollmentQueries),
      selectedSeriesId
        ? Promise.all([
            db.collection("studentCourseRecords").where("seriesId", "==", selectedSeriesId).get(),
            db.collection("studentCourseRecords").where("courseMasterId", "==", selectedSeriesId).get(),
          ])
        : Promise.resolve([] as FirebaseFirestore.QuerySnapshot[]),
    ]);

    const enrollments = Array.from(
      new Map(
        enrollmentSnapshots
          .flatMap((snapshot) => snapshot.docs)
          .map((doc) => [
            doc.id,
            { id: doc.id, ...doc.data() } as Enrollment,
          ]),
      ).values(),
    );

    const studentCourseRecords = Array.from(
      new Map(
        recordSnapshots
          .flatMap((snapshot) => snapshot.docs)
          .map((doc) => [
            doc.id,
            { id: doc.id, ...doc.data() } as StudentCourseRecord,
          ]),
      ).values(),
    );

    return normalizeBookingData({
      categories,
      students,
      courseSeries,
      courseOfferings,
      studentCourseRecords,
      enrollments,
    });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student eligibility page read failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student eligibility page read failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    return normalizeBookingData({
      categories: data.categories,
      students: data.students,
      courseSeries: data.courseSeries,
      courseOfferings: data.courseOfferings,
      studentCourseRecords: data.studentCourseRecords,
      enrollments: targetOfferingId
        ? (data.enrollments ?? []).filter(
            (item) =>
              matchesTargetOffering(
                item,
                data.courseOfferings.find((offering) => offering.id === targetOfferingId)
                  ?.legacyCourseId,
              ),
          )
        : [],
    });
  }
}

export async function findReservationsByStudent(studentName: string, phoneLastThree: string): Promise<Reservation[]> {
  const idNumberLast3 = cleanIdentityLast3(phoneLastThree);
  if (!studentName || !idNumberLast3) {
    return [];
  }
  const matchesStudent = (reservation: Reservation) =>
    normalizeName(reservation.studentName) === normalizeName(studentName) &&
    cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) === idNumberLast3;

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    return data.reservations.filter(matchesStudent);
  }

  try {
    const query = db.collection("reservations").where("studentName", "==", studentName);
    const snapshot = await query.get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Reservation)
      .filter(matchesStudent);
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Reservation search failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore reservation search failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    return data.reservations.filter(matchesStudent);
  }
}

type CreateReservationInput = {
  courseId: string;
  sessionId: string;
  studentName: string;
  phoneLastThree: string;
  idNumberLast3?: string;
};

function cleanIdentityLast3(value: string | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 3);
}

function normalizeName(value: string | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function getCourseOfferingCandidates(course: Course, session: CourseSession) {
  const legacyCourse = course as Course & { courseOfferingId?: string; legacyCourseId?: string };
  return new Set([
    course.id,
    course.offeringId,
    legacyCourse.courseOfferingId,
    legacyCourse.legacyCourseId,
    session.offeringId,
    session.courseId,
  ].filter(Boolean) as string[]);
}

function getCourseSeriesCandidates(course: Course, session: CourseSession) {
  return new Set([
    course.seriesId,
    course.courseSeriesId,
    course.courseMasterId,
    session.seriesId,
  ].filter(Boolean) as string[]);
}

function isActiveEnrollmentStatus(status: string | undefined) {
  const text = String(status ?? "").trim().toLowerCase();
  if (!text) return true;
  return ["active", "booked", "enrolled", "上課中", "已加入"].some((item) => text.includes(item));
}

function isEffectiveEnrollment(enrollment: Enrollment, course: Course, session: CourseSession) {
  if (!isActiveEnrollmentStatus(enrollment.status)) return false;

  const offeringCandidates = getCourseOfferingCandidates(course, session);
  const seriesCandidates = getCourseSeriesCandidates(course, session);
  const offeringMatches =
    (enrollment.offeringId ? offeringCandidates.has(enrollment.offeringId) : false) ||
    (enrollment.courseOfferingId ? offeringCandidates.has(enrollment.courseOfferingId) : false) ||
    // 舊名冊／資格頁有些資料會把年度班級寫在 courseId，
    // 後台名冊頁已接受這種資料；前台名單制預約也要用同一套判斷，
    // 避免後台看得到「上課中」，但前台預約時被判定不在名冊內。
    (enrollment.courseId ? offeringCandidates.has(enrollment.courseId) : false);
  const seriesMatches =
    (enrollment.seriesId ? seriesCandidates.has(enrollment.seriesId) : false) ||
    (enrollment.courseMasterId ? seriesCandidates.has(enrollment.courseMasterId) : false);

  return offeringMatches || seriesMatches;
}



function isSessionBookable(session: CourseSession) {
  const status = session.status ?? "scheduled";
  return ["scheduled", "rescheduled", "makeup", ""].includes(status);
}

export function getBookingQuotaGroupId(course?: Partial<Course> | null, courseIdFallback?: string): string {
  if (!course) return courseIdFallback || "";
  return course.bookingQuotaGroupId || course.offeringId || course.id || courseIdFallback || "";
}

export async function createReservation(input: CreateReservationInput) {
  const db = getFirestoreDb();

  if (!db) {
    return createReservationInJson(input);
  }

  try {
    return await db.runTransaction(async (transaction) => {
      const courseRef = db.collection("courses").doc(input.courseId);
      const sessionRef = db.collection("sessions").doc(input.sessionId);
      const [courseDoc, sessionDoc] = await Promise.all([transaction.get(courseRef), transaction.get(sessionRef)]);

      if (!courseDoc.exists || !sessionDoc.exists || !normalizeName(input.studentName)) {
        return { ok: false as const, reason: "invalid" };
      }

      const course = { id: courseDoc.id, ...courseDoc.data() } as Course;
      const session = { id: sessionDoc.id, ...sessionDoc.data() } as CourseSession;

      if (session.courseId !== course.id) {
        return { ok: false as const, reason: "invalid" };
      }

      // 載入 offering 與 series 資料以進行有效政策解析
      const offeringId = course.offeringId || session.offeringId || course.id;
      const seriesId = course.seriesId || course.courseSeriesId || course.courseMasterId || (course.id ? `series-${course.id}` : "");

      const offeringRef = offeringId ? db.collection("courseOfferings").doc(offeringId) : null;
      const seriesRef = seriesId ? db.collection("courseSeries").doc(seriesId) : null;

      const [offeringDoc, seriesDoc] = await Promise.all([
        offeringRef ? transaction.get(offeringRef) : Promise.resolve(null),
        seriesRef ? transaction.get(seriesRef) : Promise.resolve(null),
      ]);

      const offering = offeringDoc && offeringDoc.exists ? { id: offeringDoc.id, ...offeringDoc.data() } as CourseOffering : null;
      const series = seriesDoc && seriesDoc.exists ? { id: seriesDoc.id, ...seriesDoc.data() } as CourseSeries : null;

      // 取得有效政策與分群 ID
      const resolved = resolveEffectiveBookingPolicy({ course, offering, series });
      const policy = resolved.bookingPolicy;
      const quotaGroupId = resolved.bookingQuotaGroupId;

      const isBooking = policy !== "none";

      if (!isBooking) {
        return { ok: false as const, reason: "not_booking" };
      }

      const studentSnapshot = await transaction.get(
        db.collection("students").where("name", "==", input.studentName).limit(20),
      );
      const nameMatchedStudents = studentSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Student)
        .filter((student) => student.isActive !== false);

      if (nameMatchedStudents.length === 0) {
        return { ok: false as const, reason: "not_roster" };
      }

      const cleanInputLast3 = cleanIdentityLast3(input.idNumberLast3 || input.phoneLastThree);
      const candidateStudents = nameMatchedStudents.filter((student) => {
        const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
        return studentLast3 === cleanInputLast3;
      });

      let eligibleStudent: Student | undefined;
      for (const student of candidateStudents) {
        const enrollmentSnapshot = await transaction.get(
          db.collection("enrollments").where("studentId", "==", student.id).limit(50),
        );
        const hasRosterEnrollment = enrollmentSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Enrollment)
          .some((enrollment) => isEffectiveEnrollment(enrollment, course, session));
        if (hasRosterEnrollment) {
          eligibleStudent = student;
          break;
        }
      }

      if (!eligibleStudent) {
        const isIdentityMismatch = nameMatchedStudents.some((student) => {
          const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
          return studentLast3 !== cleanInputLast3;
        });
        return { ok: false as const, reason: isIdentityMismatch ? "identity_mismatch" : "not_roster" };
      }

      // 讀取該學員所有的有效booked預約進行記憶體中核對，防範欄位缺失、未建立複合索引與手機/證件末三碼錯配
      const [resByStudentIdSnapshot, resByNameSnapshot] = await Promise.all([
        transaction.get(
          db.collection("reservations")
            .where("studentId", "==", eligibleStudent.id)
            .where("status", "==", "booked")
        ),
        transaction.get(
          db.collection("reservations")
            .where("studentName", "==", input.studentName)
            .where("status", "==", "booked")
        ),
      ]);

      const rawReservations = [
        ...resByStudentIdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Reservation),
        ...resByNameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Reservation),
      ];

      // 依 ID 去重
      const activeReservations = Array.from(new Map(rawReservations.map(r => [r.id, r])).values());

      // 安全過濾，必須 studentId 一致，或是「姓名 + 手機末三碼/證件末三碼」一致，但嚴禁 phoneLastThree === idNumberLast3 錯配交叉比對
      const studentPhoneLast3 = eligibleStudent.phone ? eligibleStudent.phone.replace(/\D/g, "").slice(-3) : "";
      const studentIdLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3 || eligibleStudent.nationalId) || "";

      const isStudentMatch = (r: Reservation) => {
        if (r.studentId && eligibleStudent.id && r.studentId === eligibleStudent.id) return true;
        const nameMatches = normalizeName(r.studentName) === normalizeName(eligibleStudent.name);
        if (!nameMatches) return false;

        const phoneMatches = studentPhoneLast3 && r.phoneLastThree && r.phoneLastThree === studentPhoneLast3;
        const idMatches = studentIdLast3 && r.idNumberLast3 && r.idNumberLast3 === studentIdLast3;
        return Boolean(phoneMatches || idMatches);
      };

      const studentReservations = activeReservations.filter(isStudentMatch);

      // 1. 檢查同一個 session 是否重複預約
      const hasDuplicateSession = studentReservations.some(r => r.sessionId === session.id);
      if (hasDuplicateSession) {
        return { ok: false as const, reason: "duplicate" };
      }

      // 2. 檢查一科一約 (one_per_course)
      if (policy === "one_per_course") {
        const hasDuplicateCourse = studentReservations.some(r => {
          const rQuotaGroupId = getBookingQuotaGroupId({
            bookingQuotaGroupId: r.bookingQuotaGroupId,
            offeringId: r.offeringId,
            id: r.courseId
          }, r.courseId);
          return rQuotaGroupId === quotaGroupId;
        });
        if (hasDuplicateCourse) {
          return { ok: false as const, reason: "duplicate_course" };
        }
      }

      // 3. 檢查一週一約 (one_per_cycle)
      const cycleKey = session.date ? getBookingCycleKey(session.date) : "";
      if (policy === "one_per_cycle" && cycleKey) {
        // 收集所有需要查詢 session date 的課堂 ID
        const missingSessionIds = studentReservations
          .filter(r => !r.bookingCycleKey)
          .map(r => r.sessionId)
          .filter(Boolean);

        const sessionMap = new Map<string, CourseSession>();
        if (missingSessionIds.length > 0) {
          const sessionDocs = await Promise.all(
            missingSessionIds.map(sid => transaction.get(db.collection("sessions").doc(sid)))
          );
          sessionDocs.forEach(doc => {
            if (doc.exists) {
              sessionMap.set(doc.id, { id: doc.id, ...doc.data() } as CourseSession);
            }
          });
        }

        const hasDuplicateCycle = studentReservations.some(r => {
          const rQuotaGroupId = getBookingQuotaGroupId({
            bookingQuotaGroupId: r.bookingQuotaGroupId,
            offeringId: r.offeringId,
            id: r.courseId
          }, r.courseId);
          const rCycleKey = r.bookingCycleKey || (r.sessionId ? getBookingCycleKey(sessionMap.get(r.sessionId)?.date || "") : "");
          return rQuotaGroupId === quotaGroupId && rCycleKey === cycleKey;
        });
        if (hasDuplicateCycle) {
          return { ok: false as const, reason: "duplicate_cycle" };
        }
      }

      if (!course.isActive || !session.isActive || !isSessionBookable(session) || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
        return { ok: false as const, reason: "closed" };
      }

      const actualPhoneLast3 = eligibleStudent.phone ? eligibleStudent.phone.replace(/\D/g, "").slice(-3) : "";
      const actualIdLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3 || eligibleStudent.nationalId) || "";

      const reservation = buildReservation(
        { 
          ...input, 
          phoneLastThree: actualPhoneLast3 || input.phoneLastThree, 
          idNumberLast3: actualIdLast3 || input.idNumberLast3, 
          studentId: eligibleStudent.id 
        },
        course,
        session,
        policy,
        quotaGroupId
      );
      transaction.create(db.collection("reservations").doc(reservation.id), reservation);
      transaction.update(sessionRef, { bookedCount: session.bookedCount + 1 });

      return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
    });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Reservation write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore reservation write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return createReservationInJson(input);
  }
}

type ReservationAttendanceUpdateOptions = {
  leaveHours?: number;
  leaveStartTime?: string;
  leaveEndTime?: string;
  lateTime?: string;
};

type ComputedReservationAttendanceUpdate = {
  attendanceStatus: AttendanceStatus;
  lateTime?: string | null;
  leaveHours?: number | null;
  leaveStartTime?: string | null;
  leaveEndTime?: string | null;
};

function hasLeaveRecord(value: Partial<Pick<Reservation, "leaveHours" | "leaveStartTime" | "leaveEndTime">>) {
  return Boolean(value.leaveStartTime || value.leaveEndTime || value.leaveHours != null);
}

function computeReservationAttendanceUpdate(
  current: Partial<Reservation>,
  requestedStatus: AttendanceStatus,
  options: ReservationAttendanceUpdateOptions = {},
): ComputedReservationAttendanceUpdate {
  const currentStatus = current.attendanceStatus;
  const currentHasLeave = hasLeaveRecord(current);
  const requestedHasLeave = hasLeaveRecord(options);
  const next: ComputedReservationAttendanceUpdate = { attendanceStatus: requestedStatus };

  if (requestedStatus === "late") {
    next.attendanceStatus = "late";
    next.lateTime = options.lateTime ?? current.lateTime ?? null;
    next.leaveHours = options.leaveHours ?? current.leaveHours ?? null;
    next.leaveStartTime = options.leaveStartTime ?? current.leaveStartTime ?? null;
    next.leaveEndTime = options.leaveEndTime ?? current.leaveEndTime ?? null;
    return next;
  }

  if (requestedStatus === "leave") {
    next.attendanceStatus = currentStatus === "late" || currentStatus === "attended" ? currentStatus : "leave";
    next.lateTime = current.lateTime ?? null;
    next.leaveHours = options.leaveHours ?? current.leaveHours ?? null;
    next.leaveStartTime = options.leaveStartTime ?? current.leaveStartTime ?? null;
    next.leaveEndTime = options.leaveEndTime ?? current.leaveEndTime ?? null;
    if (!requestedHasLeave && !currentHasLeave) {
      next.leaveHours = null;
      next.leaveStartTime = null;
      next.leaveEndTime = null;
    }
    return next;
  }

  if (requestedStatus === "attended") {
    next.attendanceStatus = "attended";
    next.lateTime = null;
    next.leaveHours = currentHasLeave ? current.leaveHours ?? null : null;
    next.leaveStartTime = currentHasLeave ? current.leaveStartTime ?? null : null;
    next.leaveEndTime = currentHasLeave ? current.leaveEndTime ?? null : null;
    return next;
  }

  next.lateTime = null;
  next.leaveHours = null;
  next.leaveStartTime = null;
  next.leaveEndTime = null;
  return next;
}

function applyReservationAttendanceUpdate(reservation: Reservation, update: ComputedReservationAttendanceUpdate) {
  reservation.attendanceStatus = update.attendanceStatus;

  if (update.lateTime) {
    reservation.lateTime = update.lateTime;
  } else {
    delete reservation.lateTime;
  }

  if (update.leaveHours != null) {
    reservation.leaveHours = update.leaveHours;
  } else {
    delete reservation.leaveHours;
  }

  if (update.leaveStartTime) {
    reservation.leaveStartTime = update.leaveStartTime;
  } else {
    delete reservation.leaveStartTime;
  }

  if (update.leaveEndTime) {
    reservation.leaveEndTime = update.leaveEndTime;
  } else {
    delete reservation.leaveEndTime;
  }
}

export async function updateReservationAttendance(
  reservationId: string,
  attendanceStatus: AttendanceStatus,
  options: ReservationAttendanceUpdateOptions = {},
) {
  if (!["pending", "unchecked", "attended", "late", "absent", "leave"].includes(attendanceStatus)) {
    return;
  }

  const applyLocalFallback = () => {
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (reservation) {
      applyReservationAttendanceUpdate(
        reservation,
        computeReservationAttendanceUpdate(reservation, attendanceStatus, options),
      );
      writeBookingData(data);
    }
  };

  const db = getFirestoreDb();

  if (!db) {
    applyLocalFallback();
    return;
  }

  try {
    const directRef = db.collection("reservations").doc(reservationId);
    const directDoc = await directRef.get();

    if (directDoc.exists) {
      const currentReservation = { ...(directDoc.data() ?? {}), id: directDoc.id } as Partial<Reservation>;
      const updatePayload = computeReservationAttendanceUpdate(currentReservation, attendanceStatus, options);
      await directRef.update(updatePayload);
      return;
    }

    // Some older/imported Firestore reservation documents were saved with a document id
    // that does not match the reservation.id field stored inside the document.
    // The attendance page uses reservation.id from getBookingData(), so direct doc(id)
    // can miss the real Firestore document. Query by the stored id before falling back.
    const legacySnapshot = await db
      .collection("reservations")
      .where("id", "==", reservationId)
      .limit(1)
      .get();

    const legacyDoc = legacySnapshot.docs[0];
    if (legacyDoc) {
      const currentReservation = { ...(legacyDoc.data() ?? {}), id: legacyDoc.id } as Partial<Reservation>;
      const updatePayload = computeReservationAttendanceUpdate(currentReservation, attendanceStatus, options);
      await legacyDoc.ref.update(updatePayload);
      return;
    }

    console.warn(`[DATA_SOURCE] Reservation document not found for attendance update: ${reservationId}`);
    if (!shouldFallbackToJson()) {
      throw new Error(`Reservation document not found for attendance update: ${reservationId}`);
    }
    applyLocalFallback();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Attendance update failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore attendance update failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocalFallback();
  }
}


export async function updateReservationAttendanceBySessionStudent(
  reservationId: string,
  sessionId: string,
  studentId: string | undefined,
  attendanceStatus: AttendanceStatus,
  options: ReservationAttendanceUpdateOptions = {},
) {
  if (!studentId || !sessionId) {
    await updateReservationAttendance(reservationId, attendanceStatus, options);
    return;
  }

  if (!["pending", "unchecked", "attended", "late", "absent", "leave"].includes(attendanceStatus)) {
    return;
  }

  const applyLocalFallback = () => {
    const data = readBookingData();
    const reservation =
      data.reservations.find((item) => item.id === reservationId) ??
      data.reservations.find(
        (item) =>
          item.sessionId === sessionId &&
          item.studentId === studentId &&
          item.status === "booked",
      );

    if (reservation) {
      applyReservationAttendanceUpdate(
        reservation,
        computeReservationAttendanceUpdate(reservation, attendanceStatus, options),
      );
      writeBookingData(data);
    }
  };

  const db = getFirestoreDb();

  if (!db) {
    applyLocalFallback();
    return;
  }

  try {
    const directRef = db.collection("reservations").doc(reservationId);
    const directDoc = await directRef.get();

    if (directDoc.exists) {
      const currentReservation = { ...(directDoc.data() ?? {}), id: directDoc.id } as Partial<Reservation>;
      const updatePayload = computeReservationAttendanceUpdate(currentReservation, attendanceStatus, options);
      await directRef.update(updatePayload);
      return;
    }

    const legacySnapshot = await db
      .collection("reservations")
      .where("id", "==", reservationId)
      .limit(1)
      .get();

    const legacyDoc = legacySnapshot.docs[0];
    if (legacyDoc) {
      const currentReservation = { ...(legacyDoc.data() ?? {}), id: legacyDoc.id } as Partial<Reservation>;
      const updatePayload = computeReservationAttendanceUpdate(currentReservation, attendanceStatus, options);
      await legacyDoc.ref.update(updatePayload);
      return;
    }

    const sessionStudentSnapshot = await db
      .collection("reservations")
      .where("sessionId", "==", sessionId)
      .where("studentId", "==", studentId)
      .limit(5)
      .get();

    const sessionStudentDoc = sessionStudentSnapshot.docs.find((doc) => {
      const data = doc.data() as Partial<Reservation>;
      return data.status === "booked" || !data.status;
    });

    if (sessionStudentDoc) {
      const currentReservation = { ...(sessionStudentDoc.data() ?? {}), id: sessionStudentDoc.id } as Partial<Reservation>;
      const updatePayload = computeReservationAttendanceUpdate(currentReservation, attendanceStatus, options);
      await sessionStudentDoc.ref.update(updatePayload);
      return;
    }

    console.warn(
      `[DATA_SOURCE] Reservation document not found for attendance update: ${reservationId} (${sessionId}/${studentId})`,
    );
    if (!shouldFallbackToJson()) {
      throw new Error(`Reservation document not found for attendance update: ${reservationId} (${sessionId}/${studentId})`);
    }
    applyLocalFallback();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Attendance update failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore attendance update failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocalFallback();
  }
}



export async function markSessionReservationsAttended(sessionId: string) {
  const now = buildTimestamp();
  const payload: Record<string, unknown> = {
    attendanceStatus: "attended",
    lateTime: null,
    leaveHours: null,
    leaveStartTime: null,
    leaveEndTime: null,
    updatedAt: now,
  };

  const applyLocalFallback = () => {
    const data = readBookingData();
    let changed = false;

    data.reservations.forEach((reservation) => {
      if (reservation.sessionId === sessionId && reservation.status === "booked") {
        reservation.attendanceStatus = "attended";
        reservation.lateTime = undefined;
        reservation.leaveHours = undefined;
        reservation.leaveStartTime = undefined;
        reservation.leaveEndTime = undefined;
        reservation.updatedAt = now;
        changed = true;
      }
    });

    if (changed) writeBookingData(data);
  };

  const db = getFirestoreDb();

  if (!db) {
    applyLocalFallback();
    return;
  }

  try {
    const snapshot = await db
      .collection("reservations")
      .where("sessionId", "==", sessionId)
      .where("status", "==", "booked")
      .get();

    await Promise.all(snapshot.docs.map((doc) => doc.ref.set(payload, { merge: true })));
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Batch attendance update failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore batch attendance update failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocalFallback();
  }
}


type ReservationLessonNoteUpdate = {
  homework?: string;
  note?: string;
};

export async function updateReservationLessonNotes(reservationId: string, update: ReservationLessonNoteUpdate) {
  const now = new Date().toISOString();
  const payload: Partial<Reservation> & { updatedAt: string } = { updatedAt: now };

  if (Object.prototype.hasOwnProperty.call(update, "homework")) {
    payload.homework = String(update.homework ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(update, "note")) {
    payload.note = String(update.note ?? "").trim();
  }

  const applyLocalFallback = () => {
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (reservation) {
      Object.assign(reservation, payload);
      writeBookingData(data);
    }
  };

  const db = getFirestoreDb();

  if (!db) {
    applyLocalFallback();
    return;
  }

  try {
    const directRef = db.collection("reservations").doc(reservationId);
    const directDoc = await directRef.get();

    if (directDoc.exists) {
      await directRef.update(payload);
      return;
    }

    const legacySnapshot = await db
      .collection("reservations")
      .where("id", "==", reservationId)
      .limit(1)
      .get();

    const legacyDoc = legacySnapshot.docs[0];
    if (legacyDoc) {
      await legacyDoc.ref.update(payload);
      return;
    }

    console.warn(`[DATA_SOURCE] Reservation document not found for lesson note update: ${reservationId}`);
    if (!shouldFallbackToJson()) {
      throw new Error(`Reservation document not found for lesson note update: ${reservationId}`);
    }
    applyLocalFallback();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Lesson note update failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore lesson note update failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocalFallback();
  }
}


export async function ensureSessionRosterReservation(studentId: string, courseId: string, sessionId: string) {
  const now = buildTimestamp();

  const buildFromData = (data: BookingData) => {
    const student = (data.students ?? []).find((item) => item.id === studentId && item.isActive !== false);
    const course = (data.courses ?? []).find((item) => item.id === courseId || item.offeringId === courseId);
    const session = course?.sessions?.find((item) => item.id === sessionId);

    if (!student || !course || !session) {
      return { ok: false as const, reason: "invalid" as const };
    }

    const existing = (data.reservations ?? []).find(
      (reservation) =>
        reservation.sessionId === session.id &&
        reservation.studentId === student.id &&
        reservation.status === "booked",
    );

    if (existing) {
      return { ok: true as const, reservation: existing, courseId: course.id, sessionId: session.id };
    }

    const seriesId = course.seriesId || course.courseMasterId || course.courseSeriesId || course.offeringId || course.id;
    const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
    const reservation: Reservation = {
      id: `roster-${String(session.id).replace(/[\/]/g, "~")}-${student.id}`,
      courseId: course.id,
      sessionId: session.id,
      studentId: student.id,
      studentName: student.name,
      phoneLastThree: studentLast3,
      idNumberLast3: cleanIdentityLast3(student.idNumberLast3) || studentLast3,
      offeringId: session.offeringId ?? course.offeringId,
      seriesId,
      bookedAt: now,
      status: "booked",
      attendanceStatus: "unchecked",
      source: "manual",
      note: "由年度課程名單自動帶入課堂點名",
      createdAt: now,
      updatedAt: now,
    };

    return { ok: true as const, reservation, courseId: course.id, sessionId: session.id, shouldCreate: true as const };
  };

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const result = buildFromData(data);
    if (result.ok && "shouldCreate" in result) {
      data.reservations = [...(data.reservations ?? []), result.reservation];
      const session = data.courses.flatMap((course) => course.sessions ?? []).find((item) => item.id === sessionId);
      if (session) {
        session.bookedCount = (data.reservations ?? []).filter((item) => item.sessionId === sessionId && item.status === "booked").length;
      }
      writeBookingData(data);
    }
    return result;
  }

  try {
    const data = await getBookingData();
    const result = buildFromData(data);
    if (result.ok && "shouldCreate" in result) {
      await db.collection("reservations").doc(result.reservation.id).set(result.reservation, { merge: true });
      try {
        await db.collection("sessions").doc(sessionId).set({ updatedAt: now }, { merge: true });
      } catch {
        // 部分專案版本沒有獨立 sessions collection；點名紀錄已成功建立即可。
      }
    }
    return result;
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Roster reservation ensure failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore roster reservation ensure failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const result = buildFromData(data);
    if (result.ok && "shouldCreate" in result) {
      data.reservations = [...(data.reservations ?? []), result.reservation];
      writeBookingData(data);
    }
    return result;
  }
}

export async function cancelReservation(reservationId: string, studentName: string, phoneLastThree: string) {
  const db = getFirestoreDb();

  if (!db) {
    return cancelReservationInJson(reservationId, studentName, phoneLastThree);
  }

  try {
    return await db.runTransaction(async (transaction) => {
    const reservationRef = db.collection("reservations").doc(reservationId);
    const reservationDoc = await transaction.get(reservationRef);

    if (!reservationDoc.exists) {
      return { ok: false as const, reason: "invalid" };
    }

    const reservation = { id: reservationDoc.id, ...reservationDoc.data() } as Reservation;

    if (
      normalizeName(reservation.studentName) !== normalizeName(studentName) ||
      !phoneLastThree ||
      cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) !== cleanIdentityLast3(phoneLastThree) ||
      reservation.status !== "booked"
    ) {
      return { ok: false as const, reason: "invalid" };
    }

    const sessionRef = db.collection("sessions").doc(reservation.sessionId);
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists) {
      return { ok: false as const, reason: "invalid" };
    }

    const session = { id: sessionDoc.id, ...sessionDoc.data() } as CourseSession;

    if (!canChangeReservation(session)) {
      return { ok: false as const, reason: "closed" };
    }

    transaction.update(reservationRef, { status: "cancelled", cancelledAt: buildTimestamp() });
    transaction.update(sessionRef, { bookedCount: Math.max(session.bookedCount - 1, 0) });

    return { ok: true as const, courseId: reservation.courseId, sessionId: reservation.sessionId };
    });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Reservation cancel failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore reservation cancel failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return cancelReservationInJson(reservationId, studentName, phoneLastThree);
  }
}

export async function cancelReservationByStaff(reservationId: string) {
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    const session = data.courses.flatMap((course) => course.sessions).find((item) => item.id === reservation?.sessionId);

    if (!reservation || !session || reservation.status !== "booked") {
      return { ok: false as const, reason: "invalid" };
    }

    reservation.status = "cancelled";
    reservation.cancelledAt = buildTimestamp();
    session.bookedCount = Math.max(session.bookedCount - 1, 0);
    writeBookingData(data);
    return { ok: true as const, courseId: reservation.courseId, sessionId: reservation.sessionId };
  }

  try {
    return await db.runTransaction(async (transaction) => {
      const reservationRef = db.collection("reservations").doc(reservationId);
      const reservationDoc = await transaction.get(reservationRef);

      if (!reservationDoc.exists) {
        return { ok: false as const, reason: "invalid" };
      }

      const reservation = { id: reservationDoc.id, ...reservationDoc.data() } as Reservation;

      if (reservation.status !== "booked") {
        return { ok: false as const, reason: "invalid" };
      }

      const sessionRef = db.collection("sessions").doc(reservation.sessionId);
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        return { ok: false as const, reason: "invalid" };
      }

      const session = { id: sessionDoc.id, ...sessionDoc.data() } as CourseSession;
      transaction.update(reservationRef, { status: "cancelled", cancelledAt: buildTimestamp() });
      transaction.update(sessionRef, { bookedCount: Math.max(session.bookedCount - 1, 0) });

      return { ok: true as const, courseId: reservation.courseId, sessionId: reservation.sessionId };
    });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Staff reservation cancel failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore staff reservation cancel failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    const session = data.courses.flatMap((course) => course.sessions).find((item) => item.id === reservation?.sessionId);

    if (!reservation || !session || reservation.status !== "booked") {
      return { ok: false as const, reason: "invalid" };
    }

    reservation.status = "cancelled";
    reservation.cancelledAt = buildTimestamp();
    session.bookedCount = Math.max(session.bookedCount - 1, 0);
    writeBookingData(data);
    return { ok: true as const, courseId: reservation.courseId, sessionId: reservation.sessionId };
  }
}

function createReservationInJson(input: CreateReservationInput) {
  const data = readBookingData();
  const course = data.courses.find((item) => item.id === input.courseId);
  const session = course?.sessions.find((item) => item.id === input.sessionId);
  if (!course || !session || !normalizeName(input.studentName)) {
    return { ok: false as const, reason: "invalid" };
  }

  // 載入 offering 與 series 資料以進行有效政策解析
  const offeringId = course.offeringId || session.offeringId || course.id;
  const seriesId = course.seriesId || course.courseSeriesId || course.courseMasterId || (course.id ? `series-${course.id}` : "");

  const offering = data.courseOfferings?.find((o) => o.id === offeringId);
  const series = data.courseSeries?.find((s) => s.id === seriesId);

  // 取得有效政策與分群 ID
  const resolved = resolveEffectiveBookingPolicy({ course, offering, series });
  const policy = resolved.bookingPolicy;
  const quotaGroupId = resolved.bookingQuotaGroupId;

  const isBooking = policy !== "none";

  if (!isBooking) {
    return { ok: false as const, reason: "not_booking" };
  }

  const nameMatchedStudents = (data.students ?? []).filter(
    (student) => normalizeName(student.name) === normalizeName(input.studentName) && student.isActive !== false
  );

  if (nameMatchedStudents.length === 0) {
    return { ok: false as const, reason: "not_roster" };
  }

  const cleanInputLast3 = cleanIdentityLast3(input.idNumberLast3 || input.phoneLastThree);
  const eligibleStudent = nameMatchedStudents
    .filter((student) => {
      const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
      return studentLast3 === cleanInputLast3;
    })
    .find((student) =>
      (data.enrollments ?? []).some((enrollment) => enrollment.studentId === student.id && isEffectiveEnrollment(enrollment, course, session)),
    );

  if (!eligibleStudent) {
    const isIdentityMismatch = nameMatchedStudents.some((student) => {
      const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
      return studentLast3 !== cleanInputLast3;
    });
    return { ok: false as const, reason: isIdentityMismatch ? "identity_mismatch" : "not_roster" };
  }

  // 安全過濾，必須 studentId 一致，或是「姓名 + 手機末三碼/證件末三碼」一致，但嚴禁 phoneLastThree === idNumberLast3 錯配交叉比對
  const studentPhoneLast3 = eligibleStudent.phone ? eligibleStudent.phone.replace(/\D/g, "").slice(-3) : "";
  const studentIdLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3 || eligibleStudent.nationalId) || "";

  const isStudentMatch = (r: Reservation) => {
    if (r.studentId && eligibleStudent.id && r.studentId === eligibleStudent.id) return true;
    const nameMatches = normalizeName(r.studentName) === normalizeName(eligibleStudent.name);
    if (!nameMatches) return false;

    const phoneMatches = studentPhoneLast3 && r.phoneLastThree && r.phoneLastThree === studentPhoneLast3;
    const idMatches = studentIdLast3 && r.idNumberLast3 && r.idNumberLast3 === studentIdLast3;
    return Boolean(phoneMatches || idMatches);
  };

  // 1. 檢查同一個 session 是否重複預約
  const hasDuplicate = data.reservations.some(
    (r) => r.sessionId === session.id && r.status === "booked" && isStudentMatch(r)
  );

  if (hasDuplicate) {
    return { ok: false as const, reason: "duplicate" };
  }

  // 2. 檢查一科一約 (one_per_course)
  if (policy === "one_per_course") {
    const hasDuplicateCourse = data.reservations.some(
      (r) => {
        const rQuotaGroupId = getBookingQuotaGroupId({
          bookingQuotaGroupId: r.bookingQuotaGroupId,
          offeringId: r.offeringId,
          id: r.courseId
        }, r.courseId);
        return rQuotaGroupId === quotaGroupId && r.status === "booked" && isStudentMatch(r);
      }
    );
    if (hasDuplicateCourse) {
      return { ok: false as const, reason: "duplicate_course" };
    }
  }

  // 3. 檢查一週一約 (one_per_cycle)
  const cycleKey = session.date ? getBookingCycleKey(session.date) : "";
  if (policy === "one_per_cycle" && cycleKey) {
    const hasDuplicateCycle = data.reservations.some(
      (r) => {
        const rQuotaGroupId = getBookingQuotaGroupId({
          bookingQuotaGroupId: r.bookingQuotaGroupId,
          offeringId: r.offeringId,
          id: r.courseId
        }, r.courseId);
        const rCycleKey = r.bookingCycleKey || (r.sessionId ? getBookingCycleKey(data.courses.flatMap(c => c.sessions).find(s => s.id === r.sessionId)?.date || "") : "");
        return rQuotaGroupId === quotaGroupId && rCycleKey === cycleKey && r.status === "booked" && isStudentMatch(r);
      }
    );
    if (hasDuplicateCycle) {
      return { ok: false as const, reason: "duplicate_cycle" };
    }
  }

  if (!course.isActive || !session.isActive || !isSessionBookable(session) || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
    return { ok: false as const, reason: "closed" };
  }

  const actualPhoneLast3 = eligibleStudent.phone ? eligibleStudent.phone.replace(/\D/g, "").slice(-3) : "";
  const actualIdLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3 || eligibleStudent.nationalId) || "";

  const reservation = buildReservation(
    { 
      ...input, 
      phoneLastThree: actualPhoneLast3 || input.phoneLastThree, 
      idNumberLast3: actualIdLast3 || input.idNumberLast3, 
      studentId: eligibleStudent.id 
    },
    course,
    session,
    policy,
    quotaGroupId
  );
  session.bookedCount += 1;
  data.reservations.push(reservation);
  writeBookingData(data);

  return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
}

function cancelReservationInJson(reservationId: string, studentName: string, phoneLastThree: string) {
  const data = readBookingData();
  const reservation = data.reservations.find(
    (item) =>
      item.id === reservationId &&
      normalizeName(item.studentName) === normalizeName(studentName) &&
      phoneLastThree &&
      cleanIdentityLast3(item.idNumberLast3 ?? item.phoneLastThree) === cleanIdentityLast3(phoneLastThree) &&
      item.status === "booked",
  );
  const session = data.courses.flatMap((course) => course.sessions).find((item) => item.id === reservation?.sessionId);

  if (!reservation || !session) {
    return { ok: false as const, reason: "invalid" };
  }

  if (!canChangeReservation(session)) {
    return { ok: false as const, reason: "closed" };
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = buildTimestamp();
  session.bookedCount = Math.max(session.bookedCount - 1, 0);
  writeBookingData(data);
  return { ok: true as const, courseId: reservation.courseId, sessionId: reservation.sessionId };
}

export async function upsertCategory(category: CourseCategory) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const index = data.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) data.categories[index] = category;
    else data.categories.push(category);
    writeBookingData(data);
    return;
  }

  try {
    await db.collection("categories").doc(category.id).set(removeUndefinedFields(category), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Category write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore category write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const index = data.categories.findIndex((item) => item.id === category.id);
    if (index >= 0) data.categories[index] = category;
    else data.categories.push(category);
    writeBookingData(data);
  }
}

export async function upsertCourse(course: Omit<Course, "sessions">) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const index = data.courses.findIndex((item) => item.id === course.id);
    if (index >= 0) data.courses[index] = { ...data.courses[index], ...course };
    else data.courses.push({ ...course, sessions: [] });
    writeBookingData(data);
    return;
  }

  try {
    await db.collection("courses").doc(course.id).set(removeUndefinedFields(course), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const index = data.courses.findIndex((item) => item.id === course.id);
    if (index >= 0) data.courses[index] = { ...data.courses[index], ...course };
    else data.courses.push({ ...course, sessions: [] });
    writeBookingData(data);
  }
}


export async function deleteSessionsByIds(sessionIds: string[]) {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  if (uniqueSessionIds.length === 0) return;

  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const idSet = new Set(uniqueSessionIds);

    data.courses = data.courses.map((course) => ({
      ...course,
      sessions: course.sessions.filter((session) => !idSet.has(session.id)),
    }));

    data.courseSessions = data.courseSessions?.filter((session) => !idSet.has(session.id)) ?? [];
    data.reservations = data.reservations.filter((reservation) => !idSet.has(reservation.sessionId));
    data.attendanceRecords =
      data.attendanceRecords?.filter((record) => !idSet.has(record.sessionId)) ?? [];

    writeBookingData(data);
    return;
  }

  try {
    for (let index = 0; index < uniqueSessionIds.length; index += 450) {
      const batch = db.batch();
      uniqueSessionIds.slice(index, index + 450).forEach((sessionId) => {
        batch.delete(db.collection("sessions").doc(sessionId));
        batch.delete(db.collection("courseSessions").doc(sessionId));
      });
      await batch.commit();
    }
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Sessions delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore session delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const idSet = new Set(uniqueSessionIds);

    data.courses = data.courses.map((course) => ({
      ...course,
      sessions: course.sessions.filter((session) => !idSet.has(session.id)),
    }));

    data.courseSessions = data.courseSessions?.filter((session) => !idSet.has(session.id)) ?? [];
    data.reservations = data.reservations.filter((reservation) => !idSet.has(reservation.sessionId));
    data.attendanceRecords =
      data.attendanceRecords?.filter((record) => !idSet.has(record.sessionId)) ?? [];

    writeBookingData(data);
  }
}

export async function upsertSession(session: CourseSession) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const course = data.courses.find((item) => item.id === session.courseId);
    if (!course) return;

    const index = course.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) course.sessions[index] = session;
    else course.sessions.push(session);
    course.sessions.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    writeBookingData(data);
    return;
  }

  try {
    await db.collection("sessions").doc(session.id).set(removeUndefinedFields(session), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Session write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore session write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const course = data.courses.find((item) => item.id === session.courseId);
    if (!course) return;

    const index = course.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) course.sessions[index] = session;
    else course.sessions.push(session);
    course.sessions.sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    writeBookingData(data);
  }
}

export async function upsertCourseSeries(series: CourseSeries) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const courseSeries = data.courseSeries ?? [];
    const index = courseSeries.findIndex((item) => item.id === series.id);
    if (index >= 0) courseSeries[index] = { ...courseSeries[index], ...series };
    else courseSeries.push(series);
    writeBookingData({ ...data, courseSeries });
    return;
  }

  try {
    await db.collection("courseSeries").doc(series.id).set(removeUndefinedFields(series), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course series write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course series write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const courseSeries = data.courseSeries ?? [];
    const index = courseSeries.findIndex((item) => item.id === series.id);
    if (index >= 0) courseSeries[index] = { ...courseSeries[index], ...series };
    else courseSeries.push(series);
    writeBookingData({ ...data, courseSeries });
  }
}

export async function upsertCourseOffering(offering: CourseOffering) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const courseOfferings = data.courseOfferings ?? [];
    const index = courseOfferings.findIndex((item) => item.id === offering.id);
    if (index >= 0) courseOfferings[index] = { ...courseOfferings[index], ...offering };
    else courseOfferings.push(offering);
    writeBookingData({ ...data, courseOfferings });
    return;
  }

  try {
    await db.collection("courseOfferings").doc(offering.id).set(removeUndefinedFields(offering), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course offering write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course offering write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const courseOfferings = data.courseOfferings ?? [];
    const index = courseOfferings.findIndex((item) => item.id === offering.id);
    if (index >= 0) courseOfferings[index] = { ...courseOfferings[index], ...offering };
    else courseOfferings.push(offering);
    writeBookingData({ ...data, courseOfferings });
  }
}

export async function upsertStudent(student: Student) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const students = data.students ?? [];
    const index = students.findIndex((item) => item.id === student.id);
    if (index >= 0) students[index] = student;
    else students.push(student);
    writeBookingData({ ...data, students });
    return;
  }

  try {
    await db
      .collection("students")
      .doc(student.id)
      .set(removeUndefinedFields(student), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const students = data.students ?? [];
    const index = students.findIndex((item) => item.id === student.id);
    if (index >= 0) students[index] = student;
    else students.push(student);
    writeBookingData({ ...data, students });
  }
}

export async function upsertEnrollment(enrollment: Enrollment) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const enrollments = data.enrollments ?? [];
    const index = enrollments.findIndex((item) => item.id === enrollment.id);
    if (index >= 0) enrollments[index] = { ...enrollments[index], ...enrollment };
    else enrollments.push(enrollment);
    writeBookingData({ ...data, enrollments });
    return;
  }

  try {
    await db.collection("enrollments").doc(enrollment.id).set(removeUndefinedFields(enrollment), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Enrollment write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore enrollment write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const enrollments = data.enrollments ?? [];
    const index = enrollments.findIndex((item) => item.id === enrollment.id);
    if (index >= 0) enrollments[index] = { ...enrollments[index], ...enrollment };
    else enrollments.push(enrollment);
    writeBookingData({ ...data, enrollments });
  }
}


export async function upsertStudentCourseRecord(record: StudentCourseRecord) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const records = data.studentCourseRecords ?? [];
    const index = records.findIndex((item) => item.id === record.id);
    if (index >= 0) records[index] = { ...records[index], ...record };
    else records.push(record);
    writeBookingData({ ...data, studentCourseRecords: records });
    return;
  }

  try {
    await db.collection("studentCourseRecords").doc(record.id).set(removeUndefinedFields(record), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student course record write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student course record write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const records = data.studentCourseRecords ?? [];
    const index = records.findIndex((item) => item.id === record.id);
    if (index >= 0) records[index] = { ...records[index], ...record };
    else records.push(record);
    writeBookingData({ ...data, studentCourseRecords: records });
  }
}


export async function removeStudentCourseEligibility(studentId: string, seriesId: string, year: string | number) {
  const normalizedYear = String(year ?? "").trim();
  const matches = (record: StudentCourseRecord) => {
    if (record.studentId !== studentId) return false;
    const recordSeriesIds = [
      record.seriesId,
      record.courseMasterId,
      (record as StudentCourseRecord & { courseSeriesId?: string }).courseSeriesId,
    ]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    const recordYear = String(record.year ?? record.sourceRocYear ?? "").trim();
    return recordSeriesIds.includes(seriesId) && (!normalizedYear || recordYear === normalizedYear);
  };

  const applyLocal = () => {
    const data = readBookingData();
    data.studentCourseRecords = (data.studentCourseRecords ?? []).filter((record) => !matches(record));

    // 若過去曾用 enrollments 記錄「課程資格」而非正式梯次名冊，也一併移除對應關聯，
    // 避免前台或後台從舊關聯誤判仍有資格。
    data.enrollments = (data.enrollments ?? []).filter((enrollment) => {
      if (enrollment.studentId !== studentId) return true;
      const enrollmentSeriesIds = [
        enrollment.seriesId,
        enrollment.courseMasterId,
        (enrollment as Enrollment & { courseSeriesId?: string }).courseSeriesId,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      const enrollmentYear = String((enrollment as Enrollment & { year?: string | number; sourceRocYear?: string | number }).year ?? (enrollment as Enrollment & { year?: string | number; sourceRocYear?: string | number }).sourceRocYear ?? "").trim();
      return !(enrollmentSeriesIds.includes(seriesId) && (!normalizedYear || !enrollmentYear || enrollmentYear === normalizedYear));
    });

    writeBookingData(data);
  };

  const db = getFirestoreDb();
  if (!db) {
    applyLocal();
    return;
  }

  try {
    const snapshot = await db.collection("studentCourseRecords").where("studentId", "==", studentId).get();
    const docsToDelete = snapshot.docs.filter((doc) => matches(doc.data() as StudentCourseRecord));

    for (let index = 0; index < docsToDelete.length; index += 450) {
      const batch = db.batch();
      docsToDelete.slice(index, index + 450).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student course eligibility delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student course eligibility delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}


export async function checkStudentOfferingRecords(studentId: string, offeringId: string) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const course = data.courses.find((c) => c.offeringId === offeringId || c.id === offeringId);
    const courseId = course?.id || offeringId;
    const sessionIds = new Set([
      ...(course?.sessions.map((session) => session.id) ?? []),
      ...(data.courseSessions ?? [])
        .filter((session) => session.offeringId === offeringId || session.legacyCourseId === courseId)
        .map((session) => session.id),
    ]);

    const hasReservations = data.reservations.some(
      (r) =>
        r.studentId === studentId &&
        r.status === "booked" &&
        (r.offeringId === offeringId || r.courseId === courseId || sessionIds.has(r.sessionId))
    );
    const hasAttendance = (data.attendanceRecords ?? []).some(
      (a) => {
        const record = a as AttendanceRecord & { courseId?: string };
        return (
          record.studentId === studentId &&
          (record.offeringId === offeringId ||
            record.courseId === courseId ||
            (record.sessionId ? sessionIds.has(record.sessionId) : false) ||
            (record.courseSessionId ? sessionIds.has(record.courseSessionId) : false))
        );
      }
    );

    return { hasReservations, hasAttendance };
  }

  // Firestore mode
  const courseSnapshot = await db.collection("courses").where("offeringId", "==", offeringId).get();
  const courseIds = Array.from(new Set([offeringId, ...courseSnapshot.docs.map((doc) => doc.id)]));
  const sessionIds = new Set<string>();
  courseSnapshot.docs.forEach((doc) => {
    const sessions = doc.data()?.sessions;
    if (Array.isArray(sessions)) {
      sessions.forEach((session) => {
        if (session?.id) sessionIds.add(String(session.id));
      });
    }
  });
  const directSessionSnapshot = await db.collection("sessions").where("offeringId", "==", offeringId).get();
  directSessionSnapshot.docs.forEach((doc) => sessionIds.add(doc.id));
  for (const courseId of courseIds) {
    const courseSessionSnapshot = await db.collection("sessions").where("courseId", "==", courseId).get();
    courseSessionSnapshot.docs.forEach((doc) => sessionIds.add(doc.id));
  }

  // Check booked reservations
  let hasReservations = false;
  const resSnapshot = await db.collection("reservations").where("studentId", "==", studentId).where("status", "==", "booked").get();
  for (const doc of resSnapshot.docs) {
    const data = doc.data();
    if (data.offeringId === offeringId || courseIds.includes(data.courseId) || sessionIds.has(data.sessionId)) {
      hasReservations = true;
      break;
    }
  }

  // Check attendance records
  let hasAttendance = false;
  const attSnapshot = await db.collection("attendanceRecords").where("studentId", "==", studentId).get();
  for (const doc of attSnapshot.docs) {
    const data = doc.data();
    if (
      data.offeringId === offeringId ||
      courseIds.includes(data.courseId) ||
      sessionIds.has(data.sessionId) ||
      sessionIds.has(data.courseSessionId)
    ) {
      hasAttendance = true;
      break;
    }
  }

  return { hasReservations, hasAttendance };
}

export async function removeStudentFromOffering(studentId: string, offeringId: string) {
  const db = getFirestoreDb();

  const applyLocal = () => {
    const data = readBookingData();
    const course = data.courses.find((c) => c.offeringId === offeringId || c.id === offeringId);
    const courseId = course?.id || offeringId;

    // 1. Remove enrollment
    data.enrollments = (data.enrollments ?? []).filter(
      (e) =>
        !(
          e.studentId === studentId &&
          (e.offeringId === offeringId ||
            e.courseOfferingId === offeringId ||
            e.courseId === courseId)
        )
    );

    // 2. Remove studentCourseRecord
    data.studentCourseRecords = (data.studentCourseRecords ?? []).filter(
      (r) =>
        !(
          r.studentId === studentId &&
          (r.offeringId === offeringId || r.courseId === courseId)
        )
    );

    writeBookingData(data);
  };

  if (!db) {
    applyLocal();
    return;
  }

  try {
    const courseSnapshot = await db.collection("courses").where("offeringId", "==", offeringId).get();
    const course = courseSnapshot.empty ? null : { id: courseSnapshot.docs[0].id, ...courseSnapshot.docs[0].data() } as Course;
    const courseId = course?.id || offeringId;

    // Delete enrollments from Firestore
    const enrollSnapshot = await db.collection("enrollments")
      .where("studentId", "==", studentId)
      .where("offeringId", "==", offeringId)
      .get();
    const enrollSnapshotByCourseOffering = await db.collection("enrollments")
      .where("studentId", "==", studentId)
      .where("courseOfferingId", "==", offeringId)
      .get();
    const enrollSnapshot2 = await db.collection("enrollments")
      .where("studentId", "==", studentId)
      .where("courseId", "==", courseId)
      .get();

    const enrollDocs = [
      ...enrollSnapshot.docs,
      ...enrollSnapshotByCourseOffering.docs,
      ...enrollSnapshot2.docs,
    ];
    const uniqueEnrollDocs = Array.from(new Map(enrollDocs.map(doc => [doc.id, doc])).values());

    // Delete studentCourseRecords from Firestore
    const recordSnapshot = await db.collection("studentCourseRecords")
      .where("studentId", "==", studentId)
      .where("offeringId", "==", offeringId)
      .get();
    const recordSnapshotByCourse = await db.collection("studentCourseRecords")
      .where("studentId", "==", studentId)
      .where("courseId", "==", courseId)
      .get();
    const recordDocs = Array.from(
      new Map(
        [...recordSnapshot.docs, ...recordSnapshotByCourse.docs].map((doc) => [
          doc.id,
          doc,
        ]),
      ).values(),
    );

    // Batch delete
    const allDocsToDelete = [...uniqueEnrollDocs, ...recordDocs];
    for (let index = 0; index < allDocsToDelete.length; index += 450) {
      const batch = db.batch();
      allDocsToDelete.slice(index, index + 450).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Remove student from offering failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore remove student from offering failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}




export async function addStudentToSessionRoster(studentId: string, courseId: string, sessionId: string) {
  const now = buildTimestamp();

  const applyLocal = () => {
    const data = readBookingData();
    const student = (data.students ?? []).find((item) => item.id === studentId && item.isActive !== false);
    const course = (data.courses ?? []).find((item) => item.id === courseId);
    const session = course?.sessions?.find((item) => item.id === sessionId);

    if (!student || !course || !session) {
      return { ok: false as const, reason: "invalid" };
    }

    const hasDuplicate = (data.reservations ?? []).some(
      (reservation) =>
        reservation.sessionId === session.id &&
        reservation.status === "booked" &&
        (reservation.studentId === student.id ||
          (normalizeName(reservation.studentName) === normalizeName(student.name) &&
            cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) === cleanIdentityLast3(student.idNumberLast3))),
    );

    if (hasDuplicate) {
      return { ok: false as const, reason: "duplicate" };
    }

    const seriesId = course.seriesId || course.courseMasterId || course.courseSeriesId || course.offeringId || course.id;
    const year = course.year ?? (session.date ? Number(session.date.slice(0, 4)) - 1911 : undefined);
    const recordId = `elig-${student.id}-${seriesId}-${year ?? "na"}`;
    const records = data.studentCourseRecords ?? [];
    const existingRecordIndex = records.findIndex(
      (record) =>
        record.id === recordId ||
        (record.studentId === student.id &&
          [record.seriesId, record.courseMasterId, (record as StudentCourseRecord & { courseSeriesId?: string }).courseSeriesId].filter(Boolean).includes(seriesId) &&
          String(record.year ?? record.sourceRocYear ?? "") === String(year ?? "")),
    );

    const eligibilityRecord: StudentCourseRecord = {
      ...(existingRecordIndex >= 0 ? records[existingRecordIndex] : {}),
      id: existingRecordIndex >= 0 ? records[existingRecordIndex].id : recordId,
      studentId: student.id,
      seriesId,
      courseMasterId: seriesId,
      offeringId: course.offeringId,
      sourceColumn: "後台加入課堂名單",
      rawValue: "可上課",
      normalizedValue: "可上課",
      recordType: "roster",
      sourceRocYear: year,
      year,
      term: course.term,
      termLabel: course.termLabel,
      classDisplayName: course.displayTitle ?? course.classDisplayName ?? course.title,
      note: "由點名頁直接加入課堂名單",
      importedAt: existingRecordIndex >= 0 ? records[existingRecordIndex].importedAt : now,
      createdAt: existingRecordIndex >= 0 ? records[existingRecordIndex].createdAt : now,
      updatedAt: now,
    } as StudentCourseRecord;

    if (existingRecordIndex >= 0) records[existingRecordIndex] = eligibilityRecord;
    else records.push(eligibilityRecord);
    data.studentCourseRecords = records;

    const reservation: Reservation = {
      id: `manual-${session.id}-${student.id}`,
      courseId: course.id,
      sessionId: session.id,
      studentId: student.id,
      studentName: student.name,
      phoneLastThree: cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3),
      idNumberLast3: cleanIdentityLast3(student.idNumberLast3),
      offeringId: course.offeringId,
      seriesId,
      bookedAt: now,
      status: "booked",
      attendanceStatus: "unchecked",
      source: "manual",
      note: "後台點名頁加入",
      createdAt: now,
      updatedAt: now,
    };

    data.reservations = [...(data.reservations ?? []), reservation];
    session.bookedCount = (data.reservations ?? []).filter((item) => item.sessionId === session.id && item.status === "booked").length;
    writeBookingData(data);
    return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
  };

  const db = getFirestoreDb();
  if (!db) return applyLocal();

  try {
    const data = await getBookingData();
    const student = (data.students ?? []).find((item) => item.id === studentId && item.isActive !== false);
    const course = (data.courses ?? []).find((item) => item.id === courseId);
    const session = course?.sessions?.find((item) => item.id === sessionId);

    if (!student || !course || !session) {
      return { ok: false as const, reason: "invalid" as const };
    }

    const hasDuplicate = (data.reservations ?? []).some(
      (reservation) =>
        reservation.sessionId === session.id &&
        reservation.status === "booked" &&
        (reservation.studentId === student.id ||
          (normalizeName(reservation.studentName) === normalizeName(student.name) &&
            cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) === cleanIdentityLast3(student.idNumberLast3))),
    );

    if (hasDuplicate) {
      return { ok: false as const, reason: "duplicate" as const };
    }

    const seriesId = course.seriesId || course.courseMasterId || course.courseSeriesId || course.offeringId || course.id;
    const year = course.year ?? (session.date ? Number(session.date.slice(0, 4)) - 1911 : undefined);
    const recordId = `elig-${student.id}-${seriesId}-${year ?? "na"}`;
    const records = data.studentCourseRecords ?? [];
    const existingRecord = records.find(
      (record) =>
        record.id === recordId ||
        (record.studentId === student.id &&
          [record.seriesId, record.courseMasterId, (record as StudentCourseRecord & { courseSeriesId?: string }).courseSeriesId].filter(Boolean).includes(seriesId) &&
          String(record.year ?? record.sourceRocYear ?? "") === String(year ?? "")),
    );

    const eligibilityRecord: StudentCourseRecord = {
      ...(existingRecord ?? {}),
      id: existingRecord ? existingRecord.id : recordId,
      studentId: student.id,
      seriesId,
      courseMasterId: seriesId,
      offeringId: course.offeringId,
      sourceColumn: "後台加入課堂名單",
      rawValue: "可上課",
      normalizedValue: "可上課",
      recordType: "roster",
      sourceRocYear: year,
      year,
      term: course.term,
      termLabel: course.termLabel,
      classDisplayName: course.displayTitle ?? course.classDisplayName ?? course.title,
      note: "由點名頁直接加入課堂名單",
      importedAt: existingRecord ? existingRecord.importedAt : now,
      createdAt: existingRecord ? existingRecord.createdAt : now,
      updatedAt: now,
    } as StudentCourseRecord;

    const studentLast3 = cleanIdentityLast3(student.idNumberLast3) || cleanIdentityLast3(student.phone).slice(-3);
    const reservation: Reservation = {
      id: `manual-${session.id}-${student.id}`,
      courseId: course.id,
      sessionId: session.id,
      studentId: student.id,
      studentName: student.name,
      phoneLastThree: studentLast3,
      idNumberLast3: cleanIdentityLast3(student.idNumberLast3),
      offeringId: course.offeringId,
      seriesId,
      bookedAt: now,
      status: "booked",
      attendanceStatus: "unchecked",
      source: "manual",
      note: "後台點名頁加入",
      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(db.collection("studentCourseRecords").doc(eligibilityRecord.id), removeUndefinedFields(eligibilityRecord), { merge: true });
    batch.set(db.collection("reservations").doc(reservation.id), removeUndefinedFields(reservation), { merge: true });

    const newBookedCount = (data.reservations ?? []).filter((item) => item.sessionId === session.id && item.status === "booked").length + 1;
    batch.set(db.collection("sessions").doc(session.id), { bookedCount: newBookedCount, updatedAt: now }, { merge: true });

    await batch.commit();
    return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Add student to session roster failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore add student to session roster failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return applyLocal();
  }
}

export async function setDocumentActive(
  collection: "categories" | "courses" | "sessions" | "students" | "courseSeries" | "courseOfferings",
  id: string,
  isActive: boolean,
) {
  const applyLocal = () => {
    const data = readBookingData();
    if (collection === "categories") {
      const category = data.categories.find((item) => item.id === id);
      if (category) category.isActive = isActive;
    }
    if (collection === "courses") {
      const course = data.courses.find((item) => item.id === id);
      if (course) course.isActive = isActive;
    }
    if (collection === "sessions") {
      const session = data.courses.flatMap((course) => course.sessions).find((item) => item.id === id);
      if (session) session.isActive = isActive;
      const courseSession = data.courseSessions?.find((item) => item.id === id);
      if (courseSession) courseSession.status = isActive ? (courseSession.status ?? "scheduled") : "cancelled";
    }
    if (collection === "students") {
      const student = data.students?.find((item) => item.id === id);
      if (student) student.isActive = isActive;
    }
    if (collection === "courseSeries") {
      const series = data.courseSeries?.find((item) => item.id === id);
      if (series) series.isActive = isActive;
    }
    if (collection === "courseOfferings") {
      const offering = data.courseOfferings?.find((item) => item.id === id);
      if (offering) {
        offering.isActive = isActive;
        offering.bookingOpen = isActive;
        offering.status = isActive ? (offering.status === "draft" ? "draft" : "open") : "closed";
      }
      const course = data.courses.find((item) => item.offeringId === id || item.id === id);
      if (course) {
        course.isActive = isActive;
        course.bookingOpen = isActive;
        course.status = isActive ? (course.status === "draft" ? "draft" : "open") : "closed";
      }
    }
    writeBookingData(data);
  };

  const db = getFirestoreDb();
  if (!db) {
    applyLocal();
    return;
  }

  try {
    const payload: Record<string, unknown> = { isActive };
    if (collection === "courseOfferings") {
      payload.bookingOpen = isActive;
      payload.status = isActive ? "open" : "closed";
    }
    await db.collection(collection).doc(id).set(payload, { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Active-state write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore active-state write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}

export async function deleteManagedDocument(collection: "categories" | "courses" | "courseSeries" | "courseOfferings", id: string) {
  const applyLocal = () => {
    const data = readBookingData();
    if (collection === "categories") data.categories = data.categories.filter((item) => item.id !== id);
    if (collection === "courses") data.courses = data.courses.filter((item) => item.id !== id);
    if (collection === "courseSeries") data.courseSeries = (data.courseSeries ?? []).filter((item) => item.id !== id);
    if (collection === "courseOfferings") {
      data.courseOfferings = (data.courseOfferings ?? []).filter((item) => item.id !== id);
      data.courses = data.courses.filter((item) => item.offeringId !== id && item.id !== id);
    }
    writeBookingData(data);
  };

  const db = getFirestoreDb();
  if (!db) {
    applyLocal();
    return;
  }

  try {
    await db.collection(collection).doc(id).delete();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Managed document delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore managed document delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}

export async function deleteSessionAndReservations(sessionId: string) {
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();

    for (const course of data.courses) {
      course.sessions = course.sessions.filter((session) => session.id !== sessionId);
    }

    data.reservations = data.reservations.filter((reservation) => reservation.sessionId !== sessionId);
    data.courseSessions = data.courseSessions?.filter((session) => session.id !== sessionId) ?? [];
    data.attendanceRecords = data.attendanceRecords?.filter((record) => record.sessionId !== sessionId) ?? [];

    writeBookingData(data);
    return;
  }

  try {
    const [reservationSnapshot, attendanceSnapshot] = await Promise.all([
      db.collection("reservations").where("sessionId", "==", sessionId).get(),
      db.collection("attendanceRecords").where("sessionId", "==", sessionId).get(),
    ]);

    const docs = [
      ...reservationSnapshot.docs,
      ...attendanceSnapshot.docs,
      db.collection("sessions").doc(sessionId),
      db.collection("courseSessions").doc(sessionId),
    ];

    for (let index = 0; index < docs.length; index += 450) {
      const batch = db.batch();
      docs.slice(index, index + 450).forEach((docOrRef) => {
        const ref = "ref" in docOrRef ? docOrRef.ref : docOrRef;
        batch.delete(ref);
      });
      await batch.commit();
    }
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Session delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore session delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();

    for (const course of data.courses) {
      course.sessions = course.sessions.filter((session) => session.id !== sessionId);
    }

    data.reservations = data.reservations.filter((reservation) => reservation.sessionId !== sessionId);
    data.courseSessions = data.courseSessions?.filter((session) => session.id !== sessionId) ?? [];
    data.attendanceRecords = data.attendanceRecords?.filter((record) => record.sessionId !== sessionId) ?? [];

    writeBookingData(data);
  }
}

export async function deleteCourseSessionsAndReservations(courseId: string) {
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const course = data.courses.find((item) => item.id === courseId);
    const sessionIds = new Set([
      ...(course?.sessions.map((session) => session.id) ?? []),
      ...(data.courseSessions?.filter((session) => session.offeringId === courseId || session.legacyCourseId === courseId).map((session) => session.id) ?? []),
    ]);

    if (course) course.sessions = [];

    data.reservations = data.reservations.filter(
      (reservation) => reservation.courseId !== courseId && !sessionIds.has(reservation.sessionId),
    );
    data.courseSessions = data.courseSessions?.filter(
      (session) => session.offeringId !== courseId && session.legacyCourseId !== courseId && !sessionIds.has(session.id),
    ) ?? [];
    data.attendanceRecords = data.attendanceRecords?.filter(
      (record) => record.offeringId !== courseId && !sessionIds.has(record.sessionId),
    ) ?? [];

    writeBookingData(data);
    return;
  }

  try {
    const [sessionSnapshot, courseSessionSnapshot, reservationSnapshot, attendanceSnapshot] = await Promise.all([
      db.collection("sessions").where("courseId", "==", courseId).get(),
      db.collection("courseSessions").where("offeringId", "==", courseId).get(),
      db.collection("reservations").where("courseId", "==", courseId).get(),
      db.collection("attendanceRecords").where("offeringId", "==", courseId).get(),
    ]);

    const docs = [
      ...sessionSnapshot.docs,
      ...courseSessionSnapshot.docs,
      ...reservationSnapshot.docs,
      ...attendanceSnapshot.docs,
    ];

    for (let index = 0; index < docs.length; index += 450) {
      const batch = db.batch();
      docs.slice(index, index + 450).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course sessions delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course sessions delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const course = data.courses.find((item) => item.id === courseId);
    const sessionIds = new Set([
      ...(course?.sessions.map((session) => session.id) ?? []),
      ...(data.courseSessions?.filter((session) => session.offeringId === courseId || session.legacyCourseId === courseId).map((session) => session.id) ?? []),
    ]);

    if (course) course.sessions = [];

    data.reservations = data.reservations.filter(
      (reservation) => reservation.courseId !== courseId && !sessionIds.has(reservation.sessionId),
    );
    data.courseSessions = data.courseSessions?.filter(
      (session) => session.offeringId !== courseId && session.legacyCourseId !== courseId && !sessionIds.has(session.id),
    ) ?? [];
    data.attendanceRecords = data.attendanceRecords?.filter(
      (record) => record.offeringId !== courseId && !sessionIds.has(record.sessionId),
    ) ?? [];

    writeBookingData(data);
  }
}


export type CourseOfferingCascadeDeleteResult = {
  ok: true;
  offeringId: string;
  legacyCourseIds: string[];
  deleted: {
    courseOfferings: number;
    courses: number;
    courseSessions: number;
    students: number;
    enrollments: number;
    reservations: number;
    attendanceRecords: number;
    studentCourseRecords: number;
    entitlements: number;
  };
};

function getCourseOfferingCascadeTargets(data: BookingData, offeringId: string) {
  const offering = data.courseOfferings?.find((item) => item.id === offeringId);
  const legacyCourseIds = new Set<string>();

  if (offering?.legacyCourseId) legacyCourseIds.add(offering.legacyCourseId);
  for (const course of data.courses ?? []) {
    if (course.offeringId === offeringId || course.id === offering?.legacyCourseId) legacyCourseIds.add(course.id);
  }

  const courseSessionIds = new Set<string>();
  for (const course of data.courses ?? []) {
    if (legacyCourseIds.has(course.id) || course.offeringId === offeringId) {
      for (const session of course.sessions ?? []) courseSessionIds.add(session.id);
    }
  }
  for (const session of data.courseSessions ?? []) {
    if (session.offeringId === offeringId || (session.legacyCourseId && legacyCourseIds.has(session.legacyCourseId))) courseSessionIds.add(session.id);
  }

  return { legacyCourseIds, courseSessionIds };
}

export async function deleteCourseOfferingCascade(offeringId: string): Promise<CourseOfferingCascadeDeleteResult> {
  const applyLocal = () => {
    const data = readBookingData();
    const { legacyCourseIds, courseSessionIds } = getCourseOfferingCascadeTargets(data, offeringId);

    const deleted = {
      courseOfferings: data.courseOfferings?.filter((item) => item.id === offeringId).length ?? 0,
      courses: data.courses?.filter((item) => item.offeringId === offeringId || legacyCourseIds.has(item.id)).length ?? 0,
      courseSessions: data.courseSessions?.filter((item) => item.offeringId === offeringId || (item.legacyCourseId && legacyCourseIds.has(item.legacyCourseId)) || courseSessionIds.has(item.id)).length ?? 0,
      students: 0,
      enrollments: data.enrollments?.filter((item) => item.offeringId === offeringId || item.courseOfferingId === offeringId || (item.courseId && legacyCourseIds.has(item.courseId))).length ?? 0,
      reservations: data.reservations?.filter((item) => item.offeringId === offeringId || legacyCourseIds.has(item.courseId) || courseSessionIds.has(item.sessionId)).length ?? 0,
      attendanceRecords: data.attendanceRecords?.filter((item) => {
        const record = item as AttendanceRecord & { courseId?: string };
        return (
          record.offeringId === offeringId ||
          (record.courseId ? legacyCourseIds.has(record.courseId) : false) ||
          (record.sessionId ? courseSessionIds.has(record.sessionId) : false) ||
          (record.courseSessionId ? courseSessionIds.has(record.courseSessionId) : false)
        );
      }).length ?? 0,
      studentCourseRecords: data.studentCourseRecords?.filter((item) => item.offeringId === offeringId || (item.courseId && legacyCourseIds.has(item.courseId))).length ?? 0,
      entitlements: data.entitlements?.filter((item) => item.offeringId === offeringId).length ?? 0,
    };

    data.courseOfferings = (data.courseOfferings ?? []).filter((item) => item.id !== offeringId);
    data.courses = (data.courses ?? []).filter((item) => item.offeringId !== offeringId && !legacyCourseIds.has(item.id));
    data.courseSessions = (data.courseSessions ?? []).filter((item) => item.offeringId !== offeringId && !(item.legacyCourseId && legacyCourseIds.has(item.legacyCourseId)) && !courseSessionIds.has(item.id));
    data.enrollments = (data.enrollments ?? []).filter((item) => item.offeringId !== offeringId && item.courseOfferingId !== offeringId && !(item.courseId && legacyCourseIds.has(item.courseId)));
    data.reservations = (data.reservations ?? []).filter((item) => item.offeringId !== offeringId && !legacyCourseIds.has(item.courseId) && !courseSessionIds.has(item.sessionId));
    data.attendanceRecords = (data.attendanceRecords ?? []).filter((item) => {
      const record = item as AttendanceRecord & { courseId?: string };
      return (
        record.offeringId !== offeringId &&
        !(record.courseId && legacyCourseIds.has(record.courseId)) &&
        !(record.sessionId && courseSessionIds.has(record.sessionId)) &&
        !(record.courseSessionId && courseSessionIds.has(record.courseSessionId))
      );
    });
    data.studentCourseRecords = (data.studentCourseRecords ?? []).filter((item) => item.offeringId !== offeringId && !(item.courseId && legacyCourseIds.has(item.courseId)));
    data.entitlements = (data.entitlements ?? []).filter((item) => item.offeringId !== offeringId);

    writeBookingData(data);
    return { ok: true as const, offeringId, legacyCourseIds: Array.from(legacyCourseIds), deleted };
  };

  const db = getFirestoreDb();
  if (!db) return applyLocal();

  try {
    const legacyCourseIds = new Set<string>();
    const courseSessionIds = new Set<string>();
    const offeringDoc = await db.collection("courseOfferings").doc(offeringId).get();
    if (offeringDoc.exists) {
      const off = offeringDoc.data();
      if (off?.legacyCourseId) legacyCourseIds.add(off.legacyCourseId);
    }

    const coursesSnap = await db.collection("courses").where("offeringId", "==", offeringId).get();
    coursesSnap.docs.forEach((doc) => {
      legacyCourseIds.add(doc.id);
      const sessions = doc.data()?.sessions;
      if (Array.isArray(sessions)) {
        sessions.forEach((session) => {
          if (session?.id) courseSessionIds.add(String(session.id));
        });
      }
    });

    const courseSessionsSnap = await db.collection("courseSessions").where("offeringId", "==", offeringId).get();
    courseSessionsSnap.docs.forEach((doc) => courseSessionIds.add(doc.id));

    const sessionsSnap = await db.collection("sessions").where("offeringId", "==", offeringId).get();
    sessionsSnap.docs.forEach((doc) => courseSessionIds.add(doc.id));

    for (const cid of legacyCourseIds) {
      const csSnap = await db.collection("courseSessions").where("legacyCourseId", "==", cid).get();
      csSnap.docs.forEach((doc) => courseSessionIds.add(doc.id));

      const sSnap = await db.collection("sessions").where("legacyCourseId", "==", cid).get();
      sSnap.docs.forEach((doc) => courseSessionIds.add(doc.id));
    }

    for (const cid of legacyCourseIds) {
      const sessionsByCourseSnap = await db.collection("sessions").where("courseId", "==", cid).get();
      sessionsByCourseSnap.docs.forEach((doc) => courseSessionIds.add(doc.id));
    }

    const refs = new Map<string, any>();

    const collect = async (collection: string, field: string, value: string) => {
      if (!value) return;
      const snapshot = await db.collection(collection).where(field, "==", value).get();
      snapshot.docs.forEach((doc) => refs.set(doc.ref.path, doc.ref));
    };

    if (offeringId) {
      refs.set(`courseOfferings/${offeringId}`, db.collection("courseOfferings").doc(offeringId));
      await collect("courses", "offeringId", offeringId);
      await collect("courseSessions", "offeringId", offeringId);
      await collect("sessions", "offeringId", offeringId);
      await collect("enrollments", "offeringId", offeringId);
      await collect("enrollments", "courseOfferingId", offeringId);
      await collect("reservations", "offeringId", offeringId);
      await collect("attendanceRecords", "offeringId", offeringId);
      await collect("studentCourseRecords", "offeringId", offeringId);
      await collect("entitlements", "offeringId", offeringId);
    }

    for (const legacyCourseId of legacyCourseIds) {
      if (!legacyCourseId) continue;
      refs.set(`courses/${legacyCourseId}`, db.collection("courses").doc(legacyCourseId));
      await collect("sessions", "courseId", legacyCourseId);
      await collect("enrollments", "courseId", legacyCourseId);
      await collect("reservations", "courseId", legacyCourseId);
      await collect("attendanceRecords", "courseId", legacyCourseId);
      await collect("studentCourseRecords", "courseId", legacyCourseId);
    }

    for (const sessionId of courseSessionIds) {
      if (!sessionId) continue;
      refs.set(`courseSessions/${sessionId}`, db.collection("courseSessions").doc(sessionId));
      refs.set(`sessions/${sessionId}`, db.collection("sessions").doc(sessionId));
      await collect("reservations", "sessionId", sessionId);
      await collect("attendanceRecords", "sessionId", sessionId);
      await collect("attendanceRecords", "courseSessionId", sessionId);
    }

    const refList = Array.from(refs.values()).filter(Boolean);
    for (let index = 0; index < refList.length; index += 450) {
      const batch = db.batch();
      refList.slice(index, index + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    return applyLocal();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Course offering cascade delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore course offering cascade delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    return applyLocal();
  }
}

function buildReservation(
  input: CreateReservationInput & { studentId?: string },
  course: Course | undefined,
  session: CourseSession | undefined,
  resolvedPolicy: string,
  resolvedQuotaGroupId: string,
): Reservation {
  const idNumberLast3 = cleanIdentityLast3(input.idNumberLast3);
  const phoneLastThree = cleanIdentityLast3(input.phoneLastThree) || idNumberLast3;
  const cycleKey = session?.date ? getBookingCycleKey(session.date) : "";

  return {
    id: `r-${randomUUID()}`,
    courseId: input.courseId,
    sessionId: input.sessionId,
    studentName: input.studentName,
    phoneLastThree,
    idNumberLast3,
    studentId: input.studentId,
    bookedAt: buildTimestamp(),
    status: "booked",
    attendanceStatus: "pending",
    bookingCycleKey: cycleKey,
    bookingQuotaGroupId: resolvedQuotaGroupId,
    bookingPolicy: resolvedPolicy,
  };
}

export async function deleteStudentIdentityDocument(studentId: string) {
  const applyLocal = () => {
    const data = readBookingData();
    data.students = (data.students ?? []).filter((student) => student.id !== studentId);
    writeBookingData(data);
  };

  const db = getFirestoreDb();
  if (!db) {
    applyLocal();
    return;
  }

  try {
    await db.collection("students").doc(studentId).delete();
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Student delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore student delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}

export function buildSessionDeadline(date: string) {
  const cutoff = getReservationCutoff({ date });
  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, "0");
  const day = String(cutoff.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} 18:00`;
}

function buildTimestamp() {
  return new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}


export async function upsertInstructor(instructor: Instructor) {
  const db = getFirestoreDb();
  if (!db) {
    const data = readBookingData();
    const instructors = data.instructors ?? [];
    const index = instructors.findIndex((item) => item.id === instructor.id);
    if (index >= 0) instructors[index] = { ...instructors[index], ...instructor };
    else instructors.push(instructor);
    writeBookingData({ ...data, instructors });
    return;
  }

  try {
    await db.collection("instructors").doc(instructor.id).set(removeUndefinedFields(instructor), { merge: true });
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Instructor write failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore instructor write failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    const data = readBookingData();
    const instructors = data.instructors ?? [];
    const index = instructors.findIndex((item) => item.id === instructor.id);
    if (index >= 0) instructors[index] = { ...instructors[index], ...instructor };
    else instructors.push(instructor);
    writeBookingData({ ...data, instructors });
  }
}

export async function deleteInstructorIdentityDocument(instructorId: string) {
  const now = new Date().toISOString();

  const applyLocal = () => {
    const data = readBookingData();
    const instructors = data.instructors ?? [];
    const index = instructors.findIndex((item) => item.id === instructorId);
    if (index >= 0) {
      instructors[index] = { ...instructors[index], isActive: false, updatedAt: now };
      writeBookingData({ ...data, instructors });
    }
  };

  const db = getFirestoreDb();
  if (!db) {
    applyLocal();
    return;
  }

  try {
    await db.collection("instructors").doc(instructorId).set(
      {
        isActive: false,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (error) {
    if (!shouldFallbackToJson()) {
      throw createFirestoreRequiredError("Instructor delete failed.", error);
    }
    console.warn("[DATA_SOURCE] ⚠️ Firestore instructor delete failed, falling back to local JSON. Error: " + (error instanceof Error ? error.message : String(error)));
    applyLocal();
  }
}

export async function getDataSourceStatus() {
  const db = getFirestoreDb();
  const runtime = process.env.NODE_ENV || "development";
  const bookingDataSource = process.env.BOOKING_DATA_SOURCE || "local-json";
  const usingFirestore = db !== null;

  let counts = {
    courses: 0,
    students: 0,
    reservations: 0,
    enrollments: 0,
  };

  try {
    const data = await getBookingData();
    counts = {
      courses: data.courses?.length || 0,
      students: data.students?.length || 0,
      reservations: data.reservations?.length || 0,
      enrollments: data.enrollments?.length || 0,
    };
  } catch (err) {
    console.error("Failed to load booking data counts for status banner", err);
  }

  return {
    runtime,
    bookingDataSource,
    usingFirestore,
    counts,
    updatedAt: new Date().toISOString(),
  };
}

export async function generateNextStudentNumber(db: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  const rocYear = String(currentYear - 1911); // e.g. "115", "116"

  if (!db) {
    // Fallback to local JSON mode
    const data = readBookingData();
    const prefix = `${rocYear}-`;
    let maxSeq = 0;
    for (const student of data.students ?? []) {
      const memberNo = student.memberNo || student.memberId || student.externalMemberNo || "";
      if (memberNo.startsWith(prefix)) {
        const seqStr = memberNo.substring(prefix.length);
        const seq = parseInt(seqStr, 10);
        if (Number.isFinite(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `${rocYear}-${String(nextSeq).padStart(4, "0")}`;
  }

  // Firestore transaction mode
  const counterRef = db.collection("counters").doc("studentNumber");
  
  let nextSeq = 1;
  await db.runTransaction(async (transaction: any) => {
    const doc = await transaction.get(counterRef);
    let currentCounter = 0;
    
    if (doc.exists) {
      const data = doc.data();
      if (data && typeof data[rocYear] === "number") {
        currentCounter = data[rocYear];
      }
    }
    
    if (currentCounter === 0) {
      const prefix = `${rocYear}-`;
      const snapshot = await db.collection("students")
        .where("memberNo", ">=", prefix)
        .where("memberNo", "<", prefix + "\uf8ff")
        .get();
        
      let maxSeq = 0;
      snapshot.docs.forEach((studentDoc: any) => {
        const student = studentDoc.data();
        const memberNo = student.memberNo || "";
        if (memberNo.startsWith(prefix)) {
          const seqStr = memberNo.substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (Number.isFinite(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      });
      currentCounter = maxSeq;
    }
    
    nextSeq = currentCounter + 1;
    transaction.set(counterRef, { [rocYear]: nextSeq }, { merge: true });
  });
  
  return `${rocYear}-${String(nextSeq).padStart(4, "0")}`;
}
