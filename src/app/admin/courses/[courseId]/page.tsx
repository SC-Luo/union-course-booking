import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkCreateSessionsAction, saveCourseAction, saveSessionAction, updateAttendanceAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import {
  getCategoryName,
  getCourseStatus,
  getOfferingForCourse,
  getOfferingPeriodLabel,
  getSeriesForCourse,
  resolveCourseColor,
} from "@/lib/course-utils";
import type { AttendanceStatus, CourseSession, Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ month?: string; openSession?: string }>;
};

const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
const longWeekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return formatDate(date);
  return `${formatDate(date)} ${longWeekdayNames[parsed.getDay()]}`;
}

function toMonth(date: string) {
  return date.slice(0, 7);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(month: string, diff: number) {
  const [year, rawMonth] = month.split("-").map(Number);
  const date = new Date(year, rawMonth - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, rawMonth] = month.split("-");
  return `${year}年${Number(rawMonth)}月`;
}

function getCalendarDays(month: string) {
  const [year, rawMonth] = month.split("-").map(Number);
  const firstDay = new Date(year, rawMonth - 1, 1);
  const lastDay = new Date(year, rawMonth, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    return {
      key,
      gridKey: `${key}-${index}`,
      label: String(date.getDate()),
      inMonth: date.getMonth() === lastDay.getMonth(),
    };
  });
}

function countSessionAttendance(
  sessionId: string,
  reservations: Array<{ sessionId: string; status: string; attendanceStatus?: string }>,
) {
  const booked = reservations.filter(
    (reservation) => reservation.sessionId === sessionId && reservation.status !== "cancelled",
  );

  return {
    booked: booked.length,
    attended: booked.filter((reservation) => reservation.attendanceStatus === "attended").length,
    absent: booked.filter((reservation) => reservation.attendanceStatus === "absent").length,
    pending: booked.filter(
      (reservation) =>
        !reservation.attendanceStatus ||
        reservation.attendanceStatus === "pending" ||
        reservation.attendanceStatus === "unchecked",
    ).length,
  };
}

function attendanceButtonClass(current: string | undefined, target: AttendanceStatus) {
  const isActive = current === target || (!current && target === "unchecked");
  if (target === "attended") {
    return isActive
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  }
  if (target === "absent") {
    return isActive
      ? "border-rose-500 bg-rose-50 text-rose-700"
      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  }
  return "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
}

