import { disableCategoryAction, saveCategoryAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courses } = await getBookingData();
  const mergedCategories = professionalCategories.map((item) => categories.find((category) => category.id === item.id) ?? { ...item, code: item.id, sortOrder: 0, isActive: true });

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">分類管理</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">課程分類</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">分類採課程編碼體系的專業類別代號；排序欄位不顯示，各分類會直接列出對應課程。</p>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新分類。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫分類代號與名稱。</p> : null}

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950">新增或編輯分類</h2>
        <form action={saveCategoryAction} className="grid gap-3 md:grid-cols-[100px_180px_1fr_120px] md:items-end">
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">代號</span>
            <input name="id" className="w-full rounded-md border border-zinc-300 px-3 py-3 uppercase" placeholder="B" maxLength={2} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">名稱</span>
            <input name="name" className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="美容" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">說明</span>
            <input name="description" className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="涵蓋範圍" />
          </label>
          <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存</button>
        </form>
      </section>

      <section className="grid gap-4">
        {mergedCategories.map((category) => {
          const categoryCourses = courses.filter((course) => course.categoryId === category.id);

          return (
            <article key={category.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{category.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-950">{category.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{category.description}</p>
                </div>
                <div className="flex gap-2">
                  <details className="relative">
                    <summary className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">編輯</summary>
                    <form action={saveCategoryAction} className="absolute right-0 z-10 mt-2 grid w-[420px] gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
                      <input name="id" defaultValue={category.id} className="rounded-md border border-zinc-300 px-3 py-3 uppercase" />
                      <input name="name" defaultValue={category.name} className="rounded-md border border-zinc-300 px-3 py-3" />
                      <textarea name="description" defaultValue={category.description} className="min-h-24 rounded-md border border-zinc-300 px-3 py-3" />
                      <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                    </form>
                  </details>
                  <form action={disableCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">停用</button>
                  </form>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {categoryCourses.length === 0 ? <p className="text-sm text-zinc-400">目前沒有課程。</p> : null}
                {categoryCourses.map((course) => (
                  <div key={course.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    <span className="font-semibold text-zinc-950">{course.code ?? course.id}</span>｜{course.title}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
