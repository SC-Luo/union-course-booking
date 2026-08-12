import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repo = process.cwd();
const page = read(`${repo}/src/app/admin/students/[studentId]/page.tsx`);
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

const profileLoader = section(
  repository,
  "export async function getStudentProfilePageData",
  "export async function findReservationsByStudent",
).replace(/\s+/g, " ");

assert(
  page.includes("getStudentProfilePageData"),
  "profile page must call getStudentProfilePageData.",
);
assert(
  !page.includes("getBookingData"),
  "profile page execution path must not call getBookingData.",
);
assert(
  !profileLoader.includes("getBookingData"),
  "profile loader must not call getBookingData.",
);
assert(
  !profileLoader.includes("getLiveBookingCollections") &&
    !profileLoader.includes("getStaticBookingCollections"),
  "profile loader must not use full-read collection helpers.",
);

assert(
  !profileLoader.includes('.collection("students").get()'),
  "profile loader must not full-read students.",
);
assert(
  !profileLoader.includes('.collection("enrollments").get()'),
  "profile loader must not full-read enrollments.",
);
assert(
  !profileLoader.includes('.collection("reservations").get()'),
  "profile loader must not full-read reservations.",
);
assert(
  !profileLoader.includes('.collection("categories").get()') &&
    !profileLoader.includes('.collection("sessions").get()') &&
    !profileLoader.includes('.collection("courseSeries").get()') &&
    !profileLoader.includes('.collection("courseSessions").get()') &&
    !profileLoader.includes('.collection("instructors").get()') &&
    !profileLoader.includes('.collection("studentCourseRecords").get()') &&
    !profileLoader.includes('.collection("attendanceRecords").get()'),
  "profile loader must not full-read any unused collections.",
);

assert(
  new RegExp('\\.collection\\("students"\\)\\s*\\.doc\\(studentId\\)').test(
    profileLoader,
  ),
  "student lookup must be students.doc(studentId).",
);

assert(
  new RegExp(
    '\\.collection\\("enrollments"\\)\\s*\\.where\\("studentId", "==", student\\.id\\)',
  ).test(profileLoader),
  "enrollments query must be enrollments.where(studentId == sid).",
);

assert(
  profileLoader.includes("fetchStudentReservationsIdentitySafe("),
  "profile loader must reuse the shared identity-safe reservations helper.",
);
assert(
  new RegExp(
    '\\.collection\\("reservations"\\)\\s*\\.where\\("studentId", "==", studentId\\)',
  ).test(profileLoader),
  "canonical reservation query must be reservations.where(studentId == sid).",
);
assert(
  new RegExp(
    '\\.collection\\("reservations"\\)\\s*\\.where\\("studentName", "==", studentName\\)\\s*\\.limit\\(50\\)',
  ).test(profileLoader),
  "legacy reservation compatibility must use a bounded studentName query.",
);
assert(
  profileLoader.includes("legacyReservationIds"),
  "canonical + legacy reservations must be deduped by document id.",
);
assert(
  profileLoader.includes("cleanIdentityLast3") &&
    profileLoader.includes("normalizeName"),
  "legacy reservations must apply the existing name + idNumberLast3 identity rule.",
);

assert(
  profileLoader.includes('readDocumentsByIds(') &&
    profileLoader.includes('"courseOfferings"') &&
    profileLoader.includes('"courses"'),
  "metadata must be fetched with readDocumentsByIds for courseOfferings + courses.",
);
assert(
  !profileLoader.includes('.collection("courseOfferings").get()') &&
    !profileLoader.includes('.collection("courses").get()'),
  "metadata must not use full courseOfferings/courses collection reads.",
);
assert(
  !/for\s*\([^)]*enrollment[^)]*\)\s*\{\s*[^}]*\.doc\(/.test(profileLoader),
  "metadata must not be fetched per-enrollment with doc.get().",
);

assert(
  profileLoader.includes("importBatches: []"),
  "Firestore profile mode must keep importBatches parity as [].",
);

assert(
  profileLoader.includes('source: input.source ?? "getStudentProfilePageData"') &&
    profileLoader.includes("route: input.route"),
  "profile loader reads must be labeled with source/route.",
);
assert(
  profileLoader.includes("requestId: input.requestId"),
  "profile loader reads must share the requestId.",
);

console.log("Phase 1F student profile guards passed.");