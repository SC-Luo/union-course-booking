import { randomUUID } from "node:crypto";
import { readBookingData, writeBookingData } from "./data-store";
import { getAdminDb } from "./firebase-admin";
import type { AttendanceStatus, BookingData, Course, CourseCategory, CourseSession, Reservation, Student } from "./types";

function shouldUseFirestore() {
  return process.env.BOOKING_DATA_SOURCE === "firestore";
}

function getFirestoreDb() {
  if (!shouldUseFirestore()) {
    return null;
  }

  return getAdminDb();
}

export async function getBookingData(): Promise<BookingData> {
  const db = getFirestoreDb();

  if (!db) {
    return readBookingData();
  }

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

  return { categories, courses, reservations, students };
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

    if (!course.isActive || !session.isActive || session.bookedCount >= session.capacity) {
      return { ok: false as const, reason: "closed" };
    }

    const reservation = buildReservation(input);
    session.bookedCount += 1;
    data.reservations.push(reservation);
    writeBookingData(data);

    return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
  }

  return db.runTransaction(async (transaction) => {
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

    if (!course.isActive || !session.isActive || session.bookedCount >= session.capacity) {
      return { ok: false as const, reason: "closed" };
    }

    const reservation = buildReservation(input);
    transaction.create(db.collection("reservations").doc(reservation.id), reservation);
    transaction.update(sessionRef, { bookedCount: session.bookedCount + 1 });

    return { ok: true as const, reservation, courseId: course.id, sessionId: session.id };
  });
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

  await db.collection("reservations").doc(reservationId).update({ attendanceStatus });
}

function buildReservation(input: CreateReservationInput): Reservation {
  const now = new Date();

  return {
    id: `r-${randomUUID()}`,
    courseId: input.courseId,
    sessionId: input.sessionId,
    studentName: input.studentName,
    phoneLastThree: input.phoneLastThree,
    bookedAt: now.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    status: "booked",
    attendanceStatus: "pending",
  };
}