function SessionDetailCard({
  session,
  reservations,
  color,
  courseId,
  defaultOpen = false,
  highlight = false,
}: {
  session: CourseSession;
  reservations: Reservation[];
  color: string;
  courseId: string;
  defaultOpen?: boolean;
  highlight?: boolean;
}) {
  const sessionReservations = reservations.filter(
    (reservation) => reservation.sessionId === session.id && reservation.status !== "cancelled",
  );
  const attendance = countSessionAttendance(session.id, reservations);
  const redirectTo = `/admin/courses/${courseId}?month=${toMonth(session.date)}&openSession=${session.id}#session-${session.id}`;

  return (
    <article
      id={`session-${session.id}`}
      className={`scroll-mt-24 rounded-xl border-2 p-4 transition has-[details[open]]:border-sky-500 has-[details[open]]:bg-sky-50/70 has-[details[open]]:shadow-md ${
        highlight
          ? "border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-200"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-3 w-8 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {highlight ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">今日課堂</span> : null}
          </div>
          <h3 className="mt-2 text-base font-semibold text-zinc-950">
            {formatDisplayDate(session.date)}｜{session.startTime}–{session.endTime}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            {session.topic || "未填單元"}｜{session.location || "未設定地點"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["已報名", `${attendance.booked}/${session.capacity}`],
            ["剩餘名額", Math.max(session.capacity - attendance.booked, 0)],
            ["已到", attendance.attended],
            ["未到", attendance.absent],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <details className="group/student-list mt-4 rounded-lg border border-zinc-200 bg-white open:border-sky-300 open:bg-sky-50/40" open={defaultOpen}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-zinc-950 group-open/student-list:bg-sky-100 group-open/student-list:text-sky-900">
          <span>學生名單（{sessionReservations.length}）</span>
          <span className="hidden rounded-full bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white group-open/student-list:inline-flex">正在查看名單</span>
        </summary>
        <div className="border-t border-zinc-100 p-3">
          {sessionReservations.length === 0 ? (
            <p className="rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-500">這堂課目前沒有學生預約。</p>
          ) : (
            <div className="grid gap-2">
              {sessionReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm lg:grid-cols-[1fr_auto_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-zinc-950">{reservation.studentName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      手機末三碼：{reservation.phoneLastThree || "未填"}｜{reservation.bookedAt || "未記錄時間"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={updateAttendanceAction}>
                      <input type="hidden" name="reservationId" value={reservation.id} />
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="attendanceStatus" value="attended" />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <button className={`rounded-md border px-3 py-2 text-xs font-semibold ${attendanceButtonClass(reservation.attendanceStatus, "attended")}`}>
                        已到
                      </button>
                    </form>
                    <form action={updateAttendanceAction}>
                      <input type="hidden" name="reservationId" value={reservation.id} />
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="attendanceStatus" value="absent" />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <button className={`rounded-md border px-3 py-2 text-xs font-semibold ${attendanceButtonClass(reservation.attendanceStatus, "absent")}`}>
                        未到
                      </button>
                    </form>
                  </div>
                  <p className="text-xs text-zinc-500">狀態：{reservation.attendanceStatus || "未點名"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

export default async function AdminCourseWorkspacePage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { month, openSession } = await searchParams;
  const { categories, courses, reservations, courseSeries, courseOfferings, enrollments } = await getBookingData();
  const course = courses.find((item) => item.id === courseId);

  if (!course) {
    notFound();
  }

  const todayKey = getTodayKey();
  const todayMonth = toMonth(todayKey);
  const category = categories.find((item) => item.id === course.categoryId);
  const color = resolveCourseColor(course, category);
  const series = getSeriesForCourse(course, courseSeries);
  const offering = getOfferingForCourse(course, courseOfferings);
  const offeringRosterCount = enrollments.filter((enrollment) => {
    const offeringId = enrollment.offeringId ?? enrollment.courseOfferingId;
    return offeringId === offering.id && enrollment.status !== "withdrawn";
  }).length;
  const sortedSessions = course.sessions
    .slice()
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const currentMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : todayMonth;
  const previousMonth = addMonths(currentMonth, -1);
  const nextMonth = addMonths(currentMonth, 1);
  const calendarDays = getCalendarDays(currentMonth);
  const sessionsInMonth = sortedSessions.filter((session) => toMonth(session.date) === currentMonth);
  const groupedSessions = sessionsInMonth.reduce<Record<string, typeof sortedSessions>>((groups, session) => {
    groups[session.date] = groups[session.date] ?? [];
    groups[session.date].push(session);
    return groups;
  }, {});

  const todaySessions = sortedSessions.filter((session) => session.date === todayKey);
  const upcomingSessions = sortedSessions.filter((session) => session.date > todayKey);
  const historicalSessions = sortedSessions.filter((session) => session.date < todayKey);

  return (
    <AdminShell>
      <section className="mb-5">
        <Link href="/admin" className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
          ← 返回後台首頁
        </Link>

        <div className="mb-4">
          <p className="text-sm font-semibold text-emerald-700">年度期別班級工作區</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">班級設定、上課時段、名冊與點名</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            這裡處理單一年度期別班級的基礎資料、課程日曆、課堂新增、班級名冊、點名與檢定日期；課程主檔本體仍是「{series.title}」。
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                <p className="text-sm font-semibold text-emerald-700">{getCategoryName(course.categoryId, categories)}</p>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500">{course.code ?? course.id}</span>
                <CourseStatusBadge status={course.isActive === false ? "closed" : "available"} />
              </div>
              <h2 className="mt-3 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">{series.title}</h2>
              <p className="mt-2 text-xl font-semibold text-zinc-700">{getOfferingPeriodLabel(offering)}</p>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-2 lg:grid-cols-4">
                <p className="rounded-lg bg-zinc-50 px-3 py-2"><span className="block text-xs text-zinc-500">預設地點</span>{course.defaultLocation || "未設定"}</p>
                <p className="rounded-lg bg-zinc-50 px-3 py-2"><span className="block text-xs text-zinc-500">名冊 / 名額</span>{offeringRosterCount}/{course.totalCapacity ?? offering.capacity ?? "未設定"}</p>
                <p className="rounded-lg bg-zinc-50 px-3 py-2"><span className="block text-xs text-zinc-500">簡稱 / 來源</span>{offering.shortName ?? "無簡稱"}｜{offering.sourceSheet ?? "無來源"}</p>
                <p className="rounded-lg bg-zinc-50 px-3 py-2"><span className="block text-xs text-zinc-500">班級類型</span>{offering.rosterType === "fixed" ? "固定名冊檢定班" : course.courseMode === "booking_flexible" ? "自由預約" : "年度期別班級"}</p>
              </div>
              {course.notes ? <p className="mt-3 text-sm leading-6 text-zinc-500">{course.notes}</p> : null}
            </div>
          </div>

          <details className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 open:bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-950">
              課程基礎設定｜展開修改名稱、分類、名額、地點與開放狀態
            </summary>
            <form action={saveCourseAction} className="grid gap-4 border-t border-zinc-200 p-4">
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="code" value={course.code ?? ""} />
              <input type="hidden" name="courseType" value={course.courseType ?? course.code?.split("-")[0] ?? "SF"} />
              <input type="hidden" name="capacityMode" value={course.capacityMode ?? "course"} />
              <input type="hidden" name="redirectTo" value={`/admin/courses/${course.id}?month=${currentMonth}`} />

              <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr_0.7fr]">
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  課程名稱
                  <input name="title" defaultValue={course.title} className="rounded-md border border-zinc-300 px-3 py-3" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  課程分類
                  <select name="categoryId" defaultValue={course.categoryId} className="rounded-md border border-zinc-300 px-3 py-3">
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}（{category.id}）
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  課程色
                  <input name="color" type="color" defaultValue={course.color ?? color} className="h-[46px] rounded-md border border-zinc-300 px-2 py-1" />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.45fr_0.45fr]">
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  預設地點
                  <input name="defaultLocation" defaultValue={course.defaultLocation ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  總名額
                  <input name="totalCapacity" type="number" min="0" defaultValue={course.totalCapacity ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  開放狀態
                  <select name="isActive" defaultValue={course.isActive === false ? "false" : "true"} className="rounded-md border border-zinc-300 px-3 py-3">
                    <option value="true">可預約 / 啟用</option>
                    <option value="false">停止預約 / 停用</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                課程說明
                <textarea name="description" defaultValue={course.description ?? ""} rows={3} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                備註
                <textarea name="notes" defaultValue={course.notes ?? ""} rows={2} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <button className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
                儲存課程基礎設定
              </button>
            </form>
          </details>
        </div>
      </section>


      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-zinc-950">
            批次新增課堂｜依日期區間與星期快速建立上課時段
          </summary>
          <form action={bulkCreateSessionsAction} className="mt-4 grid gap-4 border-t border-zinc-200 pt-4">
            <input type="hidden" name="courseId" value={course.id} />
            <input type="hidden" name="redirectTo" value={`/admin/courses/${course.id}?month=${currentMonth}`} />

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                開始日期
                <input name="startDate" type="date" defaultValue={todayKey} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                結束日期
                <input name="endDate" type="date" defaultValue={todayKey} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
            </div>

            <fieldset className="rounded-lg bg-zinc-50 p-4">
              <legend className="mb-3 text-sm font-semibold text-zinc-700">上課星期</legend>
              <div className="flex flex-wrap gap-3 text-sm text-zinc-700">
                {weekdayNames.map((weekday, index) => (
                  <label key={weekday} className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
                    <input name="weekdays" type="checkbox" value={index} />
                    {weekday}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 lg:grid-cols-[0.8fr_0.8fr_1fr_0.5fr]">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                開始時間
                <input name="startTime" type="time" defaultValue="09:30" className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                結束時間
                <input name="endTime" type="time" defaultValue="16:30" className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                課堂內容 / 單元
                <input name="topic" defaultValue="未填單元" className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                名額
                <input name="capacity" type="number" min="0" defaultValue={course.totalCapacity ?? 20} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.6fr_0.35fr]">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                地點
                <input name="location" defaultValue={course.defaultLocation ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                預約截止時間
                <input name="bookingDeadline" placeholder="留空＝上課前一天 18:00" className="rounded-md border border-zinc-300 px-3 py-3" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                狀態
                <select name="isActive" defaultValue="true" className="rounded-md border border-zinc-300 px-3 py-3">
                  <option value="true">開放</option>
                  <option value="false">停用</option>
                </select>
              </label>
            </div>

            <button className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
              批次新增課堂
            </button>
          </form>
        </details>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">課程日曆</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">{formatMonthLabel(currentMonth)}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              進入工作區會優先顯示今天所在月份；今天日期會以淡黃色標示。日曆格右上角「+」可直接新增當日課堂，拖拉改期會留到下一階段做成互動式日曆。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/admin/courses/${course.id}?month=${previousMonth}`} className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700">上月</Link>
            <Link href={`/admin/courses/${course.id}?month=${todayMonth}`} className="rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50">今天</Link>
            <Link href={`/admin/courses/${course.id}?month=${nextMonth}`} className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700">下月</Link>
          </div>
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
          <div className="grid grid-cols-7 bg-zinc-50 text-center text-xs font-semibold text-zinc-500">
            {weekdayNames.map((weekday) => (
              <div key={weekday} className="border-r border-zinc-200 px-2 py-2 last:border-r-0">{weekday}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const daySessions = groupedSessions[day.key] ?? [];
              const isToday = day.key === todayKey;
              return (
                <div
                  key={day.gridKey}
                  className={`min-h-[132px] border-r border-t border-zinc-200 p-2 last:border-r-0 ${
                    isToday
                      ? "bg-amber-50 ring-2 ring-inset ring-amber-300"
                      : day.inMonth
                        ? "bg-white"
                        : "bg-zinc-50 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                    <span>{day.label}</span>
                    <div className="flex items-center gap-1">
                      {isToday ? <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] text-amber-900">今天</span> : null}
                      {day.inMonth ? (
                        <form action={saveSessionAction} title="快速新增這一天的課堂">
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="date" value={day.key} />
                          <input type="hidden" name="startTime" value="09:30" />
                          <input type="hidden" name="endTime" value="16:30" />
                          <input type="hidden" name="capacity" value={course.totalCapacity ?? 20} />
                          <input type="hidden" name="topic" value="未填單元" />
                          <input type="hidden" name="location" value={course.defaultLocation || ""} />
                          <input type="hidden" name="redirectTo" value={`/admin/courses/${course.id}?month=${currentMonth}`} />
                          <button className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700" aria-label={`新增 ${day.key} 課堂`}>
                            +
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1">
                    {daySessions.slice(0, 3).map((session) => {
                      const attendance = countSessionAttendance(session.id, reservations);
                      return (
                        <a
                          key={session.id}
                          href={`#session-${session.id}`}
                          className={`rounded-md border px-2 py-1 text-left text-xs leading-5 hover:bg-zinc-50 ${session.isActive ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 opacity-60"}`}
                          style={{ borderLeft: `5px solid ${color}` }}
                        >
                          <span className="block font-semibold text-zinc-950">{session.startTime} {session.topic || "未填單元"}</span>
                          <span className="block text-zinc-500">已到 {attendance.attended}｜未到 {attendance.absent}</span>
                        </a>
                      );
                    })}
                    {daySessions.length > 3 ? <p className="text-xs text-zinc-400">還有 {daySessions.length - 3} 堂</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:hidden">
          {Object.entries(groupedSessions).map(([date, sessions]) => (
            <article key={date} className={`rounded-xl border p-4 ${date === todayKey ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
              <h3 className="text-sm font-semibold text-zinc-950">
                {formatDisplayDate(date)} {date === todayKey ? "｜今天" : ""}
              </h3>
              <div className="mt-3 grid gap-3">
                {sessions.map((session) => {
                  const attendance = countSessionAttendance(session.id, reservations);
                  return (
                    <a key={session.id} href={`#session-${session.id}`} className={`block rounded-lg border bg-white p-3 ${session.isActive ? "border-zinc-200" : "border-zinc-200 opacity-60"}`}>
                      <div className="flex gap-3">
                        <span className="mt-1 h-12 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-950">{session.startTime}–{session.endTime}｜{session.topic || "未填單元"}</p>
                          <p className="mt-1 text-sm text-zinc-600">{session.location}</p>
                          <p className="mt-1 text-xs text-zinc-500">已報名 {attendance.booked}｜已到 {attendance.attended}｜未到 {attendance.absent}</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </article>
          ))}
          {sessionsInMonth.length === 0 ? <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">這個月份尚未建立時段。</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-emerald-700">各堂課詳情</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950">點名與學生名單</h2>
          <p className="mt-1 text-sm text-zinc-500">
            今日課堂優先顯示；今天以前的歷史課堂預設收合，仍可展開備查。
          </p>
        </div>

        <div className="grid gap-4">
          {todaySessions.length > 0 ? (
            <section className="grid gap-3">
              <h3 className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">今日課堂｜優先點名</h3>
              {todaySessions.map((session) => (
                <SessionDetailCard
                  key={session.id}
                  session={session}
                  reservations={reservations}
                  color={color}
                  courseId={course.id}
                  defaultOpen={openSession === session.id}
                  highlight
                />
              ))}
            </section>
          ) : null}

          {upcomingSessions.length > 0 ? (
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-zinc-700">即將上課</h3>
              {upcomingSessions.map((session) => (
                <SessionDetailCard
                  key={session.id}
                  session={session}
                  reservations={reservations}
                  color={color}
                  courseId={course.id}
                  defaultOpen={openSession === session.id}
                />
              ))}
            </section>
          ) : null}

          <details className="rounded-xl border border-zinc-200 bg-zinc-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800">
              歷史課堂（{historicalSessions.length} 場）
            </summary>
            <div className="grid gap-3 border-t border-zinc-200 p-4">
              {historicalSessions.length === 0 ? (
                <p className="text-sm text-zinc-500">目前沒有歷史課堂。</p>
              ) : (
                historicalSessions.map((session) => (
                  <SessionDetailCard
                    key={session.id}
                    session={session}
                    reservations={reservations}
                    color={color}
                    courseId={course.id}
                    defaultOpen={openSession === session.id}
                  />
                ))
              )}
            </div>
          </details>
        </div>
      </section>
    </AdminShell>
  );
}
