import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bulkCreateSessionsAction,
  bulkDisableSessionsAction,
  disableSessionAction,
  saveCourseAction,
  saveSessionAction,
  updateAttendanceAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import {
  getCategoryName,
  getCourse,
  getCourseStatus,
  resolveCourseColor,
} from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ month?: string; openSession?: string }>;
};

const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
const commonStartTimes = [
  "09:00",
  "09:30",
  "10:00",
  "12:00",
  "13:00",
  "13:30",
  "14:00",
  "18:30",
  "19:00",
];
const commonEndTimes = [
  "11:00",
  "11:30",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "16:30",
  "17:00",
  "20:30",
  "21:00",
];

function uniqueOptions(options: string[], selected?: string) {
  return selected && !options.includes(selected)
    ? [selected, ...options]
    : options;
}
const longWeekdayNames = [
  "週日",
  "週一",
  "週二",
  "週三",
  "週四",
  "週五",
  "週六",
];

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
  const days: Array<{
    key: string;
    gridKey: string;
    label: number;
    inMonth: boolean;
  }> = [];

  const leadingDays = firstDay.getDay();
  for (let index = leadingDays - 1; index >= 0; index -= 1) {
    const date = new Date(year, rawMonth - 1, -index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({
      key,
      gridKey: `prev-${key}-${index}`,
      label: date.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const key = `${year}-${String(rawMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ key, gridKey: `current-${key}`, label: day, inMonth: true });
  }

  let trailingIndex = 0;
  while (days.length % 7 !== 0) {
    const last = new Date(`${days[days.length - 1].key}T00:00:00`);
    last.setDate(last.getDate() + 1);
    const key = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    days.push({
      key,
      gridKey: `next-${key}-${trailingIndex}`,
      label: last.getDate(),
      inMonth: false,
    });
    trailingIndex += 1;
  }

  return days;
}

function countSessionAttendance(
  sessionId: string,
  reservations: Array<{
    sessionId: string;
    status: string;
    attendanceStatus: string;
  }>,
) {
  const booked = reservations.filter(
    (reservation) =>
      reservation.sessionId === sessionId && reservation.status === "booked",
  );
  return {
    booked: booked.length,
    attended: booked.filter(
      (reservation) => reservation.attendanceStatus === "attended",
    ).length,
    absent: booked.filter(
      (reservation) => reservation.attendanceStatus === "absent",
    ).length,
  };
}

function getAttendanceLabel(status: string) {
  if (status === "attended") return "已到";
  if (status === "absent") return "未到";
  return "未點名";
}

function getSourceLabel(source?: string) {
  if (source === "manual") return "後台手動";
  if (source === "excel") return "Excel 匯入";
  return "線上報名";
}

function StudentListDetails({
  sessionId,
  reservations,
  redirectTo,
  defaultOpen = false,
}: {
  sessionId: string;
  redirectTo: string;
  defaultOpen?: boolean;
  reservations: Array<{
    id: string;
    sessionId: string;
    studentName: string;
    phoneLastThree: string;
    bookedAt: string;
    status: string;
    attendanceStatus: string;
    source?: string;
    note?: string;
  }>;
}) {
  const sessionReservations = reservations.filter(
    (reservation) =>
      reservation.sessionId === sessionId && reservation.status === "booked",
  );

  return (
    <details
      id={`session-${sessionId}`}
      open={defaultOpen}
      className="rounded-lg border border-zinc-200 bg-white open:border-amber-300 open:bg-amber-50"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-950">
        學生名單（{sessionReservations.length}）
      </summary>
      <div className="border-t border-zinc-100 p-3">
        {sessionReservations.length === 0 ? (
          <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
            這堂課目前沒有學生預約。
          </p>
        ) : (
          <div className="grid gap-2">
            {sessionReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="grid gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm lg:grid-cols-[1fr_170px_120px_100px] lg:items-center"
              >
                <div>
                  <p className="font-semibold text-zinc-950">
                    {reservation.studentName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    手機末三碼：{reservation.phoneLastThree}｜
                    {getSourceLabel(reservation.source)}
                  </p>
                  {reservation.note ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      備註：{reservation.note}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <form action={updateAttendanceAction}>
                    <input
                      type="hidden"
                      name="reservationId"
                      value={reservation.id}
                    />
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input
                      type="hidden"
                      name="attendanceStatus"
                      value="attended"
                    />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`${redirectTo}&openSession=${sessionId}#session-${sessionId}`}
                    />
                    <button
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${reservation.attendanceStatus === "attended" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"}`}
                    >
                      已到
                    </button>
                  </form>
                  <form action={updateAttendanceAction}>
                    <input
                      type="hidden"
                      name="reservationId"
                      value={reservation.id}
                    />
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input
                      type="hidden"
                      name="attendanceStatus"
                      value="absent"
                    />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`${redirectTo}&openSession=${sessionId}#session-${sessionId}`}
                    />
                    <button
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${reservation.attendanceStatus === "absent" ? "border-rose-600 bg-rose-50 text-rose-700" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"}`}
                    >
                      未到
                    </button>
                  </form>
                </div>
                <span className="text-zinc-500">{reservation.bookedAt}</span>
                <span className="text-zinc-500">有效預約</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function SessionEditForm({
  courseId,
  session,
  defaultLocation,
  redirectTo,
  compact = false,
}: {
  courseId: string;
  session?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    topic?: string;
    location: string;
    capacity: number;
    bookedCount: number;
    bookingDeadline: string;
    isActive: boolean;
  };
  defaultLocation: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  return (
    <form
      action={saveSessionAction}
      className={`grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 ${compact ? "" : "sm:p-4"}`}
    >
      {session ? <input type="hidden" name="id" value={session.id} /> : null}
      <input type="hidden" name="courseId" value={courseId} />
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}
      <input
        type="hidden"
        name="bookedCount"
        value={session?.bookedCount ?? 0}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          上課日期
          <input
            name="date"
            type="date"
            defaultValue={session?.date ?? ""}
            className="min-w-0 rounded-md border border-zinc-300 px-3 py-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          開始時間
          <select
            name="startTime"
            defaultValue={session?.startTime ?? "09:00"}
            className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
          >
            {uniqueOptions(commonStartTimes, session?.startTime).map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          結束時間
          <select
            name="endTime"
            defaultValue={session?.endTime ?? "12:00"}
            className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
          >
            {uniqueOptions(commonEndTimes, session?.endTime).map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          課堂內容
          <input
            name="topic"
            defaultValue={session?.topic ?? ""}
            className="min-w-0 rounded-md border border-zinc-300 px-3 py-3 text-sm"
            placeholder="例如：彩妝、衛生、術科練習"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          名額
          <input
            name="capacity"
            type="number"
            min={session?.bookedCount ?? 0}
            defaultValue={session?.capacity ?? 40}
            className="min-w-0 rounded-md border border-zinc-300 px-3 py-3 text-sm"
          />
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_190px]">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          地點
          <input
            name="location"
            defaultValue={session?.location ?? defaultLocation}
            className="min-w-0 rounded-md border border-zinc-300 px-3 py-3 text-sm"
            placeholder="上課地點"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          預約截止時間
          <input
            name="bookingDeadline"
            defaultValue={session?.bookingDeadline ?? ""}
            className="min-w-0 rounded-md border border-zinc-300 px-3 py-3 text-sm"
            placeholder="留空＝上課前一天 18:00"
          />
        </label>
      </div>
      <input
        type="hidden"
        name="isActive"
        value={session?.isActive === false ? "false" : "true"}
      />
      <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
        {session?.id ? "儲存這堂課" : "新增這堂課"}
      </button>
    </form>
  );
}

export default async function AdminCourseWorkspacePage({
  params,
  searchParams,
}: PageProps) {
  const { courseId } = await params;
  const { month, openSession } = await searchParams;
  const { categories, courses, reservations } = await getBookingData();
  const course = getCourse(courseId, courses);

  if (!course) {
    redirect("/admin?error=course-not-found");
  }

  const category = categories.find((item) => item.id === course.categoryId);
  const color = resolveCourseColor(course, category);
  const sortedSessions = course.sessions
    .filter((session) => session.isActive)
    .slice()
    .sort((a, b) =>
      `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );
  const firstMonth = sortedSessions[0]
    ? toMonth(sortedSessions[0].date)
    : new Date().toISOString().slice(0, 7);
  const currentMonth =
    month && /^\d{4}-\d{2}$/.test(month) ? month : firstMonth;
  const previousMonth = addMonths(currentMonth, -1);
  const nextMonth = addMonths(currentMonth, 1);
  const calendarDays = getCalendarDays(currentMonth);
  const sessionsInMonth = sortedSessions.filter(
    (session) => toMonth(session.date) === currentMonth,
  );
  const groupedSessions = sessionsInMonth.reduce<
    Record<string, typeof sortedSessions>
  >((groups, session) => {
    groups[session.date] = groups[session.date] ?? [];
    groups[session.date].push(session);
    return groups;
  }, {});
  const quickSwitchCourses = courses
    .filter((item) => item.id !== course.id)
    .slice()
    .sort((a, b) => (a.code ?? a.title).localeCompare(b.code ?? b.title));

  return (
    <AdminShell>
      <section className="mb-5">
        <Link
          href="/admin"
          className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          ← 返回後台首頁
        </Link>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex h-3 w-10 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-emerald-700">
                  {getCategoryName(course.categoryId, categories)}
                </p>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500">
                  {course.code ?? course.id}
                </span>
                <CourseStatusBadge status={getCourseStatus(course)} />
                {!course.isActive ? (
                  <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-600">
                    已停用
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 break-words text-2xl font-semibold text-zinc-950 sm:text-3xl">
                {course.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                預設地點：{course.defaultLocation || "未設定"}
              </p>
              {course.notes ? (
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {course.notes}
                </p>
              ) : null}
            </div>

            <aside className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-950">
                  快速切換課程
                </p>
                <span className="text-xs text-zinc-400">
                  {quickSwitchCourses.length} 門
                </span>
              </div>
              <div className="grid max-h-36 gap-2 overflow-auto pr-1">
                {quickSwitchCourses.length > 0 ? (
                  quickSwitchCourses.map((item) => {
                    const itemCategory = categories.find(
                      (categoryItem) => categoryItem.id === item.categoryId,
                    );
                    const itemColor = resolveCourseColor(item, itemCategory);
                    return (
                      <Link
                        key={item.id}
                        href={`/admin/courses/${item.id}`}
                        className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-zinc-400 hover:bg-zinc-50"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: itemColor }}
                          aria-hidden="true"
                        />
                        <span className="shrink-0 font-semibold text-zinc-700">
                          {item.code ?? item.id}
                        </span>
                        <span className="min-w-0 truncate text-zinc-600 group-hover:text-zinc-950">
                          {item.title}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <p className="rounded-lg bg-white px-3 py-3 text-sm text-zinc-500">
                    目前沒有其他課程可切換。
                  </p>
                )}
              </div>
            </aside>
          </div>

          <details className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <summary className="cursor-pointer font-semibold text-zinc-950">
              課程設定{" "}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                展開修改這門課的課程資訊與開放狀態
              </span>
            </summary>
            <form action={saveCourseAction} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={course.id} />
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/courses/${course.id}`}
              />
              <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  課程代碼
                  <input
                    name="code"
                    defaultValue={course.code ?? ""}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  課程名稱
                  <input
                    name="title"
                    defaultValue={course.title}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[160px_160px_160px_1fr]">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  分類
                  <select
                    name="categoryId"
                    defaultValue={course.categoryId}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  >
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  類型
                  <input
                    name="courseType"
                    defaultValue={course.courseType ?? "SF"}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  課程顏色
                  <input
                    name="color"
                    type="color"
                    defaultValue={color}
                    className="h-[46px] rounded-md border border-zinc-300 bg-white px-2 py-2"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  預設地點
                  <input
                    name="defaultLocation"
                    defaultValue={course.defaultLocation}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  備註
                  <input
                    name="notes"
                    defaultValue={course.notes}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  名額模式
                  <select
                    name="capacityMode"
                    defaultValue={course.capacityMode ?? "course"}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  >
                    <option value="course">整門課名額</option>
                    <option value="session">單堂課名額</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  總名額
                  <input
                    name="totalCapacity"
                    type="number"
                    min={0}
                    defaultValue={course.totalCapacity ?? ""}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  />
                </label>
              </div>
              <textarea
                name="description"
                defaultValue={course.description}
                className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                placeholder="課程描述"
              />
              <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={course.isActive}
                />
                課程開放使用；取消勾選後會顯示為已停用 / 已截止
              </label>
              <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
                儲存課程設定
              </button>
            </form>
          </details>
        </div>
      </section>

      <details className="mb-5 rounded-xl border border-zinc-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-950">
          修改時間
          <span className="ml-2 text-xs font-normal text-zinc-500">
            展開後可批次新增或調整上課時段
          </span>
        </summary>
        <form
          action={bulkCreateSessionsAction}
          className="grid gap-5 border-t border-zinc-100 p-5"
        >
          <input type="hidden" name="courseId" value={course.id} />
          <input
            type="hidden"
            name="redirectTo"
            value={`/admin/courses/${course.id}?month=${currentMonth}`}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              開始日期
              <input
                name="startDate"
                type="date"
                defaultValue={`${currentMonth}-01`}
                className="rounded-md border border-zinc-300 px-3 py-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              結束日期
              <input
                name="endDate"
                type="date"
                defaultValue={`${currentMonth}-01`}
                className="rounded-md border border-zinc-300 px-3 py-3 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-2 rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-600">上課星期</p>
            <div className="flex flex-wrap gap-3 text-sm text-zinc-700">
              {weekdayNames.map((weekday, index) => (
                <label key={weekday} className="inline-flex items-center gap-2">
                  <input type="checkbox" name="weekdays" value={index} />
                  {weekday}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-3 text-sm font-semibold text-zinc-950">
              上課時間與內容
            </p>
            <div className="grid gap-4 lg:grid-cols-[160px_160px_minmax(0,1fr)_140px]">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                開始時間
                <select
                  name="startTime"
                  defaultValue="09:00"
                  className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                >
                  {commonStartTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                結束時間
                <select
                  name="endTime"
                  defaultValue="12:00"
                  className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                >
                  {commonEndTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                課堂內容
                <input
                  name="topic"
                  className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                  placeholder="例如：彩妝、衛生"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">
                名額
                <input
                  name="capacity"
                  type="number"
                  min={0}
                  defaultValue={course.totalCapacity ?? 40}
                  className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              地點
              <input
                name="location"
                defaultValue={course.defaultLocation}
                className="rounded-md border border-zinc-300 px-3 py-3 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-zinc-600">
              預約截止時間
              <input
                name="bookingDeadline"
                className="rounded-md border border-zinc-300 px-3 py-3 text-sm"
                placeholder="留空＝上課前一天 18:00"
              />
            </label>
          </div>
          <input type="hidden" name="isActive" value="true" />
          <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">
            儲存批次修改時間
          </button>
        </form>
        <div className="border-t border-zinc-100 p-5">
          <details className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-rose-700">
              刪除全部上課時段
              <span className="ml-2 text-xs font-normal text-rose-500">
                從系統中刪除本課程所有課堂
              </span>
            </summary>
            <form
              action={bulkDisableSessionsAction}
              className="mt-3 grid gap-3"
            >
              <input type="hidden" name="courseId" value={course.id} />
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/courses/${course.id}?month=${currentMonth}`}
              />
              <p className="text-sm text-rose-600">
                這會直接刪除本課程所有上課時段與相關預約紀錄，不會保留在資料庫。若只是調整時間，請優先使用上方批次修改。
              </p>
              <button className="w-fit rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                刪除全部課堂
              </button>
            </form>
          </details>
        </div>
      </details>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">課程日曆</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
              {formatMonthLabel(currentMonth)}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              點選有課卡片可直接修改；點空白日期可直接新增這一天的上課時段。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <Link
              href={`/admin/courses/${course.id}?month=${previousMonth}`}
              className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700"
            >
              上月
            </Link>
            <Link
              href={`/admin/courses/${course.id}`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              今天
            </Link>
            <Link
              href={`/admin/courses/${course.id}?month=${nextMonth}`}
              className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-700"
            >
              下月
            </Link>
          </div>
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
          <div className="grid grid-cols-7 bg-zinc-50 text-center text-xs font-semibold text-zinc-500">
            {weekdayNames.map((weekday) => (
              <div
                key={weekday}
                className="border-r border-zinc-200 px-2 py-2 last:border-r-0"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const daySessions = groupedSessions[day.key] ?? [];
              return (
                <div
                  key={day.gridKey}
                  className={`relative min-h-[156px] border-r border-t border-zinc-200 p-2 last:border-r-0 ${day.inMonth ? "bg-white" : "bg-zinc-50 text-zinc-400"}`}
                >
                  <div className="text-xs font-semibold">{day.label}</div>
                  {daySessions.length === 0 && day.inMonth ? (
                    <>
                      <button
                        type="button"
                        popoverTarget={`new-session-${day.key}`}
                        className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50"
                        aria-label={`新增 ${formatDisplayDate(day.key)} 的課堂`}
                      >
                        +
                      </button>
                      <div
                        id={`new-session-${day.key}`}
                        popover=""
                        className="m-auto max-h-[86vh] w-[min(94vw,760px)] overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-2xl"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-zinc-950">
                              新增 {formatDisplayDate(day.key)} 的課堂
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              儲存後會回到本課程工作區，不會跳到其他管理頁面。
                            </p>
                          </div>
                          <button
                            type="button"
                            popoverTarget={`new-session-${day.key}`}
                            popoverTargetAction="hide"
                            className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
                          >
                            關閉
                          </button>
                        </div>
                        <SessionEditForm
                          courseId={course.id}
                          defaultLocation={course.defaultLocation}
                          redirectTo={`/admin/courses/${course.id}?month=${currentMonth}`}
                          session={{
                            id: "",
                            date: day.key,
                            startTime: "",
                            endTime: "",
                            topic: "",
                            location: course.defaultLocation,
                            capacity: course.totalCapacity ?? 40,
                            bookedCount: 0,
                            bookingDeadline: "",
                            isActive: true,
                          }}
                          compact
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="mt-2 grid gap-1">
                    {daySessions.slice(0, 3).map((session) => {
                      const attendance = countSessionAttendance(
                        session.id,
                        reservations,
                      );
                      return (
                        <div key={session.id}>
                          <button
                            type="button"
                            popoverTarget={`edit-session-${session.id}`}
                            className={`w-full rounded-md border px-2 py-1 text-left text-xs leading-5 ${session.isActive ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 opacity-60"}`}
                            style={{ borderLeft: `5px solid ${color}` }}
                          >
                            <span className="block font-semibold text-zinc-950">
                              {session.startTime} {session.topic || "未填單元"}
                            </span>
                            <span className="block text-zinc-500">
                              已到 {attendance.attended}｜未到{" "}
                              {attendance.absent}
                            </span>
                          </button>
                          <div
                            id={`edit-session-${session.id}`}
                            popover=""
                            className="m-auto max-h-[86vh] w-[min(94vw,760px)] overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-2xl"
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-zinc-950">
                                  修改 {formatDisplayDate(session.date)} 的課堂
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  在此直接修改課堂，不會跳到其他頁面。
                                </p>
                              </div>
                              <button
                                type="button"
                                popoverTarget={`edit-session-${session.id}`}
                                popoverTargetAction="hide"
                                className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
                              >
                                關閉
                              </button>
                            </div>
                            <SessionEditForm
                              courseId={course.id}
                              session={session}
                              defaultLocation={course.defaultLocation}
                              redirectTo={`/admin/courses/${course.id}?month=${currentMonth}`}
                              compact
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <form action={disableSessionAction}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={session.id}
                                />
                                <input
                                  type="hidden"
                                  name="courseId"
                                  value={course.id}
                                />
                                <input
                                  type="hidden"
                                  name="redirectTo"
                                  value={`/admin/courses/${course.id}?month=${currentMonth}`}
                                />
                                <input
                                  type="hidden"
                                  name="isActive"
                                  value={session.isActive ? "false" : "true"}
                                />
                                <button className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                  "刪除這堂課"
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {daySessions.length > 3 ? (
                      <p className="text-xs text-zinc-400">
                        還有 {daySessions.length - 3} 堂
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:hidden">
          {Object.entries(groupedSessions).map(([date, sessions]) => (
            <article
              key={date}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <h3 className="text-sm font-semibold text-zinc-950">
                {formatDisplayDate(date)}
              </h3>
              <div className="mt-3 grid gap-3">
                {sessions.map((session) => {
                  const attendance = countSessionAttendance(
                    session.id,
                    reservations,
                  );
                  return (
                    <details
                      key={session.id}
                      className={`rounded-lg border bg-white p-3 ${session.isActive ? "border-zinc-200" : "border-zinc-200 opacity-60"}`}
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex gap-3">
                          <span
                            className="mt-1 h-12 w-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-950">
                              {session.startTime}–{session.endTime}｜
                              {session.topic || "未填單元"}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {session.location}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              已報名 {attendance.booked}｜已到{" "}
                              {attendance.attended}｜未到 {attendance.absent}
                            </p>
                          </div>
                        </div>
                      </summary>
                      <div className="mt-3">
                        <SessionEditForm
                          courseId={course.id}
                          session={session}
                          defaultLocation={course.defaultLocation}
                          redirectTo={`/admin/courses/${course.id}?month=${currentMonth}`}
                          compact
                        />
                      </div>
                    </details>
                  );
                })}
              </div>
            </article>
          ))}
          {sessionsInMonth.length === 0 ? (
            <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">
              這個月份尚未建立時段。
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-950">各堂課詳情</h2>
        <p className="mt-1 text-sm text-zinc-500">
          依上課時間排列，可查看每堂課的報名與出席狀況。
        </p>
        <div className="mt-4 grid gap-3">
          {sortedSessions.map((session) => {
            const attendance = countSessionAttendance(session.id, reservations);
            return (
              <article
                key={session.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition has-[details[open]]:border-amber-300 has-[details[open]]:bg-amber-50 has-[details[open]]:ring-2 has-[details[open]]:ring-amber-200"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">
                      {formatDisplayDate(session.date)} {session.startTime}–
                      {session.endTime}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {session.topic || "未填單元"}｜
                      {session.location || "未設定地點"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[420px]">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-zinc-500">已報名</p>
                      <p className="font-semibold">
                        {attendance.booked}/{session.capacity}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-zinc-500">剩餘名額</p>
                      <p className="font-semibold">
                        {Math.max(session.capacity - attendance.booked, 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-zinc-500">已到</p>
                      <p className="font-semibold">{attendance.attended}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-zinc-500">未到</p>
                      <p className="font-semibold">{attendance.absent}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <StudentListDetails
                    sessionId={session.id}
                    reservations={reservations}
                    redirectTo={`/admin/courses/${course.id}?month=${currentMonth}`}
                    defaultOpen={openSession === session.id}
                  />
                </div>
              </article>
            );
          })}
          {sortedSessions.length === 0 ? (
            <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">
              尚未建立任何上課時段。
            </p>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
