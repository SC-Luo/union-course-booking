import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export default async function AdminHomePage() {
  const { courses, reservations } = await getBookingData();
  const totalSessions = courses.reduce((total, course) => total + course.sessions.length, 0);
  const totalCapacity = courses.flatMap((course) => course.sessions).reduce((total, session) => total + session.capacity, 0);
  const totalBooked = courses.flatMap((course) => course.sessions).reduce((total, session) => total + session.bookedCount, 0);

  return (
    <AdminShell>
      <section className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">後台首頁</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">近期課程狀態</h1>
        </div>
        <Link href="/admin/courses" className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700">
          管理課程
        </Link>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          ["開放課程", courses.length],
          ["課程時段", totalSessions],
          ["已預約", totalBooked],
          ["總名額", totalCapacity],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">近期課程</h2>
          <div className="grid gap-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-200 p-4 hover:bg-zinc-50">
                <p className="font-medium text-zinc-950">{course.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{course.sessions.length} 個時段</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950">待處理名單</h2>
          <div className="grid gap-3">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="rounded-md border border-zinc-200 p-4">
                <p className="font-medium text-zinc-950">{reservation.studentName}</p>
                <p className="mt-1 text-sm text-zinc-500">出席狀態：{reservation.attendanceStatus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
