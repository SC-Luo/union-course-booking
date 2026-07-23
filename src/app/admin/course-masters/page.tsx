import {
  deleteCourseSeriesAction,
  disableCourseSeriesAction,
  saveCourseSeriesAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import Link from "next/link";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { CourseMasterCodeField } from "./CourseMasterCodeField";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; categoryId?: string; status?: string; q?: string }>;
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
  const { saved, error, categoryId, status, q } = await searchParams;
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

  const selectedCategoryFilter = categoryId && activeCategories.some((c) => c.id === categoryId) ? categoryId : "all";
  const statusFilter = ["all", "active", "inactive"].includes(status ?? "") ? (status ?? "all") : "all";
  const filterQuery = String(q ?? "").trim().toLowerCase();

  const sortedSeries = courseSeries.slice().sort((a, b) => (a.code ?? a.title).localeCompare(b.code ?? b.title));
  const existingCodes = courseSeries.map((series) => series.code).filter(Boolean) as string[];

  const categoryTabs = [
    {
      id: "all",
      title: "全部類別",
      count: courseSeries.length,
    },
    ...activeCategories.map((category) => ({
      id: category.id,
      title: category.name,
      count: courseSeries.filter((series) => series.categoryId === category.id).length,
    })),
  ];

  const statusCounts = courseSeries.reduce(
    (acc, series) => {
      acc.all += 1;
      if (series.isActive !== false) acc.active += 1;
      else acc.inactive += 1;
      return acc;
    },
    { all: 0, active: 0, inactive: 0 }
  );

  const statusTabs = [
    { id: "all", label: "全部狀態" },
    { id: "active", label: "啟用" },
    { id: "inactive", label: "停用" },
  ] as const;

  const buildCourseSeriesHref = ({
    nextCategoryId = selectedCategoryFilter,
    nextStatus = statusFilter,
  }: {
    nextCategoryId?: string;
    nextStatus?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (nextCategoryId !== "all") params.set("categoryId", nextCategoryId);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `/admin/course-masters?${query}` : "/admin/course-masters";
  };

  const filteredSeries = sortedSeries
    .filter((series) => {
      if (selectedCategoryFilter !== "all" && series.categoryId !== selectedCategoryFilter) return false;
      if (statusFilter === "active" && series.isActive === false) return false;
      if (statusFilter === "inactive" && series.isActive !== false) return false;
      if (filterQuery) {
        const title = series.title || "";
        const code = series.code || "";
        const catName = getCategoryName(series.categoryId) || "";
        const statusLabel = series.isActive ? "啟用" : "停用";
        return [title, code, catName, statusLabel].some((val) =>
          String(val).toLowerCase().includes(filterQuery)
        );
      }
      return true;
    });

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

      <section className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">課程篩選</p>
            <h2 className="mt-1 text-xl font-black text-[#1f1712]">篩選課程目錄</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">
              先選類別與狀態，再搜尋關鍵字。目前顯示：共 {filteredSeries.length} 個課程主檔
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Search bar */}
          <form className="flex gap-2">
            {selectedCategoryFilter !== "all" && <input type="hidden" name="categoryId" value={selectedCategoryFilter} />}
            {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="搜尋課程名稱、課程代碼、類別..."
              className="h-11 flex-1 rounded-2xl border border-[#ead8ca] bg-white px-4 text-sm text-[#5A3726] shadow-sm outline-none focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
            />
            <button className="rounded-2xl bg-[#5A3726] px-5 py-2 text-sm font-bold text-white shadow-sm hover:brightness-105">
              搜尋
            </button>
            {q && (
              <Link href={`/admin/course-masters?categoryId=${encodeURIComponent(selectedCategoryFilter)}&status=${encodeURIComponent(statusFilter)}`} className="rounded-2xl border border-[#ead8ca] bg-white px-4 py-2.5 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">
                清除
              </Link>
            )}
          </form>

          {/* Categories */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B46F4A] mb-2">課程類別</p>
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((tab) => {
                const isActive = selectedCategoryFilter === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={buildCourseSeriesHref({ nextCategoryId: tab.id })}
                    className={
                      isActive
                        ? "rounded-2xl bg-[#E85F00] px-4 py-2 text-sm font-black text-white shadow-sm"
                        : "rounded-2xl border border-[#ead8ca] bg-white px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]"
                    }
                  >
                    {tab.title}
                    <span className={isActive ? "ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs" : "ml-1.5 rounded-full bg-[#fff6ed] px-1.5 py-0.5 text-xs text-[#8B5035]"}>
                      {tab.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B46F4A] mb-2">課程狀態</p>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={buildCourseSeriesHref({ nextStatus: tab.id })}
                    className={
                      isActive
                        ? "rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-black text-white shadow-sm"
                        : "rounded-2xl border border-[#ead8ca] bg-white px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]"
                    }
                  >
                    {tab.label}
                    <span className={isActive ? "ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs" : "ml-1.5 rounded-full bg-[#fff6ed] px-1.5 py-0.5 text-xs text-[#8B5035]"}>
                      {statusCounts[tab.id]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSeries.map((series) => {
          const offeringCount = courseOfferings.filter((offering) => offering.seriesId === series.id || offering.courseSeriesId === series.id || offering.courseMasterId === series.id).length;
          const legacyCount = courses.filter((course) => course.seriesId === series.id || course.courseSeriesId === series.id || course.courseMasterId === series.id).length;
          const hasRelations = offeringCount > 0 || legacyCount > 0;
          const editExistingCodes = existingCodes.filter((code) => code !== series.code);
          const category = mergedCategories.find((item) => item.id === series.categoryId);
          const categoryColor = series.color ?? category?.color ?? defaultCategoryColors[series.categoryId ?? ""] ?? "#B46F4A";
          const categoryName = category?.name ?? getCategoryName(series.categoryId);

          return (
            <article key={series.id} className="overflow-hidden rounded-[24px] border border-[#ead8ca] bg-white shadow-[0_8px_24px_rgba(90,55,38,0.04)] flex flex-col justify-between">
              <div>
                <div className="h-1 w-full" style={{ backgroundColor: categoryColor }} />
                <div className="p-4">
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="text-[11px] font-black uppercase text-[#B46F4A] tracking-wider">
                      {series.code ?? series.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: `${categoryColor}55`, backgroundColor: `${categoryColor}14`, color: categoryColor }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                        {categoryName}
                      </span>
                      <span className="rounded-full bg-[#fffaf5] px-2 py-0.5 text-[10px] font-semibold text-[#66584f]">{courseTypeName(series.courseType)}</span>
                      <StatusPill active={series.isActive} />
                    </div>
                  </div>

                  {/* Title and description */}
                  <div>
                    <h3 className="text-base font-black text-zinc-950 line-clamp-2 min-h-[2.5rem] leading-tight">
                      {series.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2 min-h-[2rem]">
                      {series.description || "尚未填寫課程說明。"}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600 bg-[#fffdfa] p-3 rounded-2xl border border-[#f0dfd2]">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">年度課程數</p>
                      <p className="font-black text-zinc-800 mt-0.5">{offeringCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">預設名額</p>
                      <p className="font-black text-zinc-800 mt-0.5">{series.defaultCapacity ?? "未設"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">預設主要講師</p>
                      <p className="font-black text-zinc-800 truncate mt-0.5" title={series.defaultInstructorName || "未設"}>
                        {series.defaultInstructorName ?? "未設"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400">預設授課地點</p>
                      <p className="font-black text-zinc-800 truncate mt-0.5" title={series.defaultLocation || "未設"}>
                        {series.defaultLocation || "未設"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom actions */}
              <div className="border-t border-[#f3ede8] bg-[#fffdfa] p-3 flex flex-wrap gap-2 items-center">
                <a href={`/admin/course-offerings?seriesId=${series.id}`} className="flex-1 text-center py-2 rounded-xl bg-[#5A3726] text-xs font-bold text-white hover:brightness-105">
                  建立期別
                </a>
                <form action={disableCourseSeriesAction} className="flex-1">
                  <input type="hidden" name="id" value={series.id} />
                  <input type="hidden" name="isActive" value={series.isActive ? "false" : "true"} />
                  <button className={series.isActive ? "w-full text-center py-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100" : "w-full text-center py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100"}>
                    {series.isActive ? "停用" : "啟用"}
                  </button>
                </form>
                <form action={deleteCourseSeriesAction} className="flex-1">
                  <input type="hidden" name="id" value={series.id} />
                  <button disabled={hasRelations} className="w-full text-center py-2 rounded-xl border border-rose-200 bg-white text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">
                    刪除
                  </button>
                </form>

                <details className="w-full mt-2 rounded-xl border border-[#ead8ca] bg-[#fffaf5] p-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-[#5A3726]">
                    <span>編輯課程目錄</span>
                    <span className="text-[10px] border border-[#dbcabd] bg-white px-2 py-0.5 rounded-lg">展開</span>
                  </summary>
                  <form action={saveCourseSeriesAction} className="mt-2 grid gap-3 rounded-lg border border-[#ead8ca] bg-white p-3">
                    <input type="hidden" name="id" value={series.id} />
                    <CourseMasterCodeField
                      categories={activeCategories}
                      courseTypes={courseTypes}
                      existingCodes={editExistingCodes}
                      initialCategoryId={series.categoryId}
                      initialCourseType={series.courseType}
                      initialCode={series.code}
                    />
                    <label className="grid gap-1 text-xs font-semibold text-[#4e4038]">
                      <span>課程名稱</span>
                      <input name="title" defaultValue={series.title} className="h-9 rounded-xl border border-[#dbcabd] px-2 font-normal" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-semibold text-[#4e4038]">預設名額<input name="defaultCapacity" type="number" defaultValue={series.defaultCapacity} className="h-9 rounded-xl border border-[#dbcabd] px-2 font-normal" /></label>
                      <label className="grid gap-1 text-xs font-semibold text-[#4e4038]">預設地點<input name="defaultLocation" defaultValue={series.defaultLocation} className="h-9 rounded-xl border border-[#dbcabd] px-2 font-normal" /></label>
                    </div>
                    <InstructorSelectField
                      categoryId={series.categoryId}
                      categories={activeCategories}
                      instructors={instructors}
                      selectedInstructorId={findInstructorSelection(series.defaultInstructorId, series.defaultInstructorName, instructors)}
                    />
                    <label className="grid gap-1 text-xs font-semibold text-[#4e4038]">課程說明<textarea name="description" defaultValue={series.description} className="min-h-16 rounded-xl border border-[#dbcabd] px-2 py-1 font-normal" /></label>
                    <input type="hidden" name="isActive" value={series.isActive ? "true" : "false"} />
                    <button className="h-9 rounded-xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] text-xs font-bold text-white">儲存編輯</button>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
        {filteredSeries.length === 0 ? (
          <div className="col-span-full rounded-[28px] border border-dashed border-[#ead8ca] bg-white px-6 py-12 text-center shadow-[0_12px_34px_rgba(90,55,38,0.04)]">
            <p className="text-lg font-black text-[#1f1712]">目前沒有符合條件的課程主檔</p>
            <p className="mt-2 text-sm font-semibold text-[#8a7c72]">可以切回全部類別或狀態查看其他課程。</p>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
