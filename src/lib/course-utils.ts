import type { Course, CourseSession, CourseStatus } from "./types";

const taipeiTimeZone = "Asia/Taipei";

export function getCategoryName(categoryId: string, categories: { id: string; name: string }[]) {
  return categories.find((category) => category.id === categoryId)?.name ?? "未分類";
}

export function getCourse(courseId: string, courses: Course[]) {
  return courses.find((course) => course.id === courseId);
}

export function getSession(sessionId: string, courses: Course[]) {
  return courses
    .flatMap((course) => course.sessions)
    .find((session) => session.id === sessionId);
}

export function getCourseStatus(course: Course): CourseStatus {
  const activeSessions = course.sessions.filter((session) => session.isActive);

  if (!course.isActive || activeSessions.length === 0) {
    return "closed";
  }

  const hasSeat = activeSessions.some((session) => session.bookedCount < session.capacity);

  return hasSeat ? "available" : "full";
}

export function getSessionStatus(session: CourseSession): CourseStatus {
  if (!session.isActive) {
    return "closed";
  }

  if (!canChangeReservation(session)) {
    return "closed";
  }

  if (session.bookedCount >= session.capacity) {
    return "full";
  }

  return "available";
}

export function getRemainingSeats(session: CourseSession) {
  return Math.max(session.capacity - session.bookedCount, 0);
}

export function getReservationCutoff(session: Pick<CourseSession, "date">) {
  const cutoff = new Date(`${session.date}T18:00:00+08:00`);
  cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
}

export function formatReservationCutoff(session: Pick<CourseSession, "date">) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: taipeiTimeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(getReservationCutoff(session));
}

export function canChangeReservation(session: Pick<CourseSession, "date">, now = new Date()) {
  return now.getTime() <= getReservationCutoff(session).getTime();
}

export function getWeekday(date: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: taipeiTimeZone, weekday: "short" }).format(new Date(`${date}T00:00:00+08:00`));
}
