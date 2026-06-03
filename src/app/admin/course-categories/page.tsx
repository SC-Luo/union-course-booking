import {
  deleteCategoryAction,
  disableCategoryAction,
  saveCategoryAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { CategoryColorPicker } from "./CategoryColorPicker";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const categoryColors: Record<string, string> = {
  B: "#E85F00",
  S: "#10b981",
  N: "#8b5cf6",
  E: "#3b82f6",
  H: "#E7892B",
  T: "#B46F4A",
  W: "#8B5035",
  O: "#64748b",
  D: "#06b6d4",
  M: "#1d4ed8",
  R: "#f59e0b",
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100"
          : "rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100"
      }
    >
      {active ? "啟用" : "停用"}
    </span>
  );
}

function ColorDot({ color, size = "md" }: { color: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-6 w-6";

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-[#dbcabd]`}
      style={{ backgroundColor: color }}
      aria-label={color}
      title={color}
    />
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#f1e2d6] bg-[#fffdf9] px-4 py-3">
      <span className="block text-xs font-medium text-[#8a7c72]">{label}</span>
      <span className="mt-1 block text-lg font-black text-[#1f1712]">{value}</span>
    </div>
  );
}

export default async function CourseCategoriesPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courseSeries, courseOfferings, courses } = await getBookingData();
  const presetCategoryIds = new Set(professionalCategories.map((category) => category.id));
  const presetCategories = professionalCategories.map((base) => {
    const savedCategory = categories.find((item) => item.id === base.id);
    return {
      ...base,
      ...savedCategory,
      id: savedCategory?.id ?? base.id,
      code: savedCategory?.code ?? base.id,
      color: savedCategory?.color ?? categoryColors[base.id] ?? "#B46F4A",
      sortOrder: savedCategory?.sortOrder ?? 0,
      isActive: savedCategory?.isActive ?? true,
    };
  });
  const customCategories = categories
    .filter((category) => !presetCategoryIds.has(category.id))
    .map((category, index) => ({
      ...category,
      code: category.code ?? category.id,
      color: category.color ?? categoryColors[category.id] ?? "#B46F4A",
      sortOrder: category.sortOrder ?? professionalCategories.length + index,
      isActive: category.isActive ?? true,
      description: category.description ?? "自訂課程類別。",
    }));
  const mergedCategories = [...presetCategories, ...customCategories].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return orderDiff !== 0 ? orderDiff : `${a.id}`.localeCompare(`${b.id}`);
  });

  return (
    <AdminShell currentSection="course-settings.category">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#B46F4A]">課程行政</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">課程類別</h1>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#66584f]">
              管理課程第 1 層分類，類別會影響前台篩選、後台標籤顏色與課程代碼前綴。代表色以下拉式色票選擇，選定後會明確顯示目前顏色；自訂類別也會一起出現在列表。
            </p>
          </div>
          <div className="rounded-2xl border border-[#ead8ca] bg-white/70 px-4 py-3 text-sm text-[#66584f]">
            <span className="font-bold text-[#1f1712]">{mergedCategories.filter((item) => item.isActive).length}</span> 個啟用類別
          </div>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存課程類別。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位或關聯資料。</p> : null}

      <details className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] shadow-[0_16px_45px_rgba(90,55,38,0.07)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <h2 className="text-xl font-black text-[#1f1712]">新增類別</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">平常先收納；需要新增新的課程分類時再展開。</p>
          </div>
          <span className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開新增</span>
        </summary>
        <form action={saveCategoryAction} className="grid gap-3 border-t border-[#ead8ca] p-6 sm:p-7 xl:grid-cols-[100px_180px_320px_1fr_120px] xl:items-end">
          <label>
            <span className="mb-2 block text-sm font-semibold text-[#4e4038]">代號</span>
            <input name="id" className="w-full rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 uppercase" placeholder="B" maxLength={2} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-[#4e4038]">名稱</span>
            <input name="name" className="w-full rounded-2xl border border-[#dbcabd] bg-white px-3 py-3" placeholder="美容" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-[#4e4038]">代表色</span>
            <CategoryColorPicker />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-[#4e4038]">說明</span>
            <input name="description" className="w-full rounded-2xl border border-[#dbcabd] bg-white px-3 py-3" placeholder="涵蓋範圍與用途" />
          </label>
          <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">儲存</button>
        </form>
      </details>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mergedCategories.map((category) => {
          const seriesCount = courseSeries.filter((item) => item.categoryId === category.id).length;
          const offeringCount = courseOfferings.filter((item) => item.categoryId === category.id).length;
          const legacyCount = courses.filter((course) => course.categoryId === category.id).length;
          const hasRelations = seriesCount > 0 || offeringCount > 0 || legacyCount > 0;

          return (
            <article
              key={category.id}
              className="relative overflow-hidden rounded-[26px] border border-[#ead8ca] bg-white shadow-[0_10px_28px_rgba(90,55,38,0.05)]"
            >
              <div className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: category.color }} />
              <div className="relative grid gap-4 p-5 pl-7">
                <div className="min-w-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <ColorDot color={category.color} size="md" />
                      <h2 className="text-xl font-black tracking-tight text-[#1f1712]">{category.name}</h2>
                      <span className="rounded-full border border-[#ead8ca] bg-[#fff6ed] px-3 py-1 text-xs font-black text-[#8B5035]">
                        {category.code ?? category.id}
                      </span>
                      <StatusPill active={category.isActive} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#66584f]">{category.description}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <MetricCard label="課程主檔" value={seriesCount} />
                    <MetricCard label="年度期別" value={offeringCount} />
                    <MetricCard label="舊班級資料" value={legacyCount} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <details>
                    <summary className="cursor-pointer rounded-xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#5A3726] hover:bg-[#fff6ed]">編輯</summary>
                    <form action={saveCategoryAction} className="mt-3 grid w-full gap-3 rounded-2xl border border-[#ead8ca] bg-[#fffdf9] p-4">
                      <input type="hidden" name="id" value={category.id} />
                      <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">名稱<input name="name" defaultValue={category.name} className="rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" /></label>
                      <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">代表色<CategoryColorPicker defaultValue={category.color} /></label>
                      <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">說明<textarea name="description" defaultValue={category.description} className="min-h-24 rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" /></label>
                      <input type="hidden" name="isActive" value={category.isActive ? "true" : "false"} />
                      <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white">儲存編輯</button>
                    </form>
                  </details>

                  <form action={disableCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="isActive" value={category.isActive ? "false" : "true"} />
                    <button
                      className={
                        category.isActive
                          ? "rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                          : "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      }
                    >
                      {category.isActive ? "停用" : "啟用"}
                    </button>
                  </form>

                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <button disabled={hasRelations} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">刪除</button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
