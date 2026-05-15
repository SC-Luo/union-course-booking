import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const { students = [] } = await getBookingData();
  const reviewCount = students.filter((student) => student.needsReview).length;

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">學員名冊</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">美容丙級學員與考試座號</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          來源為掃描名單。標示需確認的資料是掃描辨識較不清楚的姓名或座號，正式使用前請人工核對。
        </p>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["名冊人數", students.length],
          ["需人工確認", reviewCount],
          ["可用資料", students.length - reviewCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="grid min-w-[720px] grid-cols-[120px_120px_1fr_140px] border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
          <span>考試場次</span>
          <span>座號</span>
          <span>姓名</span>
          <span>狀態</span>
        </div>
        {students.map((student) => (
          <div key={student.id} className="grid min-w-[720px] grid-cols-[120px_120px_1fr_140px] items-center border-b border-zinc-100 px-4 py-4 text-sm last:border-0">
            <span>{student.examGroup}</span>
            <span>{student.seatNumber}</span>
            <span className="font-medium text-zinc-950">{student.name}</span>
            <span className={student.needsReview ? "text-amber-700" : "text-emerald-700"}>{student.needsReview ? "需確認" : "已匯入"}</span>
          </div>
        ))}
      </section>
    </AdminShell>
  );
}
