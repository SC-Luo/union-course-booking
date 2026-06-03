import {
  deleteCourseSeriesAction,
  disableCourseSeriesAction,
  saveCourseSeriesAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { CourseMasterCodeField } from "./CourseMasterCodeField";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const defaultCategoryColors: Record<string, string> = {
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


function courseTypeName(id?: string) {
  return courseTypes.find((item) => item.id === id)?.name ?? "其他";
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          : "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100"
      }
    >
      {active ? "啟用" : "停用"}
    </span>
  );
}

function instructorMatchesCategory(instructor: any, category: any) {
  const specialties = Array.isArray(instructor?.specialties) ? instructor.specialties : [];
  if (!category) return true;
  if (specialties.length === 0) return false;
  const categoryTokens = [category.id, category.code, category.name].filter(Boolean).map((item) => String(item));
  return specialties.some((specialty: any) => categoryTokens.includes(String(specialty)));
}

function getEligibleInstructors(categoryId: string | undefined, categories: any[], instructors: any[] = []) {
  const category = categories.find((item) => item.id === categoryId || item.code === categoryId);
  return instructors
    .filter((instructor) => instructor?.isActive !== false)
    .filter((instructor) => instructorMatchesCategory(instructor, category))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hant"));
}

function findInstructorSelection(defaultInstructorId: string | undefined, defaultInstructorName: string | undefined, instructors: any[]) {
  if (defaultInstructorId) return defaultInstructorId;
  if (!defaultInstructorName) return "";
  return instructors.find((instructor) => instructor.name === defaultInstructorName)?.id ?? "";
}

function InstructorSelectField({
  categoryId,
  categories,
  instructors,
  selectedInstructorId,
  hint = "只顯示授課專長符合此課程類別的講師。",
}: {
  categoryId?: string;
  categories: any[];
  instructors: any[];
  selectedInstructorId?: string;
  hint?: string;
}) {
  const eligibleInstructors = getEligibleInstructors(categoryId, categories, instructors);
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#4e4038] xl:col-span-2">
      預設講師
      <div className="rounded-[22px] border border-[#ead8ca] bg-[#fffdf9] p-3 shadow-inner shadow-[#ead8ca]/25">
        <select
          name="defaultInstructorId"
          defaultValue={selectedInstructorId ?? ""}
          className="h-12 w-full rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-bold text-[#1f1712] outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10"
        >
          <option value="">未設定</option>
          {eligibleInstructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
          ))}
        </select>
        <p className="mt-2 text-xs font-normal leading-5 text-[#8a7c72]">
          {eligibleInstructors.length > 0 ? hint : "目前沒有符合此課程類別的講師，請先到講師名冊新增並勾選授課專長。"}
        </p>
      </div>
    </label>
  );
}

