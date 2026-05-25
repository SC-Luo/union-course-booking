import Link from "next/link";
import { disableCourseAction, saveCourseAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { courseTypes, professionalCategories } from "@/lib/course-coding";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName } from "@/lib/course-utils";
import type {
  Course,
  CourseOffering,
  CourseSeries,
  CourseSession,
  CourseSessionRecord,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type CourseSection = "master" | "offering" | "session";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    courseId?: string;
    section?: string;
  }>;
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

const sectionTabs: Array<{
  key: CourseSection;
  label: string;
  href: string;
  description: string;
}> = [
  {
    key: "master",
    label: "課程主檔",
    href: "/admin/courses?section=master",
    description: "長期重複開設的課程模板",
  },
  {
    key: "offering",
    label: "年度課程",
    href: "/admin/courses?section=offering",
    description: "實際招生的年度期別班級",
  },
  {
    key: "session",
    label: "課堂場次",
    href: "/admin/courses?section=session",
    description: "每一天或每一堂課的時間安排",
  },
];

function normalizeSection(section?: string): CourseSection {
  if (section === "master" || section === "session") return section;
  return "offering";
}

function getSectionTitle(section: CourseSection) {
  if (section === "master") return "課程主檔設定";
  if (section === "session") return "課堂場次工作區";
  return "年度課程工作區";
}

function getSectionDescription(section: CourseSection) {
  if (section === "master")
    return "管理可以長期重複開設的課程模板，例如美容丙級檢定班。";
  if (section === "session")
    return "管理實際上課日期、單元、地點、名額與預約截止時間。";
  return "管理某一年、某一期實際招生的班級，例如 115 年第 2 期美容丙級檢定班。";
}

function getCourseDateTime(session: CourseSessionRecord | CourseSession) {
  if ("startsAt" in session && session.startsAt) {
    const startsAt = session.startsAt
      .replace("T", " ")
      .replace("+08:00", "")
      .slice(0, 16);
    const endsAt = session.endsAt
      ? session.endsAt.replace("T", " ").replace("+08:00", "").slice(11, 16)
      : "";
    return endsAt ? `${startsAt} - ${endsAt}` : startsAt;
  }

  if ("startTime" in session) {
    return `${session.date ?? "未設定日期"} ${session.startTime ?? ""}${session.endTime ? ` - ${session.endTime}` : ""}`.trim();
  }

  return session.date ?? "未設定日期";
}

