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
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-[#9b4f1f] shadow-sm">課程資訊與名單制預約</p>
            <h1 className="text-3xl font-black tracking-tight text-[#34231a] sm:text-5xl">選擇你想預約的課程</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#70513d]">
              可先瀏覽目前開放的課程。實際預約時，系統會確認你是否在該班名冊內。
            </p>
          </div>
          <div className="rounded-3xl border border-white/75 bg-white/80 p-5 text-sm leading-6 text-[#6f4b35] shadow-sm">
            <p className="font-black text-[#3a2a20]">預約提醒</p>
            <p className="mt-2">開課前 7 天起，課程會鎖定預約。鎖定後，無法新增預約，也無法取消預約。</p>
            <p className="mt-2 text-xs font-semibold text-[#9b4f1f]">停課、已取消、額滿或未啟用的課堂，也無法預約。</p>
          </div>
        </div>
      </section>

      <CourseViewSwitcher courses={activeCourses} categories={activeCategories} />
    </StudentShell>
  );
}
