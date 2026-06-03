import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkCreateSessionsAction, saveSessionAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName, getCourse, resolveCourseColor } from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; view?: string; month?: string; dialog?: string; date?: string; edit?: string; from?: string }>;
};

const weekdays = [
  { value: "1", label: "週一" },
  { value: "2", label: "週二" },
  { value: "3", label: "週三" },
  { value: "4", label: "週四" },
  { value: "5", label: "週五" },
  { value: "6", label: "週六" },
  { value: "0", label: "週日" },
];

const calendarWeekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
const longWeekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function formatDisplayDate(date?: string) {
  if (!date) return "尚未排定";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  return `${date.replaceAll("-", "/")} ${longWeekdayNames[parsed.getDay()]}`;
}

function statusLabel(status?: string, isActive?: boolean) {
  if (isActive === false) return "停用";
  if (status === "suspended") return "停課";
  if (status === "rescheduled") return "已調課";
  if (status === "makeup") return "補課";
  if (status === "cancelled") return "已取消";
  return "正常上課";
}


const sessionStatusOptions = [
  { value: "scheduled", label: "正常上課", helper: "可預約與點名", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "suspended", label: "停課", helper: "不可預約，本堂暫停上課", className: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "rescheduled", label: "已調課", helper: "時間或地點已調整", className: "border-sky-200 bg-sky-50 text-sky-700" },
  { value: "makeup", label: "補課", helper: "補原本缺漏課程", className: "border-violet-200 bg-violet-50 text-violet-700" },
  { value: "cancelled", label: "已取消", helper: "不可預約，本堂取消不再上課", className: "border-rose-200 bg-rose-50 text-rose-700" },
];

function statusPillClass(status?: string, isActive?: boolean) {
  if (isActive === false) return "border-zinc-200 bg-zinc-100 text-zinc-500";
  return sessionStatusOptions.find((option) => option.value === status)?.className ?? sessionStatusOptions[0].className;
}


function isLessonReservable(session: any) {
  if (session.isActive === false) return false;
  if (session.status === "suspended" || session.status === "cancelled") return false;
  return true;
}

function lessonAvailabilityLabel(session: any) {
  if (session.isActive === false) return "停用不可預約";
  return isLessonReservable(session) ? "可預約" : "不可預約";
}

