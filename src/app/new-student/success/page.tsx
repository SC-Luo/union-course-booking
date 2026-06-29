import Link from "next/link";
import { StudentShell } from "@/components/page-shell";
import { RememberStudentProfile } from "@/components/remember-student-profile";

type PageProps = {
  searchParams: Promise<{ name?: string; idNumberLast3?: string }>;
};

export default async function NewStudentSuccessPage({ searchParams }: PageProps) {
  const { name = "", idNumberLast3 = "" } = await searchParams;

  return (
    <StudentShell>
      {name ? <RememberStudentProfile name={name} idNumberLast3={idNumberLast3} /> : null}
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-[2rem] border border-[#ead8c6] bg-white p-8 shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mt-6 text-2xl font-black text-[#34231a]">資料已送出</h1>
          
          <div className="mt-4 space-y-2 text-sm leading-6 text-stone-600">
            <p>我們已收到您的基本資料。</p>
            <p>工作人員確認後，會依照您留下的聯絡方式與您聯繫。</p>
          </div>

          <div className="mt-8 border-t border-[#f0e3d5] pt-6">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#522d1b] focus:outline-none focus:ring-2 focus:ring-[#f7c58d]"
            >
              回到課程首頁
            </Link>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
