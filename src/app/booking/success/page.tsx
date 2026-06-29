import Link from "next/link";
import { StudentShell } from "@/components/page-shell";
import { RememberSuccessReservation } from "@/components/remember-success-reservation";

export default function BookingSuccessPage() {
  return (
    <StudentShell>
      <RememberSuccessReservation />

      <section className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-medium text-emerald-700">預約完成</p>
        <h1 className="text-2xl font-semibold text-zinc-950">已完成預約</h1>

        <p className="mt-4 leading-7 text-zinc-600">
          請用姓名與身分證後三碼查詢自己的預約紀錄。這台裝置也會記住本次預約資訊，方便下次查看。
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
            返回課程列表
          </Link>

          <Link href="/booking/search" className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
            查詢我的預約
          </Link>
        </div>
      </section>
    </StudentShell>
  );
}
