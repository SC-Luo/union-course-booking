import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repo = process.cwd();
const page = read(`${repo}/src/app/admin/students/page.tsx`);
const component = read(
  `${repo}/src/app/admin/students/student-directory-page.tsx`,
);
const button = read(
  `${repo}/src/app/admin/students/DeleteStudentButton.tsx`,
);
const repository = read(`${repo}/src/lib/booking-repository.ts`);
const actions = read(`${repo}/src/app/admin/actions.ts`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function compact(source) {
  return source.replace(/\s+/g, "");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert(end > start, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const pageText = compact(page);
const directoryLoader = compact(
  section(
    repository,
    "export async function getStudentDirectoryPageData",
    "export async function getStudentDirectoryData",
  ),
);
const deleteCheck = compact(
  section(
    repository,
    "export async function checkStudentCanBeHardDeleted",
    "export async function getStudentImportPageData",
  ),
);
const hardDeleteAction = compact(
  section(
    actions,
    "export async function hardDeleteStudentIdentityAction",
    "export async function deleteStudentIdentityAction",
  ),
);

assert(
  compact(repository).includes('"browse"|"search"|"class"|"recent"'),
  "StudentDirectoryMode must include recent.",
);
assert(
  pageText.includes('mode==="recent"?"recent"'),
  "directoryMode must map mode=recent to the recent view.",
);
assert(
  pageText.includes("deleted={deleted}"),
  "students directory must render the deleted feedback.",
);
assert(
  directoryLoader.includes('.orderBy("createdAt","desc")') &&
    directoryLoader.includes(".limit(STUDENT_DIRECTORY_RECENT_LIMIT)"),
  "recent view must use a bounded orderBy createdAt desc limit query.",
);
assert(
  !directoryLoader.includes('.collection("students").get()'),
  "directory loader must not full-read students.",
);
assert(
  !deleteCheck.includes("getBookingData("),
  "hard delete dependency check must not call getBookingData.",
);
assert(
  deleteCheck.includes(
    'db.collection("enrollments").where("studentId","==",studentId).limit(1).get()',
  ),
  "enrollments dependency check must be bounded to limit(1).",
);
assert(
  deleteCheck.includes(
    'db.collection("studentCourseRecords").where("studentId","==",studentId).limit(1).get()',
  ),
  "studentCourseRecords dependency check must be bounded to limit(1).",
);
assert(
  deleteCheck.includes(
    'db.collection("attendanceRecords").where("studentId","==",studentId).limit(1).get()',
  ),
  "attendanceRecords dependency check must be bounded to limit(1).",
);
assert(
  deleteCheck.includes(
    'db.collection("reservations").where("studentId","==",studentId).limit(1).get()',
  ),
  "reservations by studentId check must be bounded to limit(1).",
);
assert(
  deleteCheck.includes(
    'db.collection("reservations").where("studentName","==",student.name).limit(1).get()',
  ),
  "legacy reservations by name check must be bounded to limit(1).",
);
assert(
  !hardDeleteAction.includes("getBookingData("),
  "hard delete action must not call getBookingData.",
);
assert(
  hardDeleteAction.includes("checkStudentCanBeHardDeleted"),
  "hard delete action must delegate to the bounded dependency check.",
);
assert(
  hardDeleteAction.includes("deleted="),
  "hard delete must redirect with deleted feedback.",
);
assert(
  !component.includes("hardDeleteStudentIdentityAction"),
  "directory page must not call the hard delete action directly.",
);
assert(
  component.includes("近期新增 30 筆"),
  "directory page must expose the recent quick view.",
);
assert(
  component.includes("DeleteStudentButton"),
  "directory rows must use the dialog-based delete button.",
);
assert(
  button.includes('role="dialog"'),
  "delete button must render a dialog.",
);
assert(
  button.includes("確認刪除"),
  "dialog must require explicit confirmation.",
);

console.log("Phase 2 recent/delete UX guards passed.");