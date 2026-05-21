import Link from "next/link";
import { disableStudentAction, saveStudentAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import {
  getEnrollmentOfferingId,
  getEnrollmentSeatLabel,
  getOfferingForCourse,
  getOfferingPeriodLabel,
  getSeriesForCourse,
  getStudentEnrollments,
  resolveCourseColor,
} from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    classId?: string;
    seriesId?: string;
    year?: string;
    term?: string;
    saved?: string;
    error?: string;
    q?: string;
    status?: string;
  }>;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getCoursePeriodLabel(
  course:
    | {
        year?: number;
        termLabel?: string;
        displayTitle?: string;
        title?: string;
      }
    | undefined,
) {
  if (!course) return "未指定";
  const parts = [
    course.year ? `${course.year}年` : "",
    course.termLabel ?? "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join("｜");
  return course.displayTitle ?? course.title ?? "未設定期別";
}

function getStudentClassStatus(student: {
  classId?: string;
  needsReview?: boolean;
  isActive?: boolean;
}) {
  if (student.isActive === false) {
    return {
      label: "已停用 / 封存",
      className: "bg-zinc-100 text-zinc-600 border-zinc-200",
    };
  }
  if (!student.classId) {
    return {
      label: "未指定年度期別班級",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (student.needsReview) {
    return {
      label: "需人工確認",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "名冊有效",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function getStudentRegistryNumber(student: {
  externalMemberNo?: string;
  memberId?: string;
  id: string;
}) {
  return student.externalMemberNo || student.memberId || student.id;
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const {
    classId,
    seriesId,
    year,
    term,
    saved,
    error,
    q = "",
    status = "active",
  } = await searchParams;
  const {
    categories = [],
    courses,
    students = [],
    courseSeries = [],
    courseOfferings = [],
    enrollments = [],
  } = await getBookingData();
  const allStudents = students;
  const activeStudents = allStudents.filter(
    (student) => student.isActive !== false,
  );
  const inactiveStudents = allStudents.filter(
    (student) => student.isActive === false,
  );
  const studentStatus =
    status === "inactive" || status === "all" ? status : "active";
  const legacySelectedCourse =
    classId && classId !== "all"
      ? courses.find((course) => course.id === classId)
      : undefined;
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const seriesMap = new Map(courseSeries.map((series) => [series.id, series]));
  const offeringMap = new Map(courseOfferings.map((offering) => [offering.id, offering]));

  const selectedSeriesId =
    seriesId || legacySelectedCourse?.seriesId || legacySelectedCourse?.courseMasterId || "all";
  const selectedYear =
    year || (legacySelectedCourse?.year != null ? String(legacySelectedCourse.year) : "all");
  const selectedTerm =
    term || (legacySelectedCourse?.termLabel ?? (legacySelectedCourse?.term != null ? String(legacySelectedCourse.term) : "all"));
  const selectedOffering =
    classId && classId !== "all"
      ? courseOfferings.find((offering) => offering.legacyCourseId === classId || offering.id === classId)
      : courseOfferings.find(
          (offering) =>
            (selectedSeriesId === "all" || offering.seriesId === selectedSeriesId || offering.courseMasterId === selectedSeriesId) &&
            (selectedYear === "all" || String(offering.year) === selectedYear) &&
            (selectedTerm === "all" || offering.termLabel === selectedTerm || String(offering.term) === selectedTerm),
        );
  const selectedClassId = selectedOffering?.legacyCourseId ?? selectedOffering?.id ?? classId ?? "all";
  const selectedCourse =
    selectedOffering?.legacyCourseId
      ? courses.find((course) => course.id === selectedOffering.legacyCourseId)
      : legacySelectedCourse;

  function getCourseSeriesTitle(course: (typeof courses)[number] | undefined) {
    if (!course) return "未指定課程";
    const series = getSeriesForCourse(course, courseSeries);
    return series?.title ?? course.displayTitle?.split("｜")[0] ?? course.title;
  }

  function getCourseSeriesDescription(
    course: (typeof courses)[number] | undefined,
  ) {
    if (!course) return "";
    const series = getSeriesForCourse(course, courseSeries);
    return (
      series?.description ?? "同一課程主檔的不同年度 / 期別班級，名冊分開管理。"
    );
  }

  const getCourseColor = (courseId?: string) => {
    const course = courseMap.get(courseId ?? "");
    if (!course) return "#a1a1aa";
    const category = categories.find((item) => item.id === course.categoryId);
    return resolveCourseColor(course, category);
  };
  const normalizedQuery = normalizeText(q);
  const effectiveClassForNew =
    selectedClassId === "all" ? (courses[0]?.id ?? "") : selectedClassId;
  const years = Array.from(
    new Set(courseOfferings.map((offering) => offering.year).filter(Boolean).map(String)),
  ).sort();
  const termsForSelectedYear = Array.from(
    new Set(
      courseOfferings
        .filter((offering) => selectedSeriesId === "all" || offering.seriesId === selectedSeriesId || offering.courseMasterId === selectedSeriesId)
        .filter((offering) => selectedYear === "all" || String(offering.year) === selectedYear)
        .map((offering) => offering.termLabel ?? String(offering.term ?? ""))
        .filter(Boolean),
    ),
  ).sort();

  const courseFilterGroups = Array.from(
    courses.reduce((map, course) => {
      const seriesId = course.seriesId ?? course.courseMasterId ?? `series-${course.id}`;
      let existing = map.get(seriesId);
      const seriesTitle = getCourseSeriesTitle(course);
      const seriesDescription = getCourseSeriesDescription(course);
      if (existing) {
        existing.courses.push(course);
      } else {
        existing = {
          id: seriesId,
          title: seriesTitle,
          description: seriesDescription,
          courses: [course],
        };
        map.set(seriesId, existing);
      }
      return map;
    }, new Map<string, { id: string; title: string; description: string; courses: typeof courses }>()),
  ).map(([, group]) => ({
    ...group,
    courses: group.courses.sort((a, b) => {
      const yearCompare = (a.year ?? 0) - (b.year ?? 0);
      if (yearCompare !== 0) return yearCompare;
      return (a.termLabel ?? a.title).localeCompare(b.termLabel ?? b.title);
    }),
  }));

  const searchedStudents = allStudents.filter((student) => {
    if (!normalizedQuery) return true;
    const studentEnrollments = getStudentEnrollments(student, enrollments, courses);
    const classNames = studentEnrollments.map((enrollment) => {
      const offering = offeringMap.get(getEnrollmentOfferingId(enrollment));
      const legacyCourse = enrollment.courseId ? courseMap.get(enrollment.courseId) : undefined;
      return [
        offering ? getOfferingPeriodLabel(offering) : "",
        legacyCourse ? getCourseSeriesTitle(legacyCourse) : "",
        getEnrollmentSeatLabel(enrollment, student),
      ].join(" ");
    });

    return [
      student.name,
      student.examGroup,
      student.memberId,
      student.externalMemberNo,
      student.phone,
      student.note,
      student.classId,
      ...classNames,
    ]
      .map(normalizeText)
      .some((value) => value.includes(normalizedQuery));
  });

  const statusFilteredStudents = searchedStudents.filter((student) => {
    if (studentStatus === "all") return true;
    if (studentStatus === "inactive") return student.isActive === false;
    return student.isActive !== false;
  });

  const visibleStudents =
    selectedClassId === "all"
      ? statusFilteredStudents
      : statusFilteredStudents.filter(
          (student) => {
            const studentEnrollments = getStudentEnrollments(student, enrollments, courses);
            return studentEnrollments.some((enrollment) => {
              const offeringId = getEnrollmentOfferingId(enrollment);
              const offering = offeringMap.get(offeringId);
              return (
                offeringId === selectedOffering?.id ||
                enrollment.courseId === selectedClassId ||
                offering?.legacyCourseId === selectedClassId
              );
            });
          },
        );

  const selectedSeriesLabel =
    selectedSeriesId !== "all"
      ? (seriesMap.get(selectedSeriesId)?.title ?? (selectedCourse ? getCourseSeriesTitle(selectedCourse) : "指定課程主檔"))
      : "全部課程";
  const selectedLabel = selectedOffering
    ? getOfferingPeriodLabel(selectedOffering)
    : selectedYear !== "all" || selectedTerm !== "all"
      ? [selectedYear !== "all" ? `${selectedYear}年` : "全部年度", selectedTerm !== "all" ? selectedTerm : "全部期別"].join("｜")
      : "全部年度期別班級";
  const selectedColor = selectedCourse
    ? getCourseColor(selectedCourse.id)
    : "#059669";
  const statusLabelMap = {
    active: "使用中",
    inactive: "已停用",
    all: "全部資料",
  } as const;
  const resumeHref = visibleStudents[0]
    ? `/admin/students/${visibleStudents[0].id}`
    : "/admin/students";

  function classHref(nextClassId: string) {
    const params = new URLSearchParams();
    if (nextClassId !== "all") params.set("classId", nextClassId);
    if (q.trim()) params.set("q", q.trim());
    if (studentStatus !== "active") params.set("status", studentStatus);
    const query = params.toString();
    return `/admin/students${query ? `?${query}` : ""}`;
  }

  function filterHref(next: { seriesId?: string; year?: string; term?: string }) {
    const params = new URLSearchParams();
    if (next.seriesId && next.seriesId !== "all") params.set("seriesId", next.seriesId);
    if (next.year && next.year !== "all") params.set("year", next.year);
    if (next.term && next.term !== "all") params.set("term", next.term);
    if (q.trim()) params.set("q", q.trim());
    if (studentStatus !== "active") params.set("status", studentStatus);
    const query = params.toString();
    return `/admin/students${query ? `?${query}` : ""}`;
  }

  function statusHref(nextStatus: "active" | "inactive" | "all") {
    const params = new URLSearchParams();
    if (selectedSeriesId !== "all") params.set("seriesId", selectedSeriesId);
    if (selectedYear !== "all") params.set("year", selectedYear);
    if (selectedTerm !== "all") params.set("term", selectedTerm);
    if (q.trim()) params.set("q", q.trim());
    if (nextStatus !== "active") params.set("status", nextStatus);
    const query = params.toString();
    return `/admin/students${query ? `?${query}` : ""}`;
  }

  return (
    <AdminShell resumeHref={resumeHref} resumeLabel="學習履歷">
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">名冊管理</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          依課程主檔與年度期別班級管理學員名冊
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
          以「學員」為中心管理名冊；先選課程主檔，再選年度、期別找到名單，最後點學員姓名或「履歷」查看完整學習紀錄。
          學員主檔建議以「學員編號」識別；座號屬於某一個年度期別班級，不是學員主檔欄位，避免不同班級重複座號造成排序誤判。115-1、115-2 只是年度期別簡稱，不是課程主檔名稱。停用只代表封存，不刪除資料，仍可透過「已停用
          / 全部資料」撈回查詢。
        </p>
      </section>

      {saved ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          已更新名冊。
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          請填寫課程主檔、年度期別班級、姓名與座號。
        </p>
      ) : null}

      <details className="mb-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 open:border-emerald-500 open:bg-white open:shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-5 transition hover:bg-emerald-50">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700">快速新增</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                新增學員到年度期別班級名冊
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                這是一個可點擊展開的區塊；需要手動補名冊時再展開新增。
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              ＋ 展開新增表單
            </span>
          </div>
        </summary>
        <div className="border-t border-zinc-200 p-5">
          <p className="mb-4 text-sm text-zinc-500">
            新增學員要先指定所屬課程 /
            年度期別。下方「期別 / 補充」可保留現場補充資訊。
          </p>
          <form
            action={saveStudentAction}
            className="grid gap-3 md:grid-cols-[1.35fr_1fr_100px_130px_1fr_120px] md:items-end"
          >
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                所屬年度期別班級
              </span>
              <select
                name="classId"
                defaultValue={effectiveClassForNew}
                className="w-full rounded-md border border-zinc-300 px-3 py-3"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}｜{getCoursePeriodLabel(course)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                姓名
              </span>
              <input
                name="name"
                className="w-full rounded-md border border-zinc-300 px-3 py-3"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                座號
              </span>
              <input
                name="seatNumber"
                type="number"
                className="w-full rounded-md border border-zinc-300 px-3 py-3"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                期別 / 補充
              </span>
              <input
                name="examGroup"
                className="w-full rounded-md border border-zinc-300 px-3 py-3"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                備註
              </span>
              <input
                name="note"
                className="w-full rounded-md border border-zinc-300 px-3 py-3"
              />
            </label>
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
              新增
            </button>
          </form>
        </div>
      </details>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">搜尋學員</h2>
            <p className="mt-1 text-sm text-zinc-500">
              目前篩選：{selectedLabel}
            </p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[560px]">
            {selectedSeriesId !== "all" ? <input type="hidden" name="seriesId" value={selectedSeriesId} /> : null}
            {selectedYear !== "all" ? <input type="hidden" name="year" value={selectedYear} /> : null}
            {selectedTerm !== "all" ? <input type="hidden" name="term" value={selectedTerm} /> : null}
            {studentStatus !== "active" ? (
              <input type="hidden" name="status" value={studentStatus} />
            ) : null}
            <input
              name="q"
              defaultValue={q}
              className="rounded-md border border-zinc-300 px-3 py-3"
              placeholder="跨課程主檔與年度期別班級搜尋姓名、手機、學員編號、年度、期別、備註"
            />
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
              搜尋
            </button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 lg:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            課程主檔
            <select
              defaultValue={selectedSeriesId}
              className="rounded-md border border-zinc-300 bg-white px-3 py-3"
            >
              <option value="all">全部課程主檔</option>
              {courseSeries.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.title}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-zinc-500">
              用下方快速按鈕切換，避免後台表單送出打斷工作。
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            年度
            <select defaultValue={selectedYear} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
              <option value="all">全部年度</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}年
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            期別
            <select defaultValue={selectedTerm} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
              <option value="all">全部期別</option>
              {termsForSelectedYear.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Link href={filterHref({ seriesId: "all", year: "all", term: "all" })} className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              全部
            </Link>
            {courseSeries.map((series) => (
              <Link key={series.id} href={filterHref({ seriesId: series.id, year: selectedYear, term: selectedTerm })} className={`rounded-full border px-3 py-2 text-sm font-medium ${selectedSeriesId === series.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                {series.title}
              </Link>
            ))}
            {years.map((item) => (
              <Link key={item} href={filterHref({ seriesId: selectedSeriesId, year: item, term: "all" })} className={`rounded-full border px-3 py-2 text-sm font-medium ${selectedYear === item ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                {item}年
              </Link>
            ))}
            {termsForSelectedYear.map((item) => (
              <Link key={item} href={filterHref({ seriesId: selectedSeriesId, year: selectedYear, term: item })} className={`rounded-full border px-3 py-2 text-sm font-medium ${selectedTerm === item ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                {item}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4">
          <Link
            href={classHref("all")}
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              selectedClassId === "all"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            全部課程主檔 / 全部年度期別班級
          </Link>

          {courseFilterGroups.map((group) => (
            <section
              key={group.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">
                    課程
                  </p>
                  <h3 className="text-base font-semibold text-zinc-950">
                    {group.title}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {group.courses.length} 個年度期別班級，點選後下方名冊會同步切換。
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.courses.map((course) => {
                  const courseColor = getCourseColor(course.id);
                  const isSelected = selectedClassId === course.id;
                  const offering = getOfferingForCourse(course, courseOfferings);
                  const classStudentCount = enrollments.filter(
                    (enrollment) =>
                      getEnrollmentOfferingId(enrollment) === offering.id &&
                      enrollment.status !== "withdrawn",
                  ).length;
                  return (
                    <Link
                      key={course.id}
                      href={classHref(course.id)}
                      className={`rounded-xl border bg-white px-4 py-3 text-sm font-medium transition ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900/20"
                          : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      }`}
                      style={{ borderTop: `4px solid ${courseColor}` }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: courseColor }}
                          aria-hidden="true"
                        />
                        <span className="block">{getCourseSeriesTitle(course)}</span>
                      </span>
                      <span className="mt-1 block text-xs opacity-75">
                        {getOfferingPeriodLabel(offering)}｜{classStudentCount}{" "}
                        位學員
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
          <span className="mr-1 text-sm font-medium text-zinc-600">
            資料狀態
          </span>
          {(
            [
              ["active", `使用中 ${activeStudents.length}`],
              ["inactive", `已停用 ${inactiveStudents.length}`],
              ["all", `全部 ${allStudents.length}`],
            ] as const
          ).map(([nextStatus, label]) => (
            <Link
              key={nextStatus}
              href={statusHref(nextStatus)}
              className={`rounded-full border px-3 py-2 text-sm font-medium ${
                studentStatus === nextStatus
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {label}
            </Link>
          ))}
          <span className="text-xs text-zinc-500">
            停用＝封存，不會從資料中刪除。
          </span>
        </div>
      </section>

      <section
        className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        style={{ borderLeft: `6px solid ${selectedColor}` }}
      >
        <p className="text-xs font-semibold text-emerald-700">目前名冊篩選</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              課程：{selectedSeriesLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              年度 / 期別：{selectedLabel}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              下方名冊列表目前顯示「{selectedSeriesLabel}｜{selectedLabel}」＋「{statusLabelMap[studentStatus]}」的資料，共{" "}
              {visibleStudents.length} 位。
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            點上方年度期別班級卡片會同步更新這裡與下方名單
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:hidden">
        {visibleStudents.map((student) => {
          const enrollment = getStudentEnrollments(student, enrollments, courses).find((item) => {
            const offeringId = getEnrollmentOfferingId(item);
            const offering = offeringMap.get(offeringId);
            return selectedClassId === "all" || offeringId === selectedOffering?.id || item.courseId === selectedClassId || offering?.legacyCourseId === selectedClassId;
          }) ?? getStudentEnrollments(student, enrollments, courses)[0];
          const offering = enrollment ? offeringMap.get(getEnrollmentOfferingId(enrollment)) : undefined;
          const course = offering?.legacyCourseId ? courseMap.get(offering.legacyCourseId) : courseMap.get(student.classId ?? "");
          const status = getStudentClassStatus(student);
          const registryNo = getStudentRegistryNumber(student);
          const isInactive = student.isActive === false;
          return (
            <article
              key={student.id}
              className={`rounded-xl border border-zinc-200 bg-white p-4 ${isInactive ? "opacity-75" : ""}`}
              style={{
                borderTop: `4px solid ${getCourseColor(student.classId)}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">
                    學員編號｜{registryNo}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-950">
                    {student.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    課程主檔：{getCourseSeriesTitle(course)}｜年度期別：
                    {getOfferingPeriodLabel(offering)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    座號 {getEnrollmentSeatLabel(enrollment, student) || "未設定"}｜名冊分組{" "}
                    {student.examGroup || "未填"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    來源：{offering?.sourceSheet ?? student.sourceSheet ?? "未標示"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-4 grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                <p>
                  <span className="text-zinc-500">資料來源：</span>
                  {student.source || "未標示"}
                </p>
                {student.phone ? (
                  <p>
                    <span className="text-zinc-500">電話：</span>
                    {student.phone}
                  </p>
                ) : null}
                {student.note ? (
                  <p>
                    <span className="text-zinc-500">備註：</span>
                    {student.note}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/students/${student.id}`}
                  className="w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  查看履歷
                </Link>
                <details className="w-full rounded-lg border border-zinc-200 bg-white open:border-sky-300 open:bg-sky-50/40">
                  <summary className="cursor-pointer px-3 py-2 text-center text-sm font-medium hover:bg-zinc-50">
                    編輯學員資料
                  </summary>
                  <form
                    action={saveStudentAction}
                    className="grid gap-3 border-t border-zinc-200 p-4"
                  >
                    <input type="hidden" name="id" value={student.id} />
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      所屬年度期別班級
                      <select
                        name="classId"
                        defaultValue={student.classId ?? effectiveClassForNew}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}｜{getCoursePeriodLabel(course)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      姓名
                      <input
                        name="name"
                        defaultValue={student.name}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      座號
                      <input
                        name="seatNumber"
                        type="number"
                        defaultValue={student.seatNumber}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      期別 / 補充
                      <input
                        name="examGroup"
                        defaultValue={student.examGroup}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      備註
                      <input
                        name="note"
                        defaultValue={student.note ?? ""}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
                      儲存編輯
                    </button>
                  </form>
                </details>
                {isInactive ? (
                  <span className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-center text-sm text-zinc-500">
                    已停用，資料仍可查詢
                  </span>
                ) : (
                  <form action={disableStudentAction} className="w-full">
                    <input type="hidden" name="id" value={student.id} />
                    <input
                      type="hidden"
                      name="classId"
                      value={student.classId ?? effectiveClassForNew}
                    />
                    <button className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
                      停用
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
        {visibleStudents.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            目前沒有符合篩選條件的學員。
          </p>
        ) : null}
      </section>

      <section className="hidden rounded-lg border border-zinc-200 bg-white md:block">
        <div className="border-b border-zinc-200 px-5 py-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                名冊列表｜{selectedSeriesLabel}｜{selectedLabel}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                目前顯示「{selectedLabel}」與「{statusLabelMap[studentStatus]}
                」的資料；點上方課程卡片會同步更新這份名單。
              </p>
            </div>
            <p className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
              目前顯示 {visibleStudents.length} 位
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[140px_1.1fr_1.4fr_90px_1fr_1.1fr_190px] border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-sm font-medium text-zinc-600">
          <span>學員編號</span>
          <span>學員</span>
                <span>手機 / 身分證末三碼</span>
          <span>座號</span>
                <span>座號</span>
          <span>名冊狀態</span>
          <span>操作</span>
        </div>
        {visibleStudents.map((student) => {
          const enrollment = getStudentEnrollments(student, enrollments, courses).find((item) => {
            const offeringId = getEnrollmentOfferingId(item);
            const offering = offeringMap.get(offeringId);
            return selectedClassId === "all" || offeringId === selectedOffering?.id || item.courseId === selectedClassId || offering?.legacyCourseId === selectedClassId;
          }) ?? getStudentEnrollments(student, enrollments, courses)[0];
          const offering = enrollment ? offeringMap.get(getEnrollmentOfferingId(enrollment)) : undefined;
          const course = offering?.legacyCourseId ? courseMap.get(offering.legacyCourseId) : courseMap.get(student.classId ?? "");
          const status = getStudentClassStatus(student);
          const registryNo = getStudentRegistryNumber(student);
          const isInactive = student.isActive === false;
          return (
            <details
              key={student.id}
              className={`group border-b border-zinc-100 last:border-0 open:bg-sky-50/30 ${isInactive ? "opacity-75" : ""}`}
            >
              <summary className="grid cursor-pointer list-none grid-cols-[140px_1.1fr_1.4fr_90px_1fr_1.1fr_190px] items-center px-5 py-5 text-sm hover:bg-zinc-50 group-open:border-b group-open:border-sky-100">
                <span className="font-semibold text-zinc-950">
                  {registryNo}
                </span>
                <Link
                  href={`/admin/students/${student.id}`}
                  className="font-semibold text-zinc-950 hover:text-emerald-700"
                >
                  {student.name}
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    {student.phone || "無手機"}｜{student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "末三碼未填"}
                  </span>
                </Link>
                <span
                  className="min-w-0 border-l-4 pl-3"
                  style={{ borderColor: getCourseColor(student.classId) }}
                >
                  <span className="block truncate text-xs font-medium text-emerald-700">
                    {getCourseSeriesTitle(course)}
                  </span>
                  <span className="mt-1 block truncate font-semibold text-zinc-950">
                    {getOfferingPeriodLabel(offering)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {offering?.shortName ?? offering?.sourceSheet ?? course?.code ?? "未綁定班級"}
                  </span>
                </span>
                <span className="font-semibold text-zinc-700">
                  {getEnrollmentSeatLabel(enrollment, student) || "未設定"}
                </span>
                <span className="text-zinc-700">
                  {enrollment?.status === "active" ? "名冊有效" : enrollment?.status ?? "待確認"}
                </span>
                <span className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                  {student.source ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                      {student.source}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <Link
                    href={`/admin/students/${student.id}`}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
                  >
                    履歷
                  </Link>
                  <span className="rounded-md border border-zinc-300 px-3 py-2 text-sm group-open:border-sky-300 group-open:bg-white">
                    編輯
                  </span>
                  {isInactive ? (
                    <span className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-500">
                      已停用
                    </span>
                  ) : (
                    <form action={disableStudentAction}>
                      <input type="hidden" name="id" value={student.id} />
                      <input
                        type="hidden"
                        name="classId"
                        value={student.classId ?? effectiveClassForNew}
                      />
                      <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">
                        停用
                      </button>
                    </form>
                  )}
                </span>
              </summary>
              <div className="px-4 pb-4">
                <form
                  action={saveStudentAction}
                  className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm"
                >
                  <input type="hidden" name="id" value={student.id} />
                  <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_0.7fr_0.9fr]">
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      所屬年度期別班級
                      <select
                        name="classId"
                        defaultValue={student.classId ?? effectiveClassForNew}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}｜{getCoursePeriodLabel(course)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      姓名
                      <input
                        name="name"
                        defaultValue={student.name}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      座號
                      <input
                        name="seatNumber"
                        type="number"
                        defaultValue={student.seatNumber}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      期別 / 補充
                      <input
                        name="examGroup"
                        defaultValue={student.examGroup}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      備註
                      <input
                        name="note"
                        defaultValue={student.note ?? ""}
                        className="rounded-md border border-zinc-300 px-3 py-3"
                      />
                    </label>
                    <button className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
                      儲存編輯
                    </button>
                  </div>
                </form>
              </div>
            </details>
          );
        })}
        {visibleStudents.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-500">
            目前沒有符合篩選條件的學員。
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
