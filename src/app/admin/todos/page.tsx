import type { ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import {
  getEnrollmentOfferingId,
  getOfferingForCourse,
  getOfferingPeriodLabel,
  resolveCourseColor,
} from "@/lib/course-utils";

export const dynamic = "force-dynamic";

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function getDaysUntil(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.round((end - start) / 86400000);
}

function formatYearTermLabel(course: {
  year?: number;
  termLabel?: string;
  displayTitle?: string;
  title?: string;
}) {
  const parts = [course.year ? `${course.year}年` : "", course.termLabel ?? ""].filter(Boolean);
  if (parts.length > 0) return parts.join("｜");
  return course.displayTitle ?? course.title ?? "未設定期別";
}

function getCourseGroupLabel(courseType?: string) {
  if (!courseType) return "其他課程";
  if (courseType.includes("pre") || courseType.includes("job")) return "職前課程";
  if (courseType.includes("skill")) return "技能課程";
  if (courseType.includes("exam") || courseType.includes("roster") || courseType.includes("inservice")) return "在職課程";
  return "其他課程";
}

async function getDashboardData() {
  const {
    categories = [],
    courses,
    reservations,
    courseSeries = [],
    courseOfferings = [],
    enrollments = [],
  } = await getBookingData();

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = addDays(today, 7);
  const activeCourses = courses.filter((course) => course.isActive);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const seriesMap = new Map(
    courseSeries.map((series) => [
      series.id,
      {
        id: series.id,
        title: series.title,
        description: series.description ?? "",
        categoryId: series.categoryId,
        color: series.color,
      },
    ]),
  );

  function getSeriesInfo(course: (typeof activeCourses)[number]) {
    const existing = course.seriesId ? seriesMap.get(course.seriesId) : undefined;
    const category = categoryMap.get(course.categoryId);
    if (existing) return existing;
    return {
      id: course.seriesId ?? `series-${course.id}`,
      title: course.displayTitle?.split("｜")[0] ?? course.title,
      description: course.description ?? "",
      categoryId: course.categoryId,
      color: course.color ?? category?.color,
    };
  }

  const courseSummaries = activeCourses.map((course) => {
    const category = categoryMap.get(course.categoryId);
    const activeSessions = course.sessions.filter((session) => session.isActive);
    const futureSessions = activeSessions
      .filter((session) => session.date >= today)
      .slice()
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    const nextSession = futureSessions[0];
    const color = resolveCourseColor(course, category);
    const series = getSeriesInfo(course);
    const offering = getOfferingForCourse(course, courseOfferings);
    const rosterCount = enrollments.filter(
      (enrollment) => getEnrollmentOfferingId(enrollment) === offering.id && enrollment.status !== "withdrawn",
    ).length;

    return {
      course,
      series,
      offering,
      nextSession,
      rosterCount,
      color,
      categoryName: category?.name ?? course.categoryId,
      groupLabel: getCourseGroupLabel(course.courseType),
      yearTermLabel: getOfferingPeriodLabel(offering) || formatYearTermLabel(course),
    };
  });

  const weeklySessions = courseSummaries
    .flatMap(({ course, series, color, categoryName, yearTermLabel, rosterCount }) =>
      course.sessions
        .filter((session) => session.isActive && session.date >= today && session.date <= weekEnd)
        .map((session) => {
          const sessionReservations = reservations.filter(
            (reservation) => reservation.courseId === course.id && reservation.sessionId === session.id && reservation.status === "booked",
          );
          const bookedCount = sessionReservations.length;
          const capacity = session.capacity ?? course.totalCapacity ?? 0;
          const attendedCount = sessionReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
          const absentCount = sessionReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
          return {
            course,
            series,
            session,
            color,
            categoryName,
            yearTermLabel,
            rosterCount,
            bookedCount,
            capacity,
            attendedCount,
            absentCount,
            daysUntil: getDaysUntil(today, session.date),
          };
        }),
    )
    .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));

  const unscheduledClasses = courseSummaries.filter((item) => !item.nextSession);
  const emptyRosterClasses = courseSummaries.filter((item) => item.rosterCount === 0);
  const taskItems = [
    ...unscheduledClasses.map((item) => ({
      label: "尚未排課",
      title: item.series.title,
      meta: `${item.yearTermLabel}｜${item.categoryName}`,
      href: `/admin/courses/${item.course.id}/sessions`,
      priority: "高",
    })),
    ...emptyRosterClasses.map((item) => ({
      label: "名冊待確認",
      title: item.series.title,
      meta: `${item.yearTermLabel}｜目前 0 人`,
      href: `/admin/courses/${item.course.id}`,
      priority: "中",
    })),
  ];

  return { today, weekEnd, weeklySessions, taskItems };
}

