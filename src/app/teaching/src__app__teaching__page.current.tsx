import Link from "next/link";
import { getBookingData } from "@/lib/booking-repository";
import type { Course, CourseCategory, CourseSession, Instructor } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ name?: string; view?: string; month?: string; date?: string }>;
};

type TeachingSessionItem = {
  course: Course;
  session: CourseSession;
  isMine: boolean;
  color: string;
  categoryName: string;
};

type CalendarDay = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: TeachingSessionItem[];
};

const DEFAULT_CATEGORY_COLORS = [
  "#ec4899",
  "#10b981",
  "#8b5cf6",
  "#3b82f6",
  "#f97316",
  "#ef4444",
  "#06b6d4",
  "#f59e0b",
];

function normalizeName(value?: string) {
  return String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getMonthFromParam(value?: string) {
  const today = new Date();
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return new Date(today.getFullYear(), today.getMonth(), 1);
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return new Date(today.getFullYear(), today.getMonth(), 1);
  return new Date(year, month - 1, 1);
}

function getMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatDateText(date?: string) {
  if (!date) return "未設定日期";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return `${date.replaceAll("-", "/")}（${weekdays[parsed.getDay()]}）`;
}

function formatShortDate(date?: string) {
  if (!date) return "未設定";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}（週${weekdays[parsed.getDay()]}）`;
}

function sessionStatusLabel(status?: string) {
  if (status === "suspended") return "停課";
  if (status === "makeup") return "補課";
  if (status === "rescheduled") return "調課";
  if (status === "cancelled") return "取消";
  return "正常上課";
}

function attendanceWorkflowLabel(status?: string) {
  if (status === "in_progress") return "點名中";
  if (status === "completed") return "已完成";
  return "尚未開始";
}

function displayCourseTitle(course: Course) {
  return course.displayTitle || course.displayName || course.shortTitle || course.shortName || course.title;
}

function instructorIdsByName(instructors: Instructor[], teacherName: string) {
  const normalized = normalizeName(teacherName);
  return new Set(
    instructors
      .filter((item) => item.isActive !== false && normalizeName(item.name) === normalized)
      .map((item) => item.id),
  );
}

function splitNames(values: Array<string | undefined> = []) {
  return values
    .flatMap((value) => String(value ?? "").split(/[、,，/／]/g))
    .map((value) => normalizeName(value))
    .filter(Boolean);
}

function isTeachingSessionForName(course: Course, session: CourseSession, instructors: Instructor[], teacherName: string) {
  const normalized = normalizeName(teacherName);
  if (!normalized) return false;

  const matchedInstructorIds = instructorIdsByName(instructors, teacherName);
  const idCandidates = [
    session.instructorId,
    ...(session.assistantInstructorIds ?? []),
    course.primaryInstructorId,
    ...(course.assistantInstructorIds ?? []),
  ]
    .filter(Boolean)
    .map(String);

  if (idCandidates.some((id) => matchedInstructorIds.has(id))) return true;

  const nameCandidates = splitNames([
    session.instructorName,
    ...(session.assistantInstructorNames ?? []),
    course.primaryInstructorName,
    ...(course.assistantInstructorNames ?? []),
  ]);

  return nameCandidates.includes(normalized);
}

function getSessionColor(course: Course, categories: CourseCategory[]) {
  if (course.color) return course.color;
  const category = categories.find((item) => item.id === course.categoryId);
  if (category?.color) return category.color;
  const index = Math.abs(course.categoryId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % DEFAULT_CATEGORY_COLORS.length;
  return DEFAULT_CATEGORY_COLORS[index];
}

function getCategoryName(course: Course, categories: CourseCategory[]) {
  return categories.find((category) => category.id === course.categoryId)?.name ?? course.categoryId;
}

function collectCalendarSessions(courses: Course[], instructors: Instructor[], teacherName: string, categories: CourseCategory[]): TeachingSessionItem[] {
  return courses
    .flatMap((course) =>
      (course.sessions ?? []).map((session) => ({
        course,
        session,
        isMine: isTeachingSessionForName(course, session, instructors, teacherName),
        color: getSessionColor(course, categories),
        categoryName: getCategoryName(course, categories),
      })),
    )
    .filter(({ session }) => session.isActive !== false && session.status !== "cancelled")
    .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));
}

function buildCalendarDays(monthDate: Date, sessions: TeachingSessionItem[]): CalendarDay[] {
  const todayKey = getTodayKey();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateKey = formatDateKey(date);
    return {
      date: dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
      sessions: sessions.filter((item) => item.session.date === dateKey),
    };
  });
}

function dashboardHref({ name, view, month, date }: { name: string; view: string; month: string; date?: string }) {
  const params = new URLSearchParams();
  params.set("name", name);
  params.set("view", view);
  params.set("month", month);
  if (date) params.set("date", date);
  return `/teaching?${params.toString()}`;
}

function teachingSessionHref(sessionId: string, teacherName: string) {
  return `/teaching/sessions/${encodeRouteSegment(sessionId)}?name=${encodeURIComponent(teacherName)}`;
}

function countBookedReservations(reservations: Array<{ sessionId: string; status?: string }>, sessionId: string) {
  return reservations.filter((item) => item.sessionId === sessionId && item.status === "booked").length;
}

function CalendarSessionCard({ item, teacherName, bookedCount }: { item: TeachingSessionItem; teacherName: string; bookedCount: number }) {
  const content = (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black text-[#8a6a55]">{item.categoryName}</p>
          {item.isMine ? (
            <span className="rounded-full border border-[#f3c69f] bg-[#fff7ed] px-2 py-0.5 text-[11px] font-black text-[#9b4f1f]">可進入</span>
          ) : (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-black text-stone-500">僅查看</span>
          )}
        </div>
        <h3 className="mt-1 text-base font-black text-[#34231a]">{displayCourseTitle(item.course)}</h3>
        <p className="mt-2 text-sm font-bold text-[#5A3726]">{item.session.startTime || "--:--"}–{item.session.endTime || "--:--"}</p>
        <p className="mt-1 text-xs text-[#8a6a55]">{item.session.location || item.course.defaultLocation || "未設定地點"}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-full border border-[#ead8ca] bg-white px-3 py-1 text-[#5A3726]">{sessionStatusLabel(item.session.status ?? item.session.sessionStatus)}</span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">{attendanceWorkflowLabel(item.session.attendanceStatus)}</span>
          <span className="rounded-full border border-[#ead8ca] bg-white px-3 py-1 text-[#8a7c72]">{bookedCount} 人</span>
        </div>
      </div>
    </div>
  );

  if (!item.isMine) {
    return (
      <div className="rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] p-4 opacity-75">
        {content}
        <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-xs font-bold text-[#8a7c72]">這不是你負責的課堂，因此不能進入點名與課堂日誌。</p>
      </div>
    );
  }

  return (
    <Link
      href={teachingSessionHref(item.session.id, teacherName)}
      className="group block rounded-[22px] border border-[#ead8ca] bg-white p-4 transition hover:border-[#E85F00] hover:bg-[#fff7ed]"
      aria-label={`進入 ${displayCourseTitle(item.course)} 的授課頁`}
    >
      {content}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm font-black text-[#9b4f1f] transition group-hover:bg-[#E85F00] group-hover:text-white">
        <span>進入課堂</span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

export default async function TeachingDashboardPage({ searchParams }: PageProps) {
  const { name = "", view = "all", month: monthParam, date } = await searchParams;
  const teacherName = name.trim();
  const activeView = view === "mine" ? "mine" : "all";
  const monthDate = getMonthFromParam(monthParam);
  const monthKey = getMonthParam(monthDate);
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getTodayKey();
  const { courses, instructors = [], reservations, categories = [] } = await getBookingData();

  if (!teacherName) {
    return (
      <main className="min-h-screen bg-[#f7efe7] px-4 py-8 text-[#1f1712]">
        <section className="mx-auto max-w-xl rounded-[32px] border border-[#ead8ca] bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#B46F4A]">Teaching Desk</p>
          <h1 className="mt-2 text-2xl font-black">授課工作台</h1>
          <p className="mt-3 text-sm leading-6 text-[#7a6b60]">請先輸入授課人員姓名，系統會顯示對應課堂。</p>
          <Link href="/teaching/login" className="mt-5 inline-flex rounded-2xl bg-[#5A3726] px-5 py-3 text-sm font-black text-white">
            前往登入
          </Link>
        </section>
      </main>
    );
  }

  const allCalendarSessions = collectCalendarSessions(courses, instructors, teacherName, categories);
  const mySessions = allCalendarSessions.filter((item) => item.isMine);
  const visibleSessions = activeView === "mine" ? mySessions : allCalendarSessions;
  const calendarDays = buildCalendarDays(monthDate, visibleSessions);
  const selectedSessions = visibleSessions.filter((item) => item.session.date === selectedDate);
  const todayKey = getTodayKey();
  const todayMineCount = mySessions.filter((item) => item.session.date === todayKey).length;
  const upcomingMineCount = mySessions.filter((item) => !item.session.date || item.session.date >= todayKey).length;

  return (
    <main className="min-h-screen bg-[#f7efe7] px-4 py-6 text-[#1f1712] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-[32px] border border-[#ead8ca] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#B46F4A]">授課工作台</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{teacherName} 的課堂日曆</h1>
              <p className="mt-2 text-sm leading-6 text-[#7a6b60]">全部課程可查看日期與地點；只有你負責的課堂可以進入點名與課堂日誌。</p>
            </div>

          </div>
        </header>

        {mySessions.length === 0 ? (
          <section className="mb-5 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="text-base font-black">目前找不到你負責的課堂</p>
            <p className="mt-2 text-sm leading-6">請確認姓名是否與課堂的主要講師、助教／協同講師或講師名冊名稱完全一致。你仍可查看全部課程日曆，但無法進入非本人課堂。</p>
          </section>
        ) : null}

        <section className="mb-5 grid grid-cols-3 gap-2 rounded-[26px] border border-[#ead8ca] bg-white p-2 shadow-sm sm:gap-3 sm:p-3">
          <div className="rounded-[20px] bg-[#fff7ef] px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-black text-[#8a7c72] sm:text-xs">今日我的課</p>
            <p className="mt-1 text-2xl font-black text-[#5A3726] sm:text-3xl">{todayMineCount}</p>
          </div>
          <div className="rounded-[20px] bg-[#fffaf5] px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-black text-[#8a7c72] sm:text-xs">我的近期課</p>
            <p className="mt-1 text-2xl font-black text-[#5A3726] sm:text-3xl">{upcomingMineCount}</p>
          </div>
          <div className="rounded-[20px] bg-[#fffaf5] px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-black text-[#8a7c72] sm:text-xs">全部課程</p>
            <p className="mt-1 text-2xl font-black text-[#5A3726] sm:text-3xl">{allCalendarSessions.length}</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#ead8ca] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#1f1712]">課程日曆</p>
              <p className="mt-1 text-xs leading-5 text-[#8a7c72]">亮色圓點代表可進入的課堂，淡色圓點代表其他課程。切換「我的課程」可只看可進入的課堂。</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-[#fff7ef] p-1 text-sm font-black">
              <Link href={dashboardHref({ name: teacherName, view: "all", month: monthKey, date: selectedDate })} className={`rounded-2xl px-4 py-2 text-center ${activeView === "all" ? "bg-[#E85F00] text-white shadow-sm" : "text-[#5A3726] hover:bg-white"}`}>
                全部課程
              </Link>
              <Link href={dashboardHref({ name: teacherName, view: "mine", month: monthKey, date: selectedDate })} className={`rounded-2xl px-4 py-2 text-center ${activeView === "mine" ? "bg-[#E85F00] text-white shadow-sm" : "text-[#5A3726] hover:bg-white"}`}>
                我的課程
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#ead8ca] bg-[#fffdf9] p-3 sm:p-4">
              <div className="mb-4 grid grid-cols-3 gap-2">
                <Link href={dashboardHref({ name: teacherName, view: activeView, month: getMonthParam(shiftMonth(monthDate, -1)), date: selectedDate })} className="rounded-full bg-[#3a2a20] px-3 py-2 text-center text-sm font-bold text-white">
                  上月
                </Link>
                <Link href={dashboardHref({ name: teacherName, view: activeView, month: getMonthParam(new Date()), date: todayKey })} className="rounded-full border border-[#d8bda4] bg-white px-3 py-2 text-center text-sm font-bold text-[#6f4325]">
                  今天
                </Link>
                <Link href={dashboardHref({ name: teacherName, view: activeView, month: getMonthParam(shiftMonth(monthDate, 1)), date: selectedDate })} className="rounded-full bg-[#3a2a20] px-3 py-2 text-center text-sm font-bold text-white">
                  下月
                </Link>
              </div>

              <h2 className="mb-3 text-center text-xl font-black text-[#34231a]">{getMonthTitle(monthDate)}</h2>
              <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[#ead8c6] text-center text-xs font-bold text-[#6b4b36]">
                {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                  <div key={day} className="border-b border-[#ead8c6] bg-[#fff7ef] py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  const isSelected = day.date === selectedDate;
                  const visibleDots = day.sessions.slice(0, 4);
                  const hiddenCount = day.sessions.length - visibleDots.length;
                  return (
                    <Link
                      key={`${day.date}-${index}`}
                      href={dashboardHref({ name: teacherName, view: activeView, month: monthKey, date: day.date })}
                      className={`min-h-16 border-r border-t border-[#ead8c6] p-1 text-left align-top ${isSelected ? "bg-[#fff4e8] ring-2 ring-inset ring-[#d9823b]" : "bg-white"} ${day.isCurrentMonth ? "text-[#34231a]" : "text-[#c7ac94]"}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${day.isToday ? "bg-[#5A3726] text-white" : ""}`}>{day.day}</span>
                        {day.sessions.some((item) => item.isMine) ? <span className="h-1.5 w-1.5 rounded-full bg-[#E85F00]" aria-label="有可進入課堂" /> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {visibleDots.map((item) => (
                          <span
                            key={`${item.session.id}-${item.isMine ? "mine" : "all"}`}
                            className={`h-2.5 w-2.5 rounded-full ${item.isMine ? "opacity-100 ring-2 ring-white shadow-[0_0_0_1px_rgba(232,95,0,0.35)]" : "opacity-25"}`}
                            style={{ backgroundColor: item.color }}
                          />
                        ))}
                        {hiddenCount > 0 ? <span className="text-[10px] leading-none text-[#8a6a55]">+{hiddenCount}</span> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-[28px] border border-[#ead8ca] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#1f1712]">{formatDateText(selectedDate)}</p>
                  <p className="mt-1 text-xs text-[#8a7c72]">{activeView === "mine" ? "我的課程" : "全部課程"}</p>
                </div>
                <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-black text-[#9b4f1f]">{selectedSessions.length} 堂</span>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedSessions.length === 0 ? (
                  <div className="rounded-2xl bg-[#fff7ef] p-4 text-sm leading-6 text-[#8a6a55]">
                    <p>這一天沒有{activeView === "mine" ? "你的" : ""}課程。</p>
                    <p className="mt-1">你可以點選月曆中有顏色圓點的日期查看其他課堂。</p>
                  </div>
                ) : null}
                {selectedSessions.map((item) => (
                  <CalendarSessionCard key={item.session.id} item={item} teacherName={teacherName} bookedCount={countBookedReservations(reservations, item.session.id)} />
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#ead8ca] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#1f1712]">今日我的課</p>
              <p className="mt-1 text-xs text-[#8a7c72]">日曆是主要入口；這裡只保留今日課堂快速進入。</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mySessions.filter((item) => item.session.date === todayKey).length === 0 ? (
              <p className="rounded-2xl bg-[#fffaf5] px-4 py-3 text-sm text-[#8a7c72]">今天沒有你的授課課堂。</p>
            ) : null}
            {mySessions.filter((item) => item.session.date === todayKey).map((item) => (
              <Link
                key={item.session.id}
                href={teachingSessionHref(item.session.id, teacherName)}
                className="group rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-4 transition hover:border-[#E85F00] hover:bg-[#fff7ed]"
                aria-label={`進入 ${displayCourseTitle(item.course)} 的授課頁`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-[#1f1712]">{displayCourseTitle(item.course)}</p>
                    <p className="mt-1 text-sm font-bold text-[#5A3726]">{formatShortDate(item.session.date)}｜{item.session.startTime || "--:--"}–{item.session.endTime || "--:--"}</p>
                    <p className="mt-1 text-xs text-[#8a7c72]">{item.session.location || item.course.defaultLocation || "未設定地點"}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#f3c69f] bg-[#fff7ed] px-3 py-1 text-xs font-black text-[#9b4f1f]">可進入</span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm font-black text-[#9b4f1f] transition group-hover:bg-[#E85F00] group-hover:text-white">
                  <span>進入課堂</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
