import { CourseViewSwitcher } from "@/components/course-view-switcher";
import { LastReservationCard } from "@/components/last-reservation-card";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";
import { isBookingCourse } from "@/lib/course-utils";

export default async function Home() {
  const { categories, courses } = await getCourseCatalog();
  const activeCourses = courses.filter((course) => course.isActive && course.sessions.length > 0);
  const bookingCourseCount = activeCourses.filter(isBookingCourse).length;
  const fixedRosterCourseCount = activeCourses.length - bookingCourseCount;
  const activeCategoryIds = new Set(activeCourses.map((course) => course.categoryId));
  const activeCategories = categories.filter((item) => item.isActive && activeCategoryIds.has(item.id));

  return (
    <StudentShell>
      <LastReservationCard />

      <section className="mb-8 overflow-hidden rounded-[2rem] border border-[#ead8c6] bg-gradient-to-br from-[#fffaf5] via-[#f8eadc] to-[#eed2b8] p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-[#9b4f1f] shadow-sm">
              課程資訊與學員服務
            </p>
            <h1 className="text-3xl font-black tracking-tight text-[#34231a] sm:text-5xl">
              查看目前開放的課程
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#70513d]">
              自費課程可依開放時段預約；職前、產投、在職或補助課程則以固定名冊為主，依課表出席並累計出缺勤紀錄。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-2 text-emerald-800">
                預約制 {bookingCourseCount} 門
              </span>
              <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-2 text-amber-900">
                固定名冊 {fixedRosterCourseCount} 門
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/75 bg-white/80 p-5 text-sm leading-6 text-[#6f4b35] shadow-sm">
            <p className="font-black text-[#3a2a20]">使用提醒</p>
            <p className="mt-2">
              「預約制」課程可選擇可預約時段；開課前 7 天起會鎖定預約與取消。
            </p>
            <p className="mt-2">
              「固定名冊」課程不開放自行預約，請依正式課表出席，後續可銜接出缺勤與作業繳交。
            </p>
          </div>
        </div>
      </section>

      <CourseViewSwitcher courses={activeCourses} categories={activeCategories} />
    </StudentShell>
  );
}
