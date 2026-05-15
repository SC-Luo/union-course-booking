import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/page-shell";
import { CourseStatusBadge } from "@/components/status-badge";
import { getCategoryName, getCourse, getRemainingSeats, getSessionStatus } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function AdminSessionsPage({ params }: PageProps) {
  const { courseId } = await params;
  const course = getCourse(courseId);

  if (!course) {
    notFound();
  }

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">{getCategoryName(course.categoryId)}</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">預設地點：{course.defaultLocation}</p>
        </div>
        <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white">新增時段</button>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[940px] grid-cols-[130px_120px_1fr_110px_110px_160px_130px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>日期</span>
          <span>時間</span>
          <span>地點</span>
          <span>名額</span>
          <span>剩餘</span>
          <span>狀態</span>
          <span>操作</span>
        </div>
        {course.sessions.map((session) => (
          <div key={session.id} className="grid min-w-[940px] grid-cols-[130px_120px_1fr_110px_110px_160px_130px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span>{session.date}</span>
            <span>{session.startTime}-{session.endTime}</span>
            <span>{session.location}</span>
            <span>{session.bookedCount}/{session.capacity}</span>
            <span>{getRemainingSeats(session)}</span>
            <span><CourseStatusBadge status={getSessionStatus(session)} /></span>
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
