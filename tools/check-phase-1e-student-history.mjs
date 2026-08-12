import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repo = process.cwd();
const page = read(`${repo}/src/app/admin/students/page.tsx`);
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

const historyBranch = section(
  page,
  '} else if (currentMode === "history") {',
  '} else if (currentMode === "eligibility") {',
);
const historyLoader = section(
  repository,
  "export async function getStudentHistoryPageData",
  "export async function findReservationsByStudent",
).replace(/\s+/g, " ");

assert(
  historyBranch.includes("getStudentHistoryPageData"),
  "history branch must call getStudentHistoryPageData.",
);
assert(
  !historyBranch.includes("getBookingData"),
  "history execution path must not call getBookingData.",
);
assert(
  page.includes("studentId: student.id"),
  "history link must carry studentId.",
);

assert(
  !historyLoader.includes('.collection("students").get()'),
  "history loader must not full-read students.",
);
assert(
  !historyLoader.includes('.collection("reservations").get()'),
  "history loader must not full-read reservations.",
);
assert(
  !historyLoader.includes('.collection("enrollments").get()'),
  "history loader must not full-read enrollments.",
);
assert(
  !historyLoader.includes('.collection("studentCourseRecords").get()'),
  "history loader must not full-read studentCourseRecords.",
);
assert(
  !historyLoader.includes('.collection("attendanceRecords").get()'),
  "history loader must not full-read attendanceRecords.",
);
assert(
  !historyLoader.includes("getLiveBookingCollections") &&
    !historyLoader.includes("getStaticBookingCollections"),
  "history loader must not use full-read collection helpers.",
);

assert(
  new RegExp(
    '\\.collection\\("reservations"\\)\\s*\\.where\\("studentId", "==", studentId\\)',
  ).test(historyLoader),
  "canonical reservation query must be reservations.where(studentId == sid).",
);
assert(
  new RegExp(
    '\\.collection\\("reservations"\\)\\s*\\.where\\("studentName", "==", studentName\\)\\s*\\.limit\\(50\\)',
  ).test(historyLoader),
  "legacy reservation compatibility must use a bounded studentName query.",
);
assert(
  historyLoader.includes("legacyReservationIds"),
  "canonical + legacy reservations must be deduped by document id.",
);
assert(
  historyLoader.includes("cleanIdentityLast3") &&
    historyLoader.includes("normalizeName"),
  "legacy reservations must apply the existing name + idNumberLast3 identity rule.",
);

console.log("Phase 1E student history guards passed.");
