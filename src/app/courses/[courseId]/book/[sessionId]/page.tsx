import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/booking-form";
import { StudentShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { formatReservationCutoff, getCourse, getRemainingSeats, getSession, getWeekday } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { courseId, sessionId } = await params;
  const { error } = await searchParams;
  const { courses } = await getBookingData();
  const course = getCourse(courseId, courses);
  const session = getSession(sessionId, courses);

  if (!course || !session || session.courseId !== course.id) {
    notFound();
  }

  return (
    <StudentShell>
      <Link href={`/courses/${course.id}`} className="mb-6 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
        返回課程詳情
      </Link>

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
            <p>剩餘名額：{getRemainingSeats(session)}</p>
            <p>預約與取消截止：{formatReservationCutoff(session)}</p>
          </div>
        </div>

        <BookingForm courseId={course.id} sessionId={session.id} error={error} />
      </section>
    </StudentShell>
  );
}
