import Link from "next/link";
import { notFound } from "next/navigation";
import { addStudentToSessionRosterAction, cancelReservationByStaffAction, updateAttendanceAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { AttendanceStatusBadge, ReservationStatusBadge } from "@/components/status-badge";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; attendance?: string; q?: string; rosterQ?: string }>;
};

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSessionRouteCandidates(value: string) {
  const restored = value.replace(/~2F/gi, "%2F").replace(/~5C/gi, "%5C");
  const onceDecoded = safeDecodeURIComponent(restored);
  const twiceDecoded = safeDecodeURIComponent(onceDecoded);

  return Array.from(new Set([
    value,
    restored,
    onceDecoded,
    twiceDecoded,
    value.replace(/~2F/gi, "/").replace(/~5C/gi, "\\"),
  ].filter(Boolean)));
}

function resolveSessionFromRouteParam(sessionId: string, courses: any[]) {
  const candidates = getSessionRouteCandidates(sessionId);
  const allSessions = courses.flatMap((course) => course.sessions ?? []);

  return allSessions.find((session) => {
    const id = String(session.id ?? "");
    return (
      candidates.includes(id) ||
      candidates.includes(encodeURIComponent(id)) ||
      candidates.includes(encodeURIComponent(id).replace(/%2F/gi, "~2F").replace(/%5C/gi, "~5C"))
    );
  });
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function getSourceLabel(source?: string) {
  if (source === "manual") return "後台手動";
  if (source === "excel") return "Excel 匯入";
  return "線上報名";
}

function formatDateText(date?: string) {
  if (!date) return "未設定日期";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.replaceAll("-", "/");
  const weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return `${date.replaceAll("-", "/")}（${weekdays[parsed.getDay()]}）`;
}

function StatCard({ label, value, hint, tone = "normal" }: { label: string; value: number | string; hint: string; tone?: "normal" | "primary" | "muted" }) {
  const toneClass = tone === "primary"
    ? "border-[#d8b69f] bg-[#fff6ed]"
    : tone === "muted"
      ? "border-[#ead8ca] bg-[#fffaf5]"
      : "border-[#ead8ca] bg-white";

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-[#B46F4A]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#1f1712]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#8a7c72]">{hint}</p>
    </div>
  );
}

function AttendanceProgressCard({ checked, unchecked, total }: { checked: number; unchecked: number; total: number }) {
  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  const isComplete = total > 0 && unchecked === 0;

  return (
    <section className={`mb-6 rounded-[30px] border p-6 shadow-sm ${isComplete ? "border-emerald-200 bg-emerald-50" : "border-[#ead8ca] bg-white"}`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={isComplete ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-[#B46F4A]"}>
              點名完成狀態
            </p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isComplete ? "bg-white text-emerald-700" : "bg-[#fff6ed] text-[#8B5035]"}`}>
              {isComplete ? "已完成" : `尚有 ${unchecked} 人未點名`}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-black text-[#1f1712]">
            {total > 0 ? `已完成 ${checked} / ${total} 人` : "目前沒有有效名單"}
          </h2>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#f3e5d9]">
            <div
              className={isComplete ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-gradient-to-r from-[#E85F00] to-[#B46F4A]"}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-[#8a7c72]">
            {total === 0
              ? "本堂課尚無有效名單，先確認是否已建立報名或匯入名冊。"
              : isComplete
                ? "本堂課有效名單都已完成點名，可以匯出或返回課程工作區。"
                : "建議先切到尚未點名名單，逐一標記已到或未到。"}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[420px]">
          <a href="#attendance-list" className="rounded-2xl bg-[#5A3726] px-4 py-3 text-center text-sm font-bold text-white hover:brightness-105">
            繼續點名
          </a>
          <a href="#attendance-filters" className="rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-3 text-center text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">
            查看篩選
          </a>
        </div>
      </div>
    </section>
  );
}

function AttendanceActions({
  reservationId,
  sessionId,
  currentStatus,
  redirectTo,
}: {
  reservationId: string;
  sessionId: string;
  currentStatus?: string;
  redirectTo: string;
}) {
  const isAttended = currentStatus === "attended";
  const isAbsent = currentStatus === "absent";

  return (
    <>
      <form action={updateAttendanceAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="attendanceStatus" value="attended" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          className={`w-full rounded-xl border px-3 py-2 text-sm font-bold transition ${
            isAttended
              ? "border-emerald-300 bg-emerald-600 text-white shadow-sm"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {isAttended ? "已到 ✓" : "標記已到"}
        </button>
      </form>
      <form action={updateAttendanceAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="attendanceStatus" value="absent" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          className={`w-full rounded-xl border px-3 py-2 text-sm font-bold transition ${
            isAbsent
              ? "border-amber-300 bg-amber-500 text-white shadow-sm"
              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
        >
          {isAbsent ? "未到 ✓" : "標記未到"}
        </button>
      </form>
      <form action={cancelReservationByStaffAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50">取消預約</button>
      </form>
    </>
  );
}

function normalizeAttendanceStatus(status?: string) {
  return status === "attended" || status === "absent" ? status : "unchecked";
}

function getAttendanceEmptyText(attendanceFilter: string, statusFilter: string) {
  if (statusFilter === "cancelled") return "目前沒有已取消的預約紀錄。";
  if (attendanceFilter === "unchecked") return "本堂課已沒有尚未點名的學員。";
  if (attendanceFilter === "attended") return "目前還沒有標記已到的學員。";
  if (attendanceFilter === "absent") return "目前還沒有標記未到的學員。";
  return "目前這堂課還沒有有效報名名單。你可以返回課程工作區確認是否已建立名單，或檢查篩選條件。";
}

export default async function AdminReservationsPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const { status = "booked", attendance = "all", q = "", rosterQ = "" } = await searchParams;
  const currentUrl = `/admin/sessions/${sessionId}/reservations?status=${encodeURIComponent(status)}&attendance=${encodeURIComponent(attendance)}&q=${encodeURIComponent(q)}&rosterQ=${encodeURIComponent(rosterQ)}#reservation-list`;
  const { courses, reservations, students } = await getBookingData();
  const session = resolveSessionFromRouteParam(sessionId, courses);
  const course = session ? getCourse(session.courseId, courses) : undefined;

  if (!session || !course) {
    notFound();
  }

  const sessionReservations = reservations.filter((reservation) => reservation.sessionId === session.id);
  const bookedStudentIds = new Set(
    sessionReservations
      .filter((reservation) => reservation.status === "booked")
      .map((reservation) => reservation.studentId)
      .filter(Boolean),
  );
  const addableStudents = (students ?? [])
    .filter((student) => student.isActive !== false && !bookedStudentIds.has(student.id))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hant"));
  const normalizedRosterQuery = rosterQ.trim().toLowerCase();
  const filteredAddableStudents = normalizedRosterQuery
    ? addableStudents.filter((student) => {
        const searchText = [
          student.name,
          student.phone,
          student.idNumberLast3,
          student.memberNo,
          student.studentNo,
          student.note,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())
          .join(" ");

        return searchText.includes(normalizedRosterQuery);
      })
    : [];
  const bookedReservations = sessionReservations.filter((reservation) => reservation.status === "booked");
  const cancelled = sessionReservations.filter((reservation) => reservation.status === "cancelled").length;
  const attended = bookedReservations.filter((reservation) => reservation.attendanceStatus === "attended").length;
  const absent = bookedReservations.filter((reservation) => reservation.attendanceStatus === "absent").length;
  const unchecked = bookedReservations.filter((reservation) => !reservation.attendanceStatus || reservation.attendanceStatus === "pending" || reservation.attendanceStatus === "unchecked").length;
  const checkedCount = attended + absent;
  const capacityMode = course.capacityMode ?? "course";
  const remainingSeats = capacityMode === "course"
    ? Math.max((course.totalCapacity ?? session.capacity) - bookedReservations.length, 0)
    : Math.max(session.capacity - session.bookedCount, 0);
  const normalizedQuery = q.trim().toLowerCase();
  const statusFilter = status === "all" || status === "cancelled" ? status : "booked";
  const attendanceFilter = attendance === "unchecked" || attendance === "attended" || attendance === "absent" ? attendance : "all";
  const displayedReservations = sessionReservations.filter((reservation) => {
    const statusMatches = statusFilter === "all" || reservation.status === statusFilter;
    const reservationAttendanceStatus = normalizeAttendanceStatus(reservation.attendanceStatus);
    const attendanceMatches =
      statusFilter === "cancelled" ||
      attendanceFilter === "all" ||
      (reservation.status === "booked" && reservationAttendanceStatus === attendanceFilter);
    const queryMatches =
      !normalizedQuery ||
      reservation.studentName.toLowerCase().includes(normalizedQuery) ||
      reservation.phoneLastThree.includes(normalizedQuery);

    return statusMatches && attendanceMatches && queryMatches;
  });
  const statusLinks = [
    { label: "有效名單", value: "booked", count: bookedReservations.length },
    { label: "已取消", value: "cancelled", count: cancelled },
    { label: "全部", value: "all", count: sessionReservations.length },
  ];
  const attendanceLinks = [
    { label: "全部點名狀態", value: "all", count: bookedReservations.length },
    { label: "尚未點名", value: "unchecked", count: unchecked },
    { label: "已到", value: "attended", count: attended },
    { label: "未到", value: "absent", count: absent },
  ];
  const baseFilterQuery = `status=${statusFilter}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const emptyText = getAttendanceEmptyText(attendanceFilter, statusFilter);

  return (
    <AdminShell currentSection="attendance.dashboard">
      <section className="mb-6 rounded-[34px] border border-[#ead8ca] bg-gradient-to-br from-[#fffaf4] via-[#fffdf9] to-[#f5e6d9] p-7 shadow-[0_20px_70px_rgba(90,55,38,0.08)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link href={`/admin/courses/${course.id}/sessions`} className="mb-4 inline-flex text-sm font-medium text-[#66584f] hover:text-[#1f1712]">
              ← 返回課程工作區
            </Link>
            <p className="text-sm font-bold text-[#B46F4A]">本堂課點名 / 報名名單</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1f1712] sm:text-4xl">{course.title}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66584f]">
              這一頁是單堂課現場操作頁：確認本堂課名單、標記已到 / 未到，必要時匯出名單或返回課程工作區調整場次。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/courses/${course.id}/sessions`} className="rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 py-3 text-sm font-bold text-[#5A3726] hover:bg-[#fff6ed]">
              返回工作區
            </Link>
            <Link href={`/admin/sessions/${encodeRouteSegment(session.id)}/reservations/export`} className="rounded-2xl bg-[#5A3726] px-4 py-3 text-sm font-bold text-white hover:brightness-105">
              匯出 CSV
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-[30px] border border-[#ead8ca] bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
          <div>
            <p className="text-sm font-bold text-[#B46F4A]">本堂課資訊</p>
            <h2 className="mt-2 text-2xl font-black text-[#1f1712]">{formatDateText(session.date)}｜{session.startTime}-{session.endTime}</h2>
            <p className="mt-2 text-sm leading-6 text-[#66584f]">
              {session.topic || "未填單元"}｜{session.location || course.defaultLocation || "未設定地點"}
            </p>
          </div>
          <div className="grid gap-2 rounded-[24px] border border-[#f1e2d6] bg-[#fffaf5] p-4 text-sm text-[#66584f]">
            <div className="flex items-center justify-between gap-3"><span>本堂容量</span><strong className="text-[#1f1712]">{session.capacity}</strong></div>
            <div className="flex items-center justify-between gap-3"><span>有效名單</span><strong className="text-[#1f1712]">{bookedReservations.length}</strong></div>
            <div className="flex items-center justify-between gap-3"><span>{capacityMode === "course" ? "整門課剩餘招生" : "本場次剩餘名額"}</span><strong className="text-[#1f1712]">{remainingSeats}</strong></div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="有效名單" value={bookedReservations.length} hint="目前這堂課需要點名的人數" tone="primary" />
        <StatCard label="尚未點名" value={unchecked} hint="尚未確認已到或未到" />
        <StatCard label="已到" value={attended} hint="已完成到課標記" />
        <StatCard label="未到" value={absent} hint="已標記未出席" />
      </section>

      <AttendanceProgressCard checked={checkedCount} unchecked={unchecked} total={bookedReservations.length} />

      <section id="attendance-list" className="mb-4 rounded-[28px] border border-[#ead8ca] bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-bold text-[#B46F4A]">本堂課學員名單</p>
          <h2 className="mt-1 text-2xl font-black text-[#1f1712]">點名與名單確認</h2>
          <p className="mt-1 text-sm text-[#8a7c72]">可先從學員總表搜尋並加入本課堂，再針對有效名單標記已到或未到。</p>
        </div>
        <section className="mt-5 rounded-[24px] border border-[#ead8ca] bg-[#fffaf5] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#B46F4A]">加入本課堂</p>
              <h3 className="mt-1 text-lg font-black text-[#1f1712]">從學員總表搜尋後加入</h3>
              <p className="mt-1 text-xs leading-5 text-[#8a7c72]">
                可用姓名、電話或身分證末三碼搜尋；後台加入不受前台一週鎖定限制，加入後會同步建立本課程資格。
              </p>
            </div>
            <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[460px]">
              <input type="hidden" name="status" value={statusFilter} />
              <input type="hidden" name="attendance" value={attendanceFilter} />
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <input
                name="rosterQ"
                defaultValue={rosterQ}
                className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100"
                placeholder="搜尋姓名、電話或身分證末三碼"
              />
              <button className="h-12 rounded-2xl bg-[#5A3726] px-5 text-sm font-bold text-white hover:brightness-105">搜尋學員</button>
            </form>
          </div>

          {normalizedRosterQuery ? (
            <div className="mt-4 overflow-hidden rounded-[20px] border border-[#ead8ca] bg-white">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_auto] gap-3 border-b border-[#ead8ca] bg-[#fff9f3] px-4 py-3 text-xs font-bold text-[#66584f]">
                <span>學員</span>
                <span>電話</span>
                <span>末三碼</span>
                <span className="text-right">操作</span>
              </div>
              {filteredAddableStudents.slice(0, 12).map((student) => (
                <div key={student.id} className="grid grid-cols-[1.2fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-[#f1e2d6] px-4 py-3 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#1f1712]">{student.name || "未命名學員"}</p>
                    <p className="mt-0.5 text-xs text-[#8a7c72]">會員編號：{student.memberNo || student.studentNo || "未填"}</p>
                  </div>
                  <span className="text-[#66584f]">{student.phone || "未填"}</span>
                  <span className="font-bold text-[#1f1712]">{student.idNumberLast3 || "未填"}</span>
                  <form action={addStudentToSessionRosterAction} className="flex justify-end">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="studentId" value={student.id} />
                    <input type="hidden" name="redirectTo" value={`/admin/sessions/${encodeRouteSegment(session.id)}/reservations?status=${statusFilter}&attendance=${attendanceFilter}${q ? `&q=${encodeURIComponent(q)}` : ""}&rosterQ=${encodeURIComponent(rosterQ)}#attendance-list`} />
                    <button className="rounded-2xl bg-[#5A3726] px-4 py-2 text-sm font-bold text-white hover:brightness-105">
                      加入本課堂
                    </button>
                  </form>
                </div>
              ))}
              {filteredAddableStudents.length === 0 ? (
                <div className="px-4 py-6 text-sm leading-6 text-[#8a7c72]">
                  找不到符合「{rosterQ}」且尚未加入本堂課的學員。請確認姓名、電話或身分證末三碼是否正確。
                </div>
              ) : null}
              {filteredAddableStudents.length > 12 ? (
                <div className="border-t border-[#f1e2d6] bg-[#fffdf9] px-4 py-3 text-xs text-[#8a7c72]">
                  目前只顯示前 12 筆結果，請輸入更完整的姓名、電話或末三碼縮小範圍。
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-dashed border-[#dbcabd] bg-white px-4 py-5 text-sm text-[#8a7c72]">
              請先搜尋學員，再從搜尋結果按「加入本課堂」。
            </div>
          )}
        </section>

        <div id="attendance-filters" className="mt-4 grid gap-3">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#B46F4A]">名單篩選</p>
            <div className="flex flex-wrap gap-2">
              {statusLinks.map((item) => (
                <Link
                  key={item.value}
                  href={`/admin/sessions/${session.id}/reservations?status=${item.value}&attendance=${attendanceFilter}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                    statusFilter === item.value ? "bg-[#5A3726] text-white" : "border border-[#dbcabd] bg-[#fffdf9] text-[#5A3726] hover:bg-[#fff6ed]"
                  }`}
                >
                  {item.label} {item.count}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#B46F4A]">點名狀態</p>
            <div className="flex flex-wrap gap-2">
              {attendanceLinks.map((item) => (
                <Link
                  key={item.value}
                  href={`/admin/sessions/${session.id}/reservations?${baseFilterQuery}&attendance=${item.value}`}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                    attendanceFilter === item.value ? "bg-gradient-to-r from-[#E85F00] to-[#B46F4A] text-white" : "border border-[#dbcabd] bg-[#fffdf9] text-[#5A3726] hover:bg-[#fff6ed]"
                  }`}
                >
                  {item.label} {item.count}
                </Link>
              ))}
            </div>
          </div>
        </div>
        {normalizedQuery ? <p className="mt-3 text-sm text-[#8a7c72]">目前顯示 {displayedReservations.length} 筆符合「{q}」的資料。</p> : null}
      </section>

      <section id="reservation-list" className="grid gap-3 md:hidden">
        {displayedReservations.map((reservation) => (
          <article key={reservation.id} className="rounded-[24px] border border-[#ead8ca] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#1f1712]">{reservation.studentName}</h2>
                <p className="mt-1 text-sm text-[#8a7c72]">手機末三碼：{reservation.phoneLastThree}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ReservationStatusBadge status={reservation.status} />
                <AttendanceStatusBadge status={reservation.attendanceStatus} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-[#fff9f3] p-3 text-sm text-zinc-700">
              <p><span className="text-[#8a7c72]">預約時間：</span>{reservation.bookedAt}</p>
              <p><span className="text-[#8a7c72]">資料來源：</span>{getSourceLabel(reservation.source)}</p>
              {reservation.cancelledAt ? <p><span className="text-[#8a7c72]">取消時間：</span>{reservation.cancelledAt}</p> : null}
              {reservation.note ? <p><span className="text-[#8a7c72]">備註：</span>{reservation.note}</p> : null}
            </div>

            {reservation.status === "booked" ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <AttendanceActions reservationId={reservation.id} sessionId={session.id} currentStatus={reservation.attendanceStatus} redirectTo={currentUrl} />
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-[#fff9f3] px-3 py-2 text-sm text-zinc-400">此預約已取消。</p>
            )}
          </article>
        ))}
        {displayedReservations.length === 0 ? (
          <div className="rounded-[24px] border border-[#ead8ca] bg-white px-5 py-8 text-sm leading-6 text-[#8a7c72]">
            {emptyText}
          </div>
        ) : null}
      </section>

      <section className="hidden overflow-hidden rounded-[28px] border border-[#ead8ca] bg-white shadow-sm md:block">
        <div className="grid min-w-[960px] grid-cols-[1.2fr_110px_160px_120px_120px_120px_330px] border-b border-[#ead8ca] bg-[#fff9f3] px-4 py-3 text-sm font-bold text-[#66584f]">
          <span>姓名</span>
          <span>末三碼</span>
          <span>預約時間</span>
          <span>來源</span>
          <span>預約狀態</span>
          <span>出席狀態</span>
          <span>現場點名操作</span>
        </div>
        {displayedReservations.map((reservation) => (
          <div key={reservation.id} className={`grid min-w-[960px] grid-cols-[1.2fr_110px_160px_120px_120px_120px_330px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0 ${reservation.status === "booked" && normalizeAttendanceStatus(reservation.attendanceStatus) === "unchecked" ? "bg-[#fffdf9]" : "bg-white"}`}>
            <span className="font-bold text-[#1f1712]">{reservation.studentName}</span>
            <span>{reservation.phoneLastThree}</span>
            <span>{reservation.bookedAt}</span>
            <span>{getSourceLabel(reservation.source)}</span>
            <span><ReservationStatusBadge status={reservation.status} /></span>
            <span><AttendanceStatusBadge status={reservation.attendanceStatus} /></span>
            <span className="grid grid-cols-3 gap-2">
              {reservation.status === "booked" ? (
                <AttendanceActions reservationId={reservation.id} sessionId={session.id} currentStatus={reservation.attendanceStatus} redirectTo={currentUrl} />
              ) : (
                <span className="col-span-3 text-zinc-400">此預約已取消</span>
              )}
            </span>
          </div>
        ))}
        {displayedReservations.length === 0 ? (
          <div className="px-5 py-10 text-sm leading-6 text-[#8a7c72]">
            {emptyText}
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
