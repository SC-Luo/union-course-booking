import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { getCategoryName, resolveCourseColor } from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ courseId?: string }>;
};

type SessionSummary = {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  location: string;
  capacity: number;
  booked: number;
  attended: number;
  absent: number;
  pending: number;
  isActive: boolean;
  courseColor: string;
  categoryName: string;
};

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function formatDate(date: string) {
  return date.replaceAll("-", "/");
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCourseTermLabel(course: {
  year?: number;
  termLabel?: string;
  displayTitle?: string;
  title?: string;
}) {
  const parts = [
    course.year ? `${course.year}年` : "",
    course.termLabel ?? "",
  ].filter(Boolean);
  if (parts.length > 0) return parts.join("｜");
  return course.displayTitle ?? course.title ?? "未設定期別";
}

function getCourseModeLabel(course: { courseMode?: string }) {
  if (course.courseMode === "roster_fixed") return "固定名冊";
  if (course.courseMode === "booking_flexible") return "自由預約";
  return "未分類型";
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function isWithinRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export default async function AdminStatsPage({ searchParams }: PageProps) {
  const { courseId } = await searchParams;
  const { categories, courses, reservations } = await getBookingData();
  const activeCourses = courses.filter((course) => course.isActive);
  const selectedCourse =
    courses.find((course) => course.id === courseId) ??
    activeCourses[0] ??
    courses[0];
  const getCourseMeta = (course: (typeof courses)[number]) => {
    const category = categories.find((item) => item.id === course.categoryId);
    return {
      color: resolveCourseColor(course, category),
      categoryName: getCategoryName(course.categoryId, categories),
    };
  };
  const today = getToday();
  const weekEnd = addDays(today, 6);

  const allSessions: SessionSummary[] = activeCourses
    .flatMap((course) =>
      course.sessions.map((session) => {
        const meta = getCourseMeta(course);
        const sessionReservations = reservations.filter(
          (reservation) =>
            reservation.sessionId === session.id &&
            reservation.status === "booked",
        );
        return {
          courseId: course.id,
          courseTitle: course.title,
          courseCode: course.code ?? course.id,
          sessionId: session.id,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          topic: session.topic || "未填單元",
          location: session.location || course.defaultLocation || "未設定地點",
          capacity: session.capacity,
          booked: sessionReservations.length,
          attended: sessionReservations.filter(
            (reservation) => reservation.attendanceStatus === "attended",
          ).length,
          absent: sessionReservations.filter(
            (reservation) => reservation.attendanceStatus === "absent",
          ).length,
          pending: sessionReservations.filter(
            (reservation) => reservation.attendanceStatus === "pending",
          ).length,
          isActive: session.isActive,
          courseColor: meta.color,
          categoryName: meta.categoryName,
        };
      }),
    )
    .sort((a, b) =>
      `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );

  const activeSessions = allSessions.filter((session) => session.isActive);
  const todaySessions = activeSessions.filter(
    (session) => session.date === today,
  );
  const weekSessions = activeSessions.filter((session) =>
    isWithinRange(session.date, today, weekEnd),
  );
  const pendingAttendanceSessions = activeSessions.filter(
    (session) => session.booked > 0 && session.pending > 0,
  );
  const lowAttendanceSessions = activeSessions
    .filter(
      (session) => session.booked > 0 && session.attended + session.absent > 0,
    )
    .filter((session) => session.attended / session.booked < 0.7)
    .slice(0, 6);

  const selectedCourseReservations = selectedCourse
    ? reservations.filter(
        (reservation) =>
          reservation.courseId === selectedCourse.id &&
          reservation.status === "booked",
      )
    : [];
  const selectedActiveSessions =
    selectedCourse?.sessions.filter((session) => session.isActive) ?? [];
  const selectedCapacity = selectedActiveSessions.reduce(
    (sum, session) => sum + session.capacity,
    0,
  );
  const selectedBooked = selectedCourseReservations.length;
  const selectedAttended = selectedCourseReservations.filter(
    (reservation) => reservation.attendanceStatus === "attended",
  ).length;
  const selectedAbsent = selectedCourseReservations.filter(
    (reservation) => reservation.attendanceStatus === "absent",
  ).length;
  const selectedPending = selectedCourseReservations.filter(
    (reservation) => reservation.attendanceStatus === "pending",
  ).length;

  const totalCapacity = activeSessions.reduce(
    (sum, session) => sum + session.capacity,
    0,
  );
  const totalBooked = reservations.filter(
    (reservation) => reservation.status === "booked",
  ).length;
  const totalAttended = reservations.filter(
    (reservation) =>
      reservation.status === "booked" &&
      reservation.attendanceStatus === "attended",
  ).length;
  const totalAbsent = reservations.filter(
    (reservation) =>
      reservation.status === "booked" &&
      reservation.attendanceStatus === "absent",
  ).length;
  const totalPending = reservations.filter(
    (reservation) =>
      reservation.status === "booked" &&
      reservation.attendanceStatus === "pending",
  ).length;

  const courseSummaries = activeCourses
    .map((course) => {
      const courseSessions = course.sessions.filter(
        (session) => session.isActive,
      );
      const courseReservations = reservations.filter(
        (reservation) =>
          reservation.courseId === course.id && reservation.status === "booked",
      );
      const capacity = courseSessions.reduce(
        (sum, session) => sum + session.capacity,
        0,
      );
      const attended = courseReservations.filter(
        (reservation) => reservation.attendanceStatus === "attended",
      ).length;
      const absent = courseReservations.filter(
        (reservation) => reservation.attendanceStatus === "absent",
      ).length;
      const pending = courseReservations.filter(
        (reservation) => reservation.attendanceStatus === "pending",
      ).length;
      return {
        course,
        sessions: courseSessions.length,
        booked: courseReservations.length,
        capacity,
        attended,
        absent,
        pending,
        attendanceRate: percent(attended, courseReservations.length),
      };
    })
    .sort((a, b) => b.booked - a.booked);

  return (
    <AdminShell>
      <section className="mb-8">
        <p className="text-sm font-semibold text-emerald-700">統計</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          課程營運統計
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          這裡不只看總數，而是協助行政快速判斷：今天要點哪些名、本週有哪些課、哪些場次還沒點名，以及哪一門課最需要注意。
        </p>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">今日課程</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">
            {todaySessions.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{formatDate(today)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">本週場次</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">
            {weekSessions.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {formatDate(today)}–{formatDate(weekEnd)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm text-amber-700">待點名場次</p>
          <p className="mt-2 text-3xl font-semibold text-amber-950">
            {pendingAttendanceSessions.length}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            有學生預約但尚未完成點名
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">整體出席率</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">
            {percent(totalAttended, totalAttended + totalAbsent)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            已到 {totalAttended}｜未到 {totalAbsent}｜未點名 {totalPending}
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                今日點名入口
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                點擊後直接回到該課程工作區並展開學生名單。
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
              {formatDate(today)}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {todaySessions.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                今天沒有排定課程。
              </p>
            ) : null}
            {todaySessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/admin/courses/${session.courseId}?month=${today.slice(0, 7)}&openSession=${session.sessionId}#session-${session.sessionId}`}
                className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"
                style={{ borderLeft: `6px solid ${session.courseColor}` }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {session.courseCode}
                    </span>
                    <span
                      className="rounded-full px-2 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: `${session.courseColor}22`,
                        color: session.courseColor,
                      }}
                    >
                      {session.categoryName}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">
                    {session.startTime}–{session.endTime}｜{session.courseTitle}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {session.topic}｜{session.location}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <span className="rounded-lg bg-white px-3 py-2">
                    已報名
                    <br />
                    <b>
                      {session.booked}/{session.capacity}
                    </b>
                  </span>
                  <span className="rounded-lg bg-white px-3 py-2">
                    已到
                    <br />
                    <b>{session.attended}</b>
                  </span>
                  <span className="rounded-lg bg-white px-3 py-2">
                    未到
                    <br />
                    <b>{session.absent}</b>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-950">需要注意</h2>
          <div className="mt-4 grid gap-3">
            {pendingAttendanceSessions.slice(0, 5).map((session) => (
              <Link
                key={session.sessionId}
                href={`/admin/courses/${session.courseId}?month=${session.date.slice(0, 7)}&openSession=${session.sessionId}#session-${session.sessionId}`}
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm hover:bg-amber-100"
                style={{ borderLeft: `6px solid ${session.courseColor}` }}
              >
                <p className="font-semibold text-amber-950">
                  待點名｜{formatDate(session.date)} {session.startTime}
                </p>
                <p className="mt-1 text-amber-800">
                  {session.courseTitle}｜未點名 {session.pending} 人
                </p>
              </Link>
            ))}
            {pendingAttendanceSessions.length === 0 ? (
              <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                目前沒有待點名場次。
              </p>
            ) : null}
            {lowAttendanceSessions.length > 0 ? (
              <div className="mt-2 border-t border-zinc-100 pt-3">
                <p className="mb-2 text-sm font-semibold text-rose-700">
                  低出席率場次
                </p>
                {lowAttendanceSessions.map((session) => (
                  <p
                    key={session.sessionId}
                    className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800"
                  >
                    {formatDate(session.date)}｜{session.courseTitle}｜出席率{" "}
                    {percent(session.attended, session.booked)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">
              選擇課程查看細節
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              用課程色條、代碼、年度 / 期別與課程模式區分同名不同年度的課程。
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            共 {activeCourses.length} 門課
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeCourses.map((course) => {
            const isSelected = selectedCourse?.id === course.id;
            const meta = getCourseMeta(course);
            return (
              <Link
                key={course.id}
                href={`/admin/stats?courseId=${encodeURIComponent(course.id)}`}
                className={`rounded-2xl border p-4 text-sm transition ${isSelected ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-100" : "border-zinc-200 bg-white text-zinc-700 hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md"}`}
                style={{ borderTop: `8px solid ${meta.color}` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {course.code ?? course.id}
                  </span>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: `${meta.color}22`,
                      color: meta.color,
                    }}
                  >
                    {meta.categoryName}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600">
                    {getCourseModeLabel(course)}
                  </span>
                </div>
                <p className="mt-3 text-base font-semibold text-zinc-950">
                  {course.title}
                </p>
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  {getCourseTermLabel(course)}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {!selectedCourse ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
          目前沒有可統計的課程。
        </section>
      ) : (
        <>
          <section
            className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            style={{
              borderTop: `8px solid ${getCourseMeta(selectedCourse).color}`,
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {selectedCourse.code ?? selectedCourse.id}
                  </span>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: `${getCourseMeta(selectedCourse).color}22`,
                      color: getCourseMeta(selectedCourse).color,
                    }}
                  >
                    {getCourseMeta(selectedCourse).categoryName}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                  {selectedCourse.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {getCourseTermLabel(selectedCourse)}｜
                  {getCourseModeLabel(selectedCourse)}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {selectedCourse.description}
                </p>
              </div>
              <Link
                href={`/admin/courses/${selectedCourse.id}`}
                className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-700"
              >
                進入工作區
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">開放場次</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-950">
                  {selectedActiveSessions.length}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">報名 / 名額</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-950">
                  {selectedBooked}/{selectedCapacity}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">已到 / 未到</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-950">
                  {selectedAttended}/{selectedAbsent}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-sm text-zinc-500">未點名</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-950">
                  {selectedPending}
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">
              各課程狀態總覽
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              同名課程會用年度 /
              期別分開顯示，避免把不同年度或不同期別的數據混在一起。
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
              <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_0.6fr] bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-500">
                <span>課程</span>
                <span>場次</span>
                <span>報名率</span>
                <span>出席率</span>
                <span>未點名</span>
              </div>
              {courseSummaries.map((item) => (
                <Link
                  key={item.course.id}
                  href={`/admin/stats?courseId=${item.course.id}`}
                  className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_0.6fr] border-t border-zinc-100 px-4 py-3 text-sm hover:bg-zinc-50"
                  style={{
                    borderLeft: `6px solid ${getCourseMeta(item.course).color}`,
                  }}
                >
                  <span className="font-medium text-zinc-900">
                    <span className="mr-2 rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {item.course.code ?? item.course.id}
                    </span>
                    {item.course.title}
                    <span className="mt-1 block text-xs font-normal text-zinc-500">
                      {getCourseTermLabel(item.course)}｜
                      {getCourseModeLabel(item.course)}
                    </span>
                  </span>
                  <span>{item.sessions}</span>
                  <span>{percent(item.booked, item.capacity)}</span>
                  <span>{item.attendanceRate}</span>
                  <span>{item.pending}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">
              場次詳細狀況
            </h2>
            <div className="mt-4 grid gap-3">
              {selectedCourse.sessions.length === 0 ? (
                <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                  此課程尚未建立場次。
                </p>
              ) : null}
              {selectedCourse.sessions
                .slice()
                .sort((a, b) =>
                  `${a.date} ${a.startTime}`.localeCompare(
                    `${b.date} ${b.startTime}`,
                  ),
                )
                .map((session) => {
                  const summary = allSessions.find(
                    (item) => item.sessionId === session.id,
                  );
                  const remaining = Math.max(
                    session.capacity - (summary?.booked ?? 0),
                    0,
                  );
                  return (
                    <article
                      key={session.id}
                      className={`rounded-xl border p-4 ${session.isActive ? "border-zinc-200 bg-zinc-50" : "border-zinc-200 bg-zinc-100 opacity-70"}`}
                      style={{
                        borderLeft: `6px solid ${getCourseMeta(selectedCourse).color}`,
                      }}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-950">
                            {formatDate(session.date)} {session.startTime}–
                            {session.endTime}
                          </p>
                          <p className="mt-1 text-sm text-zinc-600">
                            {session.topic || "未填單元"}｜{session.location}
                          </p>
                          {!session.isActive ? (
                            <p className="mt-1 text-xs font-medium text-zinc-500">
                              已停用
                            </p>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-zinc-500">報名 / 名額</p>
                            <p className="font-semibold text-zinc-950">
                              {summary?.booked ?? 0}/{session.capacity}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-zinc-500">剩餘</p>
                            <p className="font-semibold text-zinc-950">
                              {remaining}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-zinc-500">已到 / 未到</p>
                            <p className="font-semibold text-zinc-950">
                              {summary?.attended ?? 0}/{summary?.absent ?? 0}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-zinc-500">未點名</p>
                            <p className="font-semibold text-zinc-950">
                              {summary?.pending ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Link
                          href={`/admin/courses/${selectedCourse.id}?month=${session.date.slice(0, 7)}&openSession=${session.id}#session-${session.id}`}
                          className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          到工作區處理名單
                        </Link>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
