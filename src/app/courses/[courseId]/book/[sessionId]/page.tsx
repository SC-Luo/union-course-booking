import Link from "next/link";
import { notFound } from "next/navigation";
import { createReservationAction } from "@/app/actions";
import { StudentShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse, getRemainingSeats, getSession } from "@/lib/course-utils";

type PageProps = {
  params: Promise<{ courseId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const errorMessage: Record<string, string> = {
  invalid: "請確認姓名與手機末三碼都已填寫。",
  duplicate: "這位學員已預約過同一門課程，不能重複預約其他時段。",
  closed: "這個時段目前無法預約，可能已額滿或已關閉。",
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
            <p>時間：{session.startTime}-{session.endTime}</p>
            <p>地點：{session.location}</p>
            <p>剩餘名額：{getRemainingSeats(session)}</p>
          </div>
        </div>

        <form action={createReservationAction} className="rounded-lg border border-zinc-200 bg-white p-5">
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="sessionId" value={session.id} />
          {error ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage[error] ?? "預約失敗，請再確認資料。"}
            </p>
          ) : null}
          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">姓名</span>
            <input name="studentName" required className="w-full rounded-md border border-zinc-300 px-3 py-3 outline-none focus:border-zinc-900" placeholder="請輸入姓名" />
          </label>
          <label className="mb-5 block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">手機末三碼</span>
            <input name="phoneLastThree" required pattern="[0-9]{3}" className="w-full rounded-md border border-zinc-300 px-3 py-3 outline-none focus:border-zinc-900" inputMode="numeric" maxLength={3} placeholder="例如 168" />
          </label>
          <button type="submit" className="w-full rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
            送出預約
          </button>
          <p className="mt-4 text-sm leading-6 text-zinc-500">送出時系統會檢查是否額滿、截止，以及同一課程是否已預約過其他時段。</p>
        </form>
      </section>
    </StudentShell>
  );
}
