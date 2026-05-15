import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import { formatReservationCutoff, getCategoryName, getCourse, getRemainingSeats, getSessionStatus } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function AdminSessionsPage({ params }: PageProps) {
  const { courseId } = await params;
  const { categories, courses } = await getBookingData();
  const course = getCourse(courseId, courses);

  if (!course) {
    notFound();
  }

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin/courses" className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
            返回課程管理
          </Link>
          <p className="text-sm font-medium text-emerald-700">{getCategoryName(course.categoryId, categories)}</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">預設地點：{course.defaultLocation}</p>
        </div>
        <span className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-500">時段新增待開放</span>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[1040px] grid-cols-[130px_120px_120px_1fr_110px_110px_160px_130px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>日期</span>
          <span>時間</span>
          <span>單元</span>
          <span>地點</span>
          <span>名額</span>
          <span>剩餘</span>
          <span>截止</span>
          <span>操作</span>
        </div>
        {course.sessions.map((session) => (
          <div key={session.id} className="grid min-w-[1040px] grid-cols-[130px_120px_120px_1fr_110px_110px_160px_130px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span>{session.date}</span>
            <span>{session.startTime}-{session.endTime}</span>
            <span>{session.topic ?? "-"}</span>
            <span>{session.location}</span>
            <span>{session.bookedCount}/{session.capacity}</span>
            <span>{getRemainingSeats(session)}</span>
            <span className="flex flex-col gap-1"><CourseStatusBadge status={getSessionStatus(session)} />{formatReservationCutoff(session)}</span>
            <span>
              <Link href={`/admin/sessions/${session.id}/reservations`} className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">
                名單
              </Link>
            </span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
