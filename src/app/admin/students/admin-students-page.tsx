import Link from "next/link";
import { disableStudentAction, saveStudentAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ classId?: string; saved?: string; error?: string; q?: string }>;
};

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const { classId, saved, error, q = "" } = await searchParams;
  const { courses, students = [] } = await getBookingData();
  const activeStudents = students.filter((student) => student.isActive !== false);
  const selectedClassId = classId || courses.find((course) => activeStudents.some((student) => student.classId === course.id))?.id || courses[0]?.id || "";
  const selectedCourse = courses.find((course) => course.id === selectedClassId);
  const normalizedQuery = q.trim().toLowerCase();
  const classStudents = activeStudents
    .filter((student) => (student.classId ?? "beauty-license-june-2026") === selectedClassId)
    .filter((student) => {
      if (!normalizedQuery) return true;
      return (
        student.name.toLowerCase().includes(normalizedQuery) ||
        String(student.seatNumber).includes(normalizedQuery) ||
        (student.examGroup ?? "").toLowerCase().includes(normalizedQuery) ||
        (student.memberId ?? "").toLowerCase().includes(normalizedQuery) ||
        (student.phone ?? "").includes(normalizedQuery)
      );
    });
  const reviewCount = classStudents.filter((student) => student.needsReview).length;

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">名冊管理</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">依班級管理學員名冊</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          名冊是「學生資料」角度；預約名單是「某堂課 / 某場次」角度。手機版已改成卡片，方便現場查人。
        </p>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新名冊。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫班級、姓名與座號。</p> : null}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">選擇班級</h2>
            {selectedCourse ? <p className="mt-1 text-sm text-zinc-500">目前：{selectedCourse.title}</p> : null}
          </div>
          <form className="grid gap-2 sm:grid-cols-[1fr_auto] lg:w-[420px]">
            <input type="hidden" name="classId" value={selectedClassId} />
            <input name="q" defaultValue={q} className="rounded-md border border-zinc-300 px-3 py-3" placeholder="搜尋姓名、座號、場次、電話" />
            <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">搜尋</button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {courses.map((course) => (
            <Link key={course.id} href={`/admin/students?classId=${course.id}`} className={`rounded-md border px-4 py-3 text-sm font-medium ${selectedClassId === course.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 bg-white text-zinc-700"}`}>
              {course.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["本班名冊", classStudents.length],
          ["需人工確認", reviewCount],
          ["可用資料", classStudents.length - reviewCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950">新增學員</h2>
        <form action={saveStudentAction} className="grid gap-3 md:grid-cols-[1fr_110px_120px_1fr_120px] md:items-end">
          <input type="hidden" name="classId" value={selectedClassId} />
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">姓名</span>
            <input name="name" className="w-full rounded-md border border-zinc-300 px-3 py-3" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">座號</span>
            <input name="seatNumber" type="number" className="w-full rounded-md border border-zinc-300 px-3 py-3" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">場次</span>
            <input name="examGroup" className="w-full rounded-md border border-zinc-300 px-3 py-3" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">備註</span>
            <input name="note" className="w-full rounded-md border border-zinc-300 px-3 py-3" />
          </label>
          <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">新增</button>
        </form>
      </section>

      <section className="grid gap-3 md:hidden">
        {classStudents.map((student) => (
          <article key={student.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{student.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">座號 {student.seatNumber}｜場次 {student.examGroup || "未填"}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${student.needsReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {student.needsReview ? "需確認" : "已匯入"}
              </span>
            </div>

            <div className="mt-4 grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
              <p><span className="text-zinc-500">資料來源：</span>{student.source || "未標示"}</p>
              {student.phone ? <p><span className="text-zinc-500">電話：</span>{student.phone}</p> : null}
              {student.memberId ? <p><span className="text-zinc-500">會員編號：</span>{student.memberId}</p> : null}
              {student.note ? <p><span className="text-zinc-500">備註：</span>{student.note}</p> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <details className="w-full">
                <summary className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-center text-sm hover:bg-zinc-50">編輯</summary>
                <form action={saveStudentAction} className="mt-3 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                  <input type="hidden" name="id" value={student.id} />
                  <input type="hidden" name="classId" value={selectedClassId} />
                  <input name="name" defaultValue={student.name} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="seatNumber" type="number" defaultValue={student.seatNumber} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="examGroup" defaultValue={student.examGroup} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="note" defaultValue={student.note ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                </form>
              </details>
              <form action={disableStudentAction} className="w-full">
                <input type="hidden" name="id" value={student.id} />
                <input type="hidden" name="classId" value={selectedClassId} />
                <button className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">停用</button>
              </form>
            </div>
          </article>
        ))}
        {classStudents.length === 0 ? <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">目前沒有符合條件的學員。</p> : null}
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-zinc-200 bg-white md:block">
        <div className="grid min-w-[900px] grid-cols-[120px_120px_1fr_160px_220px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>考試場次</span>
          <span>座號</span>
          <span>姓名</span>
          <span>狀態</span>
          <span>操作</span>
        </div>
        {classStudents.map((student) => (
          <div key={student.id} className="grid min-w-[900px] grid-cols-[120px_120px_1fr_160px_220px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span>{student.examGroup}</span>
            <span>{student.seatNumber}</span>
            <span className="font-medium text-zinc-950">{student.name}</span>
            <span className={student.needsReview ? "text-amber-700" : "text-emerald-700"}>{student.needsReview ? "需確認" : "已匯入"}</span>
            <span className="flex gap-2">
              <details className="relative">
                <summary className="cursor-pointer rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">編輯</summary>
                <form action={saveStudentAction} className="absolute right-0 z-10 mt-2 grid w-[420px] gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
                  <input type="hidden" name="id" value={student.id} />
                  <input type="hidden" name="classId" value={selectedClassId} />
                  <input name="name" defaultValue={student.name} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="seatNumber" type="number" defaultValue={student.seatNumber} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="examGroup" defaultValue={student.examGroup} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <input name="note" defaultValue={student.note ?? ""} className="rounded-md border border-zinc-300 px-3 py-3" />
                  <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">儲存編輯</button>
                </form>
              </details>
              <form action={disableStudentAction}>
                <input type="hidden" name="id" value={student.id} />
                <input type="hidden" name="classId" value={selectedClassId} />
                <button className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-50">停用</button>
              </form>
            </span>
          </div>
        ))}
        {classStudents.length === 0 ? <div className="px-4 py-8 text-sm text-zinc-500">目前沒有符合條件的學員。</div> : null}
      </section>
    </AdminShell>
  );
}
