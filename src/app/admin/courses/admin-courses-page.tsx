import Link from "next/link";
import { disableCourseAction, saveCourseAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName, getCourseStatus, resolveCourseColor } from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

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


export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courses } = await getBookingData();
  const activeCategories = professionalCategories.filter((category) => {
    const savedCategory = categories.find((item) => item.id === category.id);
    return savedCategory?.isActive ?? true;
  });

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">課程管理</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">建立課程與進入工作區</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          這頁只負責新增課程、找到課程、進入課程工作區。時段、名單、統計與匯出都集中到單一課程工作區中處理。
        </p>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新課程。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫方案、分類與課程名稱。</p> : null}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-950">新增課程或班級</h2>
        <p className="mt-1 text-sm text-zinc-600">課程代碼會依「方案 + 分類 + 流水號」自動建立，不需要人工輸入。</p>
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
            <label>
              <span className="sr-only">課程顏色</span>
              <select name="color" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
                {colorPresets.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <textarea name="notes" className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="注意事項" />
          <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:w-40">儲存課程</button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">已建立課程</h2>
            <p className="mt-1 text-sm text-zinc-500">點「進入工作區」後，再處理時段、日曆、名單、統計與匯出。</p>
          </div>
          <Link href="/admin" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">回課程工作台 →</Link>
        </div>

        <div className="grid gap-4">
          {courses.map((course) => {
            const category = categories.find((item) => item.id === course.categoryId);
            const color = resolveCourseColor(course, category);
            const activeSessions = course.sessions.filter((session) => session.isActive);
            const nextSession = activeSessions.slice().sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0];

            return (
              <article key={course.id} className={`rounded-xl border p-4 ${course.isActive ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-zinc-100 opacity-70"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <span className="text-xs font-semibold text-emerald-700">{course.code ?? course.id}</span>
                      <CourseStatusBadge status={getCourseStatus(course)} />
                    </div>
                    <h3 className="mt-2 break-words text-xl font-semibold text-zinc-950">{course.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{getCategoryName(course.categoryId, categories)}｜共 {course.sessions.length} 堂｜開放 {activeSessions.length} 堂{nextSession ? `｜下一堂 ${nextSession.date} ${nextSession.startTime}` : ""}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                    <Link href={`/admin/courses/${course.id}`} className="rounded-md bg-zinc-900 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-700">
                      進入工作區
                    </Link>
                    <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                      時段 / 日曆
                    </Link>
                    <details className="sm:col-span-2">
                      <summary className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                        編輯基本資料
                      </summary>
                      <form action={saveCourseAction} className="mt-3 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                        <input type="hidden" name="id" value={course.id} />
                        <input type="hidden" name="code" value={course.code ?? ""} />
                        <label>
                          <span className="mb-2 block text-sm font-medium text-zinc-700">系統課程代碼</span>
                          <input value={course.code ?? ""} readOnly className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-zinc-500" placeholder="尚未產生" />
                        </label>
                        <input name="title" defaultValue={course.title} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="課程名稱" />
                        <div className="grid gap-3 md:grid-cols-3">
                          <select name="courseType" defaultValue={course.courseType ?? ""} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                            {courseTypes.map((type) => <option key={type.id} value={type.id}>{type.id} {type.name}</option>)}
                          </select>
                          <select name="categoryId" defaultValue={course.categoryId} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                            {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.id} {category.name}</option>)}
                          </select>
                          <select name="color" defaultValue={course.color ?? ""} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                            {colorPresets.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
                          </select>
                        </div>
                        <p className="text-xs leading-5 text-zinc-500">代碼為唯讀；顏色留空時會使用分類預設色。</p>
                        <input name="defaultLocation" defaultValue={course.defaultLocation} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="上課地點" />
                        <textarea name="description" defaultValue={course.description} className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="課程說明" />
                        <textarea name="notes" defaultValue={course.notes} className="min-h-20 rounded-md border border-zinc-300 px-3 py-3" placeholder="注意事項" />
                        <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                      </form>
                    </details>
                    <form action={disableCourseAction} className="sm:col-span-2">
                      <input type="hidden" name="id" value={course.id} />
                      <input type="hidden" name="isActive" value={course.isActive ? "false" : "true"} />
                      <button className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                        {course.isActive ? "停用課程" : "重新啟用課程"}
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
