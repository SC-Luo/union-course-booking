import { notFound } from "next/navigation";
import Link from "next/link";
import { BookingForm } from "@/components/booking-form";
import { StudentShell } from "@/components/page-shell";
import { getCourseCatalog } from "@/lib/booking-repository";
import { canChangeReservation, formatReservationCutoff, getCourse, getRemainingSeats, getSession, getWeekday } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { courseId, sessionId } = await params;
  const { error } = await searchParams;
  const { courses } = await getCourseCatalog();
  const course = getCourse(courseId, courses);
  const session = getSession(sessionId, courses);

  if (!course || !session || session.courseId !== course.id) {
    notFound();
  }

  const remainingSeats = getRemainingSeats(session);
  const isChangeOpen = canChangeReservation(session);
  const canBook = isChangeOpen && remainingSeats > 0 && session.isActive && course.isActive;

  return (
    <StudentShell>
      <a href={`/courses/${course.id}`} className="mb-6 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
        返回課程詳情
      </a>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-700">預約表單</p>
          <h1 className="text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <div className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-700">
            <p>日期：{session.date}</p>
            <p>星期：{getWeekday(session.date)}</p>
            <p>單元：{session.topic ?? "未設定"}</p>
            <p>時間：{session.startTime}-{session.endTime}</p>
            <p>地點：{session.location}</p>
            <p>剩餘名額：{remainingSeats}</p>
            <p>預約與取消截止：{formatReservationCutoff(session)}</p>
          </div>
        </div>

{canBook ? (
  <BookingForm
    courseId={course.id}
    sessionId={session.id}
    courseTitle={course.title}
    sessionTime={`${session.date} ${session.startTime}-${session.endTime}`}
    error={error}
  />
) : (
  <aside className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
    <p className="text-base font-semibold">此場次目前無法預約</p>
    {!isChangeOpen ? (
      <p className="mt-2">已超過預約與取消時間，系統已鎖定操作。</p>
    ) : remainingSeats <= 0 ? (
      <p className="mt-2">此場次名額已滿。</p>
    ) : !session.isActive || !course.isActive ? (
      <p className="mt-2">此課程或場次目前未開放預約。</p>
    ) : null}
        <Link href="/" className="mt-4 inline-flex rounded-md bg-zinc-950 px-4 py-2 font-semibold text-white">
          返回課程列表
        </Link>
      </aside>
)} 
     </section>
    </StudentShell>
  );
}
