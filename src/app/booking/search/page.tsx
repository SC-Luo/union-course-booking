import { AttendanceStatusBadge, ReservationStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { readBookingData } from "@/lib/data-store";
import { getCategoryName, getCourse, getSession } from "@/lib/course-utils";

type PageProps = {
  searchParams: Promise<{ name?: string; phone?: string }>;
};

export default async function BookingSearchPage({ searchParams }: PageProps) {
  const { name = "", phone = "" } = await searchParams;
  const { reservations } = readBookingData();
  const normalizedName = name.trim();
  const normalizedPhone = phone.replace(/\D/g, "").slice(0, 3);
  const hasQuery = normalizedName.length > 0 || normalizedPhone.length > 0;
  const filteredReservations = hasQuery
    ? reservations.filter((reservation) => {
        const matchName = normalizedName.length === 0 || reservation.studentName.includes(normalizedName);
        const matchPhone = normalizedPhone.length === 0 || reservation.phoneLastThree === normalizedPhone;
        return matchName && matchPhone;
      })
    : reservations;

  return (
    <StudentShell>
      <section className="mb-8">
        <p className="mb-2 text-sm font-medium text-emerald-700">查詢預約</p>
        <h1 className="text-3xl font-semibold text-zinc-950">輸入資料查詢預約紀錄</h1>
      </section>

      <form className="mb-8 rounded-lg border border-zinc-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_120px] md:items-end">
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">姓名</span>
            <input name="name" defaultValue={name} className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="請輸入姓名" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">手機末三碼</span>
            <input name="phone" defaultValue={phone} className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="168" maxLength={3} />
          </label>
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700">查詢</button>
        </div>
      </form>

      <section className="grid gap-4">
        {filteredReservations.length === 0 ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">查無符合條件的預約紀錄。</article>
        ) : null}
        {filteredReservations.map((reservation) => {
          const course = getCourse(reservation.courseId);
          const session = getSession(reservation.sessionId);

          if (!course || !session) {
            return null;
          }

          return (
            <article key={reservation.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <ReservationStatusBadge status={reservation.status} />
                <AttendanceStatusBadge status={reservation.attendanceStatus} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-950">{course.title}</h2>
              <p className="mt-1 text-sm text-sky-700">{getCategoryName(course.categoryId)}</p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                <p>日期：{session.date}</p>
                <p>時間：{session.startTime}-{session.endTime}</p>
                <p>地點：{session.location}</p>
                <p>姓名：{reservation.studentName}（{reservation.phoneLastThree}）</p>
              </div>
            </article>
          );
        })}
      </section>
    </StudentShell>
  );
}
