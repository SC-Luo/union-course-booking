/* eslint-disable @next/next/no-html-link-for-pages */
import { CourseViewSwitcher } from "@/components/course-view-switcher";
import { LastReservationCard } from "@/components/last-reservation-card";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const { category = "" } = await searchParams;
  const { categories, courses } = await getCourseCatalog();
  const activeCourses = courses.filter((course) => course.isActive && course.sessions.length > 0);
  const activeCategoryIds = new Set(activeCourses.map((course) => course.categoryId));
  const activeCategories = categories.filter((item) => item.isActive && activeCategoryIds.has(item.id));
  const filteredCourses = category ? activeCourses.filter((course) => course.categoryId === category) : activeCourses;
  const selectedCategoryName = activeCategories.find((item) => item.id === category)?.name;

  return (
    <StudentShell>
      <LastReservationCard />
      <section className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-medium text-emerald-700">課程預約</p>
        <h1 className="text-3xl font-semibold text-zinc-950 sm:text-4xl">選擇你要預約的課程</h1>
        <p className="max-w-2xl text-zinc-600">請先選擇課程，再挑選可預約的日期與時段。額滿課程仍會顯示，但不能送出預約。</p>
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <a href="/" className={`rounded-md px-4 py-2 text-sm font-medium ${category ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50" : "bg-zinc-900 text-white"}`}>
          全部
        </a>
        {activeCategories.map((item) => (
          <a key={item.id} href={`/?category=${encodeURIComponent(item.id)}`} className={`rounded-md px-4 py-2 text-sm font-medium ${category === item.id ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}>
            {item.name}
          </a>
        ))}
      </section>

      {selectedCategoryName ? <p className="mb-4 text-sm text-zinc-600">目前顯示：{selectedCategoryName}</p> : null}

      <CourseViewSwitcher courses={filteredCourses} categories={categories} />
    </StudentShell>
  );
}
