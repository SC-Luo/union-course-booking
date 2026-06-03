import { randomUUID } from "node:crypto";
import { normalizeBookingData, readBookingData, writeBookingData } from "./data-store";
import { getAdminDb } from "./firebase-admin";
import { canChangeReservation, getReservationCutoff } from "./course-utils";
import type { AttendanceStatus, BookingData, Course, CourseCategory, CourseOffering, CourseSeries, CourseSession, Enrollment, Reservation, Student, StudentCourseRecord, Instructor } from "./types";

function shouldUseFirestore() {
  return process.env.BOOKING_DATA_SOURCE === "firestore";
}

function getFirestoreDb() {
  if (!shouldUseFirestore()) {
    return null;
  }

  try {
    return getAdminDb();
  } catch (error) {
    console.warn("Firestore initialization failed, falling back to local booking data.", error);
    return null;
  }
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
      db.collection("students").orderBy("seatNumber", "asc").get(),
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
    const students = studentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Student);
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
    console.warn("Firestore read failed, falling back to local booking data.", error);
    return readBookingData();
  }
}

export async function getCourseCatalog(): Promise<Pick<BookingData, "categories" | "courses">> {
  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    return { categories: data.categories, courses: data.courses };
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
    return { categories: normalized.categories, courses: normalized.courses };
  } catch (error) {
    console.warn("Firestore catalog read failed, falling back to local booking data.", error);
    const data = readBookingData();
    return { categories: data.categories, courses: data.courses };
  }
}

export async function findReservationsByStudent(studentName: string, phoneLastThree = ""): Promise<Reservation[]> {
  const idNumberLast3 = cleanIdentityLast3(phoneLastThree);
  if (!studentName) {
    return [];
  }
  const matchesStudent = (reservation: Reservation) =>
    normalizeName(reservation.studentName) === normalizeName(studentName) &&
    (!idNumberLast3 || cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) === idNumberLast3);

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    return data.reservations.filter(matchesStudent);
  }

  try {
    let query = db.collection("reservations").where("studentName", "==", studentName);
    if (idNumberLast3) {
      query = query.where("phoneLastThree", "==", idNumberLast3);
    }
    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reservation);
  } catch (error) {
    console.warn("Firestore reservation search failed, falling back to local booking data.", error);
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
    (enrollment.courseOfferingId ? offeringCandidates.has(enrollment.courseOfferingId) : false);
  const seriesMatches =
    (enrollment.seriesId ? seriesCandidates.has(enrollment.seriesId) : false) ||
    (enrollment.courseMasterId ? seriesCandidates.has(enrollment.courseMasterId) : false);

  return offeringMatches || seriesMatches;
}

function findEligibleStudentInData(data: BookingData, course: Course, session: CourseSession, studentName: string) {
  const normalizedName = normalizeName(studentName);
  if (!normalizedName) return null;

  const matchedStudents = (data.students ?? []).filter(
    (student) => normalizeName(student.name) === normalizedName && student.isActive !== false,
  );

  return matchedStudents.find((student) =>
    (data.enrollments ?? []).some((enrollment) => enrollment.studentId === student.id && isEffectiveEnrollment(enrollment, course, session)),
  ) ?? null;
}

