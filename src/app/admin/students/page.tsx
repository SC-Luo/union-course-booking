import Link from "next/link";
import { disableStudentAction, saveStudentAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ classId?: string; saved?: string; error?: string }>;
};

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const { classId, saved, error } = await searchParams;
  const { courses, students = [] } = await getBookingData();
  const activeStudents = students.filter((student) => student.isActive !== false);
  const selectedClassId = classId || courses.find((course) => activeStudents.some((student) => student.classId === course.id))?.id || courses[0]?.id || "";
  const classStudents = activeStudents.filter((student) => (student.classId ?? "beauty-license-june-2026") === selectedClassId);
  const reviewCount = classStudents.filter((student) => student.needsReview).length;

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">名冊管理</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">依班級管理學員名冊</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">名冊以班級為單位維護；可新增、編輯、停用學員。</p>
      </section>

      {saved ? <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">已更新名冊。</p> : null}
      {error ? <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">請填寫班級、姓名與座號。</p> : null}

      <section className="mb-6 flex flex-wrap gap-2">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/students?classId=${course.id}`} className={`rounded-md border px-4 py-3 text-sm font-medium ${selectedClassId === course.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 bg-white text-zinc-700"}`}>
            {course.title}
          </Link>
        ))}
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

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
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
      </section>
    </AdminShell>
  );
}
