/* eslint-disable @next/next/no-html-link-for-pages */
import { cancelReservationAction } from "@/app/actions";
import { StudentShell } from "@/components/page-shell";
import { ReservationStatusBadge } from "@/components/status-badge";
import { findReservationsByStudent, getCourseCatalog } from "@/lib/booking-repository";
import { canChangeReservation, formatReservationCutoff, getCategoryName, getCourse, getSession, resolveCourseColor } from "@/lib/course-utils";

type PageProps = {
  searchParams: Promise<{ name?: string; error?: string }>;
};

export default async function BookingSearchPage({ searchParams }: PageProps) {
  const { name = "", error } = await searchParams;
  const normalizedName = name.trim();
  const hasQuery = normalizedName.length > 0;
  const [{ categories, courses }, filteredReservations] = await Promise.all([
    getCourseCatalog(),
    hasQuery ? findReservationsByStudent(normalizedName) : Promise.resolve([]),
  ]);
  const activeReservations = filteredReservations.filter((reservation) => reservation.status === "booked");

  return (
    <StudentShell>
      <section className="mb-8 rounded-[2rem] border border-[#ead8c6] bg-white/80 p-6 shadow-sm">
        <a href="/" className="mb-4 inline-flex rounded-full border border-[#d8bda4] bg-white px-4 py-2 text-sm font-semibold text-[#6f4325] hover:bg-[#fff4e8]">
          返回課程列表
        </a>
        <p className="mb-2 inline-flex rounded-full bg-[#fff4e8] px-4 py-2 text-sm font-bold text-[#9b4f1f]">預約查詢</p>
        <h1 className="text-3xl font-bold text-[#34231a]">查詢我的預約</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7b6252]">請輸入預約姓名，查詢目前有效的預約。可預約與取消的最後時間為該課堂開課前 7 天 18:00。</p>
      </section>

      <form action="/booking/search" className="mb-6 rounded-[1.75rem] border border-[#ead8c6] bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#34231a]">姓名</span>
            <input
              name="name"
              defaultValue={name}
              className="w-full rounded-2xl border border-[#d8bda4] bg-[#fffaf5] px-4 py-3 outline-none focus:border-[#9b4f1f] focus:bg-white focus:ring-4 focus:ring-[#f3e1d0]"
              placeholder="請輸入名冊中的姓名"
            />
          </label>
          <button className="rounded-full bg-[#9b4f1f] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#7d3e18]">查詢</button>
        </div>
      </form>

      <section className="grid gap-4">
        {error === "closed" ? <article className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 text-rose-800">這堂課已進入鎖定時間，無法取消預約。</article> : null}
        {!hasQuery ? <article className="rounded-[1.5rem] border border-[#ead8c6] bg-white p-5 text-[#7b6252]">請輸入預約姓名後查詢預約。</article> : null}
        {hasQuery && activeReservations.length === 0 ? <article className="rounded-[1.5rem] border border-[#ead8c6] bg-white p-5 text-[#7b6252]">目前查不到有效預約。</article> : null}
        {activeReservations.map((reservation) => {
          const course = getCourse(reservation.courseId, courses);
          const session = getSession(reservation.sessionId, courses);
          if (!course || !session) return null;
          const category = categories.find((item) => item.id === course.categoryId);
          const courseColor = resolveCourseColor(course, category);
          const categoryName = getCategoryName(course.categoryId, categories);

          return (
            <article key={reservation.id} className="overflow-hidden rounded-[1.75rem] border border-[#ead8c6] bg-white shadow-sm" style={{ borderTopColor: courseColor, borderTopWidth: 6 }}>
              <div className="p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <ReservationStatusBadge status={reservation.status} />
                </div>
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: courseColor }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: courseColor }}>{categoryName}</p>
                    <h2 className="mt-1 text-lg font-bold leading-snug text-[#34231a]">{course.displayTitle ?? course.title}</h2>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#6f4b35] sm:grid-cols-2">
                  <p>日期：{session.date}</p>
                  <p>時間：{session.startTime}-{session.endTime}</p>
                  <p>地點：{session.location}</p>
                  <p>可取消期限：{formatReservationCutoff(session)}</p>
                </div>
                {reservation.status === "booked" && canChangeReservation(session) ? (
                  <form action={cancelReservationAction} className="mt-5">
                    <input type="hidden" name="reservationId" value={reservation.id} />
                    <input type="hidden" name="studentName" value={normalizedName} />
                    <button className="w-full rounded-full border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 sm:w-auto">取消這筆預約</button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </StudentShell>
  );
}
