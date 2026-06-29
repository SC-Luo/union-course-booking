import Link from "next/link";
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

      {/* 學員入口分流 */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "我要預約課程",
            desc: "查看目前可預約的課程與時段",
            btnText: "查看課程",
            href: "#course-list",
            bg: "from-[#fffaf5] to-[#fcf4ec]",
          },
          {
            title: "我的預約",
            desc: "查詢或取消已預約的課程",
            btnText: "查詢預約",
            href: "/booking/search",
            bg: "from-[#fffaf5] to-[#f9ece0]",
          },
          {
            title: "第一次使用",
            desc: "尚未建立學員資料的新生請先填寫",
            btnText: "填寫新生資料",
            href: "/new-student",
            bg: "from-[#fffaf5] to-[#f4e1d0]",
          },
        ].map((item) => (
          <article
            key={item.href}
            className={`flex flex-col justify-between rounded-[2rem] border border-[#ead8c6] bg-gradient-to-br ${item.bg} p-6 shadow-sm transition hover:shadow-md`}
          >
            <div>
              <h2 className="text-xl font-black text-[#6b3b25]">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#8a6855]">{item.desc}</p>
            </div>
            <div className="mt-6">
              {item.href.startsWith("#") ? (
                <a
                  href={item.href}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#522d1b]"
                >
                  {item.btnText}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#522d1b]"
                >
                  {item.btnText}
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* 預約提醒小條 */}
      <div className="mb-8 flex items-start gap-2.5 rounded-2xl border border-[#ead8c6] bg-[#fffaf5] p-4 text-sm text-[#8a6855] shadow-sm">
        <span className="mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-[#ef6c00]" />
        <p className="leading-6">
          <strong className="font-black text-[#6b3b25]">預約提醒：</strong>
          自費預約制課程會在開課前 7 天鎖定預約與取消，請提前完成預約。
        </p>
      </div>

      <section id="course-list">
        <CourseViewSwitcher courses={activeCourses} categories={activeCategories} />
      </section>
    </StudentShell>
  );
}