function toMasterFromCourse(course: Course): CourseSeries {
  return {
    id:
      course.courseMasterId ??
      course.courseSeriesId ??
      course.seriesId ??
      course.id,
    code: course.code,
    title: course.title,
    name: course.title,
    categoryId: course.categoryId,
    courseType: course.courseType,
    defaultCapacity: course.totalCapacity,
    defaultLocation: course.defaultLocation,
    description: course.description,
    color: course.color,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toOfferingFromCourse(course: Course): CourseOffering {
  return {
    id: course.offeringId ?? course.id,
    seriesId:
      course.courseMasterId ??
      course.courseSeriesId ??
      course.seriesId ??
      course.id,
    legacyCourseId: course.id,
    categoryId: course.categoryId,
    code: course.code,
    title: course.title,
    displayTitle: course.displayTitle ?? course.displayName ?? course.title,
    displayName: course.displayName ?? course.displayTitle ?? course.title,
    shortName: course.shortName ?? course.shortTitle,
    year: course.year,
    term: course.term,
    termNumber: course.termNumber,
    termLabel: course.termLabel,
    classIdentifier: course.classIdentifier,
    classDisplayName: course.classDisplayName,
    courseType: course.courseType,
    location: course.defaultLocation,
    capacity: course.totalCapacity,
    assistantInstructorIds: course.assistantInstructorIds,
    assistantInstructorNames: course.assistantInstructorNames,
    bookingOpen: course.bookingOpen,
    bookingStatus: course.bookingOpen ? "open" : "closed",
    status: course.status,
    color: course.color,
    notes: course.notes,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toSessionRecordFromCourseSession(
  course: Course,
  session: CourseSession,
): CourseSessionRecord {
  return {
    id: session.id,
    offeringId: session.offeringId ?? course.offeringId ?? course.id,
    seriesId:
      session.seriesId ??
      course.courseMasterId ??
      course.courseSeriesId ??
      course.seriesId ??
      course.id,
    legacyCourseId: course.id,
    categoryId: session.categoryId ?? course.categoryId,
    title: session.topic,
    unitName: session.topic,
    location: session.location,
    startsAt: `${session.date}T${session.startTime}:00+08:00`,
    endsAt: `${session.date}T${session.endTime}:00+08:00`,
    date: session.date,
    capacity: session.capacity,
    bookingDeadline: session.bookingDeadline,
    status: session.status,
    instructorId: session.instructorId,
    instructorName: session.instructorName,
    assistantInstructorIds: session.assistantInstructorIds,
    assistantInstructorNames: session.assistantInstructorNames,
    stats: {
      reservedCount: session.bookedCount,
      uncheckedCount: session.bookedCount,
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function dedupeMasters(masters: CourseSeries[]) {
  const map = new Map<string, CourseSeries>();
  for (const master of masters) {
    if (!map.has(master.id)) map.set(master.id, master);
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.code ?? a.title).localeCompare(b.code ?? b.title),
  );
}

function getStatusLabel(status?: string, open?: boolean) {
  if (open === true) return "開放報名";
  if (open === false) return "關閉報名";
  if (!status) return "未設定";
  if (status === "open" || status === "active") return "開放";
  if (status === "closed") return "關閉";
  if (status === "scheduled") return "已排課";
  if (status === "suspended") return "停課";
  if (status === "cancelled") return "取消";
  return status;
}

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const { saved, error, courseId, section: rawSection } = await searchParams;
  const section = normalizeSection(rawSection);
  const data = await getBookingData();
  const { categories, courses } = data;

  const activeCategories =
    categories.length > 0
      ? categories.filter((category) => category.isActive)
      : professionalCategories;

  const masters = dedupeMasters(
    data.courseSeries.length > 0
      ? data.courseSeries
      : courses.map(toMasterFromCourse),
  );
  const offerings = (
    data.courseOfferings.length > 0
      ? data.courseOfferings
      : courses.map(toOfferingFromCourse)
  ).sort((a, b) => {
    const aValue = `${a.year ?? ""}-${a.termNumber ?? a.term ?? ""}-${a.displayTitle ?? a.title}`;
    const bValue = `${b.year ?? ""}-${b.termNumber ?? b.term ?? ""}-${b.displayTitle ?? b.title}`;
    return bValue.localeCompare(aValue);
  });
  const courseSessions = (
    data.courseSessions.length > 0
      ? data.courseSessions
      : courses.flatMap((course) =>
          course.sessions.map((session) =>
            toSessionRecordFromCourseSession(course, session),
          ),
        )
  ).sort((a, b) =>
    `${a.date ?? a.startsAt ?? ""}`.localeCompare(
      `${b.date ?? b.startsAt ?? ""}`,
    ),
  );

  const selectedCurrentSection = `course-settings.${section}`;

  return (
    <AdminShell currentSection={selectedCurrentSection}>
      <section className="mb-6 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <p className="text-sm font-medium text-[#B46F4A]">課程管理</p>
        <h1 className="mt-2 text-3xl font-black text-[#1f1712] sm:text-4xl">
          {getSectionTitle(section)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66584f]">
          {getSectionDescription(section)}
        </p>
      </section>

      <nav className="mb-6 grid gap-3 md:grid-cols-3">
        {sectionTabs.map((tab) => {
          const isActive = section === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-[24px] border px-5 py-4 transition ${
                isActive
                  ? "border-[#B46F4A] bg-[#fff6ed] shadow-[0_12px_35px_rgba(180,111,74,0.16)]"
                  : "border-[#ead8ca] bg-[#fffdf9] hover:bg-[#fff6ed]"
              }`}
            >
              <span className="text-base font-bold text-[#1f1712]">
                {tab.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#8a7c72]">
                {tab.description}
              </span>
            </Link>
          );
        })}
      </nav>

      {saved ? (
        <p className="mb-4 rounded-md border border-[#d8b69f] bg-[#fff6ed] px-4 py-3 text-sm text-[#8B5035]">
          已建立或更新課程。
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          請填寫方案、分類與課程名稱。
        </p>
      ) : null}

      {section === "master" ? (
        <>
          <details className="group mb-6 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-[#B46F4A] px-4 py-3 text-sm font-semibold text-white hover:brightness-95">
              <span>新增課程主檔</span>
              <span className="text-xs group-open:hidden">展開</span>
              <span className="hidden text-xs group-open:inline">收合</span>
            </summary>
            <div className="mt-4 rounded-2xl border border-[#ead8ca] bg-[#fff9f3] p-4">
              <p className="text-sm leading-6 text-[#66584f]">
                目前這個表單沿用既有課程儲存流程。下一輪若要完全拆成主檔 /
                年度課程 / 場次三個資料表，再補專用 action。
              </p>
              <form action={saveCourseAction} className="mt-4 grid gap-3">
                <input
                  type="hidden"
                  name="redirectTo"
                  value="/admin/courses?section=master"
                />
                <div className="grid gap-3 lg:grid-cols-[160px_180px_1fr]">
                  <label>
                    <span className="mb-2 block text-sm font-medium text-[#4e4038]">
                      方案
                    </span>
                    <select
                      name="courseType"
                      className="w-full rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-3 py-3"
                    >
                      {courseTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.id} {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-medium text-[#4e4038]">
                      分類
                    </span>
                    <select
                      name="categoryId"
                      className="w-full rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-3 py-3"
                    >
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.id} {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-medium text-[#4e4038]">
                      課程主檔名稱
                    </span>
                    <input
                      name="title"
                      className="w-full rounded-2xl border border-[#dbcabd] px-3 py-3"
                      placeholder="美容丙級檢定班"
                    />
                  </label>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
                  <input
                    name="defaultLocation"
                    className="rounded-2xl border border-[#dbcabd] px-3 py-3"
                    placeholder="預設上課地點"
                  />
                  <input
                    name="description"
                    className="rounded-2xl border border-[#dbcabd] px-3 py-3"
                    placeholder="課程說明"
                  />
                  <label>
                    <span className="sr-only">課程顏色</span>
                    <select
                      name="color"
                      className="w-full rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-3 py-3"
                    >
                      {colorPresets.map((item) => (
                        <option key={item.label} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <textarea
                  name="notes"
                  className="min-h-20 rounded-2xl border border-[#dbcabd] px-3 py-3"
                  placeholder="注意事項"
                />
                <button className="rounded-md bg-[#B46F4A] px-4 py-3 text-sm font-semibold text-white hover:brightness-95 sm:w-40">
                  儲存主檔
                </button>
              </form>
            </div>
          </details>

          <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#1f1712]">
                  課程主檔列表
                </h2>
                <p className="mt-1 text-sm text-[#8a7c72]">
                  主檔代表可重複開設的課程模板，不應因年份或期別不同而重複建立。
                </p>
              </div>
              <span className="text-sm font-medium text-[#B46F4A]">
                共 {masters.length} 筆
              </span>
            </div>
            <div className="grid gap-4">
              {masters.map((master) => {
                const color =
                  master.color ??
                  master.defaultColor ??
                  categories.find(
                    (category) => category.id === master.categoryId,
                  )?.color ??
                  "#B46F4A";
                const relatedOfferings = offerings.filter(
                  (offering) =>
                    offering.seriesId === master.id ||
                    offering.courseMasterId === master.id ||
                    offering.courseSeriesId === master.id,
                );
                return (
                  <article
                    key={master.id}
                    className="rounded-xl border border-[#eaded3] bg-[#fff9f3] p-4"
                    style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#B46F4A]">
                          <span>{master.code ?? master.id}</span>
                          <span>・</span>
                          <span>
                            {getCategoryName(master.categoryId, categories)}
                          </span>
                          <span>・</span>
                          <span>{master.courseType ?? "未設定方案"}</span>
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-[#1f1712]">
                          {master.title}
                        </h3>
                        <p className="mt-1 text-sm text-[#66584f]">
                          預設地點：{master.defaultLocation || "未設定"}
                          ｜預設名額：{master.defaultCapacity ?? "未設定"}
                          ｜年度課程：{relatedOfferings.length} 筆
                        </p>
                        {master.description ? (
                          <p className="mt-2 text-sm leading-6 text-[#8a7c72]">
                            {master.description}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${master.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
                      >
                        {master.isActive ? "啟用中" : "已停用"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {section === "offering" ? (
        <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1712]">
                年度課程 / 開課班級
              </h2>
              <p className="mt-1 text-sm text-[#8a7c72]">
                這裡顯示某一年、某一期實際招生的班級。
              </p>
            </div>
            <span className="text-sm font-medium text-[#B46F4A]">
              共 {offerings.length} 筆
            </span>
          </div>
          <div className="grid gap-4">
            {offerings.map((offering) => {
              const master = masters.find(
                (item) =>
                  item.id === offering.seriesId ||
                  item.id === offering.courseMasterId ||
                  item.id === offering.courseSeriesId,
              );
              const color =
                offering.color ??
                master?.color ??
                categories.find(
                  (category) => category.id === offering.categoryId,
                )?.color ??
                "#B46F4A";
              const relatedSessions = courseSessions.filter(
                (session) =>
                  session.offeringId === offering.id ||
                  session.legacyCourseId === offering.legacyCourseId,
              );
              return (
                <article
                  key={offering.id}
                  className="rounded-xl border border-[#eaded3] bg-[#fff9f3] p-4"
                  style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#B46F4A]">
                        <span>{offering.code ?? offering.id}</span>
                        <span>・</span>
                        <span>
                          {offering.year ? `${offering.year} 年` : "未設定年度"}
                        </span>
                        <span>・</span>
                        <span>
                          {offering.termLabel ??
                            (offering.term
                              ? `第 ${offering.term} 期`
                              : "未設定期別")}
                        </span>
                      </div>
                      <h3 className="mt-2 text-xl font-semibold text-[#1f1712]">
                        {offering.displayTitle ??
                          offering.displayName ??
                          offering.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#66584f]">
                        主檔：{master?.title ?? offering.title}｜地點：
                        {offering.location || "未設定"}｜名額：
                        {offering.capacity ?? "未設定"}｜場次：
                        {relatedSessions.length} 堂
                      </p>
                      <p className="mt-1 text-sm text-[#8a7c72]">
                        招生狀態：
                        {getStatusLabel(
                          offering.status ?? offering.bookingStatus,
                          offering.bookingOpen,
                        )}
                        ｜期間：{offering.startDate ?? "未設定"} -{" "}
                        {offering.endDate ?? "未設定"}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[300px]">
                      {offering.legacyCourseId ? (
                        <Link
                          href={`/admin/courses/${offering.legacyCourseId}/sessions`}
                          className="rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-3 py-3 text-center text-sm font-medium text-[#4e4038] hover:bg-[#f5ece4]"
                        >
                          查看場次
                        </Link>
                      ) : null}
                      <Link
                        href="/admin/students?mode=offering"
                        className="rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-3 py-3 text-center text-sm font-medium text-[#4e4038] hover:bg-[#f5ece4]"
                      >
                        梯次名冊
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === "session" ? (
        <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1712]">
                課堂場次列表
              </h2>
              <p className="mt-1 text-sm text-[#8a7c72]">
                這裡顯示每一堂課的日期、單元、地點、預約截止與出席統計。
              </p>
            </div>
            <span className="text-sm font-medium text-[#B46F4A]">
              共 {courseSessions.length} 堂
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#ead8ca]">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead className="bg-[#fff6ed] text-[#4e4038]">
                <tr>
                  <th className="px-4 py-3 font-semibold">日期時間</th>
                  <th className="px-4 py-3 font-semibold">課堂單元</th>
                  <th className="px-4 py-3 font-semibold">所屬班級</th>
                  <th className="px-4 py-3 font-semibold">地點</th>
                  <th className="px-4 py-3 font-semibold">名額 / 預約</th>
                  <th className="px-4 py-3 font-semibold">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ead8ca] bg-[#fffdf9]">
                {courseSessions.map((session) => {
                  const offering = offerings.find(
                    (item) =>
                      item.id === session.offeringId ||
                      item.legacyCourseId === session.legacyCourseId,
                  );
                  return (
                    <tr
                      key={session.id}
                      className="align-top hover:bg-[#fff9f3]"
                    >
                      <td className="px-4 py-3 text-[#4e4038]">
                        {getCourseDateTime(session)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1f1712]">
                        {session.unitName ?? session.title ?? "未命名場次"}
                      </td>
                      <td className="px-4 py-3 text-[#66584f]">
                        {offering?.displayTitle ??
                          offering?.displayName ??
                          offering?.title ??
                          session.offeringId}
                      </td>
                      <td className="px-4 py-3 text-[#66584f]">
                        {session.location ?? "未設定"}
                      </td>
                      <td className="px-4 py-3 text-[#66584f]">
                        {session.capacity ?? "未設定"}
                        {session.stats?.reservedCount != null
                          ? ` / 已預約 ${session.stats.reservedCount}`
                          : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#f5ece4] px-3 py-1 text-xs font-semibold text-[#66584f]">
                          {getStatusLabel(session.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
