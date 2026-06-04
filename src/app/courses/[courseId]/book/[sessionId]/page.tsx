import { notFound } from "next/navigation";
import Link from "next/link";
import { BookingForm } from "@/components/booking-form";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";
import {
  canChangeReservation,
  formatReservationCutoff,
  getCourse,
  getCourseModeInfo,
  getRemainingSeats,
  getSession,
  getWeekday,
  isBookingCourse,
} from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string; sessionId: string }>;
};

function isBookableStatus(status?: string) {
  return ["scheduled", "rescheduled", "makeup", undefined, ""].includes(status);
}

export default async function BookingPage({ params }: PageProps) {
  const { courseId, sessionId } = await params;
  const { courses } = await getCourseCatalog();
  const decodedCourseId = decodeURIComponent(courseId);
  const decodedSessionId = decodeURIComponent(sessionId);
  const course = getCourse(decodedCourseId, courses);
  const session = course ? getSession(course, decodedSessionId) ?? getSession(decodedSessionId, courses) : undefined;

  if (!course || !session) notFound();

  const modeInfo = getCourseModeInfo(course);
  const isBookingMode = isBookingCourse(course);
  const remainingSeats = getRemainingSeats(session);
  const isChangeOpen = canChangeReservation(session);
  const canBook =
    isBookingMode &&
    isChangeOpen &&
    remainingSeats > 0 &&
    session.isActive &&
    course.isActive &&
    isBookableStatus(session.status);

  return (
    <StudentShell>
      <Link href={`/courses/${encodeURIComponent(course.id)}`} className="mb-6 inline-flex rounded-full border border-[#d8bda4] bg-white px-4 py-2 text-sm font-semibold text-[#6f4325] hover:bg-[#fff4e8]">
        返回課程詳情
      </Link>
      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <p className={`mb-2 inline-flex rounded-full border px-4 py-2 text-sm font-bold ${modeInfo.badgeClassName}`}>
            {modeInfo.label}
          </p>
          <h1 className="text-3xl font-bold text-[#34231a]">{course.displayTitle ?? course.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7b6252]">
            {isBookingMode
              ? "請確認課堂資訊後，輸入預約姓名。系統會比對本班名冊，確認在名單內才會完成預約。"
              : "此課程為固定名冊課程，不開放學員自行預約。請依正式課表出席，後續可查詢出缺勤與作業紀錄。"}
          </p>
          <div className="mt-6 grid gap-3 rounded-[1.75rem] border border-[#ead8c6] bg-white p-5 text-sm text-[#6f4b35] shadow-sm sm:grid-cols-2">
            <p><span className="font-bold text-[#34231a]">日期：</span>{session.date}</p>
            <p><span className="font-bold text-[#34231a]">星期：</span>{getWeekday(session.date)}</p>
            <p><span className="font-bold text-[#34231a]">單元：</span>{session.topic ?? "未設定"}</p>
            <p><span className="font-bold text-[#34231a]">時間：</span>{session.startTime}-{session.endTime}</p>
            <p className="sm:col-span-2"><span className="font-bold text-[#34231a]">地點：</span>{session.location}</p>
            {isBookingMode ? <p><span className="font-bold text-[#34231a]">剩餘名額：</span>{remainingSeats}</p> : null}
            <p><span className="font-bold text-[#34231a]">課堂狀態：</span>{canBook ? "可預約" : isBookingMode ? "目前不可預約" : "固定名冊，不需預約"}</p>
            {isBookingMode ? <p className="sm:col-span-2"><span className="font-bold text-[#34231a]">預約與取消截止：</span>{formatReservationCutoff(session)}</p> : null}
          </div>
        </div>

        {canBook ? (
          <BookingForm courseId={course.id} sessionId={session.id} courseTitle={course.displayTitle ?? course.title} sessionTime={`${session.date} ${session.startTime}-${session.endTime}`} />
        ) : (
          <aside className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 shadow-sm">
            <p className="text-base font-bold">{isBookingMode ? "此課堂目前無法預約" : "此課程不開放前台預約"}</p>
            {!isBookingMode ? (
              <p className="mt-2">固定名冊課程由工作人員維護學員名單，講師與助教依正式課表點名，不需要學員自行選時段。</p>
            ) : !isChangeOpen ? (
              <p className="mt-2">已進入開課前 7 天鎖定期，系統已鎖定預約與取消。</p>
            ) : remainingSeats <= 0 ? (
              <p className="mt-2">此課堂名額已滿。</p>
            ) : !session.isActive || !course.isActive ? (
              <p className="mt-2">此課程或課堂目前未開放預約。</p>
            ) : !isBookableStatus(session.status) ? (
              <p className="mt-2">此課堂目前為停課、已取消或其他不可預約狀態。</p>
            ) : null}
            <Link href="/" className="mt-4 inline-flex rounded-full bg-[#3a2a20] px-4 py-2 font-bold text-white">
              返回課程列表
            </Link>
          </aside>
        )}
      </section>
    </StudentShell>
  );
}
