import Link from "next/link";
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
  const canSearch = normalizedName.length > 0 && normalizedPhone.length === 3;
  const bookedCount = reservations.filter((reservation) => reservation.status === "booked").length;
  const filteredReservations = hasQuery
    ? canSearch
      ? reservations.filter(
          (reservation) =>
            reservation.studentName === normalizedName &&
            reservation.phoneLastThree === normalizedPhone &&
            reservation.status === "booked",
        )
      : []
    : [];

  return (
    <StudentShell>
      <section className="mb-8">
        <Link href="/" className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回課程列表
        </Link>
        <p className="mb-2 text-sm font-medium text-emerald-700">查詢預約</p>
        <h1 className="text-3xl font-semibold text-zinc-950">輸入資料查詢預約紀錄</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          為保護學員個資，必須同時輸入完整姓名與手機末三碼，系統只會顯示符合本人資料的預約紀錄。
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">目前有效預約人數</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{bookedCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">個資保護</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">未完成身份查詢前，不顯示任何學員姓名、手機末三碼或預約明細。</p>
        </div>
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
        {!hasQuery ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">
            請輸入完整姓名與手機末三碼後查詢自己的預約。
          </article>
        ) : null}
        {hasQuery && !canSearch ? (
          <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800">
            請同時輸入姓名與 3 碼手機末碼，避免查詢到非本人資料。
          </article>
        ) : null}
        {canSearch && filteredReservations.length === 0 ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">查無符合條件的本人預約紀錄。</article>
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
                <p>查詢身份：已驗證</p>
              </div>
            </article>
          );
        })}
      </section>
    </StudentShell>
  );
}
