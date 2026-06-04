import Link from "next/link";
import {
  deleteCourseOfferingAction,
  disableCourseOfferingAction,
  saveCourseOfferingAction,
} from "@/app/admin/actions";
import { clearCourseOfferingCascadeAction } from "./actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; seriesId?: string }>;
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

function StatusPill({ status, active }: { status?: string; active?: boolean }) {
  const label = active === false ? "停用" : status === "closed" ? "關閉報名" : status === "draft" ? "草稿" : "開放報名";
  const className =
    active === false
      ? "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
      : status === "closed"
        ? "rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-semibold text-[#8B5035]"
        : status === "draft"
          ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
          : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";
  return <span className={className}>{label}</span>;
}

function MiniMetric({ label, value, valueClassName = "" }: { label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-[#f1e2d6] bg-[#fffaf5] px-4 py-3">
      <span className="block text-xs text-[#8a7c72]">{label}</span>
      <span className={`mt-1 block font-black text-[#1f1712] ${valueClassName}`}>{value}</span>
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
        <p className="text-xs leading-5 text-[#8a7c72]">這裡統一讀取講師名冊；只顯示授課專長符合此課程類別的講師。</p>
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
          <span className="text-xs font-normal leading-5 text-[#8a7c72]">選定後會同步顯示在年度課程卡片與課堂預設資料。</span>
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
          <span className="text-xs font-normal leading-5 text-[#8a7c72]">可複選；若沒有助教可留空。</span>
        </div>
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
}) {
  const selectedCourseMode = normalizeCourseModeValue(initialCourseMode);

  const inputClassName =
    "h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10";

  return (
    <div className="grid gap-5">
      <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
        <div className="mb-4 border-b border-[#ead8ca] pb-3">
          <p className="text-sm font-black text-[#1f1712]">班級基本資料</p>
          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">先填年度、期別與班級資訊；常用欄位集中在同一區，避免表單橫向拉太寬。</p>
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
            班級名稱
            <input name="classDisplayName" defaultValue={initialClassDisplayName ?? ""} className={inputClassName} placeholder="可留空，系統自動組合" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#4e4038]">
            前台報名狀態
            <select name="bookingStatus" defaultValue={initialBookingStatus} className={inputClassName}>
              <option value="open">開放報名</option>
              <option value="closed">關閉報名</option>
              <option value="draft">草稿</option>
            </select>
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-[#4e4038]">
          地點
          <input name="location" defaultValue={initialLocation ?? ""} className={inputClassName} placeholder="工會教室" />
        </label>
      </section>

      <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
        <div className="mb-4 border-b border-[#ead8ca] pb-3">
          <p className="text-sm font-black text-[#1f1712]">課程運作模式</p>
          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">這會影響前台是否開放預約，以及後續要走預約管理或固定名冊出缺勤管理。</p>
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
              <p className="mt-2 text-xs leading-5 text-[#8a7c72]">{option.description}</p>
            </label>
          ))}
        </div>
      </section>

      <InstructorPickerFields
        series={series}
        categories={categories}
        instructors={instructors}
        initialPrimaryInstructorId={initialPrimaryInstructorId}
        initialAssistantInstructorIds={initialAssistantInstructorIds}
      />

      <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20 sm:p-5">
        <div className="mb-4 border-b border-[#ead8ca] pb-3">
          <p className="text-sm font-black text-[#1f1712]">日期與備註</p>
          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">可先留空，排課後再補齊；備註只放行政提醒或特殊安排。</p>
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
    </div>
  );
}

