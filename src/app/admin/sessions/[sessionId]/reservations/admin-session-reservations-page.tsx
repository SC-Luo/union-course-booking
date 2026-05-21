import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelReservationByStaffAction, updateAttendanceAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { AttendanceStatusBadge, ReservationStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse, getSession } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
};

function getSourceLabel(source?: string) {
  if (source === "manual") return "後台手動";
  if (source === "excel") return "Excel 匯入";
  return "線上報名";
}

function AttendanceActions({ reservationId, sessionId }: { reservationId: string; sessionId: string }) {
  return (
    <>
      <form action={updateAttendanceAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="attendanceStatus" value="attended" />
        <button className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">已到</button>
      </form>
      <form action={updateAttendanceAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="attendanceStatus" value="absent" />
        <button className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">未到</button>
      </form>
      <form action={cancelReservationByStaffAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <button className="w-full rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">取消</button>
      </form>
    </>
  );
}

export default async function AdminReservationsPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const { status = "booked", q = "" } = await searchParams;
  const { courses, reservations } = await getBookingData();
  const session = getSession(sessionId, courses);
  const course = session ? getCourse(session.courseId, courses) : undefined;

  if (!session || !course) {
    notFound();
  }

  const sessionReservations = reservations.filter((reservation) => reservation.sessionId === session.id);
  const bookedReservations = sessionReservations.filter((reservation) => reservation.status === "booked");
  const cancelled = sessionReservations.filter((reservation) => reservation.status === "cancelled").length;
  const attended = bookedReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
  const absent = bookedReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
  const pending = bookedReservations.filter((reservation) => reservation.attendanceStatus === "pending").length;
  const capacityMode = course.capacityMode ?? "course";
  const remainingSeats = capacityMode === "course"
    ? Math.max((course.totalCapacity ?? session.capacity) - bookedReservations.length, 0)
    : Math.max(session.capacity - session.bookedCount, 0);
  const normalizedQuery = q.trim().toLowerCase();
  const statusFilter = status === "all" || status === "cancelled" ? status : "booked";
  const displayedReservations = sessionReservations.filter((reservation) => {
    const statusMatches = statusFilter === "all" || reservation.status === statusFilter;
    const queryMatches =
      !normalizedQuery ||
      reservation.studentName.toLowerCase().includes(normalizedQuery) ||
      reservation.phoneLastThree.includes(normalizedQuery);

    return statusMatches && queryMatches;
  });
  const statusLinks = [
    { label: "有效", value: "booked", count: bookedReservations.length },
    { label: "已取消", value: "cancelled", count: cancelled },
    { label: "全部", value: "all", count: sessionReservations.length },
  ];

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href={`/admin/courses/${course.id}/sessions`} className="mb-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
            返回時段管理
          </Link>
          <p className="text-sm font-medium text-emerald-700">預約名單</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">{session.date} {session.startTime}-{session.endTime}｜{session.topic || "未填單元"}｜{session.location}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {capacityMode === "course" ? "本頁顯示單堂點名狀態；招生剩餘名額以整門課計算。" : "本頁以單堂容量計算名額。"}
          </p>
        </div>
        <Link href={`/admin/sessions/${session.id}/reservations/export`} className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
          匯出 CSV
        </Link>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["有效預約", bookedReservations.length],
          ["已取消", cancelled],
          ["已到", attended],
          ["未到", absent],
          ["未點名", pending],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:col-span-2 lg:col-span-5">
          <p className="text-sm text-zinc-500">{capacityMode === "course" ? "整門課剩餘招生名額" : "本場次剩餘名額"}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">{remainingSeats}</p>
        </div>
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusLinks.map((item) => (
              <Link
                key={item.value}
                href={`/admin/sessions/${session.id}/reservations?status=${item.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  statusFilter === item.value ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {item.label} {item.count}
              </Link>
            ))}
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[420px]">
            <input type="hidden" name="status" value={statusFilter} />
            <input name="q" defaultValue={q} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="搜尋姓名或手機末三碼" />
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">搜尋</button>
          </form>
        </div>
        {normalizedQuery ? <p className="mt-3 text-sm text-zinc-500">目前顯示 {displayedReservations.length} 筆符合「{q}」的資料。</p> : null}
      </section>

      <section className="grid gap-3 md:hidden">
        {displayedReservations.map((reservation) => (
          <article key={reservation.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{reservation.studentName}</h2>
                <p className="mt-1 text-sm text-zinc-500">手機末三碼：{reservation.phoneLastThree}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ReservationStatusBadge status={reservation.status} />
                <AttendanceStatusBadge status={reservation.attendanceStatus} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
              <p><span className="text-zinc-500">預約時間：</span>{reservation.bookedAt}</p>
              <p><span className="text-zinc-500">資料來源：</span>{getSourceLabel(reservation.source)}</p>
              {reservation.cancelledAt ? <p><span className="text-zinc-500">取消時間：</span>{reservation.cancelledAt}</p> : null}
              {reservation.note ? <p><span className="text-zinc-500">備註：</span>{reservation.note}</p> : null}
            </div>

            {reservation.status === "booked" ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <AttendanceActions reservationId={reservation.id} sessionId={session.id} />
              </div>
            ) : (
              <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-400">此預約已取消。</p>
            )}
          </article>
        ))}
        {displayedReservations.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-sm text-zinc-500">目前沒有符合條件的預約資料。</div>
        ) : null}
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-zinc-200 bg-white md:block">
        <div className="grid min-w-[920px] grid-cols-[1fr_110px_160px_120px_120px_120px_280px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>姓名</span>
          <span>末三碼</span>
          <span>預約時間</span>
          <span>來源</span>
          <span>預約狀態</span>
          <span>出席狀態</span>
          <span>操作</span>
        </div>
        {displayedReservations.map((reservation) => (
          <div key={reservation.id} className="grid min-w-[920px] grid-cols-[1fr_110px_160px_120px_120px_120px_280px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span className="font-medium text-zinc-950">{reservation.studentName}</span>
            <span>{reservation.phoneLastThree}</span>
            <span>{reservation.bookedAt}</span>
            <span>{getSourceLabel(reservation.source)}</span>
            <span><ReservationStatusBadge status={reservation.status} /></span>
            <span><AttendanceStatusBadge status={reservation.attendanceStatus} /></span>
            <span className="flex gap-2">
              {reservation.status === "booked" ? (
                <AttendanceActions reservationId={reservation.id} sessionId={session.id} />
              ) : (
                <span className="text-zinc-400">已取消</span>
              )}
            </span>
          </div>
        ))}
        {displayedReservations.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-500">目前沒有符合條件的預約資料。</div>
        ) : null}
      </section>
    </AdminShell>
  );
}
