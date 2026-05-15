import type { Course, CourseSession, CourseStatus } from "./types";

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

  if (session.bookedCount >= session.capacity) {
    return "full";
  }

  return "available";
}

export function getRemainingSeats(session: CourseSession) {
  return Math.max(session.capacity - session.bookedCount, 0);
}
