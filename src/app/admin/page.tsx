import Link from "next/link";
import { saveCourseAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import {
  getEnrollmentOfferingId,
  getOfferingForCourse,
  getOfferingPeriodLabel,
  resolveCourseColor,
} from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; courseId?: string }>;
};

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function formatYearTermLabel(course: {
  year?: number;
  termLabel?: string;
  displayTitle?: string;
  title?: string;
}) {
  const parts = [
    course.year ? `${course.year}年` : "",
    course.termLabel ?? "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join("｜");
  return course.displayTitle ?? course.title ?? "未設定期別";
}

const colorPresets = [
  { value: "", label: "使用分類預設色" },
  { value: "#ec4899", label: "粉紅" },
  { value: "#10b981", label: "綠色" },
  { value: "#8b5cf6", label: "紫色" },
  { value: "#3b82f6", label: "藍色" },
  { value: "#f97316", label: "橘色" },
  { value: "#ef4444", label: "紅色" },
  { value: "#06b6d4", label: "青色" },
  { value: "#f59e0b", label: "金色" },
];

export default async function AdminHomePage({ searchParams }: PageProps) {
  const { saved, error, courseId } = await searchParams;
  const {
    categories = [],
    courses,
    reservations,
    courseSeries = [],
    courseOfferings = [],
    enrollments = [],
  } = await getBookingData();
  const activeCourses = courses.filter((course) => course.isActive);
  const activeCategories = professionalCategories.filter((category) => {
    const savedCategory = categories.find((item) => item.id === category.id);
    return savedCategory?.isActive ?? true;
  });

  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );
  const seriesMap = new Map(
    courseSeries.map((series) => [
      series.id,
      {
        id: series.id,
        title: series.title,
        description: series.description ?? "",
        categoryId: series.categoryId,
        color: series.color,
      },
    ]),
  );

  function getSeriesInfo(course: (typeof activeCourses)[number]) {
    const existing = course.seriesId
      ? seriesMap.get(course.seriesId)
      : undefined;
    const category = categoryMap.get(course.categoryId);
    if (existing) return existing;
    return {
      id: course.seriesId ?? `series-${course.id}`,
      title: course.displayTitle?.split("｜")[0] ?? course.title,
      description: course.description ?? "",
      categoryId: course.categoryId,
      color: course.color ?? category?.color,
    };
  }

  const courseSummaries = activeCourses
    .map((course) => {
      const category = categoryMap.get(course.categoryId);
      const activeSessions = course.sessions.filter(
        (session) => session.isActive,
      );
      const nextSession = activeSessions
        .slice()
        .sort((a, b) =>
          `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
        )[0];
      const nextSessionReservations = nextSession
        ? reservations.filter(
            (reservation) =>
              reservation.courseId === course.id &&
              reservation.sessionId === nextSession.id &&
              reservation.status === "booked",
          )
        : [];
      const attendedCount = nextSessionReservations.filter(
        (reservation) => reservation.attendanceStatus === "attended",
      ).length;
      const absentCount = nextSessionReservations.filter(
        (reservation) => reservation.attendanceStatus === "absent",
      ).length;
      const color = resolveCourseColor(course, category);
      const series = getSeriesInfo(course);
      const offering = getOfferingForCourse(course, courseOfferings);
      const rosterCount = enrollments.filter(
        (enrollment) =>
          getEnrollmentOfferingId(enrollment) === offering.id &&
          enrollment.status !== "withdrawn",
      ).length;

      return {
        course,
        series,
        offering,
        nextSession,
        bookedCount: nextSessionReservations.length,
        rosterCount,
        totalCapacity: nextSession?.capacity ?? course.totalCapacity ?? 0,
        attendedCount,
        absentCount,
        color,
        categoryName: category?.name ?? course.categoryId,
        categoryId: course.categoryId,
        yearTermLabel: getOfferingPeriodLabel(offering) || formatYearTermLabel(course),
      };
    })
    .sort((a, b) => {
      if (courseId && a.course.id === courseId) return -1;
      if (courseId && b.course.id === courseId) return 1;
      const aDate = a.nextSession
        ? `${a.nextSession.date} ${a.nextSession.startTime}`
        : "9999-12-31 23:59";
      const bDate = b.nextSession
        ? `${b.nextSession.date} ${b.nextSession.startTime}`
        : "9999-12-31 23:59";
      return aDate.localeCompare(bDate);
    });

  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = courseSummaries
    .flatMap(({ course, series, color, categoryName }) =>
      course.sessions
        .filter((session) => session.isActive && session.date === today)
        .map((session) => {
          const sessionReservations = reservations.filter(
            (reservation) =>
              reservation.courseId === course.id &&
              reservation.sessionId === session.id &&
              reservation.status === "booked",
          );
          const attendedCount = sessionReservations.filter(
            (reservation) => reservation.attendanceStatus === "attended",
          ).length;
          const absentCount = sessionReservations.filter(
            (reservation) => reservation.attendanceStatus === "absent",
          ).length;

          return {
            course,
            series,
            session,
            color,
            categoryName,
            bookedCount: sessionReservations.length,
            attendedCount,
            absentCount,
          };
        }),
    )
    .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));

  const seriesGroups = Array.from(
    courseSummaries.reduce((map, summary) => {
      const existing = map.get(summary.series.id);
      if (existing) {
        existing.items.push(summary);
      } else {
        map.set(summary.series.id, {
          series: summary.series,
          categoryName: summary.categoryName,
          color: summary.series.color ?? summary.color,
          items: [summary],
        });
      }
      return map;
    }, new Map<string, { series: ReturnType<typeof getSeriesInfo>; categoryName: string; color: string; items: typeof courseSummaries }>()),
  ).map(([, group]) => ({
    ...group,
    items: group.items.sort((a, b) => {
      const yearCompare = (a.course.year ?? 0) - (b.course.year ?? 0);
      if (yearCompare !== 0) return yearCompare;
      return (a.course.termLabel ?? a.course.title).localeCompare(
        b.course.termLabel ?? b.course.title,
      );
    }),
  }));

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-semibold text-emerald-700">後台首頁</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          課程主檔工作台
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
          現在以「課程主檔」作為課程本體，再用「課程主檔 + 年度 + 期別」產生唯一班級識別。例：美容丙級檢定班是課程主檔；美容丙級檢定班｜115年｜第1期，才是可管理的年度期別班級。
        </p>
      </section>

      {saved ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          已建立或更新課程主檔。
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          請填寫方案、分類與課程主檔名稱。
        </p>
      ) : null}

      <details className="group mb-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
          <span>新增課程主檔 / 年度期別班級</span>
          <span className="text-xs group-open:hidden">展開</span>
          <span className="hidden text-xs group-open:inline">收合</span>
        </summary>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-600">
            課程主檔名稱請填課程本體，例如「美容丙級檢定班」。年度與期別會組成可管理的班級識別；115-1、115-2 只是簡稱與匯入來源，不是課程主檔名稱。
          </p>
          <form action={saveCourseAction} className="mt-4 grid gap-3">
            <input type="hidden" name="redirectTo" value="/admin" />
            <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr]">
              <label>
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  方案
                </span>
                <select
                  name="courseType"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3"
                >
                  {courseTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.id} {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  分類
                </span>
                <select
                  name="categoryId"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3"
                >
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.id} {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  課程主檔名稱
                </span>
                <input
                  name="title"
                  className="w-full rounded-md border border-zinc-300 px-3 py-3"
                  placeholder="美容丙級檢定班"
                />
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
              <input
                name="defaultLocation"
                className="rounded-md border border-zinc-300 px-3 py-3"
                placeholder="上課地點"
              />
              <input
                name="description"
                className="rounded-md border border-zinc-300 px-3 py-3"
                placeholder="課程主檔說明"
              />
              <select
                name="color"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3"
              >
                {colorPresets.map((item) => (
                  <option key={item.label} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="notes"
              className="min-h-20 rounded-md border border-zinc-300 px-3 py-3"
              placeholder="注意事項"
            />
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:w-40">
              儲存課程主檔設定
            </button>
          </form>
        </div>
      </details>

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">今日課堂</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">
              今日點名入口
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              點擊年度期別班級即可進入該堂課的學生名單，直接進行已到 / 未到點名。
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {formatDate(today)}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {todaySessions.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
              今天沒有排定課堂。
            </p>
          ) : null}

          {todaySessions.map(
            ({
              course,
              series,
              session,
              color,
              categoryName,
              bookedCount,
              attendedCount,
              absentCount,
            }) => (
              <Link
                key={session.id}
                href={`/admin/courses/${course.id}?month=${today.slice(0, 7)}&openSession=${session.id}#session-${session.id}`}
                className="group grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex h-3 w-10 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                      {series.title}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-zinc-500">
                      {categoryName}
                    </span>
                  </div>
                  <h3 className="mt-3 break-words text-lg font-semibold text-zinc-950">
                    {course.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    {session.startTime}–{session.endTime}｜
                    {session.topic || "未填單元"}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-zinc-500">已報名</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {bookedCount}/{session.capacity}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-zinc-500">已到</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {attendedCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-zinc-500">未到</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {absentCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950 p-3 text-white group-hover:bg-emerald-700">
                    <p className="text-xs text-white/70">操作</p>
                    <p className="mt-1 text-sm font-semibold">開始點名</p>
                  </div>
                </div>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              課程主檔與年度期別班級
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              先選課程主檔，再進入指定年度期別班級的工作區處理日曆、名冊與點名。
            </p>
          </div>
          <Link
            href="/admin/stats"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            查看課程主檔統計 →
          </Link>
        </div>

        <div className="mt-5 grid gap-5">
          {seriesGroups.length === 0 ? (
            <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">
              目前沒有開放中的課程主檔。
            </p>
          ) : null}

          {seriesGroups.map(({ series, categoryName, color, items }) => {
            const totalStudents = items.reduce(
              (sum, item) => sum + item.rosterCount,
              0,
            );
            const nextItem = items.find((item) => item.nextSession);
            return (
              <article
                key={series.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm"
              >
                <div
                  className="h-2"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="grid gap-4 border-b border-zinc-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                        課程主檔
                      </span>
                      <span className="rounded-full bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
                        {categoryName}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        {items.length} 個年度期別班級
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-zinc-950">
                      {series.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                      {series.description ||
                        "同一門課程主檔可建立不同年度與期別，名冊與上課時段各自分開管理。"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-500">年度期別</p>
                      <p className="mt-1 text-xl font-semibold text-zinc-950">
                        {items.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-500">名冊人數</p>
                      <p className="mt-1 text-xl font-semibold text-zinc-950">
                        {totalStudents}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-500">最近課堂</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950">
                        {nextItem?.nextSession
                          ? formatDate(nextItem.nextSession.date)
                          : "未排課"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-4">
                  {items.map(
                    ({
                      course,
                      nextSession,
                      rosterCount,
                      totalCapacity,
                      attendedCount,
                      absentCount,
                      yearTermLabel,
                    }) => (
                      <section
                        key={course.id}
                        className={`grid gap-4 rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md lg:grid-cols-[minmax(0,1fr)_520px_150px] lg:items-center ${courseId === course.id ? "border-emerald-400 ring-2 ring-emerald-100" : "border-zinc-200"}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                            {course.shortName ?? course.code ?? course.id}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              年度期別班級
                            </span>
                            <span className="rounded-full bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
                              {yearTermLabel}
                            </span>
                            {nextSession ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                下一堂已建立
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                                尚未排課
                              </span>
                            )}
                          </div>
                          <h4 className="mt-3 break-words text-xl font-semibold text-zinc-950">
                            {series.title}
                          </h4>
                          <p className="mt-1 text-sm font-medium text-zinc-600">
                            {yearTermLabel}
                            {course.shortName ? `｜簡稱：${course.shortName}` : ""}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-600">
                            {nextSession
                              ? `${formatDate(nextSession.date)} ${nextSession.startTime}–${nextSession.endTime}｜${nextSession.topic || "未填單元"}`
                              : "尚未建立上課時間，進入工作區後可新增課堂。"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-[1.55fr_1fr_1fr_1fr]">
                          <div className="rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs text-zinc-500">上課時間</p>
                            <p className="mt-1 whitespace-nowrap text-xl font-semibold leading-tight text-zinc-950">
                              {nextSession
                                ? `${nextSession.startTime}–${nextSession.endTime}`
                                : "未設定"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs text-zinc-500">名冊人數</p>
                            <p className="mt-1 text-xl font-semibold text-zinc-950">
                              {rosterCount}/{totalCapacity || rosterCount}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs text-zinc-500">已到</p>
                            <p className="mt-1 text-xl font-semibold text-zinc-950">
                              {attendedCount}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-4">
                            <p className="text-xs text-zinc-500">未到</p>
                            <p className="mt-1 text-xl font-semibold text-zinc-950">
                              {absentCount}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/admin/courses/${course.id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
                        >
                          進入班級工作區
                        </Link>
                      </section>
                    ),
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
