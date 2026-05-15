import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAttendanceAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { AttendanceStatusBadge, ReservationStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse, getRemainingSeats, getSession } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AdminReservationsPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { courses, reservations } = await getBookingData();
  const session = getSession(sessionId, courses);
  const course = session ? getCourse(session.courseId, courses) : undefined;

  if (!session || !course) {
    notFound();
  }

  const sessionReservations = reservations.filter((reservation) => reservation.sessionId === session.id);
  const attended = sessionReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
  const absent = sessionReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/admin/courses/${course.id}/sessions`} className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
            返回時段管理
          </Link>
          <p className="text-sm font-medium text-emerald-700">預約名單</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">{session.date} {session.startTime}-{session.endTime}｜{session.location}</p>
        </div>
        <Link href={`/admin/sessions/${session.id}/reservations/export`} className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
          匯出 CSV
        </Link>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-5">
        {[
          ["有效預約", sessionReservations.length],
          ["已到", attended],
          ["未到", absent],
          ["剩餘名額", getRemainingSeats(session)],
          ["名額上限", session.capacity],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_120px_160px_120px_120px_180px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>姓名</span>
          <span>末三碼</span>
          <span>預約時間</span>
          <span>預約狀態</span>
          <span>出席狀態</span>
          <span>操作</span>
        </div>
        {sessionReservations.map((reservation) => (
          <div key={reservation.id} className="grid min-w-[760px] grid-cols-[1fr_120px_160px_120px_120px_180px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span className="font-medium text-zinc-950">{reservation.studentName}</span>
            <span>{reservation.phoneLastThree}</span>
            <span>{reservation.bookedAt}</span>
            <span><ReservationStatusBadge status={reservation.status} /></span>
            <span><AttendanceStatusBadge status={reservation.attendanceStatus} /></span>
            <span className="flex gap-2">
              <form action={updateAttendanceAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="attendanceStatus" value="attended" />
                <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">已到</button>
              </form>
              <form action={updateAttendanceAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="attendanceStatus" value="absent" />
                <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">未到</button>
              </form>
            </span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