export default async function CourseOfferingsPage({ searchParams }: PageProps) {
  const { saved, error, seriesId } = await searchParams;
  const { categories, courseSeries, courseOfferings, courses, enrollments, reservations, students, courseSessions, attendanceRecords, instructors = [] } = await getBookingData();
  const activeSeries = courseSeries.filter((series) => series.isActive !== false);
  const selectedSeriesId = seriesId && activeSeries.some((series) => series.id === seriesId) ? seriesId : activeSeries[0]?.id;
  const sortedOfferings = courseOfferings
    .slice()
    .sort((a, b) => `${b.year ?? 0}-${b.term ?? ""}`.localeCompare(`${a.year ?? 0}-${a.term ?? ""}`));

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
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存年度課程。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位或關聯資料。</p> : null}

      <details className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-0 shadow-[0_16px_45px_rgba(90,55,38,0.07)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">新增年度課程</p>
            <h2 className="mt-1 text-xl font-black text-[#1f1712]">建立新的年度班級</h2>
            <p className="mt-1 text-sm leading-6 text-[#8a7c72]">平常先收起來；需要建立新年度或新期別時再展開。</p>
          </div>
          <span className="shrink-0 rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開新增</span>
        </summary>
        <div className="border-t border-[#ead8ca] p-6 sm:p-7">
        {activeSeries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">尚未建立課程目錄，請先到課程目錄新增。</div>
        ) : (
          <form action={saveCourseOfferingAction} className="mx-auto mt-5 grid max-w-5xl gap-5">
            <section className="rounded-[26px] border border-[#ead8ca] bg-[#fffdf9] p-4 shadow-inner shadow-[#ead8ca]/20">
              <div className="mb-4 flex flex-col gap-1 border-b border-[#ead8ca] pb-3">
                <p className="text-sm font-black text-[#1f1712]">建立班級識別</p>
                <p className="text-xs leading-5 text-[#8a7c72]">先選課程目錄，先選課程目錄，再填寫年度班級資料；新增與編輯共用同一組欄位。</p>
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
              <p className="mt-2 text-xs leading-5 text-[#8a7c72]">講師選項會依目前課程目錄的課程類別篩選；若更換課程目錄後講師不符，儲存後可在下方卡片展開編輯微調。</p>
            </section>

            <CourseOfferingDetailsFields
              series={getSeries(selectedSeriesId, courseSeries)}
              categories={categories}
              instructors={instructors}
              initialCapacity={getSeries(selectedSeriesId, courseSeries)?.defaultCapacity}
              initialLocation={getSeries(selectedSeriesId, courseSeries)?.defaultLocation}
              initialCourseMode={getSeries(selectedSeriesId, courseSeries)?.defaultCourseMode}
            />
            <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">儲存年度課程</button>
          </form>
        )}
        </div>
      </details>

      <section className="grid gap-5">
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

          return (
            <article key={offering.id} className="overflow-hidden rounded-[30px] border border-[#ead8ca] bg-white shadow-[0_16px_45px_rgba(90,55,38,0.07)]">
              <div className="h-2 w-full" style={{ backgroundColor: color }} />

              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-bold text-[#8B5035]">{offering.code ?? offering.classIdentifier ?? offering.id}</span>
                      <span className="rounded-full bg-[#f6eee8] px-3 py-1 text-xs font-semibold text-[#66584f]">{getSeriesTitle(offering.seriesId, courseSeries)}</span>
                      <StatusPill status={offering.status} active={offering.isActive} />
                      <CourseModePill value={offering.courseMode ?? series?.defaultCourseMode} />
                    </div>

                    <h2 className="mt-3 text-2xl font-black leading-tight text-[#1f1712]">
                      {offering.classDisplayName ?? offering.displayTitle ?? offering.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#66584f]">
                      {offering.year ?? "未設年度"} 年｜{offering.termLabel ?? `第 ${offering.term ?? "?"} 期`}｜{offering.shortName ?? "未設簡稱"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link href={rosterHref} className="rounded-2xl bg-[#E85F00] px-4 py-2 text-sm font-black text-white shadow-sm hover:brightness-105">
                      名冊
                    </Link>
                    {legacyCourse ? (
                      <Link href={`/admin/courses/${legacyCourse.id}/sessions`} className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">
                        課堂日誌
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(190px,1.25fr)]">
                  <MiniMetric label="名冊 / 報名" value={`${reserved}/${capacity}`} />
                  <MiniMetric label="運作模式" value={getCourseModeLabel(offering.courseMode ?? series?.defaultCourseMode)} />
                  <MiniMetric label="課堂日誌" value={sessionCount > 0 ? `${sessionCount} 堂` : "尚未排課"} />
                  <MiniMetric label="主要講師" value={primaryInstructorName ?? offering.primaryInstructorName ?? "未設"} />
                  <MiniMetric label="地點" value={offering.location ?? legacyCourse?.defaultLocation ?? "未設"} />
                  <MiniMetric label="日期" value={formatDateRange(offering.startDate, offering.endDate)} valueClassName="whitespace-nowrap text-sm" />
                </div>

                <details className="mt-5 rounded-[24px] border border-[#ead8ca] bg-[#fffaf5]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-black text-[#1f1712]">進階管理</p>
                      <p className="mt-1 text-xs leading-5 text-[#8a7c72]">需要修改班級資料時再展開；平常只使用上方「名冊」與「課堂日誌」。</p>
                    </div>
                    <span className="rounded-2xl border border-[#dbcabd] bg-white px-4 py-2 text-sm font-black text-[#5A3726]">展開</span>
                  </summary>

                  <div className="grid gap-4 border-t border-[#ead8ca] bg-white/60 p-4">
                    <details className="group rounded-[24px] border border-[#ead8ca] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,38,0.04)] lg:col-span-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-[#1f1712]">編輯年度課程</p>
                          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">調整年度、期別、名額、地點、日期與報名狀態。</p>
                        </div>
                        <span className="rounded-2xl border border-[#dbcabd] bg-[#fffaf5] px-4 py-2 text-sm font-black text-[#5A3726] group-open:bg-[#5A3726] group-open:text-white">
                          展開編輯
                        </span>
                      </summary>
                      <form action={saveCourseOfferingAction} className="mx-auto mt-5 max-w-5xl rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
                        <input type="hidden" name="id" value={offering.id} />
                        <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                        <div className="grid gap-4">
                          <label className="grid gap-1 text-sm font-semibold text-[#4e4038]">
                            課程目錄
                            <select name="seriesId" defaultValue={offering.seriesId} className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10">
                              {activeSeries.map((series) => <option key={series.id} value={series.id}>{series.title}</option>)}
                            </select>
                          </label>
                          <div className="grid gap-4">
                            <CourseOfferingDetailsFields
                              series={getSeries(offering.seriesId, courseSeries)}
                              categories={categories}
                              instructors={instructors}
                              initialYear={offering.year}
                              initialTerm={offering.term}
                              initialClassDisplayName={offering.classDisplayName ?? offering.displayTitle}
                              initialCapacity={offering.capacity ?? legacyCourse?.totalCapacity}
                              initialBookingStatus={offering.bookingStatus ?? offering.status ?? "open"}
                              initialCourseMode={offering.courseMode ?? series?.defaultCourseMode}
                              initialStartDate={offering.startDate}
                              initialEndDate={offering.endDate}
                              initialPrimaryInstructorId={offering.primaryInstructorId}
                              initialAssistantInstructorIds={offering.assistantInstructorIds ?? []}
                              initialLocation={offering.location ?? legacyCourse?.defaultLocation}
                              initialNotes={offering.notes}
                            />
                          </div>
                        </div>
                        <input type="hidden" name="isActive" value={offering.isActive === false ? "false" : "true"} />
                        <button className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white">
                          儲存年度課程
                        </button>
                      </form>
                    </details>

                    <details className="rounded-[24px] border border-rose-100 bg-rose-50/40 p-4">
                      <summary className="cursor-pointer text-sm font-black text-rose-700">停用與資料清理</summary>
                      <p className="mt-2 text-xs leading-5 text-rose-700">這裡只放低頻、風險較高的操作，避免干擾平常的名冊與課堂管理。</p>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <form action={disableCourseOfferingAction}>
                          <input type="hidden" name="id" value={offering.id} />
                          <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                          <input type="hidden" name="isActive" value={offering.isActive === false ? "true" : "false"} />
                          <button className={offering.isActive === false ? "w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100" : "w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"}>
                            {offering.isActive === false ? "啟用年度課程" : "停用年度課程"}
                          </button>
                        </form>
                        <form action={deleteCourseOfferingAction}>
                          <input type="hidden" name="id" value={offering.id} />
                          <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                          <button
                            disabled={hasRelations}
                            className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={hasRelations ? "已有課堂、名冊或預約時，請使用清除功能。" : undefined}
                          >
                            刪除空課程
                          </button>
                        </form>
                      </div>
                      <details className="mt-3 rounded-2xl border border-rose-200 bg-white p-3">
                        <summary className="cursor-pointer text-sm font-black text-rose-700">清除本年度資料</summary>
                        <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800">
                          會清除：約 {sessionCount} 堂課、{offeringStudents.length} 位學員、{enrollmentCount} 筆名冊關聯、{reservationCount} 筆預約、{attendanceCount} 筆點名紀錄。
                        </div>
                        <form action={clearCourseOfferingCascadeAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="offeringId" value={offering.id} />
                          <input type="hidden" name="legacyCourseId" value={linkedCourseId} />
                          <label className="grid gap-1 text-sm font-semibold text-rose-800">
                            請輸入「確認清除」
                            <input name="confirmation" required className="h-12 rounded-2xl border border-rose-200 bg-white px-3 font-normal outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100" placeholder="確認清除" />
                          </label>
                          <button className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700">
                            清除本年度課程資料
                          </button>
                        </form>
                      </details>
                    </details>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
