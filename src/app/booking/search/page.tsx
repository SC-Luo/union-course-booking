/* eslint-disable @next/next/no-html-link-for-pages */
import { cancelReservationAction } from "@/app/actions";
import { ReservationStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { SearchForm } from "@/components/search-form";
import { findReservationsByStudent, getCourseCatalog } from "@/lib/booking-repository";
import { canChangeReservation, formatReservationCutoff, getCategoryName, getCourse, getSession, resolveCourseColor } from "@/lib/course-utils";

type PageProps = {
  searchParams: Promise<{ name?: string; phone?: string; error?: string }>;
};

export default async function BookingSearchPage({ searchParams }: PageProps) {
  const { name = "", phone = "", error } = await searchParams;
  const normalizedName = name.trim();
  const normalizedPhone = phone.replace(/\D/g, "").slice(0, 3);
  const hasQuery = normalizedName.length > 0 || normalizedPhone.length > 0;
  const canSearch = normalizedName.length > 0 && normalizedPhone.length === 3;
  const [{ categories, courses }, filteredReservations] = await Promise.all([
    getCourseCatalog(),
    canSearch ? findReservationsByStudent(normalizedName, normalizedPhone) : Promise.resolve([]),
  ]);
  const activeReservations = filteredReservations.filter((reservation) => reservation.status === "booked");

  return (
    <StudentShell>
      <section className="mb-8">
        <a href="/" className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回課程列表
        </a>
        <p className="mb-2 text-sm font-medium text-emerald-700">查詢預約</p>
        <h1 className="text-3xl font-semibold text-zinc-950">輸入資料查詢預約紀錄</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          請輸入姓名與手機末三碼，查詢目前有效的預約。可預約與取消的最後時間為該時段前一天 18:00。
        </p>
      </section>

      <SearchForm name={name} phone={phone} />

      <section className="grid gap-4">
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
        {canSearch && activeReservations.length === 0 ? (
          <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600">目前沒有有效預約紀錄。</article>
        ) : null}
        {activeReservations.map((reservation) => {
          const course = getCourse(reservation.courseId, courses);
          const session = getSession(reservation.sessionId, courses);

          if (!course || !session) {
            return null;
          }

          const category = categories.find((item) => item.id === course.categoryId);
          const courseColor = resolveCourseColor(course, category);
          const categoryName = getCategoryName(course.categoryId, categories);

          return (
            <article
              key={reservation.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
              style={{ borderTopColor: courseColor, borderTopWidth: 6 }}
            >
              <div className="p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <ReservationStatusBadge status={reservation.status} />
                </div>

                <div className="mb-3 flex items-start gap-3">
                  <span
                    className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: courseColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: courseColor }}>
                      {categoryName}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold leading-snug text-zinc-950">{course.title}</h2>
                  </div>
                </div>

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
              </div>
            </article>
          );
        })}
      </section>
    </StudentShell>
  );
}
