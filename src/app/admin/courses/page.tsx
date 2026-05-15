import Link from "next/link";
import { disableCourseAction, saveCourseAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName, getCourseStatus } from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courses } = await getBookingData();

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">課程管理</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">課程列表</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">課程代碼依編碼體系填寫，例如 SF-B001。班級可在標題註明月份或梯次。</p>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新課程。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫課程代碼、名稱與分類。</p> : null}

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950">新增課程或班級</h2>
        <form action={saveCourseAction} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[140px_160px_160px_1fr]">
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">課程代碼</span>
              <input name="code" className="w-full rounded-md border border-zinc-300 px-3 py-3 uppercase" placeholder="SF-B001" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">方案</span>
              <select name="courseType" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
                {courseTypes.map((type) => <option key={type.id} value={type.id}>{type.id} {type.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">分類</span>
              <select name="categoryId" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
                {professionalCategories.map((category) => <option key={category.id} value={category.id}>{category.id} {category.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-zinc-700">課程/班級名稱</span>
              <input name="title" className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="美容丙級保證班 6月課表" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="defaultLocation" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="上課地點" />
            <input name="description" className="rounded-md border border-zinc-300 px-3 py-3" placeholder="課程說明" />
          </div>
          <textarea name="notes" className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="注意事項" />
          <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white md:w-40">儲存課程</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[980px] grid-cols-[120px_1.4fr_120px_100px_100px_260px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>代碼</span>
          <span>課程名稱</span>
          <span>分類</span>
          <span>狀態</span>
          <span>時段</span>
          <span>操作</span>
        </div>
        {courses.map((course) => (
          <div key={course.id} className="grid min-w-[980px] grid-cols-[120px_1.4fr_120px_100px_100px_260px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span className="font-semibold text-zinc-950">{course.code ?? course.id}</span>
            <span className="font-medium text-zinc-950">{course.title}</span>
            <span className="text-zinc-600">{getCategoryName(course.categoryId, categories)}</span>
            <span><CourseStatusBadge status={getCourseStatus(course)} /></span>
            <span>{course.sessions.length}</span>
            <span className="flex gap-2">
              <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">時段</Link>
              <details className="relative">
                <summary className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">編輯</summary>
                <form action={saveCourseAction} className="absolute right-0 z-10 mt-2 grid w-[520px] gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
                  <input type="hidden" name="id" value={course.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input name="code" defaultValue={course.code ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="課程代碼" />
                    <input name="title" defaultValue={course.title} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="課程名稱" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <select name="courseType" defaultValue={course.courseType ?? ""} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                      {courseTypes.map((type) => <option key={type.id} value={type.id}>{type.id} {type.name}</option>)}
                    </select>
                    <select name="categoryId" defaultValue={course.categoryId} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                      {professionalCategories.map((category) => <option key={category.id} value={category.id}>{category.id} {category.name}</option>)}
                    </select>
                  </div>
                  <input name="defaultLocation" defaultValue={course.defaultLocation} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="上課地點" />
                  <textarea name="description" defaultValue={course.description} className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="課程說明" />
                  <textarea name="notes" defaultValue={course.notes} className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="注意事項" />
                  <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                </form>
              </details>
              <form action={disableCourseAction}>
                <input type="hidden" name="id" value={course.id} />
                <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">停用</button>
              </form>
            </span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
