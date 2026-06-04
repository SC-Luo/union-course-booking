/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { CourseStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";
import {
  canChangeReservation,
  formatReservationCutoff,
  getCategoryName,
  getCourse,
  getCourseModeInfo,
  getRemainingSeats,
  getSessionStatus,
  getWeekday,
  isBookingCourse,
} from "@/lib/course-utils";
import { getCourseTypeName } from "@/lib/course-coding";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

type SessionStatus = ReturnType<typeof getSessionStatus> | "locked";
type CourseSessionForStatus = Parameters<typeof getSessionStatus>[0];

function parseTaiwanDateTime(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) {
    const fallback = new Date(normalized);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hour = "23", minute = "59"] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
}

function getFrontSessionStatus(session: CourseSessionForStatus): SessionStatus {
  const baseStatus = getSessionStatus(session);

  if (baseStatus !== "available") {
    return baseStatus;
  }

  if (!canChangeReservation(session)) {
    return "locked";
  }

  const classEndTime = parseTaiwanDateTime(`${session.date} ${session.endTime || "23:59"}`);
  if (classEndTime && Date.now() > classEndTime.getTime()) {
    return "locked";
  }

  return baseStatus;
}

function getDisabledButtonText(status: SessionStatus) {
  if (status === "locked") return "已鎖定";
  if (status === "full") return "已額滿";
  return "無法預約";
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;
  const { categories, courses } = await getCourseCatalog();
  const course = getCourse(courseId, courses);

  if (!course) {
    notFound();
  }

  const modeInfo = getCourseModeInfo(course);
  const isBookingMode = isBookingCourse(course);
  const groupedSessions = course.sessions.reduce<Record<string, typeof course.sessions>>((groups, session) => {
    const key = session.topic ?? "其他";
    groups[key] = [...(groups[key] ?? []), session];
    return groups;
  }, {});

  return (
    <StudentShell>
      <a href="/" className="mb-6 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
        返回課程列表
      </a>

      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${modeInfo.badgeClassName}`}>
              {modeInfo.label}
            </span>
            <span className="text-sm font-medium text-sky-700">
              {[course.code, getCourseTypeName(course.courseType), getCategoryName(course.categoryId, categories)].filter(Boolean).join("｜")}
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-zinc-950">{course.displayTitle ?? course.title}</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-600">{course.description}</p>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">課程模式</p>
          <p className="mt-1 font-black text-zinc-900">{modeInfo.shortLabel}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{modeInfo.frontDescription}</p>
          <p className="mt-4 text-sm text-zinc-500">預設地點</p>
          <p className="mt-1 font-medium text-zinc-900">{course.defaultLocation}</p>
          {course.notes ? (
            <>
              <p className="mt-4 text-sm text-zinc-500">注意事項</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{course.notes}</p>
            </>
          ) : null}
        </aside>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">{modeInfo.frontTitle}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {isBookingMode
                ? "先看單元，再選日期。可預約按鈕會以綠色顯示；已過預約截止時間會自動鎖定。"
                : "此課程依固定名冊與正式課表進行，不開放學員自行預約。後續可銜接個人出缺勤查詢與作業繳交。"}
            </p>
          </div>
        </div>

        {!isBookingMode ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <p className="font-black">固定名冊課程不開放前台預約</p>
            <p className="mt-1">
              這類課程的學員名單由工作人員匯入或維護，講師與助教會依課表進行每堂點名，並累計出席、未到、遲到與請假紀錄。
            </p>
          </div>
        ) : null}

        <div className="grid gap-6">
          {Object.entries(groupedSessions).map(([topic, sessions]) => (
            <section key={topic} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-950">{topic}</h3>
                <span className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-600">{sessions.length} 個時段</span>
              </div>
              <div className="grid gap-3">
                {sessions.map((session) => {
                  const status = getFrontSessionStatus(session);
                  const canBook = isBookingMode && status === "available";

                  return (
                    <div
                      key={session.id}
                      className={`grid gap-4 rounded-md border p-4 md:grid-cols-[120px_1fr_auto] md:items-center ${
                        canBook ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="rounded-md bg-white p-3 text-center shadow-sm">
                        <p className="text-sm text-zinc-500">{getWeekday(session.date)}</p>
                        <p className="mt-1 text-xl font-semibold text-zinc-950">{session.date.slice(5).replace("-", "/")}</p>
                      </div>
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {isBookingMode ? <CourseStatusBadge status={status} /> : <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">固定課表</span>}
                          {isBookingMode ? <span className="text-sm text-zinc-500">變更截止：{formatReservationCutoff(session)}</span> : null}
                        </div>
                        <p className="text-lg font-semibold text-zinc-950">{session.startTime}-{session.endTime}</p>
                        <p className="mt-1 text-sm text-zinc-600">地點：{session.location}</p>
                        {isBookingMode ? (
                          <p className="mt-1 text-sm text-zinc-600">剩餘 {getRemainingSeats(session)} 位</p>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-600">請依班級名冊與正式課表出席</p>
                        )}
                      </div>
                      {isBookingMode ? (
                        canBook ? (
                          <a href={`/courses/${course.id}/book/${session.id}`} className="rounded-md bg-emerald-700 px-5 py-4 text-center text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
                            預約這堂
                          </a>
                        ) : (
                          <button disabled className="rounded-md bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-500">
                            {getDisabledButtonText(status)}
                          </button>
                        )
                      ) : (
                        <span className="rounded-md border border-amber-200 bg-white px-5 py-4 text-center text-sm font-black text-amber-900">
                          不需預約
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </StudentShell>
  );
}
