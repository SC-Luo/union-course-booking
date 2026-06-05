import {
  deleteCategoryAction,
  disableCategoryAction,
  saveCategoryAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { CategoryColorPicker } from "./CategoryColorPicker";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
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

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-[#dbcabd]"
      style={{ backgroundColor: color }}
      aria-label={color}
      title={color}
    />
  );
}


function RelationList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#ead8ca] bg-[#fffdf9] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-[#5A3726]">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#8B5035] ring-1 ring-[#ead8ca]">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {items.map((name, index) => (
            <li key={`${title}-${index}-${name}`} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#4e4038] ring-1 ring-[#f1dfd1]">
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[#8a7c72] ring-1 ring-[#f1dfd1]">目前沒有資料</p>
      )}
    </div>
  );
}

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;

  const message =
    error === "category-in-use"
      ? "這個分類仍被課程主檔、今年度班期或歷史班期引用，請先移動相關課程後再刪除。"
      : error === "invalid"
        ? "無法完成操作，請確認代號與名稱是否完整。"
        : "無法完成操作，請稍後再試。";

  return (
    <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
      {message}
    </p>
  );
}

export default async function CourseCategoriesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const { saved, error, edit } = resolvedSearchParams;
  const { categories, courseSeries, courseOfferings, courses } = await getBookingData();
  const mergedCategories = categories
    .map((category, index) => ({
      ...category,
      code: category.code ?? category.id,
      color: category.color ?? categoryColors[category.id] ?? "#B46F4A",
      sortOrder: category.sortOrder ?? index,
      isActive: category.isActive ?? true,
    }))
    .sort((a, b) => {
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
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66584f]">
              管理前台篩選、後台標籤顏色與課程代碼前綴。
            </p>
          </div>
          <div className="rounded-2xl border border-[#ead8ca] bg-white/70 px-4 py-3 text-sm text-[#66584f]">
            <span className="font-bold text-[#1f1712]">{mergedCategories.filter((item) => item.isActive).length}</span> 個啟用類別
          </div>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存課程類別。</p> : null}
      <ErrorMessage error={error} />

      <details className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] shadow-[0_16px_45px_rgba(90,55,38,0.07)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <h2 className="text-xl font-black text-[#1f1712]">新增類別</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">需要新的課程分類時再展開。</p>
          </div>
          <span className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開新增</span>
        </summary>
        <form action={saveCategoryAction} className="grid gap-3 border-t border-[#ead8ca] p-6 sm:p-7 xl:grid-cols-[100px_180px_320px_120px] xl:items-end">
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
          <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">儲存</button>
        </form>
      </details>

      <section className="grid gap-3">
        {mergedCategories.map((category) => {
          const relatedSeries = courseSeries.filter((item) => item.categoryId === category.id);
          const relatedOfferings = courseOfferings.filter((item) => item.categoryId === category.id);
          const relatedCourses = courses.filter((course) => course.categoryId === category.id);
          const seriesCount = relatedSeries.length;
          const offeringCount = relatedOfferings.length;
          const legacyCount = relatedCourses.length;
          const hasRelations = seriesCount > 0 || offeringCount > 0 || legacyCount > 0;

          const editHref = `?edit=${encodeURIComponent(category.id)}`;
          const isEditing = edit === category.id;
          const closeHref = "/admin/course-categories";

          return (
            <article
              key={category.id}
              className="relative overflow-hidden rounded-[22px] border border-[#ead8ca] bg-white/90 shadow-[0_8px_20px_rgba(90,55,38,0.04)]"
            >
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: category.color }} />
              <div className="relative grid gap-3 p-4 pl-6 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ColorDot color={category.color} />
                    <h2 className="text-lg font-black tracking-tight text-[#1f1712]">{category.name}</h2>
                    <span className="rounded-full border border-[#ead8ca] bg-[#fff6ed] px-2.5 py-0.5 text-xs font-black text-[#8B5035]">
                      {category.code ?? category.id}
                    </span>
                    <StatusPill active={category.isActive} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-[#66584f]">
                  <span>課程主檔 <b className="text-[#1f1712]">{seriesCount}</b></span>
                  <span>今年度班期 <b className="text-[#1f1712]">{offeringCount}</b></span>
                  <span>歷史班期 <b className="text-[#1f1712]">{legacyCount}</b></span>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <a href={editHref} className="rounded-xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#5A3726] hover:bg-[#fff6ed]">
                    編輯
                  </a>
                </div>
              </div>

              {isEditing ? (
                <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
                  <a href={closeHref} className="absolute inset-0 cursor-default" aria-label="關閉編輯視窗">
                    <span className="sr-only">關閉編輯視窗</span>
                  </a>
                  <div className="relative z-10 mx-auto flex min-h-full items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] shadow-[0_24px_90px_rgba(31,23,18,0.22)]">
                      <div className="flex items-start justify-between gap-4 border-b border-[#ead8ca] px-6 py-5">
                        <div>
                          <p className="text-sm font-bold text-[#B46F4A]">編輯課程類別</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ColorDot color={category.color} />
                            <h2 className="text-2xl font-black text-[#1f1712]">{category.name}</h2>
                            <span className="rounded-full border border-[#ead8ca] bg-[#fff6ed] px-2.5 py-0.5 text-xs font-black text-[#8B5035]">{category.code ?? category.id}</span>
                            <StatusPill active={category.isActive} />
                          </div>
                        </div>
                        <a href={closeHref} className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">關閉</a>
                      </div>

                      <div className="max-h-[calc(90vh-112px)] overflow-y-auto p-6">
                        <form action={saveCategoryAction} className="grid gap-4 rounded-[24px] border border-[#ead8ca] bg-white p-5 md:grid-cols-[1fr_280px]">
                          <input type="hidden" name="id" value={category.id} />
                          <label className="grid gap-2 text-sm font-bold text-[#4e4038]">
                            名稱
                            <input name="name" defaultValue={category.name} className="rounded-2xl border border-[#dbcabd] px-4 py-3 font-normal" />
                          </label>
                          <label className="grid gap-2 text-sm font-bold text-[#4e4038]">
                            代表色
                            <CategoryColorPicker defaultValue={category.color} />
                          </label>
                          <input type="hidden" name="isActive" value={category.isActive ? "true" : "false"} />
                          <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm md:col-span-2">儲存分類設定</button>
                        </form>

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                          <RelationList title="課程主檔" items={relatedSeries.map((item) => item.name ?? item.title ?? item.id)} />
                          <RelationList
                            title="今年度班期"
                            items={relatedOfferings.map((item) => {
                              const title = item.title ?? item.name ?? item.id;
                              const year = item.year ? `${item.year}年` : "";
                              const term = item.term ? `第${item.term}期` : "";
                              const meta = [year, term].filter(Boolean).join("｜");
                              return meta ? `${title}｜${meta}` : title;
                            })}
                          />
                          <RelationList title="歷史班期" items={relatedCourses.map((course) => course.title ?? course.id)} />
                        </div>

                        <div className="mt-5 rounded-[24px] border border-[#ead8ca] bg-white p-5">
                          <h3 className="text-sm font-black text-[#5A3726]">分類狀態與刪除</h3>
                          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">停用後不再作為新課程的主要選項；只有沒有任何關聯資料時才能刪除。</p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <form action={disableCategoryAction}>
                              <input type="hidden" name="id" value={category.id} />
                              <input type="hidden" name="isActive" value={category.isActive ? "false" : "true"} />
                              <button
                                className={
                                  category.isActive
                                    ? "rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
                                    : "rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                                }
                              >
                                {category.isActive ? "停用此分類" : "啟用此分類"}
                              </button>
                            </form>

                            <form action={deleteCategoryAction}>
                              <input type="hidden" name="id" value={category.id} />
                              <button
                                disabled={hasRelations}
                                title={hasRelations ? "仍有關聯資料，不能刪除" : "刪除此分類"}
                                className="rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                刪除此分類
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
