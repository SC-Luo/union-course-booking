import { randomUUID } from "node:crypto";
import { normalizeBookingData, readBookingData, writeBookingData } from "./data-store";
import { getAdminDb } from "./firebase-admin";
import { canChangeReservation, getReservationCutoff } from "./course-utils";
import type { AttendanceStatus, BookingData, Course, CourseCategory, CourseSession, Enrollment, Reservation, Student } from "./types";

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
    const [categorySnapshot, courseSnapshot, sessionSnapshot, reservationSnapshot, studentSnapshot] = await Promise.all([
      db.collection("categories").orderBy("sortOrder", "asc").get(),
      db.collection("courses").get(),
      db.collection("sessions").get(),
      db.collection("reservations").get(),
      db.collection("students").orderBy("seatNumber", "asc").get(),
    ]);

    const categories = categorySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseCategory);
    const sessions = sessionSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CourseSession);
    const reservations = reservationSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reservation);
    const students = studentSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Student);
    const courses = courseSnapshot.docs.map((doc) => {
      const course = { id: doc.id, ...doc.data() } as Omit<Course, "sessions">;

      return {
        ...course,
        sessions: sessions.filter((session) => session.courseId === course.id),
      };
    });

    return normalizeBookingData({ categories, courses, reservations, students });
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

export async function findReservationsByStudent(studentName: string, phoneLastThree: string): Promise<Reservation[]> {
  if (!studentName || phoneLastThree.length !== 3) {
    return [];
  }

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    return data.reservations.filter(
      (reservation) => reservation.studentName === studentName && reservation.phoneLastThree === phoneLastThree,
    );
  }

  try {
    const snapshot = await db
      .collection("reservations")
      .where("studentName", "==", studentName)
      .where("phoneLastThree", "==", phoneLastThree)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reservation);
  } catch (error) {
    console.warn("Firestore reservation search failed, falling back to local booking data.", error);
    const data = readBookingData();
    return data.reservations.filter(
      (reservation) => reservation.studentName === studentName && reservation.phoneLastThree === phoneLastThree,
    );
  }
}

type CreateReservationInput = {
  courseId: string;
  sessionId: string;
  studentName: string;
  phoneLastThree: string;
};

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

      if (!courseDoc.exists || !sessionDoc.exists || !input.studentName || input.phoneLastThree.length !== 3) {
        return { ok: false as const, reason: "invalid" };
      }

      const course = { id: courseDoc.id, ...courseDoc.data() } as Course;
      const session = { id: sessionDoc.id, ...sessionDoc.data() } as CourseSession;

      if (session.courseId !== course.id) {
        return { ok: false as const, reason: "invalid" };
      }

      const duplicateSnapshot = await transaction.get(
        db
          .collection("reservations")
          .where("courseId", "==", course.id)
          .where("studentName", "==", input.studentName)
          .where("phoneLastThree", "==", input.phoneLastThree)
          .where("status", "==", "booked")
          .limit(1),
      );

      if (!duplicateSnapshot.empty) {
        return { ok: false as const, reason: "duplicate" };
      }

      if (!course.isActive || !session.isActive || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
        return { ok: false as const, reason: "closed" };
      }

      const reservation = buildReservation(input);
      transaction.create(db.collection("reservations").doc(reservation.id), reservation);
      transaction.update(sessionRef, { bookedCount: session.bookedCount + 1 });

      return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
    });
  } catch (error) {
    console.warn("Firestore reservation write failed, falling back to local booking data.", error);
    return createReservationInJson(input);
  }
}

export async function updateReservationAttendance(reservationId: string, attendanceStatus: AttendanceStatus) {
  if (!["pending", "attended", "absent"].includes(attendanceStatus)) {
    return;
  }

  const db = getFirestoreDb();

  if (!db) {
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (reservation) {
      reservation.attendanceStatus = attendanceStatus;
      writeBookingData(data);
    }
    return;
  }

  try {
    await db.collection("reservations").doc(reservationId).update({ attendanceStatus });
  } catch (error) {
    console.warn("Firestore attendance update failed, falling back to local booking data.", error);
    const data = readBookingData();
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (reservation) {
      reservation.attendanceStatus = attendanceStatus;
      writeBookingData(data);
    }
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

    if (reservation.studentName !== studentName || reservation.phoneLastThree !== phoneLastThree || reservation.status !== "booked") {
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

  if (!course || !session || !input.studentName || input.phoneLastThree.length !== 3) {
    return { ok: false as const, reason: "invalid" };
  }

  const hasDuplicate = data.reservations.some(
    (reservation) =>
      reservation.courseId === course.id &&
      reservation.status === "booked" &&
      reservation.studentName === input.studentName &&
      reservation.phoneLastThree === input.phoneLastThree,
  );

  if (hasDuplicate) {
    return { ok: false as const, reason: "duplicate" };
  }

  if (!course.isActive || !session.isActive || !canChangeReservation(session) || session.bookedCount >= session.capacity) {
    return { ok: false as const, reason: "closed" };
  }

  const reservation = buildReservation(input);
  session.bookedCount += 1;
  data.reservations.push(reservation);
  writeBookingData(data);

  return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
}

function cancelReservationInJson(reservationId: string, studentName: string, phoneLastThree: string) {
  const data = readBookingData();
  const reservation = data.reservations.find(
    (item) => item.id === reservationId && item.studentName === studentName && item.phoneLastThree === phoneLastThree && item.status === "booked",
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

export async function setDocumentActive(collection: "categories" | "courses" | "sessions" | "students", id: string, isActive: boolean) {
  const db = getFirestoreDb();
  if (!db) {
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
    }
    if (collection === "students") {
      const student = data.students?.find((item) => item.id === id);
      if (student) student.isActive = isActive;
    }
    writeBookingData(data);
    return;
  }

  try {
    await db.collection(collection).doc(id).set({ isActive }, { merge: true });
  } catch (error) {
    console.warn("Firestore active-state write failed, falling back to local booking data.", error);
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
    }
    if (collection === "students") {
      const student = data.students?.find((item) => item.id === id);
      if (student) student.isActive = isActive;
    }
    writeBookingData(data);
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

function buildReservation(input: CreateReservationInput): Reservation {
  return {
    id: `r-${randomUUID()}`,
    courseId: input.courseId,
    sessionId: input.sessionId,
    studentName: input.studentName,
    phoneLastThree: input.phoneLastThree,
    bookedAt: buildTimestamp(),
    status: "booked",
    attendanceStatus: "pending",
  };
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
