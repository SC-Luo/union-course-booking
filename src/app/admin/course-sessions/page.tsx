import Link from "next/link";
import { bulkCreateSessionsAction, saveSessionAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; month?: string; offeringId?: string; categoryId?: string; schedule?: string; batch?: string; bulkUpdated?: string }>;
};

const calendarWeekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function statusLabel(status?: string, isActive?: boolean) {
  if (isActive === false) return "停用";
  if (status === "suspended") return "停課";
  if (status === "rescheduled") return "已調課";
  if (status === "makeup") return "補課";
  if (status === "cancelled") return "已取消";
  return "正常上課";
}

function statusPillClass(status?: string, isActive?: boolean) {
  if (isActive === false) return "border-zinc-200 bg-zinc-100 text-zinc-500";
  if (status === "suspended") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "rescheduled") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "makeup") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getOffering(course: any, offerings: any[]) {
  return offerings.find((item) => item.id === course.offeringId || item.legacyCourseId === course.id);
}

function getSeries(course: any, offering: any, seriesList: any[]) {
  return seriesList.find(
    (item) =>
      item.id === course.seriesId ||
      item.id === course.courseSeriesId ||
      item.id === course.courseMasterId ||
      item.id === offering?.seriesId ||
      item.id === offering?.courseSeriesId ||
      item.id === offering?.courseMasterId,
  );
}

function getCourseColor(course: any, offering: any, series: any, categories: any[]) {
  const category = categories.find((item) => item.id === (course.categoryId ?? offering?.categoryId ?? series?.categoryId));
  return course.color ?? offering?.color ?? series?.color ?? category?.color ?? "#B46F4A";
}

