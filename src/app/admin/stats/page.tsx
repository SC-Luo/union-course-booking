import { AdminShell } from "@/components/page-shell";
import { readBookingData } from "@/lib/data-store";
import { getCategoryName } from "@/lib/course-utils";

export default function AdminStatsPage() {
  const { courses, reservations } = readBookingData();
  const attended = reservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
  const absent = reservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
  const rate = reservations.length > 0 ? Math.round((attended / reservations.length) * 100) : 0;

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">統計</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">預約與出席統計</h1>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-[180px_180px_1fr]">
        <input className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm" type="date" />
        <select className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm">
          <option>全部分類</option>
          <option>職訓課程</option>
          <option>證照課</option>
          <option>講座</option>
        </select>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          ["總預約", reservations.length],
          ["已到", attended],
          ["未到", absent],
          ["出席率", `${rate}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_130px_120px_120px_120px_120px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>課程</span>
          <span>分類</span>
          <span>總預約</span>
          <span>已到</span>
          <span>未到</span>
          <span>出席率</span>
        </div>
        {courses.map((course) => {
          const courseReservations = reservations.filter((reservation) => reservation.courseId === course.id);
          const courseAttended = courseReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
          const courseAbsent = courseReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
          const courseRate = courseReservations.length > 0 ? Math.round((courseAttended / courseReservations.length) * 100) : 0;

          return (
            <div key={course.id} className="grid min-w-[760px] grid-cols-[1fr_130px_120px_120px_120px_120px] border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
              <span className="font-medium text-zinc-950">{course.title}</span>
              <span>{getCategoryName(course.categoryId)}</span>
              <span>{courseReservations.length}</span>
              <span>{courseAttended}</span>
              <span>{courseAbsent}</span>
              <span>{courseRate}%</span>
            </div>
          );
        })}
      </section>
    </AdminShell>
  );
}
