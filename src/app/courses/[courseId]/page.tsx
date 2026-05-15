import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName, getCourse, getRemainingSeats, getSessionStatus } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;
  const { categories, courses } = await getBookingData();
  const course = getCourse(courseId, courses);

  if (!course) {
    notFound();
  }

  return (
    <StudentShell>
      <Link href="/" className="mb-6 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
        返回課程列表
      </Link>

      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="mb-2 text-sm font-medium text-sky-700">{getCategoryName(course.categoryId, categories)}</p>
          <h1 className="text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-600">{course.description}</p>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">預設地點</p>
          <p className="mt-1 font-medium text-zinc-900">{course.defaultLocation}</p>
          <p className="mt-4 text-sm text-zinc-500">注意事項</p>
          <p className="mt-1 text-sm leading-6 text-zinc-700">{course.notes}</p>
        </aside>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-zinc-950">可預約時段</h2>
        <div className="grid gap-4">
          {course.sessions.map((session) => {
            const status = getSessionStatus(session);
            const canBook = status === "available";

            return (
              <div key={session.id} className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <CourseStatusBadge status={status} />
                    <span className="text-sm text-zinc-500">截止：{session.bookingDeadline}</span>
                  </div>
                  <p className="text-lg font-semibold text-zinc-950">
                    {session.date} {session.startTime}-{session.endTime}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">地點：{session.location}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    名額：{session.bookedCount}/{session.capacity}，剩餘 {getRemainingSeats(session)} 位
                  </p>
                </div>
                {canBook ? (
                  <Link href={`/courses/${course.id}/book/${session.id}`} className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
                    預約此時段
                  </Link>
                ) : (
                  <button disabled className="rounded-md bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-500">
                    無法預約
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </StudentShell>
  );
}
