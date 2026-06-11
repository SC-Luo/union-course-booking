import Link from "next/link";
import {
  deleteCourseOfferingAction,
  saveCourseOfferingAction,
} from "@/app/admin/actions";
import { clearCourseOfferingCascadeAction } from "./actions";
import { AdminShell } from "@/components/page-shell";
import { SessionInfoModalCard } from "@/app/admin/sessions/[sessionId]/reservations/session-info-modal-card";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; categoryId?: string; status?: string }>;
};

const fallbackColors: Record<string, string> = {
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

const courseModeOptions = [
  {
    value: "fixed_roster",
    label: "固定名冊制",
    description: "補助、職前、產投、在職課等固定班級；重點是每堂點名與累計出缺勤。",
  },
  {
    value: "booking_flexible",
    label: "預約制",
    description: "自費或彈性上課；學員可自行選擇開放時段並受名額與鎖定時間限制。",
  },
  {
    value: "subsidy_roster",
    label: "補助固定名冊",
    description: "職訓、產投或補助班級；固定名冊並需特別重視出缺勤、作業與結訓紀錄。",
  },
] as const;

function normalizeCourseModeValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (raw === "booking_flexible") return "booking_flexible";
  if (raw === "subsidy_roster") return "subsidy_roster";
  return "fixed_roster";
}

function getCourseModeLabel(value: unknown) {
  const normalized = normalizeCourseModeValue(value);
  return courseModeOptions.find((option) => option.value === normalized)?.label ?? "固定名冊制";
}

function CourseModePill({ value }: { value?: string }) {
  const normalized = normalizeCourseModeValue(value);
  const className =
    normalized === "booking_flexible"
      ? "rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
      : normalized === "subsidy_roster"
        ? "rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
        : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";

  return <span className={className}>{getCourseModeLabel(normalized)}</span>;
}

function getSeriesTitle(seriesId: string | undefined, allSeries: Array<{ id: string; title: string }>) {
  return allSeries.find((series) => series.id === seriesId)?.title ?? "未指定目錄";
}

function getSeries(seriesId: string | undefined, allSeries: any[]) {
  return allSeries.find((series) => series.id === seriesId);
}

type OfferingLifecycle = "open" | "closed" | "draft" | "disabled" | "archived";

function normalizeOfferingStatus(status?: string, active?: boolean): OfferingLifecycle {
  if (status === "archived") return "archived";
  if (active === false) return "disabled";
  if (status === "closed") return "closed";
  if (status === "draft") return "draft";
  return "open";
}

function getOfferingLifecycleMeta(status?: string, active?: boolean) {
  const normalized = normalizeOfferingStatus(status, active);

  if (normalized === "archived") {
    return {
      id: normalized,
      label: "已封存",
      hint: "退出日常管理",
      className: "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600",
    };
  }

  if (normalized === "disabled") {
    return {
      id: normalized,
      label: "已停用",
      hint: "前台不顯示",
      className: "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700",
    };
  }

  if (normalized === "closed") {
    return {
      id: normalized,
      label: "停止報名",
      hint: "保留資料不可預約",
      className: "rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-semibold text-[#8B5035]",
    };
  }

  if (normalized === "draft") {
    return {
      id: normalized,
      label: "草稿",
      hint: "尚未對外開放",
      className: "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700",
    };
  }

  return {
    id: normalized,
    label: "開放報名",
    hint: "前台可顯示",
    className: "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
  };
}

function StatusPill({ status, active }: { status?: string; active?: boolean }) {
  const meta = getOfferingLifecycleMeta(status, active);
  return <span className={meta.className}>{meta.label}</span>;
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#f1e2d6] bg-[#fffaf5] px-4 py-3">
      <span className="block text-xs font-semibold text-[#8a7c72]">{label}</span>
      <span className="mt-1 block truncate text-sm font-black text-[#1f1712]">{value}</span>
    </div>
  );
}

function formatDateRange(start?: string, end?: string) {
  if (!start && !end) return "尚未設定";
  return `${(start || "未設").replaceAll("-", "/")}–${(end || "未設").replaceAll("-", "/")}`;
}