export default async function CourseMastersPage({ searchParams }: PageProps) {
  const { saved, error } = await searchParams;
  const { categories, courseSeries, courseOfferings, courses, instructors = [] } = await getBookingData();
  const presetCategoryIds = new Set(professionalCategories.map((category) => category.id));
  const presetCategories = professionalCategories.map((base) => {
    const savedCategory = categories.find((item) => item.id === base.id);
    return {
      ...base,
      ...savedCategory,
      id: savedCategory?.id ?? base.id,
      code: savedCategory?.code ?? base.id,
      name: savedCategory?.name ?? base.name,
      description: savedCategory?.description ?? base.description,
      color: savedCategory?.color ?? defaultCategoryColors[base.id] ?? "#B46F4A",
      sortOrder: savedCategory?.sortOrder ?? 0,
      isActive: savedCategory?.isActive ?? true,
    };
  });
  const customCategories = categories
    .filter((category) => !presetCategoryIds.has(category.id))
    .map((category, index) => ({
      ...category,
      code: category.code ?? category.id,
      color: category.color ?? defaultCategoryColors[category.id] ?? "#B46F4A",
      sortOrder: category.sortOrder ?? professionalCategories.length + index,
      isActive: category.isActive ?? true,
      description: category.description ?? "自訂課程類別。",
    }));
  const mergedCategories = [...presetCategories, ...customCategories].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return orderDiff !== 0 ? orderDiff : `${a.id}`.localeCompare(`${b.id}`);
  });
  const activeCategories = mergedCategories.filter((category) => category.isActive);
  const getCategoryName = (id?: string) => mergedCategories.find((item) => item.id === id)?.name ?? id ?? "未分類";
  const sortedSeries = courseSeries.slice().sort((a, b) => (a.code ?? a.title).localeCompare(b.code ?? b.title));
  const existingCodes = courseSeries.map((series) => series.code).filter(Boolean) as string[];

  return (
    <AdminShell currentSection="course-settings.master">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#B46F4A]">課程行政</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">課程目錄</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66584f]">
              課程目錄代表「這是一種什麼課」，例如美容丙級檢定班。目錄代碼與代表色都會依所屬類別與課程類型自動帶出，不需要手動輸入顏色。
            </p>
          </div>
          <a href="/admin/course-offerings" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">前往年度課程 →</a>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存課程目錄。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位或關聯資料。</p> : null}

      <details className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-0 shadow-[0_16px_45px_rgba(90,55,38,0.07)]" >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">新增課程目錄</p>
            <h2 className="mt-1 text-xl font-black text-[#1f1712]">建立新的課程主檔</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">平常先收起來；需要新增課程目錄時再展開。</p>
          </div>
          <span className="shrink-0 rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開新增</span>
        </summary>
        <div className="border-t border-[#ead8ca] p-6 sm:p-7">
        <form action={saveCourseSeriesAction} className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2 rounded-[24px] border border-[#ead8ca] bg-[#fffaf5]/70 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">第一步</p>
            <h3 className="mt-1 text-base font-black text-[#1f1712]">選擇分類與類型，產生目錄識別</h3>
            <p className="mt-1 text-xs leading-5 text-[#8a7c72]">目錄代碼由「課程類型 + 所屬類別 + 流水號」產生，代表色直接跟隨所屬類別。</p>
          </div>
          <CourseMasterCodeField categories={activeCategories} courseTypes={courseTypes} existingCodes={existingCodes} />
          <label className="grid min-h-[104px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
            <span>課程名稱</span>
            <input name="title" className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal" placeholder="美容丙級檢定班" />
            <span className="min-h-[20px] text-xs font-normal leading-5 text-[#8a7c72]">目錄名稱不含年度、期別與日期。</span>
          </label>
          <div className="xl:col-span-2 mt-2 border-t border-[#f1e2d6] pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">第二步</p>
            <h3 className="mt-1 text-base font-black text-[#1f1712]">填寫課程預設資料</h3>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">預設名額
            <input name="defaultCapacity" type="number" min={0} className="rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal" placeholder="40" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">預設地點
            <input name="defaultLocation" className="rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal" placeholder="工會教室" />
          </label>
          <InstructorSelectField categoryId={undefined} categories={activeCategories} instructors={instructors} />
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038] xl:col-span-2">課程說明
            <textarea name="description" className="min-h-24 rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal" placeholder="課程目的、適用對象與注意事項" />
          </label>
          <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105 xl:col-span-2">儲存課程目錄</button>
        </form>
        </div>
      </details>

      <section className="grid gap-4">
        {sortedSeries.map((series) => {
          const offeringCount = courseOfferings.filter((offering) => offering.seriesId === series.id || offering.courseSeriesId === series.id || offering.courseMasterId === series.id).length;
          const legacyCount = courses.filter((course) => course.seriesId === series.id || course.courseSeriesId === series.id || course.courseMasterId === series.id).length;
          const hasRelations = offeringCount > 0 || legacyCount > 0;
          const editExistingCodes = existingCodes.filter((code) => code !== series.code);
          const category = mergedCategories.find((item) => item.id === series.categoryId);
          const categoryColor = series.color ?? category?.color ?? defaultCategoryColors[series.categoryId ?? ""] ?? "#B46F4A";
          const categoryName = category?.name ?? getCategoryName(series.categoryId);

          return (
            <article key={series.id} className="overflow-hidden rounded-[28px] border border-[#ead8ca] bg-white shadow-sm">
              <div className="h-2 w-full" style={{ backgroundColor: categoryColor }} />
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-bold text-[#8B5035]">{series.code ?? series.id}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: `${categoryColor}55`, backgroundColor: `${categoryColor}14`, color: categoryColor }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor }} />
                        {categoryName}
                      </span>
                      <span className="rounded-full bg-[#fffaf5] px-3 py-1 text-xs font-semibold text-[#66584f]">{courseTypeName(series.courseType)}</span>
                      <StatusPill active={series.isActive} />
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-[#1f1712]">{series.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66584f]">{series.description || "尚未填寫課程說明。"}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                    <a href={`/admin/course-offerings?seriesId=${series.id}`} className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">建立期別</a>
                    <form action={disableCourseSeriesAction}>
                      <input type="hidden" name="id" value={series.id} />
                      <input type="hidden" name="isActive" value={series.isActive ? "false" : "true"} />
                      <button
                        className={
                          series.isActive
                            ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                            : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        }
                      >
                        {series.isActive ? "停用" : "啟用"}
                      </button>
                    </form>
                    <form action={deleteCourseSeriesAction}>
                      <input type="hidden" name="id" value={series.id} />
                      <button disabled={hasRelations} className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">刪除</button>
                    </form>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-2xl bg-[#fffaf5] px-4 py-3"><span className="block text-xs text-[#8a7c72]">年度課程</span><span className="font-black text-[#1f1712]">{offeringCount}</span></div>
                  <div className="rounded-2xl bg-[#fffaf5] px-4 py-3"><span className="block text-xs text-[#8a7c72]">預設名額</span><span className="font-black text-[#1f1712]">{series.defaultCapacity ?? "未設"}</span></div>
                  <div className="rounded-2xl bg-[#fffaf5] px-4 py-3"><span className="block text-xs text-[#8a7c72]">預設講師</span><span className="font-black text-[#1f1712]">{series.defaultInstructorName ?? "未設"}</span></div>
                  <div className="rounded-2xl bg-[#fffaf5] px-4 py-3"><span className="block text-xs text-[#8a7c72]">預設地點</span><span className="font-black text-[#1f1712]">{series.defaultLocation || "未設"}</span></div>
                </div>

                <details className="mt-5 rounded-[24px] border border-[#ead8ca] bg-[#fffaf5] p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-[#1f1712]">編輯課程目錄</p>
                      <p className="mt-1 text-xs leading-5 text-[#8a7c72]">平常只看課程摘要；需要調整名稱、分類、預設名額或地點時再展開。</p>
                    </div>
                    <span className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開編輯</span>
                  </summary>
                  <form action={saveCourseSeriesAction} className="mt-4 grid gap-4 rounded-[22px] border border-[#ead8ca] bg-white p-4 xl:grid-cols-2">
                    <input type="hidden" name="id" value={series.id} />
                    <div className="rounded-2xl border border-[#ead8ca] bg-[#fffaf5]/70 p-3 text-xs leading-5 text-[#8a7c72] xl:col-span-2">
                      先確認所屬類別與課程類型；若組合改變，目錄代碼會重新自動產生，代表色也會同步跟隨類別更新。
                    </div>
                    <CourseMasterCodeField
                      categories={activeCategories}
                      courseTypes={courseTypes}
                      existingCodes={editExistingCodes}
                      initialCategoryId={series.categoryId}
                      initialCourseType={series.courseType}
                      initialCode={series.code}
                    />
                    <label className="grid min-h-[104px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
                      <span>課程名稱</span>
                      <input name="title" defaultValue={series.title} className="h-12 rounded-2xl border border-[#dbcabd] px-3 font-normal" />
                      <span className="min-h-[20px] text-xs font-normal leading-5 text-[#8a7c72]">目錄名稱不含年度、期別與日期。</span>
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">預設名額<input name="defaultCapacity" type="number" defaultValue={series.defaultCapacity} className="rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">預設地點<input name="defaultLocation" defaultValue={series.defaultLocation} className="rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" /></label>
                    <InstructorSelectField
                      categoryId={series.categoryId}
                      categories={activeCategories}
                      instructors={instructors}
                      selectedInstructorId={findInstructorSelection(series.defaultInstructorId, series.defaultInstructorName, instructors)}
                    />
                    <label className="grid gap-1 text-sm font-semibold text-[#4e4038] xl:col-span-2">課程說明<textarea name="description" defaultValue={series.description} className="min-h-24 rounded-2xl border border-[#dbcabd] px-3 py-3 font-normal" /></label>
                    <input type="hidden" name="isActive" value={series.isActive ? "true" : "false"} />
                    <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white xl:col-span-2">儲存編輯</button>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
