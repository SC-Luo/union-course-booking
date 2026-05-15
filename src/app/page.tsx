import Link from "next/link";
import { CourseStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { readBookingData } from "@/lib/data-store";
import { getCategoryName, getCourseStatus, getRemainingSeats } from "@/lib/course-utils";

export default function Home() {
  const { categories, courses } = readBookingData();

  return (
    <StudentShell>
      <section className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-medium text-emerald-700">課程預約</p>
        <h1 className="text-3xl font-semibold text-zinc-950">選擇你要預約的課程</h1>
        <p className="max-w-2xl text-zinc-600">請先選擇課程，再挑選可預約的日期與時段。額滿課程仍會顯示，但不能送出預約。</p>
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">全部</button>
        {categories.map((category) => (
          <button key={category.id} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
            {category.name}
          </button>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => {
          const status = getCourseStatus(course);
          const remainingSeats = course.sessions.reduce((total, session) => total + getRemainingSeats(session), 0);
          const nextSession = course.sessions[0];

          return (
            <Link key={course.id} href={`/courses/${course.id}`} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-sky-700">{getCategoryName(course.categoryId)}</p>
                  <h2 className="text-xl font-semibold text-zinc-950">{course.title}</h2>
                </div>
                <CourseStatusBadge status={status} />
              </div>
              <p className="mb-5 line-clamp-2 text-sm leading-6 text-zinc-600">{course.description}</p>
              <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                <p>最近時段：{nextSession.date} {nextSession.startTime}</p>
                <p>剩餘名額：{remainingSeats}</p>
                <p className="sm:col-span-2">地點：{nextSession.location}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </StudentShell>
  );
}
