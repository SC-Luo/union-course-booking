import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { courses, reservations } = await getBookingData();
  const activeCourses = courses.filter((course) => course.isActive);
  const totalBooked = reservations.filter((reservation) => reservation.status === "booked").length;
  const activeClasses = activeCourses.length;

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
          ["開放課程", activeCourses.length],
          ["已預約", totalBooked],
          ["開班數", activeClasses],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950">近期課程</h2>
        <div className="grid gap-3">
          {activeCourses.map((course) => (
            <Link key={course.id} href={`/admin/courses/${course.id}/sessions`} className="rounded-md border border-zinc-200 p-4 hover:bg-zinc-50">
              <p className="font-medium text-zinc-950">{course.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{course.code ?? course.id}｜{course.sessions.length} 個時段</p>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
