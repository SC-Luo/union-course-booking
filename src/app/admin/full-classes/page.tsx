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

function formatLockLabel(today: string, date: string) {
  const days = getDaysUntil(today, date);
  if (days <= 0) return "今天鎖定";
  if (days === 1) return "明天鎖定";
  return `${days} 天後鎖定`;
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

export default async function FullClassesPage() {
  const { weeklySessions } = await getDashboardData();
  const fullClasses = weeklySessions.filter((item) => item.capacity > 0 && item.bookedCount >= item.capacity);
  const nearlyFullClasses = weeklySessions.filter((item) => item.capacity > 0 && item.bookedCount < item.capacity && item.bookedCount / item.capacity >= 0.8);

  return (
    <AdminShell currentSection="booking.full">
      <PageHero
        label="報名管理"
        title="已額滿班級"
        description="集中查看未來 7 天內已額滿或接近額滿的場次，方便行政人員判斷是否需要候補、加開或通知學員。"
        action={<Link href="/admin/weekly-bookings" className="rounded-2xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95">回本週報名</Link>}
      />

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-[28px] border border-amber-200 bg-[#fffaf0] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]"><p className="text-sm font-semibold text-[#8B5035]">已額滿</p><p className="mt-3 text-4xl font-black text-[#1f1712]">{fullClasses.length}</p><p className="mt-2 text-sm text-[#8a7c72]">報名人數已達名額</p></article>
        <article className="rounded-[28px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]"><p className="text-sm font-semibold text-[#B46F4A]">接近額滿</p><p className="mt-3 text-4xl font-black text-[#1f1712]">{nearlyFullClasses.length}</p><p className="mt-2 text-sm text-[#8a7c72]">已達 80% 以上</p></article>
      </section>

      <section className="mb-8 rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <div><p className="text-sm font-semibold text-[#B46F4A]">額滿清單</p><h2 className="mt-1 text-2xl font-black text-[#1f1712]">已額滿場次</h2></div>
        <div className="mt-5 grid gap-3">
          {fullClasses.length === 0 ? <p className="rounded-2xl bg-[#fff9f3] p-5 text-sm text-[#8a7c72]">未來 7 天內沒有額滿場次。</p> : null}
          {fullClasses.map(({ course, series, session, color, categoryName, yearTermLabel, bookedCount, capacity }) => (
            <Link key={`${course.id}-${session.id}`} href={`/admin/sessions/${session.id}/reservations`} className="grid gap-4 rounded-2xl border border-[#eaded3] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md md:grid-cols-[minmax(0,1fr)_220px_140px] md:items-center" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
              <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fff6ed] px-2 py-1 text-xs font-semibold text-[#B46F4A]">已額滿</span><span className="rounded-full bg-[#f5ece4] px-2 py-1 text-xs font-semibold text-[#4e4038]">{categoryName}</span><span className="rounded-full bg-[#fffaf0] px-2 py-1 text-xs font-semibold text-[#8B5035]">{yearTermLabel}</span></div><h3 className="mt-3 text-lg font-bold text-[#1f1712]">{series.title}</h3><p className="mt-1 text-sm text-[#66584f]">{formatDate(session.date)} {session.startTime}–{session.endTime}</p></div>
              <div className="rounded-xl bg-[#fff3e8] p-3 text-sm"><p className="text-xs text-[#8a7c72]">名額</p><p className="mt-1 text-lg font-semibold text-[#1f1712]">{bookedCount}/{capacity}</p></div>
              <span className="inline-flex items-center justify-center rounded-xl bg-[#5A3726] px-4 py-3 text-sm font-semibold text-white hover:bg-[#8B5035]">查看名單</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <div><p className="text-sm font-semibold text-[#B46F4A]">預警清單</p><h2 className="mt-1 text-2xl font-black text-[#1f1712]">接近額滿場次</h2></div>
        <div className="mt-5 grid gap-3">
          {nearlyFullClasses.length === 0 ? <p className="rounded-2xl bg-[#fff9f3] p-5 text-sm text-[#8a7c72]">目前沒有接近額滿場次。</p> : null}
          {nearlyFullClasses.map(({ course, series, session, color, categoryName, bookedCount, capacity }) => (
            <Link key={`${course.id}-${session.id}`} href={`/admin/sessions/${session.id}/reservations`} className="rounded-2xl border border-[#eaded3] bg-white p-4 hover:bg-[#fff9f3]" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
              <span className="rounded-full bg-[#fff6ed] px-2 py-1 text-xs font-semibold text-[#B46F4A]">{categoryName}</span>
              <h3 className="mt-3 text-base font-bold text-[#1f1712]">{series.title}</h3>
              <p className="mt-1 text-sm text-[#8a7c72]">{formatDate(session.date)}｜{bookedCount}/{capacity}</p>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
