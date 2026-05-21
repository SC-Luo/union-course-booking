import Link from "next/link";
import { saveCourseAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function resolveCourseColor(courseColor?: string, categoryColor?: string) {
  return courseColor || categoryColor || "#10b981";
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

export default async function AdminHomePage() {
  const { categories, courses, reservations } = await getBookingData();
  const activeCourses = courses.filter((course) => course.isActive);
  const activeCategories = professionalCategories.filter((category) => {
    const savedCategory = categories.find((item) => item.id === category.id);
    return savedCategory?.isActive ?? true;
  });

  const courseSummaries = activeCourses
    .map((course) => {
      const category = categories.find((item) => item.id === course.categoryId);
      const activeSessions = course.sessions.filter((session) => session.isActive);
      const upcomingSessions = activeSessions
        .slice()
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
      const courseReservations = reservations.filter((reservation) => reservation.courseId === course.id && reservation.status === "booked");
      const attendedCount = courseReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
      const absentCount = courseReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
      const totalCapacity = activeSessions.reduce((sum, session) => sum + session.capacity, 0);
      const bookedCount = activeSessions.reduce((sum, session) => sum + session.bookedCount, 0);
      const color = resolveCourseColor(course.color, category?.color);

      return {
        course,
        activeSessions,
        nextSession: upcomingSessions[0],
        bookedCount,
        totalCapacity,
        attendedCount,
        absentCount,
        color,
        categoryName: category?.name ?? course.categoryId,
      };
    })
    .sort((a, b) => {
      const aDate = a.nextSession ? `${a.nextSession.date} ${a.nextSession.startTime}` : "9999-12-31 23:59";
      const bDate = b.nextSession ? `${b.nextSession.date} ${b.nextSession.startTime}` : "9999-12-31 23:59";
      return aDate.localeCompare(bDate);
    });

  return (
    <AdminShell>
      <section className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">後台首頁</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">課程工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            先選擇要處理的課程，再進入單一課程工作區。後台以課程、日曆、名單與統計的工作流程為主。
          </p>
        </div>
      </section>

      <details className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer list-none rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-700">
          新增課程
        </summary>
        <p className="mt-2 text-sm text-zinc-600">課程代碼會依「方案 + 分類 + 流水號」自動建立，不需要人工輸入。</p>
        <form action={saveCourseAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr]">
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">方案</span>
              <select name="courseType" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
                {courseTypes.map((type) => <option key={type.id} value={type.id}>{type.id} {type.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">分類</span>
              <select name="categoryId" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.id} {category.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">課程 / 班級名稱</span>
              <input name="title" className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="美容丙級保證班 6月課表" />
            </label>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
            <input name="defaultLocation" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="上課地點" />
            <input name="description" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="課程說明" />
            <select name="color" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
              {colorPresets.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <textarea name="notes" className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="注意事項" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:w-40">儲存課程</button>
            <Link href="/admin/courses" className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-40">
              管理全部課程
            </Link>
          </div>
        </form>
      </details>

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">選擇課程開始作業</h2>
            <p className="mt-1 text-sm text-zinc-500">每張課程卡片都提供工作區、時段日曆、名單與統計入口。</p>
          </div>
          <Link href="/admin/stats" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
            查看課程統計 →
          </Link>
        </div>

        <div className="mt-5 grid gap-4">
          {courseSummaries.length === 0 ? <p className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">目前沒有開放中的課程。</p> : null}

          {courseSummaries.map(({ course, activeSessions, nextSession, bookedCount, totalCapacity, attendedCount, absentCount, color, categoryName }) => (
            <article key={course.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    <p className="text-xs font-semibold text-emerald-700">{course.code ?? course.id}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-zinc-500">{categoryName}</span>
                  </div>
                  <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">{course.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {nextSession ? `下一堂：${formatDate(nextSession.date)} ${nextSession.startTime}–${nextSession.endTime}｜${nextSession.topic || "未填單元"}` : "尚未建立開放時段"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[420px]">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-zinc-500">開放時段</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-950">{activeSessions.length}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-zinc-500">報名 / 名額</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-950">{bookedCount}/{totalCapacity}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-zinc-500">已到</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-950">{attendedCount}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-zinc-500">未到</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-950">{absentCount}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Link href={`/admin/courses/${course.id}`} className="rounded-md bg-zinc-900 px-3 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
                  進入工作區
                </Link>
                <Link href={`/admin/courses/${course.id}/sessions?view=calendar`} className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                  日曆檢視
                </Link>
                <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                  時段管理
                </Link>
                <Link href={nextSession ? `/admin/sessions/${nextSession.id}/reservations` : `/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                  報名名單
                </Link>
                <Link href={`/admin/stats?courseId=${encodeURIComponent(course.id)}`} className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                  課程統計
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-950">次要總覽</h2>
        <p className="mt-1 text-sm text-zinc-500">這裡只保留主管查看用的全站摘要，不作為主要工作入口。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">開放課程</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{activeCourses.length}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">總報名</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{reservations.filter((reservation) => reservation.status === "booked").length}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm text-zinc-500">總時段</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{activeCourses.reduce((sum, course) => sum + course.sessions.length, 0)}</p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