function normalizeTag(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getEligibleInstructors(series: any, categories: any[], instructors: any[] = []) {
  const category = categories.find((item) => item.id === series?.categoryId);
  const keys = new Set(
    [series?.categoryId, category?.id, category?.code, category?.name]
      .map(normalizeTag)
      .filter(Boolean),
  );

  return instructors
    .filter((instructor) => instructor?.isActive !== false)
    .filter((instructor) => {
      const specialties = Array.isArray(instructor?.specialties) ? instructor.specialties : [];
      if (keys.size === 0) return true;
      return specialties.some((specialty: string) => keys.has(normalizeTag(specialty)));
    })
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hant"));
}

function InstructorPickerFields({
  series,
  categories,
  instructors,
  initialPrimaryInstructorId,
  initialAssistantInstructorIds = [],
}: {
  series: any;
  categories: any[];
  instructors: any[];
  initialPrimaryInstructorId?: string;
  initialAssistantInstructorIds?: string[];
}) {
  const eligibleInstructors = getEligibleInstructors(series, categories, instructors);
  const selectedAssistants = new Set(initialAssistantInstructorIds);

  return (
    <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20">
      <div className="mb-4 flex flex-col gap-1 border-b border-[#ead8ca] pb-3">
        <p className="text-sm font-black text-[#1f1712]">講師設定</p>
      </div>

      {eligibleInstructors.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          目前沒有符合此課程類別的講師，請先到「講師名冊」建立講師並勾選授課專長。
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.85fr)_1fr]">
        <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
          主要講師
          <div className="rounded-[22px] border border-[#ead8ca] bg-white p-2 shadow-sm">
            <select
              name="primaryInstructorId"
              defaultValue={initialPrimaryInstructorId ?? ""}
              className="h-12 w-full rounded-2xl border border-transparent bg-[#fffaf5] px-4 text-sm font-black text-[#1f1712] outline-none transition focus:border-[#E7892B] focus:bg-white focus:ring-4 focus:ring-[#E7892B]/10"
            >
              <option value="">未設定</option>
              {eligibleInstructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <div className="grid gap-2 text-sm font-semibold text-[#4e4038]">
          助教 / 協同講師
          <div className="flex min-h-[64px] flex-wrap content-start gap-2 rounded-[22px] border border-[#ead8ca] bg-white p-3 shadow-sm">
            {eligibleInstructors.map((instructor) => (
              <label
                key={instructor.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ead8ca] bg-[#fffaf5] px-3 py-2 text-xs font-bold text-[#5A3726] transition hover:border-[#E7892B] hover:bg-[#fff6ed] has-[:checked]:border-[#E85F00] has-[:checked]:bg-[#fff1e7] has-[:checked]:text-[#E85F00]"
              >
                <input
                  type="checkbox"
                  name="assistantInstructorIds"
                  value={instructor.id}
                  defaultChecked={selectedAssistants.has(instructor.id)}
                  className="h-4 w-4 rounded border-[#dbcabd] accent-[#E85F00]"
                />
                {instructor.name}
              </label>
            ))}
            {eligibleInstructors.length === 0 ? (
              <span className="px-2 py-2 text-sm font-normal text-[#8a7c72]">尚無可選講師</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


const lifecycleOptions = [
  {
    value: "draft",
    label: "草稿",
    description: "尚未公開，適合資料建立中。",
  },
  {
    value: "open",
    label: "開放報名",
    description: "前台顯示，預約制課程可預約。",
  },
  {
    value: "closed",
    label: "停止報名",
    description: "前台保留顯示，但不再接受新預約。",
  },
  {
    value: "archived",
    label: "已封存",
    description: "退出日常管理，只保留歷史資料。",
  },
] as const;

type EditableOfferingLifecycle = (typeof lifecycleOptions)[number]["value"];

function getEditableLifecycle(status?: string, active?: boolean): EditableOfferingLifecycle {
  if (status === "archived") return "archived";
  if (status === "closed") return "closed";
  if (status === "draft" || active === false) return "draft";
  return "open";
}

function getLifecycleImpact(value: EditableOfferingLifecycle, isBookingFlexible: boolean) {
  if (value === "open") {
    return {
      frontStage: "可顯示",
      bookingStage: isBookingFlexible ? "可預約" : "不適用",
      sessionStage: "可管理",
    };
  }

  if (value === "closed") {
    return {
      frontStage: "可顯示",
      bookingStage: "不可預約",
      sessionStage: "可管理",
    };
  }

  if (value === "archived") {
    return {
      frontStage: "不顯示",
      bookingStage: "不可預約",
      sessionStage: "退出流程",
    };
  }

  return {
    frontStage: "不顯示",
    bookingStage: "不可預約",
    sessionStage: "可管理",
  };
}

function getLifecycleSummaryClass(value: EditableOfferingLifecycle) {
  if (value === "open") return "hidden rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4 peer-checked/open:block lg:row-span-4";
  if (value === "closed") return "hidden rounded-[22px] border border-[#ead8ca] bg-[#fffaf5] p-4 peer-checked/closed:block lg:row-span-4";
  if (value === "archived") return "hidden rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 peer-checked/archived:block lg:row-span-4";
  return "hidden rounded-[22px] border border-amber-100 bg-amber-50/70 p-4 peer-checked/draft:block lg:row-span-4";
}

function getLifecycleOptionClass(value: EditableOfferingLifecycle) {
  const baseClassName = "cursor-pointer rounded-[22px] border border-[#ead8ca] bg-white p-4 transition hover:border-[#E7892B] hover:bg-[#fffaf5] lg:col-start-2";
  if (value === "open") return `${baseClassName} peer-checked/open:border-[#E85F00] peer-checked/open:bg-[#fff1e7] peer-checked/open:shadow-[0_10px_28px_rgba(232,95,0,0.12)]`;
  if (value === "closed") return `${baseClassName} peer-checked/closed:border-[#E85F00] peer-checked/closed:bg-[#fff1e7] peer-checked/closed:shadow-[0_10px_28px_rgba(232,95,0,0.12)]`;
  if (value === "archived") return `${baseClassName} peer-checked/archived:border-[#E85F00] peer-checked/archived:bg-[#fff1e7] peer-checked/archived:shadow-[0_10px_28px_rgba(232,95,0,0.12)]`;
  return `${baseClassName} peer-checked/draft:border-[#E85F00] peer-checked/draft:bg-[#fff1e7] peer-checked/draft:shadow-[0_10px_28px_rgba(232,95,0,0.12)]`;
}

function CourseStatusControlPanel({
  status,
  active,
  courseMode,
  fieldIdPrefix = "course-lifecycle",
}: {
  status?: string;
  active?: boolean;
  courseMode?: string;
  fieldIdPrefix?: string;
}) {
  const selectedLifecycle = getEditableLifecycle(status, active);
  const isBookingFlexible = normalizeCourseModeValue(courseMode) === "booking_flexible";

  return (
    <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffaf5] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
      <div className="mb-4 border-b border-[#ead8ca] pb-3">
        <p className="text-sm font-black text-[#1f1712]">課程狀態控制台</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        {lifecycleOptions.map((option) => (
          <input
            key={option.value}
            id={`${fieldIdPrefix}-${option.value}`}
            type="radio"
            name="courseLifecycle"
            value={option.value}
            defaultChecked={selectedLifecycle === option.value}
            className={
              option.value === "open"
                ? "peer/open sr-only"
                : option.value === "closed"
                  ? "peer/closed sr-only"
                  : option.value === "archived"
                    ? "peer/archived sr-only"
                    : "peer/draft sr-only"
            }
          />
        ))}

        {lifecycleOptions.map((option) => {
          const impact = getLifecycleImpact(option.value, isBookingFlexible);
          return (
            <div key={`summary-${option.value}`} className={getLifecycleSummaryClass(option.value)}>
              <p className="text-sm font-black text-[#1f1712]">狀態預覽</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#1f1712] shadow-sm">{option.label}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#5A3726]">{option.description}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                  <dt className="font-semibold text-[#8a7c72]">前台顯示</dt>
                  <dd className="font-black text-[#1f1712]">{impact.frontStage}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                  <dt className="font-semibold text-[#8a7c72]">學生預約</dt>
                  <dd className="font-black text-[#1f1712]">{impact.bookingStage}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                  <dt className="font-semibold text-[#8a7c72]">課堂管理</dt>
                  <dd className="font-black text-[#1f1712]">{impact.sessionStage}</dd>
                </div>
              </dl>
              {active === false && status !== "archived" ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  舊版停用狀態會在儲存後改由本控制台管理。
                </p>
              ) : null}
            </div>
          );
        })}

        {lifecycleOptions.map((option) => (
          <label key={`option-${option.value}`} htmlFor={`${fieldIdPrefix}-${option.value}`} className={getLifecycleOptionClass(option.value)}>
            <p className="text-sm font-black text-[#1f1712]">{option.label}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5A3726]">{option.description}</p>
          </label>
        ))}
      </div>
    </section>
  );
}

function CourseOfferingDetailsFields({
  series,
  categories,
  instructors,
  initialYear,
  initialTerm,
  initialClassDisplayName,
  initialCapacity,
  initialBookingStatus = "open",
  initialCourseMode,
  initialStartDate,
  initialEndDate,
  initialPrimaryInstructorId,
  initialAssistantInstructorIds = [],
  initialLocation,
  initialNotes,
  showClassDisplayName = true,
  showBookingStatusField = true,
  showInstructorFields = true,
  showDateNotesFields = true,
}: {
  series: any;
  categories: any[];
  instructors: any[];
  initialYear?: number | string;
  initialTerm?: number | string;
  initialClassDisplayName?: string;
  initialCapacity?: number | string;
  initialBookingStatus?: string;
  initialCourseMode?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialPrimaryInstructorId?: string;
  initialAssistantInstructorIds?: string[];
  initialLocation?: string;
  initialNotes?: string;
  showClassDisplayName?: boolean;
  showBookingStatusField?: boolean;
  showInstructorFields?: boolean;
  showDateNotesFields?: boolean;
}) {
  const selectedCourseMode = normalizeCourseModeValue(initialCourseMode);

  const inputClassName =
    "h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10";

  return (
    <div className="grid gap-5">
      <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
        <div className="mb-4 border-b border-[#ead8ca] pb-3">
          <p className="text-sm font-black text-[#1f1712]">班級基本資料</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[0.8fr_0.8fr_1fr]">
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
            年度
            <input name="year" defaultValue={initialYear ?? ""} required className={inputClassName} placeholder="例如 115" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
            期別
            <input name="term" defaultValue={initialTerm ?? ""} required className={inputClassName} placeholder="例如 2" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
            總名額
            <input name="capacity" defaultValue={initialCapacity ?? ""} className={inputClassName} placeholder="例如 12" />
          </label>
        </div>

        {showClassDisplayName ? (
          <div className={showBookingStatusField ? "mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]" : "mt-4 grid gap-4"}>
            <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
              班級名稱
              <input name="classDisplayName" defaultValue={initialClassDisplayName ?? ""} className={inputClassName} placeholder="可留空，系統自動組合" />
            </label>
            {showBookingStatusField ? (
              <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
                課程狀態
                <select name="bookingStatus" defaultValue={initialBookingStatus} className={inputClassName}>
                  <option value="open">開放報名</option>
                  <option value="closed">停止報名 / 保留資料</option>
                  <option value="draft">草稿</option>
                  <option value="archived">已封存</option>
                </select>
              </label>
            ) : null}
          </div>
        ) : showBookingStatusField ? (
          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#4e4038] lg:max-w-md">
            課程狀態
            <select name="bookingStatus" defaultValue={initialBookingStatus} className={inputClassName}>
              <option value="open">開放報名</option>
              <option value="closed">停止報名 / 保留資料</option>
              <option value="draft">草稿</option>
              <option value="archived">已封存</option>
            </select>
          </label>
        ) : null}

        <label className="mt-4 grid gap-2 text-sm font-semibold text-[#4e4038]">
          地點
          <input name="location" defaultValue={initialLocation ?? ""} className={inputClassName} placeholder="工會教室" />
        </label>
      </section>

      <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
        <div className="mb-4 border-b border-[#ead8ca] pb-3">
          <p className="text-sm font-black text-[#1f1712]">課程運作模式</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {courseModeOptions.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-[22px] border border-[#ead8ca] bg-white p-4 transition hover:border-[#E7892B] hover:bg-[#fffaf5] has-[:checked]:border-[#E85F00] has-[:checked]:bg-[#fff1e7] has-[:checked]:shadow-[0_10px_28px_rgba(232,95,0,0.12)]"
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="courseMode"
                  value={option.value}
                  defaultChecked={selectedCourseMode === option.value}
                  className="h-4 w-4 border-[#dbcabd] accent-[#E85F00]"
                />
                <span className="text-sm font-black text-[#1f1712]">{option.label}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {showInstructorFields ? (
        <InstructorPickerFields
          series={series}
          categories={categories}
          instructors={instructors}
          initialPrimaryInstructorId={initialPrimaryInstructorId}
          initialAssistantInstructorIds={initialAssistantInstructorIds}
        />
      ) : null}

      {showDateNotesFields ? (
        <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
          <div className="mb-4 border-b border-[#ead8ca] pb-3">
            <p className="text-sm font-black text-[#1f1712]">日期與備註</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
              開始日期
              <input type="date" name="startDate" defaultValue={initialStartDate ?? ""} className={inputClassName} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
              結束日期
              <input type="date" name="endDate" defaultValue={initialEndDate ?? ""} className={inputClassName} />
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#4e4038]">
            備註
            <textarea name="notes" defaultValue={initialNotes ?? ""} className="min-h-24 rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" placeholder="班級備註、行政提醒或特殊安排" />
          </label>
        </section>
      ) : null}
    </div>
  );
}

export default async function CourseOfferingsPage({ searchParams }: PageProps) {
  const { saved, error, categoryId, status } = await searchParams;
  const statusFilter = ["all", "daily", "open", "closed", "draft", "archived"].includes(status ?? "") ? (status ?? "daily") : "daily";
  const { categories, courseSeries, courseOfferings, courses, enrollments, reservations, students, courseSessions, attendanceRecords, instructors = [] } = await getBookingData();
  const activeSeries = courseSeries.filter((series) => series.isActive !== false);
  const categoryOptions = Array.from(new Set(activeSeries.map((series) => series.categoryId).filter(Boolean))).map((categoryId) => {
    const category = categories.find((item) => item.id === categoryId);
    return {
      id: categoryId,
      name: category?.name ?? categoryId,
      code: category?.code,
      color: category?.color ?? fallbackColors[categoryId] ?? "#B46F4A",
    };
  });
  const selectedCategoryFilter = categoryId && categoryOptions.some((category) => category.id === categoryId) ? categoryId : "all";
  const selectedSeriesId =
    activeSeries.find((series) => selectedCategoryFilter === "all" || series.categoryId === selectedCategoryFilter)?.id ??
    activeSeries[0]?.id;
  const offeringMatchesStatusFilter = (offering: any, targetStatus = statusFilter) => {
    const normalized = normalizeOfferingStatus(offering.status, offering.isActive);
    if (targetStatus === "all") return true;
    if (targetStatus === "daily") return normalized === "open" || normalized === "closed" || normalized === "disabled";
    return normalized === targetStatus;
  };
  const getOfferingCategoryId = (offering: any) =>
    offering.categoryId ?? courseSeries.find((series) => series.id === offering.seriesId)?.categoryId;
  const offeringMatchesCategoryFilter = (offering: any, targetCategoryId = selectedCategoryFilter) => {
    if (targetCategoryId === "all") return true;
    return getOfferingCategoryId(offering) === targetCategoryId;
  };
  const categoryFilteredOfferings = courseOfferings.filter((offering) => offeringMatchesCategoryFilter(offering));
  const sortedOfferings = categoryFilteredOfferings
    .filter((offering) => offeringMatchesStatusFilter(offering))
    .slice()
    .sort((a, b) => `${b.year ?? 0}-${b.term ?? ""}`.localeCompare(`${a.year ?? 0}-${a.term ?? ""}`));
  const statusTabs = [
    { id: "all", label: "全部狀態", description: "含封存與草稿" },
    { id: "daily", label: "日常管理", description: "開放與停招" },
    { id: "open", label: "開放報名", description: "前台可預約" },
    { id: "closed", label: "停止報名", description: "保留資料" },
    { id: "draft", label: "草稿", description: "尚未公開" },
    { id: "archived", label: "已封存", description: "退出日常" },
  ] as const;
  const statusCounts = categoryFilteredOfferings.reduce<Record<string, number>>(
    (counts, offering) => {
      const normalized = normalizeOfferingStatus(offering.status, offering.isActive);
      counts.all += 1;
      if (normalized === "open" || normalized === "closed" || normalized === "disabled") counts.daily += 1;
      if (normalized === "open") counts.open += 1;
      if (normalized === "closed") counts.closed += 1;
      if (normalized === "draft") counts.draft += 1;
      if (normalized === "archived") counts.archived += 1;
      return counts;
    },
    { all: 0, daily: 0, open: 0, closed: 0, draft: 0, archived: 0 },
  );
  const buildCourseOfferingsHref = ({
    nextCategoryId = selectedCategoryFilter,
    nextStatus = statusFilter,
  }: {
    nextCategoryId?: string;
    nextStatus?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (nextCategoryId !== "all") params.set("categoryId", nextCategoryId);
    if (nextStatus !== "daily") params.set("status", nextStatus);
    const query = params.toString();
    return query ? `/admin/course-offerings?${query}` : "/admin/course-offerings";
  };
  const currentListHref = buildCourseOfferingsHref();
  const selectedSeries = getSeries(selectedSeriesId, courseSeries);
  const currentCategoryLabel = selectedCategoryFilter === "all" ? "全部類別" : categoryOptions.find((category) => category.id === selectedCategoryFilter)?.name ?? selectedCategoryFilter;
  const currentStatusLabel = statusTabs.find((tab) => tab.id === statusFilter)?.label ?? "日常管理";

  const seriesOptions = activeSeries.map((series: any) => {
    const savedCategory = categories.find((category) => category.id === series.categoryId);
    return {
      id: series.id,
      title: series.title,
      code: series.code,
      categoryId: series.categoryId,
      categoryName: savedCategory?.name ?? series.categoryId,
      courseType: series.courseType,
      color: series.color ?? savedCategory?.color ?? fallbackColors[series.categoryId] ?? "#B46F4A",
      defaultCapacity: series.defaultCapacity,
      defaultLocation: series.defaultLocation,
      defaultInstructorName: series.defaultInstructorName,
      rosterType: series.rosterType,
      courseMode: series.defaultCourseMode ?? series.courseMode,
    };
  });
  const categoryTabs = [
    {
      id: "all",
      title: "全部類別",
      count: courseOfferings.filter((offering) => offeringMatchesStatusFilter(offering)).length,
    },
    ...categoryOptions.map((category) => ({
      id: category.id,
      title: category.name,
      count: courseOfferings.filter((offering) => offeringMatchesCategoryFilter(offering, category.id) && offeringMatchesStatusFilter(offering)).length,
    })),
  ];

  return (
    <AdminShell currentSection="course-settings.offering">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[#B46F4A]">課程行政</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">年度課程</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66584f]">
              年度課程是真正開班的班級容器，也是名冊、課堂日誌與點名紀錄掛載的位置。先建立年度課程，再到名冊管理加入學員。
            </p>
          </div>
          {activeSeries.length === 0 ? (
            <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm font-black text-amber-800">
              請先建立課程目錄
            </span>
          ) : (
            <SessionInfoModalCard
              title="新增年度班級"
              triggerLabel="＋ 新增年度班級"
              eyebrow="年度課程"
              closeLabel="取消"
              description=""
            >
              <form action={saveCourseOfferingAction} className="grid gap-5">
                <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20">
                  <div className="mb-4 flex flex-col gap-1 border-b border-[#ead8ca] pb-3">
                    <p className="text-sm font-black text-[#1f1712]">建立班級識別</p>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
                    課程目錄
                    <select
                      name="seriesId"
                      defaultValue={selectedSeriesId}
                      required
                      className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10"
                    >
                      {seriesOptions.map((series) => (
                        <option key={series.id} value={series.id}>
                          {series.code ? `${series.code}｜` : ""}{series.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <CourseOfferingDetailsFields
                  series={selectedSeries}
                  categories={categories}
                  instructors={instructors}
                  initialCapacity={selectedSeries?.defaultCapacity}
                  initialLocation={selectedSeries?.defaultLocation}
                  initialCourseMode={selectedSeries?.defaultCourseMode}
                  showClassDisplayName={false}
                  showInstructorFields={false}
                  showDateNotesFields={false}
                />

                <div className="flex flex-col-reverse gap-3 border-t border-[#f1e2d6] pt-5 sm:flex-row sm:justify-end">
                  <Link href={currentListHref} className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#dbcabd] bg-white px-5 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">
                    取消
                  </Link>
                  <button className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-6 text-sm font-black text-white shadow-sm hover:brightness-105">
                    建立
                  </button>
                </div>
              </form>
            </SessionInfoModalCard>
          )}
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存年度課程。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位或關聯資料。</p> : null}

      <div className="mb-6 rounded-[28px] border border-[#ead8ca] bg-white p-5 shadow-[0_10px_28px_rgba(90,55,38,0.05)]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[#5A3726]">兩階段篩選</p>
            <p className="mt-1 text-sm font-semibold text-[#8a7c72]">
              目前顯示：{currentCategoryLabel}｜{currentStatusLabel}｜{sortedOfferings.length} 個年度班級
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B46F4A]">課程類別</p>
              <p className="text-xs font-bold text-[#9a877a]">先選課程所屬的大類</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {categoryTabs.map((tab) => {
                const isActive = selectedCategoryFilter === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={buildCourseOfferingsHref({ nextCategoryId: tab.id })}
                    className={
                      isActive
                        ? "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#E85F00] bg-[#E85F00] px-4 py-3 text-sm font-black text-white shadow-sm"
                        : "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-4 py-3 text-sm font-black text-[#5A3726] transition hover:bg-[#fff6ed]"
                    }
                  >
                    <span className="max-w-[260px] truncate">{tab.title}</span>
                    <span className={isActive ? "rounded-full bg-white/20 px-2 py-0.5 text-xs" : "rounded-full bg-white px-2 py-0.5 text-xs text-[#8B5035]"}>
                      {tab.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B46F4A]">課程狀態</p>
              <p className="text-xs font-bold text-[#9a877a]">再看這門課目前處在哪個階段</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {statusTabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={buildCourseOfferingsHref({ nextStatus: tab.id })}
                    className={
                      isActive
                        ? "rounded-2xl border border-[#E85F00] bg-[#E85F00] px-4 py-3 text-white shadow-sm"
                        : "rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-4 py-3 text-[#5A3726] transition hover:bg-[#fff6ed]"
                    }
                  >
                    <span className="block text-sm font-black">{tab.label}（{statusCounts[tab.id]}）</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>


      <section className="grid gap-4">
        {sortedOfferings.map((offering) => {
          const legacyCourse = courses.find((course) => course.id === offering.legacyCourseId || course.offeringId === offering.id);
          const series = getSeries(offering.seriesId, courseSeries);
          const linkedCourseId = legacyCourse?.id ?? offering.legacyCourseId ?? "";
          const offeringStudents = students.filter((item) => item.offeringId === offering.id || item.classId === linkedCourseId);
          const enrollmentCount = enrollments.filter((item) => item.offeringId === offering.id || item.courseOfferingId === offering.id || item.courseId === linkedCourseId).length;
          const reservationCount = reservations.filter((item) => item.offeringId === offering.id || item.courseId === linkedCourseId).length;
          const legacySessionCount = legacyCourse?.sessions.length ?? 0;
          const courseSessionCount = courseSessions.filter((item) => item.offeringId === offering.id || item.legacyCourseId === linkedCourseId).length;
          const sessionCount = Math.max(legacySessionCount, courseSessionCount);
          const attendanceCount = attendanceRecords.filter((item) => item.offeringId === offering.id).length;
          const hasRelations = enrollmentCount > 0 || reservationCount > 0 || sessionCount > 0 || offeringStudents.length > 0 || attendanceCount > 0;
          const color = offering.color ?? series?.color ?? fallbackColors[offering.categoryId ?? series?.categoryId] ?? "#B46F4A";
          const primaryInstructorName = offering.primaryInstructorId
            ? instructors.find((instructor: any) => instructor.id === offering.primaryInstructorId)?.name
            : undefined;
          const capacity = offering.capacity ?? legacyCourse?.totalCapacity ?? "-";
          const reserved = offeringStudents.length || enrollmentCount || reservationCount;
          const rosterHref = `/admin/students?mode=eligibility&view=rosterOnly&classId=${encodeURIComponent(linkedCourseId)}&seriesId=${encodeURIComponent(offering.seriesId ?? "")}&year=${encodeURIComponent(String(offering.year ?? ""))}&offeringId=${encodeURIComponent(offering.id)}&term=${encodeURIComponent(String(offering.termLabel ?? offering.term ?? ""))}`;
          const lifecycle = getOfferingLifecycleMeta(offering.status, offering.isActive);
          const isArchived = lifecycle.id === "archived";

          return (
            <article key={offering.id} className="overflow-hidden rounded-[28px] border border-[#ead8ca] bg-white shadow-[0_12px_34px_rgba(90,55,38,0.055)]">
              <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

              <div className="p-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-bold text-[#8B5035]">{offering.code ?? offering.classIdentifier ?? offering.id}</span>
                      <StatusPill status={offering.status} active={offering.isActive} />
                      <CourseModePill value={offering.courseMode ?? series?.defaultCourseMode} />
                    </div>

                    <h2 className="mt-3 truncate text-2xl font-black leading-tight text-[#1f1712]">
                      {offering.classDisplayName ?? offering.displayTitle ?? offering.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#66584f]">
                      {getSeriesTitle(offering.seriesId, courseSeries)}｜{offering.year ?? "未設年度"} 年｜{offering.termLabel ?? `第 ${offering.term ?? "?"} 期`}｜{formatDateRange(offering.startDate, offering.endDate)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link href={rosterHref} className={isArchived ? "rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-600" : "rounded-2xl bg-[#E85F00] px-4 py-2 text-sm font-black text-white shadow-sm hover:brightness-105"}>
                      {isArchived ? "查看名冊" : "名冊"}
                    </Link>
                    {legacyCourse ? (
                      <Link href={`/admin/courses/${legacyCourse.id}/sessions`} className={isArchived ? "rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-600" : "rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105"}>
                        {isArchived ? "查看課堂" : "課堂日誌"}
                      </Link>
                    ) : null}

                    <SessionInfoModalCard
                      title="年度課程管理"
                      triggerLabel="管理"
                      eyebrow="年度課程"
                      closeLabel="關閉"
                      description=""
                      triggerClassName="inline-flex h-10 items-center justify-center rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-black text-[#5A3726] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff6ed] hover:shadow-md"
                      panelClassName="max-h-[88vh] w-full max-w-5xl overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[28px] border border-[#ead8ca] bg-white p-6 shadow-2xl"
                    >
                      <div className="grid gap-5">
                        {isArchived ? (
                          <section className="rounded-[26px] border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700">
                            <p className="font-black text-zinc-900">此年度課程目前為已封存。</p>
                          </section>
                        ) : null}

                        <form action={saveCourseOfferingAction} className="grid gap-5">
                            <input type="hidden" name="id" value={offering.id} />
                            <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                            <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20">
                              <div className="mb-4 flex flex-col gap-1 border-b border-[#ead8ca] pb-3">
                                <p className="text-sm font-black text-[#1f1712]">課程目錄</p>
                              </div>
                              <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">
                                課程目錄
                                <select name="seriesId" defaultValue={offering.seriesId} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10">
                                  {activeSeries.map((series) => <option key={series.id} value={series.id}>{series.title}</option>)}
                                </select>
                              </label>
                            </section>

                            <CourseOfferingDetailsFields
                              series={getSeries(offering.seriesId, courseSeries)}
                              categories={categories}
                              instructors={instructors}
                              initialYear={offering.year}
                              initialTerm={offering.term}
                              initialClassDisplayName={offering.classDisplayName ?? offering.displayTitle}
                              initialCapacity={offering.capacity ?? legacyCourse?.totalCapacity}
                              initialBookingStatus={offering.bookingStatus ?? offering.status ?? "open"}
                              showBookingStatusField={false}
                              initialCourseMode={offering.courseMode ?? series?.defaultCourseMode}
                              initialStartDate={offering.startDate}
                              initialEndDate={offering.endDate}
                              initialPrimaryInstructorId={offering.primaryInstructorId}
                              initialAssistantInstructorIds={offering.assistantInstructorIds ?? []}
                              initialLocation={offering.location ?? legacyCourse?.defaultLocation}
                              initialNotes={offering.notes}
                            />


                            <CourseStatusControlPanel
                              status={offering.status}
                              active={offering.isActive}
                              courseMode={offering.courseMode ?? series?.defaultCourseMode}
                              fieldIdPrefix={`course-lifecycle-${offering.id}`}
                            />

                            <div className="flex flex-col-reverse gap-3 border-t border-[#f1e2d6] pt-5 sm:flex-row sm:justify-end">
                              <Link href={currentListHref} className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#dbcabd] bg-white px-5 text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">
                                取消
                              </Link>
                              <button className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-6 text-sm font-black text-white shadow-sm hover:brightness-105">
                                儲存課程設定
                              </button>
                            </div>
                          </form>

                        <section className="rounded-[26px] border border-rose-100 bg-rose-50/50 p-5">
                          <div className="mb-4 border-b border-rose-100 pb-3">
                            <p className="text-sm font-black text-rose-700">危險操作</p>
                          </div>
                          <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.65fr)_1fr] xl:items-start">
                            <form action={deleteCourseOfferingAction}>
                              <input type="hidden" name="id" value={offering.id} />
                              <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                              <button
                                disabled={hasRelations || isArchived}
                                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 xl:w-auto"
                                title={hasRelations ? "已有課堂、名冊或預約時，請使用清除功能。" : undefined}
                              >
                                刪除空課程
                              </button>
                            </form>

                            <form action={clearCourseOfferingCascadeAction} className="grid gap-3 rounded-[22px] border border-rose-100 bg-white p-4 lg:grid-cols-[1fr_minmax(220px,0.7fr)_auto] lg:items-end">
                              <input type="hidden" name="offeringId" value={offering.id} />
                              <input type="hidden" name="legacyCourseId" value={linkedCourseId} />
                              <div>
                                <p className="text-sm font-black text-rose-700">清除本年度資料</p>
                                <p className="mt-1 text-xs leading-5 text-rose-700">
                                  會清除：約 {sessionCount} 堂課、{offeringStudents.length} 位學員、{enrollmentCount} 筆名冊關聯、{reservationCount} 筆預約、{attendanceCount} 筆點名紀錄。
                                </p>
                              </div>
                              <label className="grid gap-1 text-sm font-semibold text-rose-800">
                                請輸入「確認清除」
                                <input name="confirmation" required className="h-11 rounded-2xl border border-rose-200 bg-white px-3 font-normal outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100" placeholder="確認清除" />
                              </label>
                              <button disabled={isArchived} className="h-11 rounded-2xl bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
                                清除
                              </button>
                            </form>
                          </div>
                        </section>
                      </div>
                    </SessionInfoModalCard>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <CompactMetric label="名冊 / 報名" value={`${reserved}/${capacity}`} />
                  <CompactMetric label="課堂日誌" value={sessionCount > 0 ? `${sessionCount} 堂` : "尚未排課"} />
                  <CompactMetric label="地點" value={offering.location ?? legacyCourse?.defaultLocation ?? "未設"} />
                  <CompactMetric label="主要講師" value={primaryInstructorName ?? offering.primaryInstructorName ?? "未設"} />
                </div>
              </div>
            </article>
          );
        })}
        {sortedOfferings.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#ead8ca] bg-white px-6 py-12 text-center shadow-[0_12px_34px_rgba(90,55,38,0.04)]">
            <p className="text-lg font-black text-[#1f1712]">目前沒有符合條件的年度班級</p>
            <p className="mt-2 text-sm font-semibold text-[#8a7c72]">可以切回全部課程或全部狀態查看其他班級。</p>
          </div>
        ) : null}
      </section>

    </AdminShell>
  );
}