function isSessionBookable(session: CourseSession) {
  const status = session.status ?? "scheduled";
  return ["scheduled", "rescheduled", "makeup", ""].includes(status);
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

      const studentSnapshot = await transaction.get(
        db.collection("students").where("name", "==", input.studentName).limit(20),
      );
      const candidateStudents = studentSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Student)
        .filter((student) => student.isActive !== false);

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
        return { ok: false as const, reason: "not_roster" };
      }

      const duplicateSnapshot = await transaction.get(
        db
          .collection("reservations")
          .where("courseId", "==", course.id)
          .where("studentId", "==", eligibleStudent.id)
          .where("status", "==", "booked")
          .limit(1),
      );

      if (!duplicateSnapshot.empty) {
        return { ok: false as const, reason: "duplicate" };
      }

      if (!course.isActive || !session.isActive || !isSessionBookable(session) || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
        return { ok: false as const, reason: "closed" };
      }

      const studentLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3) || cleanIdentityLast3(eligibleStudent.phone).slice(-3);
      const reservation = buildReservation({ ...input, phoneLastThree: studentLast3, idNumberLast3: studentLast3, studentId: eligibleStudent.id } as CreateReservationInput & { studentId?: string });
      transaction.create(db.collection("reservations").doc(reservation.id), reservation);
      transaction.update(sessionRef, { bookedCount: session.bookedCount + 1 });

      return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
    });
  } catch (error) {
    console.warn("Firestore reservation write failed, falling back to local booking data.", error);
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

    console.warn(`Reservation document not found for attendance update: ${reservationId}`);
    applyLocalFallback();
  } catch (error) {
    console.warn("Firestore attendance update failed, falling back to local booking data.", error);
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
      `Reservation document not found for attendance update: ${reservationId} (${sessionId}/${studentId})`,
    );
    applyLocalFallback();
  } catch (error) {
    console.warn("Firestore attendance update failed, falling back to local booking data.", error);
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
    console.warn("Firestore batch attendance update failed, falling back to local booking data.", error);
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

    console.warn(`Reservation document not found for lesson note update: ${reservationId}`);
    applyLocalFallback();
  } catch (error) {
    console.warn("Firestore lesson note update failed, falling back to local booking data.", error);
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
    console.warn("Firestore roster reservation ensure failed, falling back to local booking data.", error);
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
      (phoneLastThree && cleanIdentityLast3(reservation.idNumberLast3 ?? reservation.phoneLastThree) !== cleanIdentityLast3(phoneLastThree)) ||
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
    console.warn("Firestore reservation cancel failed, falling back to local booking data.", error);
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
    console.warn("Firestore staff reservation cancel failed, falling back to local booking data.", error);
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

  const eligibleStudent = findEligibleStudentInData(data, course, session, input.studentName);

  if (!eligibleStudent) {
    return { ok: false as const, reason: "not_roster" };
  }

  const hasDuplicate = data.reservations.some(
    (reservation) =>
      reservation.courseId === course.id &&
      reservation.status === "booked" &&
      (reservation.studentId === eligibleStudent.id ||
        normalizeName(reservation.studentName) === normalizeName(input.studentName)),
  );

  if (hasDuplicate) {
    return { ok: false as const, reason: "duplicate" };
  }

  if (!course.isActive || !session.isActive || !isSessionBookable(session) || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
    return { ok: false as const, reason: "closed" };
  }

  const studentLast3 = cleanIdentityLast3(eligibleStudent.idNumberLast3) || cleanIdentityLast3(eligibleStudent.phone).slice(-3);
  const reservation = buildReservation({ ...input, phoneLastThree: studentLast3, idNumberLast3: studentLast3, studentId: eligibleStudent.id } as CreateReservationInput & { studentId?: string });
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
      (!phoneLastThree || cleanIdentityLast3(item.idNumberLast3 ?? item.phoneLastThree) === cleanIdentityLast3(phoneLastThree)) &&
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
    await db.collection("categories").doc(category.id).set(category, { merge: true });
  } catch (error) {
    console.warn("Firestore category write failed, falling back to local booking data.", error);
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
    await db.collection("courses").doc(course.id).set(course, { merge: true });
  } catch (error) {
    console.warn("Firestore course write failed, falling back to local booking data.", error);
    const data = readBookingData();
    const index = data.courses.findIndex((item) => item.id === course.id);
    if (index >= 0) data.courses[index] = { ...data.courses[index], ...course };
    else data.courses.push({ ...course, sessions: [] });
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
    await db.collection("sessions").doc(session.id).set(session, { merge: true });
  } catch (error) {
    console.warn("Firestore session write failed, falling back to local booking data.", error);
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
    await db.collection("courseSeries").doc(series.id).set(series, { merge: true });
  } catch (error) {
    console.warn("Firestore course series write failed, falling back to local booking data.", error);
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
    await db.collection("courseOfferings").doc(offering.id).set(offering, { merge: true });
  } catch (error) {
    console.warn("Firestore course offering write failed, falling back to local booking data.", error);
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
    await db.collection("students").doc(student.id).set(student, { merge: true });
  } catch (error) {
    console.warn("Firestore student write failed, falling back to local booking data.", error);
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
    await db.collection("enrollments").doc(enrollment.id).set(enrollment, { merge: true });
  } catch (error) {
    console.warn("Firestore enrollment write failed, falling back to local booking data.", error);
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
    await db.collection("studentCourseRecords").doc(record.id).set(record, { merge: true });
  } catch (error) {
    console.warn("Firestore student course record write failed, falling back to local booking data.", error);
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
    console.warn("Firestore student course eligibility delete failed, falling back to local booking data.", error);
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
    // Firestore 模式先用現有讀寫 fallback，避免點名現場因權限或交易問題中斷。
    return applyLocal();
  } catch (error) {
    console.warn("Firestore add student to session roster failed, falling back to local booking data.", error);
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
    console.warn("Firestore active-state write failed, falling back to local booking data.", error);
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
    console.warn("Firestore managed document delete failed, falling back to local booking data.", error);
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
    console.warn("Firestore session delete failed, falling back to local booking data.", error);
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
    console.warn("Firestore course sessions delete failed, falling back to local booking data.", error);
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

  const studentIds = new Set<string>();
  for (const student of data.students ?? []) {
    if (student.offeringId === offeringId || (student.classId && legacyCourseIds.has(student.classId))) studentIds.add(student.id);
  }

  return { legacyCourseIds, courseSessionIds, studentIds };
}

