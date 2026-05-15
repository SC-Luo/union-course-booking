import Link from "next/link";
import { cancelReservationAction } from "@/app/actions";
import { AttendanceStatusBadge, ReservationStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { SearchForm } from "@/components/search-form";
import { getBookingData } from "@/lib/booking-repository";
import { canChangeReservation, formatReservationCutoff, getCategoryName, getCourse, getSession } from "@/lib/course-utils";

type PageProps = {
  searchParams: Promise<{ name?: string; phone?: string; cancelled?: string; error?: string }>;
};

export default async function BookingSearchPage({ searchParams }: PageProps) {
  const { name = "", phone = "", cancelled, error } = await searchParams;
  const { categories, courses, reservations } = await getBookingData();
  const normalizedName = name.trim();
  const normalizedPhone = phone.replace(/\D/g, "").slice(0, 3);
  const hasQuery = normalizedName.length > 0 || normalizedPhone.length > 0;
  const canSearch = normalizedName.length > 0 && normalizedPhone.length === 3;
  const filteredReservations = hasQuery
    ? canSearch
      ? reservations.filter(
          (reservation) =>
            reservation.studentName === normalizedName &&
            reservation.phoneLastThree === normalizedPhone,
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
          請輸入姓名與手機末三碼，查詢已成立或已取消的預約。可預約與取消的最後時間為該時段前一天 18:00。
        </p>
      </section>

      <SearchForm name={name} phone={phone} />

      <section className="grid gap-4">
        {cancelled ? (
          <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            已取消預約，名額已釋出。
          </article>
        ) : null}
        {error === "closed" ? (
          <article className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800">
            已超過可取消時間。預約與取消最晚到該時段前一天 18:00。
          </article>
        ) : null}
        {!hasQuery ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">
            請輸入姓名與手機末三碼後查詢預約。
          </article>
        ) : null}
        {hasQuery && !canSearch ? (
          <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800">
            請同時輸入姓名與 3 碼手機末碼。
          </article>
        ) : null}
        {canSearch && filteredReservations.length === 0 ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">查無符合條件的預約紀錄。</article>
        ) : null}
        {filteredReservations.map((reservation) => {
          const course = getCourse(reservation.courseId, courses);
          const session = getSession(reservation.sessionId, courses);

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
              <p className="mt-1 text-sm text-sky-700">{getCategoryName(course.categoryId, categories)}</p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                <p>日期：{session.date}</p>
                <p>時間：{session.startTime}-{session.endTime}</p>
                <p>地點：{session.location}</p>
                <p>變更截止：{formatReservationCutoff(session)}</p>
              </div>
              {reservation.status === "booked" && canChangeReservation(session) ? (
                <form action={cancelReservationAction} className="mt-5">
                  <input type="hidden" name="reservationId" value={reservation.id} />
                  <input type="hidden" name="studentName" value={normalizedName} />
                  <input type="hidden" name="phoneLastThree" value={normalizedPhone} />
                  <button className="w-full rounded-md border border-rose-300 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:w-auto">
                    取消這筆預約
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
    </StudentShell>
  );
}
