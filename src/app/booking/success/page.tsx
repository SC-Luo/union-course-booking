import Link from "next/link";
import { StudentShell } from "@/components/page-shell";

export default function BookingSuccessPage() {
  return (
    <StudentShell>
      <section className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-6 text-center">
        <p className="mb-3 text-sm font-medium text-emerald-700">預約成功</p>
        <h1 className="text-2xl font-semibold text-zinc-950">已完成預約</h1>
        <p className="mt-4 leading-7 text-zinc-600">請記下課程日期、時間與地點。如需取消或更改預約，請聯絡工作人員。</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700">
            返回課程列表
          </Link>
          <Link href="/booking/search" className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            查詢我的預約
          </Link>
        </div>
      </section>
    </StudentShell>
  );
}
