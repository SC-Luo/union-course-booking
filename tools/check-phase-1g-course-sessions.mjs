import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repo = process.cwd();
const page = read(`${repo}/src/app/admin/course-sessions/page.tsx`);
const repository = read(`${repo}/src/lib/booking-repository.ts`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const courseSessionsLoader = section(
  repository,
  "export async function getAdminCourseSessionsPageData",
  "async function getStudentDirectoryCourseOptions",
).replace(/\s+/g, " ");

assert(
  page.includes("getAdminCourseSessionsPageData"),
  "course-sessions page must call getAdminCourseSessionsPageData.",
);
assert(
  !page.includes("getBookingData"),
  "course-sessions page must not call getBookingData.",
);
assert(
  !/getAdminCourseSessionsPageData\(\{[\s\S]*?source:/.test(page),
  "course-sessions page must not override the diagnostics source.",
);
assert(
  !courseSessionsLoader.includes("getBookingData"),
  "course-sessions loader must not call getBookingData.",
);

assert(
  !courseSessionsLoader.includes('.collection("students")'),
  "course-sessions loader must not read students.",
);
assert(
  !courseSessionsLoader.includes('.collection("studentCourseRecords")'),
  "course-sessions loader must not read studentCourseRecords.",
);
assert(
  !courseSessionsLoader.includes('.collection("enrollments")'),
  "course-sessions loader must not read enrollments.",
);
assert(
  !courseSessionsLoader.includes('.collection("attendanceRecords")'),
  "course-sessions loader must not read attendanceRecords.",
);
assert(
  !courseSessionsLoader.includes('.collection("reservations").get()'),
  "course-sessions loader must not full-read reservations.",
);

assert(
  new RegExp(
    '\\.collection\\("reservations"\\)\\s*\\.where\\("sessionId", "in", chunk\\)\\s*\\.where\\("status", "==", "booked"\\)\\s*\\.get\\(\\)',
  ).test(courseSessionsLoader),
  "reservations must use chunked where(sessionId in chunk && status == booked).",
);
assert(
  courseSessionsLoader.includes("chunkList(sessionIds, 30)"),
  "reservation query must chunk sessionIds with chunkList(..., 30).",
);
assert(
  courseSessionsLoader.includes("sessionIds.length > 0"),
  "loader must skip reservation queries when sessionIds is empty.",
);

assert(
  courseSessionsLoader.includes("getStaticBookingCollections"),
  "loader must reuse the shared static booking collections.",
);

assert(
  courseSessionsLoader.includes('source: options?.source ?? "getAdminCourseSessionsPageData"') &&
    courseSessionsLoader.includes('route: options?.route ?? "/admin/course-sessions"'),
  "course-sessions loader reads must be labeled with source/route.",
);
assert(
  courseSessionsLoader.includes("requestId: options?.requestId"),
  "course-sessions loader reads must share the requestId.",
);

console.log("Phase 1G course sessions guards passed.");