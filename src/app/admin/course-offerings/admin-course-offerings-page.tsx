import Link from "next/link";
import {
  deleteCourseOfferingAction,
  disableCourseOfferingAction,
  saveCourseOfferingAction,
} from "@/app/admin/actions";
import { clearCourseOfferingCascadeAction } from "./actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import CourseOfferingIdentityFields from "./CourseOfferingIdentityFields";
import CourseOfferingEditFields from "./CourseOfferingEditFields";

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

export default async function CourseOfferingsPage({ searchParams }: PageProps) {
  const { saved, error, seriesId } = await searchParams;
  const { categories, courseSeries, courseOfferings, courses, enrollments, reservations, students, courseSessions, attendanceRecords } = await getBookingData();
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
              年度課程是真正開班的班級容器，也是名冊、課堂詳情與點名紀錄掛載的位置。先建立年度課程，再到名冊管理加入學員。
            </p>
          </div>
          <a href="/admin/course-sessions" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105">管理課堂詳情 →</a>
        </div>
      </section>

      {saved ? <p className="mb-4 rounded-2xl border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">已儲存年度課程。</p> : null}
      {error ? <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">無法完成操作，請確認欄位或關聯資料。</p> : null}

      <section className="mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <h2 className="text-xl font-black text-[#1f1712]">新增年度課程</h2>
        <p className="mt-1 text-sm leading-6 text-[#8a7c72]">例如：美容丙級檢定班｜115 年｜第 1 期。建立後即可進入課堂詳情、名冊與點名流程。</p>
        {activeSeries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">尚未建立課程目錄，請先到課程目錄新增。</div>
        ) : (
          <form action={saveCourseOfferingAction} className="mt-5 grid gap-4 xl:grid-cols-2">
            <CourseOfferingIdentityFields seriesOptions={seriesOptions} selectedSeriesId={selectedSeriesId} />
            <button className="rounded-2xl bg-gradient-to-r from-[#E85F00] to-[#B46F4A] px-4 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105 xl:col-span-2">儲存年度課程</button>
          </form>
        )}
      </section>

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
          const capacity = offering.capacity ?? legacyCourse?.totalCapacity ?? "-";
          const reserved = offeringStudents.length || enrollmentCount || reservationCount;
          const rosterHref = `/admin/students?classId=${encodeURIComponent(linkedCourseId)}&seriesId=${encodeURIComponent(offering.seriesId ?? "")}&year=${encodeURIComponent(String(offering.year ?? ""))}&term=${encodeURIComponent(String(offering.termLabel ?? offering.term ?? ""))}`;

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
                      管理名冊
                    </Link>
                    {legacyCourse ? (
                      <Link href={`/admin/courses/${legacyCourse.id}/sessions`} className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">
                        進入課堂
                      </Link>
                    ) : null}
                    <form action={disableCourseOfferingAction}>
                      <input type="hidden" name="id" value={offering.id} />
                      <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                      <input type="hidden" name="isActive" value={offering.isActive === false ? "true" : "false"} />
                      <button className={offering.isActive === false ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100" : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"}>
                        {offering.isActive === false ? "啟用" : "停用"}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(190px,1.25fr)]">
                  <MiniMetric label="名冊 / 報名" value={`${reserved}/${capacity}`} />
                  <MiniMetric label="課堂詳情" value={sessionCount > 0 ? `${sessionCount} 堂` : "尚未排課"} />
                  <MiniMetric label="主要講師" value={offering.primaryInstructorName ?? "未設"} />
                  <MiniMetric label="地點" value={offering.location ?? legacyCourse?.defaultLocation ?? "未設"} />
                  <MiniMetric label="日期" value={formatDateRange(offering.startDate, offering.endDate)} valueClassName="whitespace-nowrap text-sm" />
                </div>

                <div className="mt-5 rounded-[26px] border border-[#ead8ca] bg-[#fffaf5] p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-sm font-black text-[#1f1712]">年度課程操作</p>
                      <p className="mt-1 text-xs leading-5 text-[#8a7c72]">
                        名冊、課堂與年度資料分開操作，避免在同一張卡片塞入過多表單。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={rosterHref} className="rounded-2xl bg-[#E85F00] px-4 py-2 text-sm font-black text-white shadow-sm hover:brightness-105">
                        前往名冊管理
                      </Link>
                      {legacyCourse ? (
                        <Link href={`/admin/courses/${legacyCourse.id}/sessions`} className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">
                          進入課堂詳情
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                      <form action={saveCourseOfferingAction} className="mt-5 rounded-[24px] border border-[#ead8ca] bg-[#fffdf9] p-4">
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
                            <CourseOfferingEditFields
                              initialYear={offering.year}
                              initialTerm={offering.term}
                              initialClassDisplayName={offering.classDisplayName ?? offering.displayTitle}
                              initialCapacity={offering.capacity ?? legacyCourse?.totalCapacity}
                              initialBookingStatus={offering.bookingStatus ?? offering.status ?? "open"}
                              initialStartDate={offering.startDate}
                              initialEndDate={offering.endDate}
                              initialPrimaryInstructorName={offering.primaryInstructorName}
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

                    <div className="rounded-[24px] border border-[#ead8ca] bg-white p-4 shadow-[0_8px_22px_rgba(90,55,38,0.04)]">
                      <p className="text-sm font-black text-[#1f1712]">名冊管理</p>
                      <p className="mt-1 text-xs leading-5 text-[#8a7c72]">新增、停用與查詢本年度課程的學員。</p>
                      <Link href={rosterHref} className="mt-3 block rounded-2xl border border-[#dbcabd] bg-white px-4 py-3 text-center text-sm font-black text-[#5A3726] hover:bg-[#fff6ed]">
                        前往名冊管理 →
                      </Link>
                    </div>

                    <div className="rounded-[24px] border border-rose-100 bg-white p-4 shadow-[0_8px_22px_rgba(90,55,38,0.04)]">
                      <p className="text-sm font-black text-[#1f1712]">資料清理</p>
                      <p className="mt-1 text-xs leading-5 text-[#8a7c72]">只用於清除建立錯誤或測試用的年度課程資料。</p>
                      <div className="mt-3 grid gap-3">
                        <form action={deleteCourseOfferingAction}>
                          <input type="hidden" name="id" value={offering.id} />
                          <input type="hidden" name="legacyCourseId" value={legacyCourse?.id ?? offering.legacyCourseId ?? ""} />
                          <button
                            disabled={hasRelations}
                            className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={hasRelations ? "已有課堂、名冊或預約時，請使用下方清除功能。" : undefined}
                          >
                            刪除空課程
                          </button>
                        </form>
                        <details className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
                          <summary className="cursor-pointer text-sm font-black text-rose-700">清除本年度資料</summary>
                          <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-rose-800">
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
                      </div>
                    </div>
                  </div>
                </div>              </div>
            </article>
          );
        })}
      </section>
    </AdminShell>
  );
}
