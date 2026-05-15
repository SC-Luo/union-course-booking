import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { readBookingData } from "@/lib/data-store";
import { getCategoryName, getCourseStatus } from "@/lib/course-utils";

export default function AdminCoursesPage() {
  const { courses } = readBookingData();

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">課程管理</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">課程列表</h1>
        </div>
        <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white">新增課程</button>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-[180px_180px_1fr]">
        <select className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm">
          <option>目前開放</option>
          <option>即將開始</option>
          <option>已結束</option>
          <option>已關閉</option>
        </select>
        <select className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm">
          <option>全部分類</option>
          <option>職訓課程</option>
          <option>證照課</option>
          <option>講座</option>
        </select>
        <input className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm" placeholder="搜尋課程" />
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[880px] grid-cols-[1.4fr_120px_100px_100px_130px_220px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>課程名稱</span>
          <span>分類</span>
          <span>狀態</span>
          <span>時段數</span>
          <span>總預約</span>
          <span>操作</span>
        </div>
        {courses.map((course) => (
          <div key={course.id} className="grid min-w-[880px] grid-cols-[1.4fr_120px_100px_100px_130px_220px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span className="font-medium text-zinc-950">{course.title}</span>
            <span className="text-zinc-600">{getCategoryName(course.categoryId)}</span>
            <span><CourseStatusBadge status={getCourseStatus(course)} /></span>
            <span>{course.sessions.length}</span>
            <span>{course.sessions.reduce((total, session) => total + session.bookedCount, 0)}</span>
            <span className="flex gap-2">
              <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">時段</Link>
              <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">編輯</button>
            </span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
