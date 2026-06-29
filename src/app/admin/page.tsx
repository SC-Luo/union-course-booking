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

export default async function AdminHomePage() {
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

  const courseSummaries = activeCourses
    .map((course) => {
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
    })
    .sort((a, b) => {
      const aDate = a.nextSession ? `${a.nextSession.date} ${a.nextSession.startTime}` : "9999-12-31 23:59";
      const bDate = b.nextSession ? `${b.nextSession.date} ${b.nextSession.startTime}` : "9999-12-31 23:59";
      return aDate.localeCompare(bDate);
    });

  const todaySessions = courseSummaries
    .flatMap(({ course, series, color, categoryName, yearTermLabel }) =>
      course.sessions
        .filter((session) => session.isActive && session.date === today)
        .map((session) => {
          const sessionReservations = reservations.filter(
            (reservation) =>
              reservation.courseId === course.id && reservation.sessionId === session.id && reservation.status === "booked",
          );
          const attendedCount = sessionReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
          const absentCount = sessionReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
          return { course, series, session, color, categoryName, yearTermLabel, bookedCount: sessionReservations.length, attendedCount, absentCount };
        }),
    )
    .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));

  const weeklySessions = courseSummaries
    .flatMap(({ course, series, color, categoryName, yearTermLabel, rosterCount }) =>
      course.sessions
        .filter((session) => session.isActive && session.date >= today && session.date <= weekEnd)
        .map((session) => {
          const sessionReservations = reservations.filter(
            (reservation) =>
              reservation.courseId === course.id && reservation.sessionId === session.id && reservation.status === "booked",
          );
          const bookedCount = sessionReservations.length;
          const capacity = session.capacity ?? course.totalCapacity ?? 0;
          return { course, series, session, color, categoryName, yearTermLabel, rosterCount, bookedCount, capacity, daysUntil: getDaysUntil(today, session.date) };
        }),
    )
    .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));

  const unscheduledClasses = courseSummaries.filter((item) => !item.nextSession);
  const emptyRosterClasses = courseSummaries.filter((item) => item.rosterCount === 0);
  const pendingAttendanceSessions = todaySessions.filter((item) => item.bookedCount > item.attendedCount + item.absentCount);
  const weeklyBookingCount = weeklySessions.reduce((sum, item) => sum + item.bookedCount, 0);
  const weeklyCapacity = weeklySessions.reduce((sum, item) => sum + item.capacity, 0);

  const taskItems = [
    ...unscheduledClasses.slice(0, 3).map((item) => ({ label: "尚未排課", title: item.series.title, meta: `${item.yearTermLabel}｜${item.categoryName}`, href: `/admin/courses/${item.course.id}/sessions` })),
    ...emptyRosterClasses.slice(0, 3).map((item) => ({ label: "名冊待確認", title: item.series.title, meta: `${item.yearTermLabel}｜目前 0 人`, href: `/admin/courses/${item.course.id}` })),
  ].slice(0, 4);

  return (
    <AdminShell currentSection="dashboard">
      <section className="mb-8 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#B46F4A]">秘書處後台</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1f1712] sm:text-4xl">行政工作總覽</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[#66584f]">
              這裡是秘書處的中控入口，集中處理課程建制、年度班級、名冊、報名、點名出勤與統計匯出；講師點名與學員預約則切換到各自入口。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/course-offerings" className="rounded-2xl border border-[#B46F4A]/25 bg-white/70 px-4 py-3 text-sm font-semibold text-[#5A3726] hover:bg-[#fff6ed]">年度課程</Link>
            <Link href="/admin/students?mode=students" className="rounded-2xl border border-[#B46F4A]/25 bg-white/70 px-4 py-3 text-sm font-semibold text-[#5A3726] hover:bg-[#fff6ed]">學員名冊</Link>
            <Link href="/teaching/login" className="rounded-2xl bg-gradient-to-br from-[#E85F00] via-[#E7892B] to-[#B46F4A] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95">授課工作台 ↗</Link>
            <Link href="/" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#8B5035]">學員中心 ↗</Link>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["今日課程", todaySessions.length, "今天排定上課場次"],
          ["待點名", pendingAttendanceSessions.length, "尚未完成出席標記"],
          ["本週報名", `${weeklyBookingCount}/${weeklyCapacity}`, "已報名 / 可預約名額"],
          ["待處理", taskItems.length, "未排課或名冊待確認"],
        ].map(([label, value, note]) => (
          <article key={label} className="rounded-[28px] border border-[#ead8ca] bg-[#fffdf9] p-5 shadow-[0_12px_36px_rgba(90,55,38,0.06)]">
            <p className="text-sm font-semibold text-[#B46F4A]">{label}</p>
            <p className="mt-3 text-4xl font-black text-[#1f1712]">{value}</p>
            <p className="mt-2 text-sm text-[#8a7c72]">{note}</p>
          </article>
        ))}
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#B46F4A]">今日課堂</p>
              <h2 className="mt-1 text-2xl font-black text-[#1f1712]">今日行政追蹤</h2>
              <p className="mt-1 text-sm text-[#8a7c72]">秘書處可查看今日課堂狀態；講師與助教請由授課工作台進入點名。</p>
            </div>
            <span className="rounded-full bg-[#f5ece4] px-3 py-1 text-sm font-medium text-[#66584f]">{formatDate(today)}</span>
          </div>

          <div className="mt-5 grid gap-3">
            {todaySessions.length === 0 ? (
              <p className="rounded-2xl bg-[#fff9f3] p-5 text-sm text-[#8a7c72]">今天沒有排定課堂。</p>
            ) : null}
            {todaySessions.slice(0, 5).map(({ course, series, session, color, categoryName, bookedCount, attendedCount, absentCount, yearTermLabel }) => (
              <Link key={`${course.id}-${session.id}`} href={`/admin/sessions/${session.id}/reservations`} className="grid gap-4 rounded-2xl border border-[#eaded3] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md lg:grid-cols-[minmax(0,1fr)_300px_130px] lg:items-center" style={{ borderLeftColor: color, borderLeftWidth: 5 }}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f5ece4] px-2 py-1 text-xs font-semibold text-[#4e4038]">{categoryName}</span>
                    <span className="rounded-full bg-[#fff6ed] px-2 py-1 text-xs font-medium text-[#B46F4A]">{yearTermLabel}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-[#1f1712]">{series.title}</h3>
                  <p className="mt-1 text-sm text-[#66584f]">{session.startTime}–{session.endTime}｜{session.location || course.defaultLocation || "未設定地點"}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-[#fff9f3] p-3"><p className="text-xs text-[#8a7c72]">預約</p><p className="mt-1 text-lg font-semibold text-[#1f1712]">{bookedCount}</p></div>
                  <div className="rounded-xl bg-[#fff9f3] p-3"><p className="text-xs text-[#8a7c72]">已到</p><p className="mt-1 text-lg font-semibold text-[#1f1712]">{attendedCount}</p></div>
                  <div className="rounded-xl bg-[#fff9f3] p-3"><p className="text-xs text-[#8a7c72]">未到</p><p className="mt-1 text-lg font-semibold text-[#1f1712]">{absentCount}</p></div>
                </div>
                <span className="inline-flex items-center justify-center rounded-xl bg-[#5A3726] px-4 py-3 text-sm font-semibold text-white hover:bg-[#8B5035]">查看名單</span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
          <p className="text-sm font-semibold text-[#B46F4A]">行政提醒</p>
          <h2 className="mt-1 text-2xl font-black text-[#1f1712]">待處理摘要</h2>
          <div className="mt-5 grid gap-3">
            {taskItems.length === 0 ? <p className="rounded-2xl bg-[#fff9f3] p-5 text-sm text-[#8a7c72]">目前沒有明顯待處理事項。</p> : null}
            {taskItems.map((item, index) => (
              <Link key={`${item.label}-${item.title}-${index}`} href={item.href} className="rounded-2xl border border-[#eaded3] bg-white p-4 hover:bg-[#fff9f3]">
                <span className="rounded-full bg-[#fff6ed] px-2 py-1 text-xs font-semibold text-[#B46F4A]">{item.label}</span>
                <h3 className="mt-3 text-base font-bold text-[#1f1712]">{item.title}</h3>
                <p className="mt-1 text-sm text-[#8a7c72]">{item.meta}</p>
              </Link>
            ))}
            <Link href="/admin/todos" className="rounded-2xl border border-[#B46F4A]/25 bg-[#fff9f3] px-4 py-3 text-center text-sm font-bold text-[#5A3726] hover:bg-[#fff3e6]">查看全部待處理 →</Link>
          </div>
        </aside>
      </section>

      <section className="rounded-[30px] border border-[#ead8ca] bg-[#fffdf9] p-6 shadow-[0_16px_45px_rgba(90,55,38,0.07)] sm:p-7">
        <p className="text-sm font-semibold text-[#B46F4A]">快速入口</p>
        <h2 className="mt-1 text-2xl font-black text-[#1f1712]">常用功能</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["課程類別", "/admin/course-categories"],
            ["課程目錄", "/admin/course-masters"],
            ["年度課程", "/admin/course-offerings"],
            ["課堂詳情", "/admin/course-sessions"],
            ["報名總覽", "/admin/weekly-bookings"],
            ["鎖定管理", "/admin/booking-locks"],
            ["學員名冊", "/admin/students?mode=students"],
            ["統計匯出", "/admin/stats"],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="rounded-2xl border border-[#eaded3] bg-white px-4 py-4 text-sm font-bold text-[#5A3726] hover:border-[#B46F4A]/35 hover:bg-[#fff9f3]">{label} →</Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