export async function deleteCourseOfferingCascade(offeringId: string): Promise<CourseOfferingCascadeDeleteResult> {
  const applyLocal = () => {
    const data = readBookingData();
    const { legacyCourseIds, courseSessionIds, studentIds } = getCourseOfferingCascadeTargets(data, offeringId);

    const deleted = {
      courseOfferings: data.courseOfferings?.filter((item) => item.id === offeringId).length ?? 0,
      courses: data.courses?.filter((item) => item.offeringId === offeringId || legacyCourseIds.has(item.id)).length ?? 0,
      courseSessions: data.courseSessions?.filter((item) => item.offeringId === offeringId || (item.legacyCourseId && legacyCourseIds.has(item.legacyCourseId)) || courseSessionIds.has(item.id)).length ?? 0,
      students: data.students?.filter((item) => item.offeringId === offeringId || (item.classId && legacyCourseIds.has(item.classId)) || studentIds.has(item.id)).length ?? 0,
      enrollments: data.enrollments?.filter((item) => item.offeringId === offeringId || item.courseOfferingId === offeringId || studentIds.has(item.studentId)).length ?? 0,
      reservations: data.reservations?.filter((item) => item.offeringId === offeringId || legacyCourseIds.has(item.courseId) || courseSessionIds.has(item.sessionId)).length ?? 0,
      attendanceRecords: data.attendanceRecords?.filter((item) => item.offeringId === offeringId || (item.sessionId && courseSessionIds.has(item.sessionId)) || studentIds.has(item.studentId)).length ?? 0,
      studentCourseRecords: data.studentCourseRecords?.filter((item) => item.offeringId === offeringId || studentIds.has(item.studentId)).length ?? 0,
      entitlements: data.entitlements?.filter((item) => item.offeringId === offeringId || studentIds.has(item.studentId)).length ?? 0,
    };

    data.courseOfferings = (data.courseOfferings ?? []).filter((item) => item.id !== offeringId);
    data.courses = (data.courses ?? []).filter((item) => item.offeringId !== offeringId && !legacyCourseIds.has(item.id));
    data.courseSessions = (data.courseSessions ?? []).filter((item) => item.offeringId !== offeringId && !(item.legacyCourseId && legacyCourseIds.has(item.legacyCourseId)) && !courseSessionIds.has(item.id));
    data.students = (data.students ?? []).filter((item) => item.offeringId !== offeringId && !(item.classId && legacyCourseIds.has(item.classId)) && !studentIds.has(item.id));
    data.enrollments = (data.enrollments ?? []).filter((item) => item.offeringId !== offeringId && item.courseOfferingId !== offeringId && !(item.courseId && legacyCourseIds.has(item.courseId)) && !studentIds.has(item.studentId));
    data.reservations = (data.reservations ?? []).filter((item) => item.offeringId !== offeringId && !legacyCourseIds.has(item.courseId) && !courseSessionIds.has(item.sessionId));
    data.attendanceRecords = (data.attendanceRecords ?? []).filter((item) => item.offeringId !== offeringId && !(item.sessionId && courseSessionIds.has(item.sessionId)) && !studentIds.has(item.studentId));
    data.studentCourseRecords = (data.studentCourseRecords ?? []).filter((item) => item.offeringId !== offeringId && !(item.courseId && legacyCourseIds.has(item.courseId)) && !studentIds.has(item.studentId));
    data.entitlements = (data.entitlements ?? []).filter((item) => item.offeringId !== offeringId && !studentIds.has(item.studentId));

    writeBookingData(data);
    return { ok: true as const, offeringId, legacyCourseIds: Array.from(legacyCourseIds), deleted };
  };

  const db = getFirestoreDb();
  if (!db) return applyLocal();

  try {
    const localData = readBookingData();
    const { legacyCourseIds, courseSessionIds, studentIds } = getCourseOfferingCascadeTargets(localData, offeringId);
    const refs = new Map<string, any>();

    const collect = async (collection: string, field: string, value: string) => {
      const snapshot = await db.collection(collection).where(field, "==", value).get();
      snapshot.docs.forEach((doc) => refs.set(doc.ref.path, doc.ref));
    };

    refs.set(`courseOfferings/${offeringId}`, db.collection("courseOfferings").doc(offeringId));
    await collect("courses", "offeringId", offeringId);
    await collect("courseSessions", "offeringId", offeringId);
    await collect("students", "offeringId", offeringId);
    await collect("enrollments", "offeringId", offeringId);
    await collect("enrollments", "courseOfferingId", offeringId);
    await collect("reservations", "offeringId", offeringId);
    await collect("attendanceRecords", "offeringId", offeringId);
    await collect("studentCourseRecords", "offeringId", offeringId);
    await collect("entitlements", "offeringId", offeringId);

    for (const legacyCourseId of legacyCourseIds) {
      refs.set(`courses/${legacyCourseId}`, db.collection("courses").doc(legacyCourseId));
      await collect("students", "classId", legacyCourseId);
      await collect("enrollments", "courseId", legacyCourseId);
      await collect("reservations", "courseId", legacyCourseId);
      await collect("studentCourseRecords", "courseId", legacyCourseId);
    }

    for (const sessionId of courseSessionIds) {
      refs.set(`courseSessions/${sessionId}`, db.collection("courseSessions").doc(sessionId));
      await collect("reservations", "sessionId", sessionId);
      await collect("attendanceRecords", "sessionId", sessionId);
    }

    for (const studentId of studentIds) {
      refs.set(`students/${studentId}`, db.collection("students").doc(studentId));
      await collect("enrollments", "studentId", studentId);
      await collect("attendanceRecords", "studentId", studentId);
      await collect("studentCourseRecords", "studentId", studentId);
      await collect("entitlements", "studentId", studentId);
    }

    const refList = Array.from(refs.values());
    for (let index = 0; index < refList.length; index += 450) {
      const batch = db.batch();
      refList.slice(index, index + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    return applyLocal();
  } catch (error) {
    console.warn("Firestore course offering cascade delete failed, falling back to local booking data.", error);
    return applyLocal();
  }
}

function buildReservation(input: CreateReservationInput & { studentId?: string }): Reservation {
  const idNumberLast3 = cleanIdentityLast3(input.idNumberLast3 ?? input.phoneLastThree);
  return {
    id: `r-${randomUUID()}`,
    courseId: input.courseId,
    sessionId: input.sessionId,
    studentName: input.studentName,
    phoneLastThree: idNumberLast3,
    idNumberLast3,
    studentId: input.studentId,
    bookedAt: buildTimestamp(),
    status: "booked",
    attendanceStatus: "pending",
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
    console.warn("Firestore student delete failed, falling back to local booking data.", error);
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
    await db.collection("instructors").doc(instructor.id).set(instructor, { merge: true });
  } catch (error) {
    console.warn("Firestore instructor write failed, falling back to local booking data.", error);
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
    console.warn("Firestore instructor delete failed, falling back to local booking data.", error);
    applyLocal();
  }
}
