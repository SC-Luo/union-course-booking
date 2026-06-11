import { CourseViewSwitcher } from "@/components/course-view-switcher";
import { LastReservationCard } from "@/components/last-reservation-card";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";

export default async function Home() {
  const { categories, courses } = await getCourseCatalog();
  const activeCourses = courses.filter((course) => course.isActive && course.sessions.length > 0);
  const activeCategoryIds = new Set(activeCourses.map((course) => course.categoryId));
  const activeCategories = categories.filter((item) => item.isActive && activeCategoryIds.has(item.id));

  return (
    <StudentShell>
      <LastReservationCard />

      <section className="mb-8 overflow-hidden rounded-[2rem] border border-[#ead8c6] bg-gradient-to-br from-[#fffaf5] via-[#f8eadc] to-[#eed2b8] p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-[#9b4f1f] shadow-sm">
              學員中心
            </p>
            <h1 className="text-3xl font-black tracking-tight text-[#34231a] sm:text-5xl">
              查看課程、預約與查詢
            </h1>
          </div>
          <div className="rounded-3xl border border-white/75 bg-white/80 p-5 text-sm leading-6 text-[#6f4b35] shadow-sm">
            <p className="font-black text-[#3a2a20]">預約提醒</p>
            <p className="mt-2">
              自費預約制課程會在開課前 7 天鎖定預約與取消，請提前完成預約。
            </p>
          </div>
        </div>
      </section>

      <section id="course-list">
        <CourseViewSwitcher courses={activeCourses} categories={activeCategories} />
      </section>
    </StudentShell>
  );
}