function PageHero({ label, title, description, action }: { label: string; title: string; description: string; action?: ReactNode }) {
  return (
    <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#B46F4A]">{label}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1f1712] sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#66584f]">{description}</p>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </section>
  );
}

export default async function TodosPage() {
  const { taskItems, weeklySessions } = await getDashboardData();
  const attendancePending = weeklySessions.filter((item) => item.bookedCount > item.attendedCount + item.absentCount && item.daysUntil <= 0);
  const allTasks = [
    ...taskItems,
    ...attendancePending.map((item) => ({
      label: "點名待完成",
      title: item.series.title,
      meta: `${formatDate(item.session.date)}｜${item.bookedCount} 人待確認`,
      href: `/admin/sessions/${item.session.id}/reservations`,
      priority: "高",
    })),
  ];

  return (
    <AdminShell currentSection="dashboard.todo">
      <PageHero
        label="工作台"
        title="待處理事項"
        description="集中整理行政人員需要補齊的資料：未排場次、名冊異常、點名未完成等。這一頁後續可擴充成真正的待辦工作流。"
        action={<Link href="/admin" className="rounded-2xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95">回今日總覽</Link>}
      />

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-[28px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]"><p className="text-sm font-semibold text-[#B46F4A]">全部待辦</p><p className="mt-3 text-4xl font-black text-[#1f1712]">{allTasks.length}</p><p className="mt-2 text-sm text-[#8a7c72]">目前偵測到的事項</p></article>
        <article className="rounded-[28px] border border-amber-200 bg-[#fffaf0] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]"><p className="text-sm font-semibold text-[#8B5035]">高優先</p><p className="mt-3 text-4xl font-black text-[#1f1712]">{allTasks.filter((item) => item.priority === "高").length}</p><p className="mt-2 text-sm text-[#8a7c72]">建議優先處理</p></article>
        <article className="rounded-[28px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]"><p className="text-sm font-semibold text-[#B46F4A]">點名待完成</p><p className="mt-3 text-4xl font-black text-[#1f1712]">{attendancePending.length}</p><p className="mt-2 text-sm text-[#8a7c72]">今日或已到期場次</p></article>
      </section>

      <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <div><p className="text-sm font-semibold text-[#B46F4A]">待辦清單</p><h2 className="mt-1 text-2xl font-black text-[#1f1712]">需要處理的項目</h2></div>
        <div className="mt-5 grid gap-3">
          {allTasks.length === 0 ? <p className="rounded-2xl bg-[#fff9f3] p-5 text-sm text-[#8a7c72]">目前沒有明顯待處理事項。</p> : null}
          {allTasks.map((item, index) => (
            <Link key={`${item.label}-${item.title}-${index}`} href={item.href} className="grid gap-4 rounded-2xl border border-[#eaded3] bg-white p-4 hover:bg-[#fff9f3] md:grid-cols-[160px_minmax(0,1fr)_120px] md:items-center">
              <span className="inline-flex w-fit rounded-full bg-[#fff6ed] px-2 py-1 text-xs font-semibold text-[#B46F4A]">{item.label}</span>
              <div><h3 className="text-base font-bold text-[#1f1712]">{item.title}</h3><p className="mt-1 text-sm text-[#8a7c72]">{item.meta}</p></div>
              <span className="rounded-xl bg-[#5A3726] px-4 py-3 text-center text-sm font-semibold text-white">處理</span>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
