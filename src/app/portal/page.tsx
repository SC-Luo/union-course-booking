import Link from "next/link";
import { StudentShell } from "@/components/page-shell";

export default function PortalPage() {
  return (
    <StudentShell>
      <div className="mx-auto max-w-4xl">
        <section className="mb-8 rounded-[2rem] border border-[#ead8c6] bg-gradient-to-br from-[#fffaf5] via-[#f8eadc] to-[#eed2b8] p-6 shadow-sm sm:p-8 text-center sm:text-left">
          <h1 className="text-3xl font-black tracking-tight text-[#34231a] sm:text-4xl">
            系統入口
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6f4b35]">
            請依照您的身分選擇要進入的功能。
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 1. 我是學員 */}
          <article className="flex flex-col justify-between rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-[#fff6ed] px-3 py-1 text-xs font-bold text-[#b46f4a]">
                學員服務
              </span>
              <h2 className="mt-3 text-2xl font-black text-[#6b3b25]">我是學員</h2>
              <p className="mt-2 text-sm text-[#8a7c72]">
                可查看目前公開的課表並進行時段預約，或查詢本人的預約狀態。
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#522d1b]"
              >
                查看課程與預約
              </Link>
              <Link
                href="/booking/search"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#ead8c6] bg-white px-5 py-3.5 text-sm font-bold text-[#6b3b25] shadow-sm transition hover:bg-[#fff9f3]"
              >
                我的預約查詢
              </Link>
              <Link
                href="/new-student"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#ead8c6] bg-white px-5 py-3.5 text-sm font-bold text-[#6b3b25] shadow-sm transition hover:bg-[#fff9f3]"
              >
                第一次填寫學員資料
              </Link>
            </div>
          </article>

          {/* 2. 我是講師 / 助教 */}
          <article className="flex flex-col justify-between rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-[#f5ece4] px-3 py-1 text-xs font-bold text-[#66584f]">
                授課工作台
              </span>
              <h2 className="mt-3 text-2xl font-black text-[#6b3b25]">我是講師 / 助教</h2>
              <p className="mt-2 text-sm text-[#8a7c72]">
                查看課堂、點名與填寫課堂紀錄。
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/teaching"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#522d1b]"
              >
                進入授課中心
              </Link>
            </div>
          </article>

          {/* 3. 我是秘書處管理人員 */}
          <article className="flex flex-col justify-between rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-[#5a3726]/10 px-3 py-1 text-xs font-bold text-[#5a3726]">
                系統後台
              </span>
              <h2 className="mt-3 text-2xl font-black text-[#6b3b25]">我是秘書處管理人員</h2>
              <p className="mt-2 text-sm text-[#8a7c72]">
                管理課程、名冊、報名、點名、匯出與系統資料。
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/admin/login"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#5a3726] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#40271b]"
              >
                進入秘書處後台
              </Link>
            </div>
          </article>

          {/* 4. 我要審核新生資料 */}
          <article className="flex flex-col justify-between rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                學員審核
              </span>
              <h2 className="mt-3 text-2xl font-black text-[#6b3b25]">我要審核新生資料</h2>
              <p className="mt-2 text-sm text-[#8a7c72]">
                查看由新生自填入口送出的資料，確認後再轉為正式學員資料。
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/admin/students?status=review"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#ef6c00] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d65f00]"
              >
                查看待確認新生
              </Link>
            </div>
          </article>
        </div>
      </div>
    </StudentShell>
  );
}