function lessonAvailabilityClass(session: any) {
  if (isLessonReservable(session)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function LessonAvailabilityBadge({ session }: { session: any }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${lessonAvailabilityClass(session)}`}>
      {lessonAvailabilityLabel(session)}
    </span>
  );
}

function getDefaultCapacity(course: any) {
  return course.totalCapacity ?? course.defaultCapacity ?? course.capacity ?? 40;
}

function getDefaultLocation(course: any) {
  return course.defaultLocation ?? course.location ?? course.venue ?? "";
}

function getDefaultInstructor(course: any) {
  return course.defaultInstructorName ?? course.instructorName ?? course.mainInstructorName ?? "";
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[26px] border border-[#ead8ca] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#B46F4A]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#1f1712]">{value}</p>
      <p className="mt-2 text-sm text-[#8a7c72]">{hint}</p>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm"
          : "rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-3 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]"
      }
    >
      {children}
    </Link>
  );
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

function reservationHref(sessionId: string) {
  return `/admin/sessions/${encodeRouteSegment(sessionId)}/reservations`;
}

function CalendarView({ course, color, sessions, monthParam, mode = "attendance" }: { course: any; color: string; sessions: any[]; monthParam?: string; mode?: "attendance" | "edit" }) {
  const isEditMode = mode === "edit";
  const monthDate = getMonthDate(monthParam);
  const gridStart = startOfMonthGrid(monthDate);
  const gridEnd = endOfMonthGrid(monthDate);
  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const todayIso = isoDate(new Date());
  const viewPrefix = isEditMode ? "?view=list&" : "?view=calendar&";

  const sessionMap = sessions.reduce<Record<string, any[]>>((map, session) => {
    if (!session.date) return map;
    if (!map[session.date]) map[session.date] = [];
    map[session.date].push(session);
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
        items: (sessionMap[key] ?? []).slice().sort((a, b) => `${a.startTime}`.localeCompare(`${b.startTime}`)),
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
            <p className="text-sm font-bold text-[#B46F4A]">{isEditMode ? "課堂修改月曆" : "課堂點名月曆"}</p>
            <h2 className="mt-1 text-2xl font-black text-[#1f1712]">{formatMonthHeading(monthDate)}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#66584f]">
              <span className="inline-flex items-center gap-2"><span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />本班課程</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-semibold text-[#8B5035]">{isEditMode ? "點課堂開啟課堂修改" : "點課堂進入點名 / 名單"}</span>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/courses/${course.id}/sessions?dialog=single&month=${formatMonthParam(monthDate)}`} className="inline-flex items-center gap-2 rounded-full border border-[#dbcabd] px-3 py-1 text-xs font-semibold text-[#5A3726] hover:bg-[#fff6ed]">＋ 新增單堂</Link>
                <Link href={`/admin/courses/${course.id}/sessions?dialog=bulk&month=${formatMonthParam(monthDate)}`} className="inline-flex items-center gap-2 rounded-full border border-[#dbcabd] px-3 py-1 text-xs font-semibold text-[#5A3726] hover:bg-[#fff6ed]">＋ 批次排課</Link>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            <Link href={`/admin/courses/${course.id}/sessions${viewPrefix}month=${formatMonthParam(prevMonth)}`} className="rounded-2xl border border-[#dbcabd] bg-[#1f1712] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-105">上月</Link>
            <Link href={`/admin/courses/${course.id}/sessions${viewPrefix}month=${formatMonthParam(new Date())}`} className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-3 text-center text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">今天</Link>
            <Link href={`/admin/courses/${course.id}/sessions${viewPrefix}month=${formatMonthParam(nextMonth)}`} className="rounded-2xl border border-[#dbcabd] bg-[#1f1712] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-105">下月</Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#ead8ca] bg-white">
          <div className="grid grid-cols-7 border-b border-[#ead8ca] bg-[#fffaf5] text-center text-sm font-bold text-[#5A3726]">
            {calendarWeekdayLabels.map((label) => (
              <div key={label} className="px-2 py-3">{label}</div>
            ))}
          </div>

          {rows.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid grid-cols-7 border-b border-[#ead8ca] last:border-b-0">
              {week.map((day) => {
                const isToday = day.dateKey === todayIso;
                return (
                  <div
                    key={day.dateKey}
                    className={`min-h-[130px] border-r border-[#ead8ca] p-2 last:border-r-0 sm:min-h-[150px] ${day.inMonth ? "bg-white" : "bg-[#faf7f2]"}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm font-bold ${day.inMonth ? "text-[#1f1712]" : "text-[#c6b9af]"}`}>{day.date.getDate()}</span>
                      {isToday ? <span className="rounded-full bg-[#e7fff7] px-2 py-0.5 text-[11px] font-bold text-[#0b9f73]">今天</span> : null}
                    </div>

                    <div className={`rounded-[18px] p-1 ${isToday ? "bg-[#f3fffb] ring-1 ring-[#20c997]" : ""}`}>
                      <div className="grid gap-1.5">
                        {day.items.length > 0 ? (
                          day.items.slice(0, 3).map((session) => {
                            const sessionStatus = statusLabel(session.status, session.isActive);
                            const isCancelled = session.status === "cancelled" || session.isActive === false;
                            const isSuspended = session.status === "suspended";
                            const sessionHref = isEditMode
                              ? `/admin/courses/${course.id}/sessions?view=list&edit=${encodeURIComponent(session.id)}&month=${formatMonthParam(monthDate)}`
                              : reservationHref(session.id);
                            return (
                              <Link
                                key={session.id}
                                href={sessionHref}
                                className={`rounded-xl border px-2 py-2 text-left text-[11px] leading-4 hover:shadow-sm ${
                                  isCancelled
                                    ? "border-rose-200 bg-rose-50 text-rose-800"
                                    : isSuspended
                                      ? "border-amber-200 bg-amber-50 text-amber-800"
                                      : "border-[#e7ded5] bg-[#fffdf9] text-[#5A3726] hover:bg-[#fff6ed]"
                                }`}
                              >
                                <span className="flex items-center gap-1 font-bold text-[#1f1712]">
                                  <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                  {session.startTime || "未定時段"}
                                </span>
                                <span className="mt-1 block truncate text-[#66584f]">{session.topic || "未填單元"}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusPillClass(session.status, session.isActive)}`}>{sessionStatus}</span>
                                  <span className="text-[10px] text-[#8a7c72]">{session.bookedCount ?? 0}/{session.capacity ?? getDefaultCapacity(course)}</span>
                                </span>
                              </Link>
                            );
                          })
                        ) : (
                          day.inMonth ? (
                            <Link
                              href={`/admin/courses/${course.id}/sessions?dialog=single&date=${day.dateKey}&month=${formatMonthParam(monthDate)}`}
                              className="rounded-xl border border-dashed border-[#e7ded5] px-2 py-2 text-[11px] text-[#8a7c72] hover:bg-[#fffaf5]"
                            >
                              ＋ 新增這天課堂
                            </Link>
                          ) : (
                            <div className="h-9" />
                          )
                        )}
                        {day.items.length > 3 ? <div className="px-1 text-[11px] font-semibold text-[#B46F4A]">另有 {day.items.length - 3} 堂…</div> : null}
                      </div>
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

function QuickSessionForm({ course, mode, defaultDate }: { course: any; mode: "single" | "bulk"; defaultDate?: string }) {
  const defaultCapacity = getDefaultCapacity(course);
  const defaultLocation = getDefaultLocation(course);
  const defaultInstructor = getDefaultInstructor(course);

  if (mode === "bulk") {
    return (
      <form action={bulkCreateSessionsAction} className="grid gap-5">
        <input type="hidden" name="courseId" value={course.id} />
        <input type="hidden" name="redirectTo" value={`/admin/courses/${course.id}/sessions?view=calendar`} />

        <div className="rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">批次建立範圍</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-4">
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">開始日期<input name="startDate" type="date" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">結束日期<input name="endDate" type="date" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">開始<input name="startTime" type="time" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">結束<input name="endTime" type="time" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
          </div>
        </div>

        <fieldset className="rounded-[22px] border border-[#ead8ca] bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-[#4e4038]">上課星期</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekdays.map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-2 rounded-full border border-[#dbcabd] bg-[#fff9f3] px-3 py-2 text-sm">
                <input type="checkbox" name="weekdays" value={value} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-[22px] border border-[#ead8ca] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">課堂預設資料</p>
          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">已依年度課程 / 課程目錄預設帶入，可在這裡針對本次排課調整。</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-12">
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-8">單元<input name="topic" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" placeholder="課程單元" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-4">名額<input name="capacity" type="number" min={0} defaultValue={defaultCapacity} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-7">地點<input name="location" defaultValue={defaultLocation} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" placeholder="地點" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-5">講師<input name="instructorName" defaultValue={defaultInstructor} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" placeholder="講師" /></label>
          </div>
        </div>

        <button className="h-12 rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 text-sm font-bold text-white shadow-sm">批次排課</button>
      </form>
    );
  }

  return (
    <form action={saveSessionAction} className="grid gap-5">
      <input type="hidden" name="courseId" value={course.id} />
      <input type="hidden" name="redirectTo" value={`/admin/courses/${course.id}/sessions?view=calendar`} />
      <input type="hidden" name="status" value="scheduled" />

      <div className="rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">上課時間</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">日期<input name="date" type="date" defaultValue={defaultDate ?? ""} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">開始<input name="startTime" type="time" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">結束<input name="endTime" type="time" className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#ead8ca] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">課堂資料</p>
        <p className="mt-1 text-xs leading-5 text-[#8a7c72]">名額、地點與講師已依年度課程 / 課程目錄預設帶入。</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-12">
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-8">單元<input name="topic" className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="課程單元" /></label>
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-4">名額<input name="capacity" type="number" min={0} defaultValue={defaultCapacity} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-7">地點<input name="location" defaultValue={defaultLocation} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="地點" /></label>
          <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-5">講師<input name="instructorName" defaultValue={defaultInstructor} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="講師" /></label>
        </div>
      </div>

      <button className="h-12 rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 text-sm font-bold text-white shadow-sm">新增單堂</button>
    </form>
  );
}

function SessionDialog({ course, mode, defaultDate }: { course: any; mode: "single" | "bulk"; defaultDate?: string }) {
  const title = mode === "bulk" ? "批次排課" : "新增單堂";
  const description = mode === "bulk" ? "一次建立整期固定課表，例如每週一、三、五上課。" : "建立單一天的課堂；若從月曆日期點入，日期會先自動帶入。";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1712]/45 px-4 py-8">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_30px_90px_rgba(31,23,18,0.28)] sm:p-7">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">班級課表管理</p>
            <h2 className="mt-1 text-2xl font-black text-[#1f1712]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66584f]">{description}</p>
            <p className="mt-2 text-xs text-[#8a7c72]">{course.displayTitle ?? course.title}｜名額預設 {getDefaultCapacity(course)}｜地點預設 {getDefaultLocation(course) || "未設"}｜講師預設 {getDefaultInstructor(course) || "未設"}</p>
          </div>
          <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">關閉</Link>
        </div>
        <div className="rounded-[24px] border border-[#ead8ca] bg-white p-5">
          <QuickSessionForm course={course} mode={mode} defaultDate={defaultDate} />
        </div>
      </div>
    </div>
  );
}


function EditSessionDialog({ course, session, monthParam, from }: { course: any; session: any; monthParam?: string; from?: string }) {
  const closeHref = from === "course-sessions"
    ? `/admin/course-sessions${monthParam ? `?month=${monthParam}` : ""}`
    : `/admin/courses/${course.id}/sessions?view=list${monthParam ? `&month=${monthParam}` : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1712]/45 px-4 py-8">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_30px_90px_rgba(31,23,18,0.28)] sm:p-7">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">課堂修改</p>
            <h2 className="mt-1 text-2xl font-black text-[#1f1712]">{formatDisplayDate(session.date)}｜{session.startTime || "未定"}–{session.endTime || "未定"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66584f]">在這裡修改本堂課時間、地點、講師、名額與課堂狀態；儲存或取消後會回到原本進入的頁面。</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LessonAvailabilityBadge session={session} />
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(session.status, session.isActive)}`}>{statusLabel(session.status, session.isActive)}</span>
              <span className="rounded-full bg-[#f5ece4] px-3 py-1 text-xs text-[#8a7c72]">{session.topic || "未填單元"}</span>
            </div>
          </div>
          <Link href={closeHref} className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">關閉</Link>
        </div>

        <form action={saveSessionAction} className="grid gap-5 rounded-[24px] border border-[#ead8ca] bg-white p-5">
          <input type="hidden" name="id" value={session.id} />
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="bookedCount" value={session.bookedCount ?? 0} />
          <input type="hidden" name="redirectTo" value={closeHref} />

          <div className="rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">上課時間</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">日期<input name="date" type="date" defaultValue={session.date} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">開始<input name="startTime" type="time" defaultValue={session.startTime} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">結束<input name="endTime" type="time" defaultValue={session.endTime} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" /></label>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#ead8ca] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">課堂資料</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-12">
              <label className="grid min-w-0 gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-8">單元<input name="topic" defaultValue={session.topic ?? ""} className="h-12 w-full min-w-0 rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="單元" /></label>
              <label className="grid min-w-0 gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-4">名額<input name="capacity" type="number" min={session.bookedCount ?? 0} defaultValue={session.capacity ?? getDefaultCapacity(course)} className="h-12 w-full min-w-0 rounded-2xl border border-[#dbcabd] px-3 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-7">地點<input name="location" defaultValue={session.location || getDefaultLocation(course)} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="地點" /></label>
              <label className="grid gap-1 text-sm font-semibold text-[#4e4038] lg:col-span-5">講師<input name="instructorName" defaultValue={session.instructorName || getDefaultInstructor(course)} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="講師" /></label>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#ead8ca] bg-white p-4">
            <SessionStatusRadios defaultValue={session.status ?? "scheduled"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">預約截止<input name="bookingDeadline" defaultValue={session.bookingDeadline} className="h-12 w-full rounded-2xl border border-[#dbcabd] px-3 font-normal" placeholder="預約截止" /></label>
            <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">啟用狀態<select name="isActive" defaultValue={session.isActive ? "true" : "false"} className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"><option value="true">啟用</option><option value="false">停用</option></select></label>
          </div>

          <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">異動原因<textarea name="changeReason" defaultValue={session.changeReason ?? ""} className="min-h-24 rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" placeholder="停課、調課或補課時填寫原因" /></label>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href={closeHref} className="rounded-2xl border border-[#dbcabd] bg-white px-5 py-3 text-center text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">取消</Link>
            <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-5 py-3 text-sm font-bold text-white">儲存編輯</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionStatusRadios({ defaultValue }: { defaultValue?: string }) {
  const active = defaultValue ?? "scheduled";

  return (
    <fieldset className="grid gap-2 text-sm font-semibold text-[#4e4038]">
      <legend>課堂狀態</legend>
      <p className="text-xs font-normal leading-5 text-[#8a7c72]">選擇「停課」或「已取消」後，這堂課會在月曆與名單入口顯示為不可預約；正常上課、已調課、補課則保留可預約狀態。</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {sessionStatusOptions.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input type="radio" name="status" value={option.value} defaultChecked={option.value === active} className="peer sr-only" />
            <span className="block rounded-2xl border border-[#ead8ca] bg-white px-3 py-3 text-[#66584f] transition hover:bg-[#fff6ed] peer-checked:border-[#E85F00] peer-checked:bg-[#fff6ed] peer-checked:text-[#5A3726] peer-focus-visible:ring-2 peer-focus-visible:ring-[#E85F00]/40">
              <span className="flex items-center gap-2 text-sm font-black">
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  option.value === "scheduled"
                    ? "bg-emerald-500"
                    : option.value === "suspended"
                      ? "bg-amber-500"
                      : option.value === "rescheduled"
                        ? "bg-sky-500"
                        : option.value === "makeup"
                          ? "bg-violet-500"
                          : "bg-rose-500"
                }`} />
                {option.label}
              </span>
              <span className="mt-1 block text-xs font-normal opacity-80">{option.helper}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function AdminSessionsPage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { saved, error, view, month, dialog, date, edit, from } = await searchParams;
  const { categories, courses, reservations } = await getBookingData();
  const course = getCourse(courseId, courses) as any;

  if (!course) {
    notFound();
  }

  const category = categories.find((item) => item.id === course.categoryId);
  const categoryName = getCategoryName(course.categoryId, categories);
  const color = resolveCourseColor(course, category);
  const sortedSessions = (course.sessions ?? []).slice().sort((a: any, b: any) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const today = new Date().toISOString().slice(0, 10);
  const upcomingSessions = sortedSessions.filter((session: any) => session.date >= today);
  const nextSession = upcomingSessions[0];
  const finishedSessions = sortedSessions.filter((session: any) => session.date < today).length;
  const uncheckedCount = (reservations as any[]).filter((item) => item.courseId === course.id && item.attendanceStatus === "unchecked").length;
  const rosterCount = (reservations as any[]).filter((item) => item.courseId === course.id && item.status === "booked").length;
  const currentView = view === "overview" || view === "list" ? view : "calendar";
  const dialogMode = dialog === "single" || dialog === "bulk" ? dialog : null;
  const decodedEdit = edit ? decodeURIComponent(edit) : null;
  const selectedSession = decodedEdit ? sortedSessions.find((session: any) => session.id === decodedEdit || encodeURIComponent(session.id) === edit) : null;

  return (
    <AdminShell currentSection="course-settings.session">
      <section className="mb-6 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link href="/admin/course-sessions" className="mb-4 inline-flex text-sm font-medium text-[#66584f] hover:text-[#1f1712]">← 返回課堂詳情</Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <p className="text-sm font-medium text-[#B46F4A]">{categoryName}</p>
              <span className="rounded-full bg-[#f5ece4] px-2 py-1 text-xs text-[#8a7c72]">{course.code ?? course.id}</span>
              <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-[#66584f]">{course.year ?? "未設年度"}｜{course.termLabel ?? course.term ?? "未設期別"}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1f1712] sm:text-4xl">{course.displayTitle ?? course.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66584f]">班級課表管理以月曆為主：課堂點名看月曆進名單；課堂修改用同一份課表進入編輯；課堂總覽保留摘要資訊。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TabLink href={`/admin/courses/${course.id}/sessions`} active={currentView === "calendar"}>課堂點名</TabLink>
            <TabLink href={`/admin/courses/${course.id}/sessions?view=list`} active={currentView === "list"}>課堂修改</TabLink>
            <TabLink href={`/admin/courses/${course.id}/sessions?view=overview`} active={currentView === "overview"}>課堂總覽</TabLink>
          </div>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新時段。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請確認日期、時間、星期與名額是否填寫正確，或批量建立的時段是否已存在。</p> : null}

      {currentView === "overview" ? (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="本期總場次" value={sortedSessions.length} hint="已建立的上課場次" />
            <StatCard label="已完成場次" value={finishedSessions} hint="日期早於今天" />
            <StatCard label="名冊 / 報名" value={rosterCount} hint="目前有效報名人數" />
            <StatCard label="未完成點名" value={uncheckedCount} hint="尚未確認出席狀態" />
          </section>

          <section className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
              <p className="text-sm font-bold text-[#B46F4A]">下一堂課</p>
              {nextSession ? (
                <div className="mt-3 rounded-[24px] border border-[#ead8ca] bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <LessonAvailabilityBadge session={nextSession} />
                    <span className="rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-semibold text-[#8B5035]">{statusLabel(nextSession.status, nextSession.isActive)}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-[#1f1712]">{formatDisplayDate(nextSession.date)}｜{nextSession.startTime}–{nextSession.endTime}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#66584f]">{nextSession.topic || "未填單元"}｜{nextSession.location || course.defaultLocation || "未設地點"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={reservationHref(nextSession.id)} className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">進入點名 / 名單</Link>
                    <Link href={`/admin/courses/${course.id}/sessions?view=list`} className="rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-2 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">查看全部場次</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[24px] border border-dashed border-[#dbcabd] bg-white px-5 py-8 text-sm text-[#8a7c72]">尚未排定下一堂課，可回到月曆使用「＋新增單堂」或「＋批次排課」。</div>
              )}
            </div>

            <div className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
              <p className="text-sm font-bold text-[#B46F4A]">快速操作</p>
              <div className="mt-4 grid gap-3">
                <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-2xl border border-[#ead8ca] bg-white px-4 py-3 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">查看課堂點名</Link>
                <Link href={`/admin/courses/${course.id}/sessions?view=list`} className="rounded-2xl border border-[#ead8ca] bg-white px-4 py-3 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">查看課堂修改</Link>
                {nextSession ? <Link href={reservationHref(nextSession.id)} className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white hover:brightness-105">前往下一堂點名</Link> : null}
              </div>
            </div>
          </section>

        </>
      ) : null}

      {currentView === "calendar" ? (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="本期總場次" value={sortedSessions.length} hint="已建立的上課場次" />
            <StatCard label="近期場次" value={upcomingSessions.length} hint="今天起算的未來課堂" />
            <StatCard label="名冊 / 報名" value={rosterCount} hint="目前有效報名人數" />
            <StatCard label="未完成點名" value={uncheckedCount} hint="尚未確認出席狀態" />
          </section>

          <CalendarView course={course} color={color} sessions={sortedSessions} monthParam={month} mode="attendance" />

        </>
      ) : null}

      {currentView === "list" ? (
        <CalendarView course={course} color={color} sessions={sortedSessions} monthParam={month} mode="edit" />
      ) : null}
      {dialogMode ? <SessionDialog course={course} mode={dialogMode} defaultDate={date} /> : null}
      {selectedSession ? <EditSessionDialog course={course} session={selectedSession} monthParam={month} from={from} /> : null}
    </AdminShell>
  );
}