function normalizeTag(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getEligibleInstructorsForClass(course: any, offering: any, series: any, categories: any[], instructors: any[] = []) {
  const category = categories.find((item) => item.id === (course.categoryId ?? offering?.categoryId ?? series?.categoryId));
  const keys = new Set(
    [course.categoryId, offering?.categoryId, series?.categoryId, category?.id, category?.code, category?.name]
      .map(normalizeTag)
      .filter(Boolean),
  );

  return instructors
    .filter((instructor) => instructor?.isActive !== false)
    .filter((instructor) => {
      const specialties = Array.isArray(instructor?.specialties) ? instructor.specialties : [];
      if (keys.size === 0) return true;
      return specialties.some((specialty: string) => keys.has(normalizeTag(specialty)));
    })
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hant"));
}

function SessionInstructorFields({
  eligibleInstructors,
  defaultPrimaryInstructorId,
  defaultAssistantInstructorIds = [],
}: {
  eligibleInstructors: any[];
  defaultPrimaryInstructorId?: string;
  defaultAssistantInstructorIds?: string[];
}) {
  const assistantSet = new Set(defaultAssistantInstructorIds);
  return (
    <section className="sm:col-span-2 rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
      <div className="mb-4 flex flex-col gap-1 border-b border-[#ead8ca] pb-3">
        <p className="text-sm font-black text-[#1f1712]">講師設定</p>
        <p className="text-xs leading-5 text-[#8a7c72]">依年度課程的課程類別篩選講師；新增課堂時可沿用或微調。</p>
      </div>
      {eligibleInstructors.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          目前沒有符合此課程類別的講師，可先留空或到「講師名冊」新增。
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.85fr)_1fr]">
        <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
          主要講師
          <div className="rounded-[22px] border border-[#ead8ca] bg-white p-2 shadow-sm">
            <select
              name="instructorId"
              defaultValue={defaultPrimaryInstructorId ?? ""}
              className="h-12 w-full rounded-2xl border border-transparent bg-[#fffaf5] px-4 text-sm font-black text-[#1f1712] outline-none transition focus:border-[#E7892B] focus:bg-white focus:ring-4 focus:ring-[#E7892B]/10"
            >
              <option value="">未設定</option>
              {eligibleInstructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
              ))}
            </select>
          </div>
        </label>
        <div className="grid gap-2 text-sm font-semibold text-[#4e4038]">
          助教 / 協同講師
          <div className="flex min-h-[64px] flex-wrap content-start gap-2 rounded-[22px] border border-[#ead8ca] bg-white p-3 shadow-sm">
            {eligibleInstructors.map((instructor) => (
              <label key={instructor.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead8ca] bg-[#fffaf5] px-3 py-2 text-xs font-bold text-[#5A3726] transition hover:border-[#E7892B] hover:bg-[#fff6ed] has-[:checked]:border-[#E85F00] has-[:checked]:bg-[#fff1e7] has-[:checked]:text-[#E85F00]">
                <input type="checkbox" name="assistantInstructorIds" value={instructor.id} defaultChecked={assistantSet.has(instructor.id)} className="h-4 w-4 rounded border-[#dbcabd] accent-[#E85F00]" />
                {instructor.name}
              </label>
            ))}
            {eligibleInstructors.length === 0 ? <span className="px-2 py-2 text-sm font-normal text-[#8a7c72]">尚無可選講師</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}


function getClassRowCategoryId(row: any) {
  return row.course?.categoryId ?? row.offering?.categoryId ?? row.series?.categoryId ?? "uncategorized";
}

function getClassRowCategoryName(row: any, categories: any[]) {
  const categoryId = getClassRowCategoryId(row);
  const category = categories.find((item) => item.id === categoryId || item.code === categoryId);
  return category?.name ?? row.series?.categoryName ?? row.offering?.categoryName ?? row.course?.categoryName ?? "未分類";
}

function getClassRowSessionStats(row: any) {
  const sessions = row.course?.sessions ?? [];
  const total = sessions.length;
  const cancelled = sessions.filter((session: any) => session?.status === "cancelled" || session?.sessionStatus === "cancelled" || session?.isActive === false).length;
  return { total, normal: Math.max(total - cancelled, 0), cancelled };
}

function inferBulkScheduleDefaults(selectedClassRow: any, visibleSessionRows: any[]) {
  const sessions = visibleSessionRows
    .map((row) => row.session)
    .filter((session) => session?.isActive !== false && session?.status !== "cancelled" && session?.sessionStatus !== "cancelled")
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  const defaultStartDate = sessions[0]?.date ?? selectedClassRow?.offering?.startDate ?? "";
  const defaultEndDate = sessions[sessions.length - 1]?.date ?? selectedClassRow?.offering?.endDate ?? "";
  const weekdaySet = new Set<number>();
  sessions.forEach((session) => {
    if (!session.date) return;
    const date = new Date(`${session.date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) weekdaySet.add(date.getDay());
  });

  const defaultStartTime = sessions[0]?.startTime ?? selectedClassRow?.offering?.startTime ?? "10:00";
  const defaultEndTime = sessions[0]?.endTime ?? selectedClassRow?.offering?.endTime ?? "12:00";
  const defaultTopic = sessions.find((session) => session.topic)?.topic ?? "";
  const defaultCapacity =
    sessions[0]?.capacity ??
    selectedClassRow?.offering?.capacity ??
    selectedClassRow?.course?.totalCapacity ??
    selectedClassRow?.series?.defaultCapacity ??
    12;
  const defaultLocation =
    sessions.find((session) => session.location)?.location ??
    selectedClassRow?.offering?.location ??
    selectedClassRow?.course?.defaultLocation ??
    selectedClassRow?.series?.defaultLocation ??
    "";
  const hasExistingSessions = sessions.length > 0;

  return {
    sessions,
    hasExistingSessions,
    defaultStartDate,
    defaultEndDate,
    defaultWeekdays: weekdaySet,
    defaultStartTime,
    defaultEndTime,
    defaultTopic,
    defaultCapacity,
    defaultLocation,
  };
}

function getMonthDate(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    const parsed = new Date(year, monthIndex - 1, 1);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthHeading(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}

function endOfMonthGrid(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  return end;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function GlobalCalendar({ sessionRows, monthParam }: { sessionRows: any[]; monthParam?: string }) {
  const monthDate = getMonthDate(monthParam);
  const gridStart = startOfMonthGrid(monthDate);
  const gridEnd = endOfMonthGrid(monthDate);
  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const todayIso = isoDate(new Date());

  const sessionMap = sessionRows.reduce<Record<string, any[]>>((map, row) => {
    if (!row.session.date) return map;
    if (!map[row.session.date]) map[row.session.date] = [];
    map[row.session.date].push(row);
    return map;
  }, {});

  const rows: { date: Date; dateKey: string; inMonth: boolean; items: any[] }[][] = [];
  const pointer = new Date(gridStart);
  while (pointer <= gridEnd) {
    const week: { date: Date; dateKey: string; inMonth: boolean; items: any[] }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const key = isoDate(pointer);
      week.push({
        date: new Date(pointer),
        dateKey: key,
        inMonth: pointer.getMonth() === monthDate.getMonth(),
        items: (sessionMap[key] ?? []).slice().sort((a, b) => `${a.session.startTime}`.localeCompare(`${b.session.startTime}`)),
      });
      pointer.setDate(pointer.getDate() + 1);
    }
    rows.push(week);
  }

  return (
    <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-6">
      <div className="flex flex-col gap-4 rounded-[24px] border border-[#ead8ca] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">日曆檢視</p>
            <h2 className="mt-1 text-2xl font-black text-[#1f1712]">{formatMonthHeading(monthDate)}</h2>
            <p className="mt-2 text-sm text-[#8a7c72]">依上方年度課程篩選顯示課堂；點擊課堂卡片可進入該堂課的課堂日誌與點名。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            <Link href={`/admin/course-sessions?month=${formatMonthParam(prevMonth)}`} className="rounded-2xl border border-[#dbcabd] bg-[#1f1712] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-105">上月</Link>
            <Link href={`/admin/course-sessions?month=${formatMonthParam(new Date())}`} className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-3 text-center text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">今天</Link>
            <Link href={`/admin/course-sessions?month=${formatMonthParam(nextMonth)}`} className="rounded-2xl border border-[#dbcabd] bg-[#1f1712] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-105">下月</Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#ead8ca] bg-white">
          <div className="grid grid-cols-7 border-b border-[#ead8ca] bg-[#fffaf5] text-center text-sm font-bold text-[#5A3726]">
            {calendarWeekdayLabels.map((label) => <div key={label} className="px-2 py-3">{label}</div>)}
          </div>
          {rows.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid grid-cols-7 border-b border-[#ead8ca] last:border-b-0">
              {week.map((day) => {
                const isToday = day.dateKey === todayIso;
                return (
                  <div key={day.dateKey} className={`min-h-[140px] border-r border-[#ead8ca] p-2 last:border-r-0 sm:min-h-[165px] ${day.inMonth ? "bg-white" : "bg-[#faf7f2]"}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm font-bold ${day.inMonth ? "text-[#1f1712]" : "text-[#c6b9af]"}`}>{day.date.getDate()}</span>
                      {isToday ? <span className="rounded-full bg-[#e7fff7] px-2 py-0.5 text-[11px] font-bold text-[#0b9f73]">今天</span> : null}
                    </div>
                    <div className="grid gap-1.5">
                      {day.items.slice(0, 3).map(({ course, session, color }) => {
                        const isCancelled = session.status === "cancelled" || session.isActive === false;
                        const isSuspended = session.status === "suspended";
                        return (
                          <Link
                            key={session.id}
                            href={`/admin/sessions/${encodeRouteSegment(session.id)}/reservations?from=course-sessions`}
                            className={`block overflow-hidden rounded-xl border bg-white text-left text-[11px] leading-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                              isCancelled
                                ? "border-rose-200 bg-rose-50 text-rose-800"
                                : isSuspended
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-[#e7ded5] text-[#5A3726] hover:bg-[#fff6ed]"
                            }`}
                          >
                            <div className="h-1" style={{ backgroundColor: color }} />
                            <div className="p-2">
                              <div className="flex items-center justify-between gap-1">
                                <span className="min-w-0 truncate font-black text-[#1f1712]">{session.startTime || "未定時間"}</span>
                                <span className="shrink-0 text-[10px] text-[#8a7c72]">{session.bookedCount ?? 0}/{session.capacity ?? "-"}</span>
                              </div>
                              <div className="mt-1 truncate font-semibold text-[#1f1712]">{course.displayTitle ?? course.title}</div>
                              <div className="mt-1 truncate text-[10px] text-[#8a7c72]">{session.topic || "未填單元"}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusPillClass(session.status, session.isActive)}`}>{statusLabel(session.status, session.isActive)}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {day.items.length > 3 ? <div className="px-1 text-[11px] font-semibold text-[#B46F4A]">另有 {day.items.length - 3} 堂…</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function CourseSessionsPage({ searchParams }: PageProps) {
  const { saved, error, month, offeringId, categoryId, schedule, bulkUpdated } = await searchParams;
  const { categories, courses, courseOfferings, courseSeries, instructors = [] } = await getBookingData();
  const allCourses = courses as any[];
  const offerings = courseOfferings as any[];
  const seriesList = courseSeries as any[];

  const classRows = allCourses.map((course) => {
    const offering = getOffering(course, offerings);
    const series = getSeries(course, offering, seriesList);
    const color = getCourseColor(course, offering, series, categories);
    return { course, offering, series, color };
  });
  const categoryTabs = [
    { id: "all", name: "全部" },
    ...Array.from(
      new Map(
        classRows.map((row) => {
          const categoryId = getClassRowCategoryId(row);
          return [categoryId, { id: categoryId, name: getClassRowCategoryName(row, categories) }];
        }),
      ).values(),
    ),
  ];

  const validCategoryIds = new Set(categoryTabs.map((category) => category.id));
  const selectedCategoryId = categoryId && validCategoryIds.has(categoryId) ? categoryId : "all";
  const filteredClassRows = selectedCategoryId === "all"
    ? classRows
    : classRows.filter((row) => getClassRowCategoryId(row) === selectedCategoryId);

  const sessionRows = allCourses
    .flatMap((course) => {
      const offering = getOffering(course, offerings);
      const series = getSeries(course, offering, seriesList);
      const color = getCourseColor(course, offering, series, categories);
      return (course.sessions ?? []).map((session: any) => ({ course, session, offering, series, color }));
    })
    .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));

  const selectedOfferingId = offeringId && classRows.some((row) => row.offering?.id === offeringId) ? offeringId : "all";
  const selectedClassRow = selectedOfferingId === "all" ? undefined : classRows.find((row) => row.offering?.id === selectedOfferingId);
  const visibleSessionRows = selectedOfferingId === "all" ? sessionRows : sessionRows.filter((row) => row.offering?.id === selectedOfferingId);
  const monthQuery = month ? `&month=${encodeURIComponent(month)}` : "";
  const scheduleCloseHref = `/admin/course-sessions?offeringId=${encodeURIComponent(selectedOfferingId)}${monthQuery}`;
  const scheduleSingleHref = `${scheduleCloseHref}&schedule=single`;
  const scheduleBulkHref = `${scheduleCloseHref}&schedule=bulk`;
  const scheduleMode = selectedClassRow && (schedule === "single" || schedule === "bulk") ? schedule : undefined;
  const eligibleSessionInstructors = selectedClassRow
    ? getEligibleInstructorsForClass(selectedClassRow.course, selectedClassRow.offering, selectedClassRow.series, categories, instructors)
    : [];
  const defaultPrimaryInstructorId = selectedClassRow?.offering?.primaryInstructorId ?? selectedClassRow?.course?.primaryInstructorId ?? selectedClassRow?.series?.defaultInstructorId;
  const defaultAssistantInstructorIds = selectedClassRow?.offering?.assistantInstructorIds ?? selectedClassRow?.course?.assistantInstructorIds ?? [];
  const bulkScheduleDefaults = selectedClassRow ? inferBulkScheduleDefaults(selectedClassRow, visibleSessionRows) : undefined;

  return (
    <AdminShell currentSection="course-settings.session">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#B46F4A]">課程行政</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">課堂日誌</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66584f]">這裡是全部課堂的日曆總覽。先用日曆掌握各班課堂狀態，再從下方課程清單進入單一課程管理。</p>
          </div>
          <a href="/admin/course-offerings" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">回年度課程 →</a>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已更新場次{bulkUpdated ? ` ${bulkUpdated} 筆` : ""}。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位。</p> : null}

      <section className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">課程篩選</p>
            <h2 className="mt-1 text-xl font-black text-[#1f1712]">先選年度課程，再看日曆與新增課堂</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">
              選定年度課程後，日曆只顯示該班課堂；新增單堂與批次排課在此頁展開，不必離開日曆。
            </p>
          </div>
          {selectedClassRow ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href={scheduleSingleHref} className="rounded-2xl bg-[#E85F00] px-4 py-3 text-sm font-black text-white shadow-sm hover:brightness-105">新增單堂</Link>
              <Link href={scheduleBulkHref} className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-black text-white shadow-sm hover:brightness-105">批次排課</Link>
            </div>
          ) : null}
        </div>
        <div className="mt-5 space-y-4">
          {categoryTabs.length > 2 ? (
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((category) => {
                const isActive = selectedCategoryId === category.id;
                const nextHref =
                  category.id === "all"
                    ? `/admin/course-sessions?offeringId=all${monthQuery}`
                    : `/admin/course-sessions?categoryId=${encodeURIComponent(category.id)}&offeringId=all${monthQuery}`;
                return (
                  <Link
                    key={category.id}
                    href={nextHref}
                    className={isActive ? "rounded-2xl bg-[#E85F00] px-4 py-2 text-sm font-black text-white shadow-sm" : "rounded-2xl border border-[#ead8ca] bg-white px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]"}
                  >
                    {category.name}
                  </Link>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-[24px] border border-[#f0dfd2] bg-[#fffaf5] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[#5A3726]">
                {selectedCategoryId === "all"
                  ? "全部年度課程"
                  : `${categoryTabs.find((category) => category.id === selectedCategoryId)?.name ?? "年度課程"}年度課程`}
              </p>
              <span className="text-xs font-bold text-[#9a877a]">{filteredClassRows.length} 個課程</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredClassRows.map(({ course, offering, series, color }) => {
                const currentOfferingId = offering?.id ?? course.offeringId ?? course.id;
                const active = selectedOfferingId === currentOfferingId;
                const stats = getClassRowSessionStats({ course, offering, series, color });
                const title = course.shortName ?? offering?.shortName ?? series?.title ?? course.title;
                const year = offering?.year ?? course.year;
                const term = offering?.term ?? offering?.period ?? course.term;
                const termLabel = year && term ? `${year}-${term}` : year ? `${year}年` : term ? `第${term}期` : "年度課";
                const hrefCategory = selectedCategoryId === "all" ? "" : `categoryId=${encodeURIComponent(selectedCategoryId)}&`;
                return (
                  <Link
                    key={currentOfferingId}
                    href={`/admin/course-sessions?${hrefCategory}offeringId=${encodeURIComponent(currentOfferingId)}${monthQuery}`}
                    className={
                      active
                        ? "relative min-h-[74px] overflow-hidden rounded-2xl border bg-white px-3 py-2 shadow-sm ring-4 ring-[#E85F00]/10"
                        : "relative min-h-[74px] overflow-hidden rounded-2xl border border-[#ead8ca] bg-white px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fffdf9] hover:shadow-md"
                    }
                    style={active ? { borderColor: color } : undefined}
                  >
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
                    <div className="min-w-0 pl-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-black leading-5 text-[#1f1712]">{title}</p>
                        <span className="shrink-0 rounded-full bg-[#fff6ed] px-2 py-0.5 text-[10px] font-black text-[#8a5a3b]">{termLabel}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] font-bold text-[#8a7c72]">
                        {stats.total > 0 ? `已排 ${stats.total} 堂${stats.cancelled ? `｜取消 ${stats.cancelled}` : ""}` : "尚未排課"}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {filteredClassRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#ead8ca] bg-white px-4 py-6 text-sm font-bold text-[#8a7c72]">
                  目前沒有符合分類的年度課程。
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {selectedClassRow && scheduleMode ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <Link href={scheduleCloseHref} aria-label="關閉排課視窗" className="absolute inset-0 bg-[#1f1712]/40 backdrop-blur-sm" />
          <div className="relative z-10 w-[min(94vw,760px)] rounded-[32px] border border-[#ead8ca] bg-white p-6 shadow-[0_30px_90px_rgba(31,23,18,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#B46F4A]">{scheduleMode === "single" ? "新增單堂課堂" : "批次排課"}</p>
                <h3 className="mt-1 text-2xl font-black text-[#1f1712]">{selectedClassRow.course.displayTitle ?? selectedClassRow.course.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#8a7c72]">已帶入目前選定的年度課程、預設講師與助教；點背景、右上角關閉或按瀏覽器上一頁都可以回到日曆。</p>
              </div>
              <Link href={scheduleCloseHref} className="rounded-full border border-[#ead8ca] bg-[#fffaf5] px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">關閉</Link>
            </div>

            {scheduleMode === "single" ? (
              <form action={saveSessionAction} className="mt-5 grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="courseId" value={selectedClassRow.course.id} />
                <input type="hidden" name="redirectTo" value={scheduleCloseHref} />
                <SessionInstructorFields eligibleInstructors={eligibleSessionInstructors} defaultPrimaryInstructorId={defaultPrimaryInstructorId} defaultAssistantInstructorIds={defaultAssistantInstructorIds} />
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">日期<input required type="date" name="date" className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">單元<input name="topic" className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" placeholder="例如 彩妝" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">開始時間<input required type="time" name="startTime" defaultValue="10:00" className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">結束時間<input required type="time" name="endTime" defaultValue="12:00" className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">名額<input required type="number" min={0} name="capacity" defaultValue={selectedClassRow.offering?.capacity ?? selectedClassRow.course.totalCapacity ?? selectedClassRow.series?.defaultCapacity ?? 12} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">地點<input name="location" defaultValue={selectedClassRow.offering?.location ?? selectedClassRow.course.defaultLocation ?? selectedClassRow.series?.defaultLocation ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <button className="sm:col-span-2 rounded-2xl bg-[#E85F00] px-4 py-3 text-sm font-black text-white shadow-sm hover:brightness-105">建立單堂課堂</button>
              </form>
            ) : (
              <form action={bulkCreateSessionsAction} className="mt-5 grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="courseId" value={selectedClassRow.course.id} />
                <input type="hidden" name="redirectTo" value={scheduleCloseHref} />
                <input type="hidden" name="syncExistingSessions" value="true" />
                <SessionInstructorFields eligibleInstructors={eligibleSessionInstructors} defaultPrimaryInstructorId={defaultPrimaryInstructorId} defaultAssistantInstructorIds={defaultAssistantInstructorIds} />

                {bulkScheduleDefaults?.hasExistingSessions ? (
                  <div className="sm:col-span-2 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    <p className="font-black">這次會更新既有批次課堂</p>
                    <p className="mt-1">
                      系統會依下方日期與星期重新整理這個年度課程：保留並更新符合規則的課堂、新增缺少的課堂，並把不在新規則內的舊課堂標記為已取消，不會刪除預約與點名紀錄。
                    </p>
                  </div>
                ) : (
                  <div className="sm:col-span-2 rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] px-4 py-3 text-sm leading-6 text-[#8a7c72]">
                    尚未建立批次課堂。請設定日期、時間與上課星期後建立課堂。
                  </div>
                )}

                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">開始日期<input required type="date" name="startDate" defaultValue={bulkScheduleDefaults?.defaultStartDate ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">結束日期<input required type="date" name="endDate" defaultValue={bulkScheduleDefaults?.defaultEndDate ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">開始時間<input required type="time" name="startTime" defaultValue={bulkScheduleDefaults?.defaultStartTime ?? "10:00"} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">結束時間<input required type="time" name="endTime" defaultValue={bulkScheduleDefaults?.defaultEndTime ?? "12:00"} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <div className="sm:col-span-2 grid gap-2 text-sm font-semibold text-[#4e4038]">
                  上課星期
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-[#ead8ca] bg-[#fffdf9] p-3">
                    {["日", "一", "二", "三", "四", "五", "六"].map((label, index) => (
                      <label key={label} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead8ca] bg-white px-3 py-2 text-xs font-bold text-[#5A3726] has-[:checked]:border-[#E85F00] has-[:checked]:bg-[#fff1e7] has-[:checked]:text-[#E85F00]">
                        <input type="checkbox" name="weekdays" value={index} defaultChecked={bulkScheduleDefaults?.defaultWeekdays.has(index) ?? false} className="h-4 w-4 accent-[#E85F00]" />週{label}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">單元<input name="topic" defaultValue={bulkScheduleDefaults?.defaultTopic ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" placeholder="例如 彩妝" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">名額<input required type="number" min={0} name="capacity" defaultValue={bulkScheduleDefaults?.defaultCapacity ?? 12} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <label className="grid gap-2 text-sm font-semibold text-[#4e4038] sm:col-span-2">地點<input name="location" defaultValue={bulkScheduleDefaults?.defaultLocation ?? ""} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" /></label>
                <button className="sm:col-span-2 rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-black text-white shadow-sm hover:brightness-105">
                  {bulkScheduleDefaults?.hasExistingSessions ? "更新這批課堂" : "建立批次課堂"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <GlobalCalendar sessionRows={visibleSessionRows} monthParam={month} />

    </AdminShell>
  );
}
