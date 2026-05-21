import { disableCategoryAction, saveCategoryAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const defaultCategoryColors: Record<string, string> = {
  B: "#ec4899",
  S: "#10b981",
  N: "#8b5cf6",
  E: "#3b82f6",
  H: "#f97316",
  T: "#ef4444",
  W: "#92400e",
  O: "#64748b",
  D: "#06b6d4",
  M: "#1d4ed8",
  R: "#f59e0b",
};

const colorOptions = [
  { value: "#ec4899", label: "粉紅" },
  { value: "#10b981", label: "綠色" },
  { value: "#8b5cf6", label: "紫色" },
  { value: "#3b82f6", label: "藍色" },
  { value: "#f97316", label: "橘色" },
  { value: "#ef4444", label: "紅色" },
  { value: "#92400e", label: "棕色" },
  { value: "#64748b", label: "灰色" },
  { value: "#06b6d4", label: "青色" },
  { value: "#1d4ed8", label: "深藍" },
  { value: "#f59e0b", label: "金色" },
];

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courses } = await getBookingData();
  const mergedCategories = professionalCategories.map((item) => {
    const savedCategory = categories.find((category) => category.id === item.id);
    return {
      ...item,
      ...savedCategory,
      code: savedCategory?.code ?? item.id,
      color: savedCategory?.color ?? defaultCategoryColors[item.id] ?? "#64748b",
      sortOrder: savedCategory?.sortOrder ?? 0,
      isActive: savedCategory?.isActive ?? true,
    };
  });

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">系統設定</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">課程分類、編碼表與顏色</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          分類是課程代碼與日曆顏色的基礎。課程代碼會依「課程類型 + 分類代碼 + 流水號」自動產生，例如 SF-B001。
        </p>
      </section>

      {saved ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新分類。</p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫分類代號與名稱。</p>
      ) : null}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">分類編碼表</h2>
            <p className="mt-1 text-sm text-zinc-500">工作人員只要選分類，不需要手動輸入課程代碼。</p>
          </div>
          <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">顏色會套用到後台課表與日曆檢視。</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mergedCategories.map((category) => (
            <div key={category.id} className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${category.isActive ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-zinc-100 opacity-70"}`}>
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
              <span className="w-8 text-sm font-bold text-zinc-950">{category.id}</span>
              <span className="text-sm text-zinc-700">{category.name}</span>
              {!category.isActive ? <span className="ml-auto rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-600">已停用</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-zinc-950">新增或編輯分類</h2>
        <form action={saveCategoryAction} className="mt-4 grid gap-3 lg:grid-cols-[100px_180px_160px_1fr_120px] lg:items-end">
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">代號</span>
            <input name="id" className="w-full rounded-md border border-zinc-300 px-3 py-3 uppercase" placeholder="B" maxLength={2} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">名稱</span>
            <input name="name" className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="美容" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">顏色</span>
            <select name="color" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3">
              {colorOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
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
            <article key={category.id} className={`rounded-xl border p-4 sm:p-5 ${category.isActive ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 opacity-75"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-3 w-10 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                    <p className="text-sm font-semibold text-emerald-700">{category.id}</p>
                    {!category.isActive ? <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs text-zinc-600">已停用</span> : null}
                  </div>
                  <h2 className="mt-2 break-words text-xl font-semibold text-zinc-950">{category.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{category.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <details>
                    <summary className="cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">編輯</summary>
                    <form action={saveCategoryAction} className="mt-3 grid w-full max-w-full gap-3 rounded-lg border border-zinc-200 bg-white p-4 lg:w-[460px]">
                      <input name="id" defaultValue={category.id} className="rounded-md border border-zinc-300 px-3 py-3 uppercase" />
                      <input name="name" defaultValue={category.name} className="rounded-md border border-zinc-300 px-3 py-3" />
                      <select name="color" defaultValue={category.color} className="rounded-md border border-zinc-300 bg-white px-3 py-3">
                        {colorOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <textarea name="description" defaultValue={category.description} className="min-h-24 rounded-md border border-zinc-300 px-3 py-3" />
                      <input type="hidden" name="isActive" value={category.isActive ? "true" : "false"} />
                      <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                    </form>
                  </details>
                  <form action={disableCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="isActive" value={category.isActive ? "false" : "true"} />
                    <button className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                      {category.isActive ? "停用" : "啟用"}
                    </button>
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
