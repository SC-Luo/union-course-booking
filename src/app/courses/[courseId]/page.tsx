import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseStatusBadge } from "@/components/status-badge";
import { StudentShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { formatReservationCutoff, getCategoryName, getCourse, getRemainingSeats, getSessionStatus, getWeekday } from "@/lib/course-utils";
import { getCourseTypeName } from "@/lib/course-coding";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;
  const { categories, courses } = await getBookingData();
  const course = getCourse(courseId, courses);

  if (!course) {
    notFound();
  }

  const groupedSessions = course.sessions.reduce<Record<string, typeof course.sessions>>((groups, session) => {
    const key = session.topic ?? "其他";
    groups[key] = [...(groups[key] ?? []), session];
    return groups;
  }, {});

  return (
    <StudentShell>
      <Link href="/" className="mb-6 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
        返回課程列表
      </Link>

      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="mb-2 text-sm font-medium text-sky-700">
            {[course.code, getCourseTypeName(course.courseType), getCategoryName(course.categoryId, categories)].filter(Boolean).join("｜")}
          </p>
          <h1 className="text-3xl font-semibold text-zinc-950">{course.title}</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-600">{course.description}</p>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">預設地點</p>
          <p className="mt-1 font-medium text-zinc-900">{course.defaultLocation}</p>
          <p className="mt-4 text-sm text-zinc-500">注意事項</p>
          <p className="mt-1 text-sm leading-6 text-zinc-700">{course.notes}</p>
        </aside>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">選擇上課單元與時段</h2>
            <p className="mt-1 text-sm text-zinc-600">先看單元，再選日期。可預約按鈕會以綠色顯示。</p>
          </div>
        </div>
        <div className="grid gap-6">
          {Object.entries(groupedSessions).map(([topic, sessions]) => (
            <section key={topic} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-950">{topic}</h3>
                <span className="rounded-md bg-zinc-100 px-3 py-1 text-sm text-zinc-600">{sessions.length} 個時段</span>
              </div>
              <div className="grid gap-3">
                {sessions.map((session) => {
                  const status = getSessionStatus(session);
                  const canBook = status === "available";

                  return (
                    <div key={session.id} className={`grid gap-4 rounded-md border p-4 md:grid-cols-[120px_1fr_auto] md:items-center ${canBook ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200 bg-zinc-50"}`}>
                      <div className="rounded-md bg-white p-3 text-center shadow-sm">
                        <p className="text-sm text-zinc-500">{getWeekday(session.date)}</p>
                        <p className="mt-1 text-xl font-semibold text-zinc-950">{session.date.slice(5).replace("-", "/")}</p>
                      </div>
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <CourseStatusBadge status={status} />
                          <span className="text-sm text-zinc-500">變更截止：{formatReservationCutoff(session)}</span>
                        </div>
                        <p className="text-lg font-semibold text-zinc-950">{session.startTime}-{session.endTime}</p>
                        <p className="mt-1 text-sm text-zinc-600">地點：{session.location}</p>
                        <p className="mt-1 text-sm text-zinc-600">剩餘 {getRemainingSeats(session)} 位</p>
                      </div>
                      {canBook ? (
                        <Link href={`/courses/${course.id}/book/${session.id}`} className="rounded-md bg-emerald-700 px-5 py-4 text-center text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
                          預約這堂
                        </Link>
                      ) : (
                        <button disabled className="rounded-md bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-500">
                          無法預約
                        </button>
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
