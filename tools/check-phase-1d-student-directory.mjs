import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repo = process.cwd();
const page = read(`${repo}/src/app/admin/students/page.tsx`);
const component = read(`${repo}/src/app/admin/students/student-directory-page.tsx`);
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

const pageDirectoryBranch = section(
  page,
  'if (currentMode === "students")',
  '} else if (currentMode === "eligibility")',
);
const directoryLoader = section(
  repository,
  "async function getStudentDirectoryCourseOptions",
  "export async function getStudentDirectoryData",
);

assert(
  page.includes("getStudentDirectoryPageData"),
  "/admin/students must use getStudentDirectoryPageData.",
);
assert(
  !page.includes("getStudentDirectoryData"),
  "/admin/students must not import or call legacy getStudentDirectoryData.",
);
assert(
  pageDirectoryBranch.includes("getStudentDirectoryPageData"),
  "students mode must call the bounded directory loader.",
);
assert(
  !pageDirectoryBranch.includes("getBookingData"),
  "students mode must not call getBookingData.",
);
assert(
  !directoryLoader.includes('.collection("students").get()'),
  "directory loader must not full-read students.",
);
assert(
  directoryLoader.includes("count().get()"),
  "student total count must use count aggregation.",
);
assert(
  directoryLoader.includes('const needsCourseOptions = mode === "class" || Boolean(selectedOfferingId);'),
  "course offerings must only load for class mode or a selected offering.",
);
assert(
  directoryLoader.includes(".limit(input.pageSize + 1).get()"),
  "default browsing must use a bounded page query.",
);
assert(
  directoryLoader.includes(".startAfter(decodedCursor.lastId)"),
  "pagination must use cursor startAfter.",
);
assert(
  directoryLoader.includes(".where(field, \"==\", q)") &&
    directoryLoader.includes("STUDENT_DIRECTORY_SEARCH_FIELDS"),
  "student search must use exact Firestore field queries.",
);
assert(
  directoryLoader.includes("readDocumentsByIds(") &&
    directoryLoader.includes("classRoster.studentsByEnrollmentStudentIds"),
  "class roster must batch-fetch students by enrollment studentIds.",
);
assert(
  component.includes("prefetch={false}"),
  "directory row links must not prefetch student detail/edit hot paths.",
);

console.log("Phase 1D student directory guards passed.");
