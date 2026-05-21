import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkCreateSessionsAction, disableSessionAction, saveSessionAction } from "@/app/admin/actions";
import { AdminCourseCalendar } from "@/components/admin-course-calendar";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import { formatReservationCutoff, getCategoryName, getCourse, getSessionStatus, resolveCourseColor } from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; view?: string }>;
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

const longWeekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  return `${date.replaceAll("-", "/")} ${longWeekdayNames[parsed.getDay()]}`;
}

function getSessionCapacityText(bookedCount: number, capacity: number) {
  return `已報名 ${bookedCount}｜容量 ${capacity}`;
}

export default async function AdminSessionsPage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { saved, error, view } = await searchParams;
  const { categories, courses } = await getBookingData();
  const course = getCourse(courseId, courses);

  if (!course) {
    notFound();
  }

  const category = categories.find((item) => item.id === course.categoryId);
  const categoryName = getCategoryName(course.categoryId, categories);
  const color = resolveCourseColor(course, category);
  const sortedSessions = course.sessions.slice().sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const isCardView = view === "cards";

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/admin/courses/${course.id}`} className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
            ← 返回課程工作區
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-700">{categoryName}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500">{course.code ?? course.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">{course.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">預設地點：{course.defaultLocation || "未設定"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/courses/${course.id}/sessions`} className={`rounded-md px-4 py-2 text-sm font-semibold ${isCardView ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50" : "bg-zinc-900 text-white"}`}>
            日曆檢視
          </Link>
          <Link href={`/admin/courses/${course.id}/sessions?view=cards`} className={`rounded-md px-4 py-2 text-sm font-semibold ${isCardView ? "bg-zinc-900 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"}`}>
            卡片檢視
          </Link>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新時段。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請確認日期、時間、星期與名額是否填寫正確，或批量建立的時段是否已存在。</p> : null}

      {!isCardView ? (
        <AdminCourseCalendar course={course} categoryName={categoryName} color={color} />
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-zinc-950">時段卡片檢視</h2>
          <p className="mt-1 text-sm text-zinc-500">適合編輯單一時段、停用時段、查看名單。</p>
          <div className="mt-5 grid gap-4">
            {sortedSessions.map((session) => (
              <article key={session.id} className={`rounded-xl border p-4 ${session.isActive ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-zinc-100 opacity-70"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <CourseStatusBadge status={getSessionStatus(session)} />
                      {!session.isActive ? <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-600">已停用</span> : null}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-950">{formatDisplayDate(session.date)} {session.startTime}–{session.endTime}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{session.topic || "未填單元"}｜{session.location}</p>
                    <p className="mt-1 text-xs text-zinc-500">{getSessionCapacityText(session.bookedCount, session.capacity)}｜{formatReservationCutoff(session)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link href={`/admin/sessions/${session.id}/reservations`} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100">
                      名單 / 出席
                    </Link>
                    <details>
                      <summary className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100">編輯</summary>
                      <form action={saveSessionAction} className="mt-3 grid w-full gap-3 rounded-lg border border-zinc-200 bg-white p-4 lg:w-[520px]">
                        <input type="hidden" name="id" value={session.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="bookedCount" value={session.bookedCount} />
                        <div className="grid gap-3 md:grid-cols-3">
                          <input name="date" type="date" defaultValue={session.date} className="rounded-md border border-zinc-300 px-3 py-3" />
                          <input name="startTime" type="time" defaultValue={session.startTime} className="rounded-md border border-zinc-300 px-3 py-3" />
                          <input name="endTime" type="time" defaultValue={session.endTime} className="rounded-md border border-zinc-300 px-3 py-3" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                          <input name="topic" defaultValue={session.topic ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="單元" />
                          <input name="capacity" type="number" min={session.bookedCount} defaultValue={session.capacity} className="rounded-md border border-zinc-300 px-3 py-3" />
                        </div>
                        <input name="location" defaultValue={session.location} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="地點" />
                        <input name="bookingDeadline" defaultValue={session.bookingDeadline} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="預約截止" />
                        <input type="hidden" name="isActive" value={session.isActive ? "true" : "false"} />
                        <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                      </form>
                    </details>
                    <form action={disableSessionAction}>
                      <input type="hidden" name="id" value={session.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="isActive" value={session.isActive ? "false" : "true"} />
                      <button className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100">{session.isActive ? "停用" : "啟用"}</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
            {sortedSessions.length === 0 ? <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">尚未建立時段。</p> : null}
          </div>
        </section>
      )}

      <details className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-zinc-950">建立 / 批量建立時段</summary>
        <div className="mt-4 grid gap-6">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <h2 className="text-base font-semibold text-zinc-950">批量建立時段</h2>
            <p className="mt-1 text-sm text-zinc-600">適合一次建立整期課表，例如每週一、三、五共 20 堂。</p>
            <form action={bulkCreateSessionsAction} className="mt-4 grid gap-3">
              <input type="hidden" name="courseId" value={course.id} />
              <div className="grid gap-3 lg:grid-cols-[150px_150px_120px_120px_120px_1fr]">
                <input name="startDate" type="date" className="rounded-md border border-zinc-300 bg-white px-3 py-3" />
                <input name="endDate" type="date" className="rounded-md border border-zinc-300 bg-white px-3 py-3" />
                <input name="startTime" type="time" className="rounded-md border border-zinc-300 bg-white px-3 py-3" />
                <input name="endTime" type="time" className="rounded-md border border-zinc-300 bg-white px-3 py-3" />
                <input name="capacity" type="number" min={0} defaultValue={40} className="rounded-md border border-zinc-300 bg-white px-3 py-3" />
                <input name="topic" className="rounded-md border border-zinc-300 bg-white px-3 py-3" placeholder="單元" />
              </div>
              <fieldset className="rounded-lg border border-emerald-200 bg-white p-3">
                <legend className="px-1 text-sm font-medium text-zinc-700">上課星期</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weekdays.map(({ value, label }) => (
                    <label key={value} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
                      <input type="checkbox" name="weekdays" value={value} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_140px] lg:items-end">
                <input name="location" defaultValue={course.defaultLocation} className="rounded-md border border-zinc-300 bg-white px-3 py-3" placeholder="地點" />
                <input name="bookingDeadline" className="rounded-md border border-zinc-300 bg-white px-3 py-3" placeholder="預約截止，可留空" />
                <button className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800">批量建立</button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-base font-semibold text-zinc-950">新增單一時段</h2>
            <form action={saveSessionAction} className="mt-4 grid gap-3">
              <input type="hidden" name="courseId" value={course.id} />
              <div className="grid gap-3 lg:grid-cols-[150px_120px_120px_120px_1fr]">
                <input name="date" type="date" className="rounded-md border border-zinc-300 px-3 py-3" />
                <input name="startTime" type="time" className="rounded-md border border-zinc-300 px-3 py-3" />
                <input name="endTime" type="time" className="rounded-md border border-zinc-300 px-3 py-3" />
                <input name="capacity" type="number" min={0} defaultValue={40} className="rounded-md border border-zinc-300 px-3 py-3" />
                <input name="topic" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="單元" />
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_120px] lg:items-end">
                <input name="location" defaultValue={course.defaultLocation} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="地點" />
                <input name="bookingDeadline" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="預約截止，可留空" />
                <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">新增</button>
              </div>
            </form>
          </section>
        </div>
      </details>
    </AdminShell>
  );
}
