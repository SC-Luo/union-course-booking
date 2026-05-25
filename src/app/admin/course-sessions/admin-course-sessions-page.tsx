import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; month?: string }>;
};

const calendarWeekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function formatSessionDate(date?: string) {
  if (!date) return "未排";
  return date.replaceAll("-", "/");
}

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

function bookingStatusLabel(status?: string, bookingOpen?: boolean) {
  if (bookingOpen === false || status === "closed") return "關閉報名";
  if (status === "draft") return "草稿";
  if (status === "archived") return "已封存";
  return "開放報名";
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

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#f1e2d6] bg-[#fffaf5] px-4 py-3">
      <span className="block text-xs text-[#8a7c72]">{label}</span>
      <span className="mt-1 block font-black text-[#1f1712]">{value}</span>
    </div>
  );
}

function ClassCard({ course, offering, series, color }: { course: any; offering: any; series: any; color: string }) {
  const sessionCount = course.sessions?.length ?? 0;
  const capacity = offering?.capacity ?? course.totalCapacity ?? series?.defaultCapacity ?? "未設";
  const reserved = course.sessions?.reduce((sum: number, session: any) => Math.max(sum, session.bookedCount ?? 0), 0) ?? 0;
  const instructor = offering?.primaryInstructorName ?? series?.defaultInstructorName ?? course.defaultInstructorName ?? "未設";
  const location = offering?.location ?? course.defaultLocation ?? series?.defaultLocation ?? "未設";
  const title = course.displayTitle ?? course.classDisplayName ?? course.title;
  const shortName = course.shortName ?? offering?.shortName ?? course.code ?? course.id;
  const year = offering?.year ?? course.year ?? "未設年度";
  const termLabel = offering?.termLabel ?? course.termLabel ?? (offering?.term || course.term ? `第 ${offering?.term ?? course.term} 期` : "未設期別");

  return (
    <article className="overflow-hidden rounded-[28px] border border-[#ead8ca] bg-white shadow-[0_12px_32px_rgba(90,55,38,0.06)]">
      <div className="flex min-h-full flex-col lg:flex-row">
        <div className="w-full lg:w-2" style={{ backgroundColor: color }} />
        <div className="flex flex-1 flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full ring-4 ring-[#fff1e7]" style={{ backgroundColor: color }} />
              <span className="rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-black text-[#8B5035]">{shortName}</span>
              <span className="rounded-full bg-[#f6eee8] px-3 py-1 text-xs font-semibold text-[#66584f]">{year}｜{termLabel}</span>
              <span className={sessionCount > 0 ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"}>
                {sessionCount > 0 ? `已排 ${sessionCount} 場` : "尚未排課"}
              </span>
              <span className="rounded-full bg-[#fffaf5] px-3 py-1 text-xs font-semibold text-[#66584f]">{bookingStatusLabel(offering?.status ?? course.status, offering?.bookingOpen ?? course.bookingOpen)}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#1f1712]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66584f]">課程目錄：{series?.title ?? "未指定目錄"}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="名額 / 報名" value={`${reserved}/${capacity}`} />
              <MiniMetric label="主要講師" value={instructor} />
              <MiniMetric label="上課地點" value={location} />
              <MiniMetric label="上課場次" value={sessionCount > 0 ? `${sessionCount} 場` : "待排課"} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Link href={`/admin/courses/${encodeURIComponent(course.id)}/sessions`} className="rounded-2xl bg-[#5A3726] px-4 py-3 text-center text-sm font-bold text-white shadow-sm hover:brightness-105">進入管理</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[28px] border border-[#ead8ca] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#B46F4A]">{label}</p>
      <p className="mt-2 text-4xl font-black text-[#1f1712]">{value}</p>
      <p className="mt-2 text-sm text-[#8a7c72]">{hint}</p>
    </div>
  );
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
  let pointer = new Date(gridStart);
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
            <p className="mt-2 text-sm text-[#8a7c72]">顯示所有課程的課堂狀態；點擊課堂會進入該堂課的點名 / 名單頁面，點下方課程卡片可進入單一課程管理。</p>
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
  const { saved, error, month } = await searchParams;
  const { categories, courses, courseOfferings, courseSeries, reservations } = await getBookingData();
  const allCourses = courses as any[];
  const offerings = courseOfferings as any[];
  const seriesList = courseSeries as any[];

  const classRows = allCourses.map((course) => {
    const offering = getOffering(course, offerings);
    const series = getSeries(course, offering, seriesList);
    const color = getCourseColor(course, offering, series, categories);
    return { course, offering, series, color };
  });

  const sessionRows = allCourses
    .flatMap((course) => {
      const offering = getOffering(course, offerings);
      const series = getSeries(course, offering, seriesList);
      const color = getCourseColor(course, offering, series, categories);
      return (course.sessions ?? []).map((session: any) => ({ course, session, offering, series, color }));
    })
    .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = sessionRows.filter((row) => row.session.date === today);
  const upcomingRows = sessionRows.filter((row) => row.session.date >= today);
  const uncheckedCount = (reservations as any[]).filter((item) => item.attendanceStatus === "unchecked").length;

  return (
    <AdminShell currentSection="course-settings.session">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#B46F4A]">課程行政</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">課堂詳情</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66584f]">這裡是全部課堂的日曆總覽。先用日曆掌握各班課堂狀態，再從下方課程清單進入單一課程管理。</p>
          </div>
          <a href="/admin/course-offerings" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">回年度課程 →</a>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已更新場次。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位。</p> : null}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="課堂總數" value={sessionRows.length} hint="已建立的課堂日期與時間" />
        <StatCard label="今日課堂" value={todayRows.length} hint="今天需要處理的課堂" />
        <StatCard label="近期場次" value={upcomingRows.length} hint="由今天起算的未來課堂" />
        <StatCard label="未完成點名" value={uncheckedCount} hint="尚未確認出席狀態" />
      </section>

      <GlobalCalendar sessionRows={sessionRows} monthParam={month} />

      <section className="mt-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-black text-[#1f1712]">目前全部課程</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">點選對應課程即可進入單一課程的課堂點名、課堂修改與課堂總覽。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {classRows.map(({ course, offering, series, color }) => <ClassCard key={course.id} course={course} offering={offering} series={series} color={color} />)}
          {classRows.length === 0 ? <div className="rounded-2xl bg-[#fffaf5] px-4 py-4 text-sm text-[#8a7c72]">目前沒有年度課程。</div> : null}
        </div>
      </section>
    </AdminShell>
  );
}
