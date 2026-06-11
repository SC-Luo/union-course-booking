import Link from "next/link";
import {
  bulkImportStudentIdentitiesAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    imported?: string;
    linked?: string;
    enrolled?: string;
  }>;
};

function baseTemplateText() {
  return [
    "姓名\t證件末三碼\t手機\t生日\t會員編號\t備註",
    "王小美\t123\t0912345678\t1990-01-01\tM001\t首次建立",
    "陳小華\t456\t0987654321\t1991-02-02\tM002\t待補 Email",
  ].join("\n");
}

export default async function StudentImportsPage({ searchParams }: PageProps) {
  const { saved, error, imported, linked, enrolled } = await searchParams;
  const data = await getBookingData();
  const courseOptions = data.courseSeries
    .filter((series) => series.isActive !== false)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-Hant"));
  const offerings = data.courseOfferings
    .filter((offering) => offering.isActive !== false)
    .sort((a, b) => {
      const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "zh-Hant");
    });
  const currentYear = String(new Date().getFullYear() - 1911);

  return (
    <AdminShell currentSection="roster.students" resumeHref="/admin/students" resumeLabel="學員總表">
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">批次匯入</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">每次只做一種匯入，不要混在一起</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-600">
          把「新增學員」、「建立資格」、「加入班級」拆開操作，比較不容易匯錯，也比較容易回頭查原因。
        </p>
      </section>

      {saved ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
          已完成匯入{imported ? `，本次處理 ${imported} 筆` : ""}
          {linked ? `，建立資格 ${linked} 筆` : ""}
          {enrolled ? `，加入班級 ${enrolled} 筆` : ""}。
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700">
          匯入失敗，請確認欄位、課程系列與班級選擇是否完整。
        </p>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        <article className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#a65f3b]">模式 1</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">只建立學員主檔</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            適合第一次整理學員名冊，只建立基本身份資料，不處理課程資格與班級。
          </p>
          <form action={bulkImportStudentIdentitiesAction} className="mt-5 grid gap-3 border-t border-[#ead7c6] pt-5">
            <input type="hidden" name="importMode" value="studentsOnly" />
            <input type="hidden" name="redirectTo" value="/admin/student-imports" />
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              貼上名單
              <textarea
                name="rosterText"
                rows={12}
                placeholder={baseTemplateText()}
                className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
              />
            </label>
            <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">匯入學員主檔</button>
          </form>
        </article>

        <article className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#a65f3b]">模式 2</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">建立課程資格</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            適合先建人，再把同一批人標記成某課程可參與的名冊。
          </p>
          <form action={bulkImportStudentIdentitiesAction} className="mt-5 grid gap-3 border-t border-[#ead7c6] pt-5">
            <input type="hidden" name="importMode" value="withEligibility" />
            <input type="hidden" name="redirectTo" value="/admin/student-imports" />
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              課程系列
              <select name="seriesId" className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]">
                <option value="">請選擇課程系列</option>
                {courseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                年度
                <input name="year" defaultValue={currentYear} className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                資格狀態
                <select name="eligibilityStatus" defaultValue="可上課" className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]">
                  <option value="可上課">可上課</option>
                  <option value="已結訓">已結訓</option>
                  <option value="未加入">未加入</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              匯入備註
              <input name="note" placeholder="例如：115 年第 2 期資格名冊" className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              貼上名單
              <textarea
                name="rosterText"
                rows={10}
                placeholder={baseTemplateText()}
                className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
              />
            </label>
            <button className="rounded-2xl bg-[#ef6c00] px-5 py-3 text-sm font-bold text-white">匯入並建立資格</button>
          </form>
        </article>

        <article className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#a65f3b]">模式 3</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">加入指定班級</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            適合同一期班級名單匯入。會先建立 / 更新學員，再把人加入你選的班級。
          </p>
          <form action={bulkImportStudentIdentitiesAction} className="mt-5 grid gap-3 border-t border-[#ead7c6] pt-5">
            <input type="hidden" name="importMode" value="withEnrollment" />
            <input type="hidden" name="redirectTo" value="/admin/student-imports" />
            <input type="hidden" name="eligibilityStatus" value="可上課" />
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              指定班級
              <select name="targetOfferingId" className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]">
                <option value="">請選擇班級</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.displayTitle ?? offering.displayName ?? offering.title ?? offering.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              匯入備註
              <input name="note" placeholder="例如：115 年第 2 期班級名單" className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              貼上名單
              <textarea
                name="rosterText"
                rows={10}
                placeholder={baseTemplateText()}
                className="w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#ef6c00]"
              />
            </label>
            <button className="rounded-2xl bg-[#b46f4a] px-5 py-3 text-sm font-bold text-white">匯入並加入班級</button>
          </form>
        </article>
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-zinc-950">補充說明</h2>
            <p className="mt-1 text-sm text-zinc-500">如果你要調整單一學員，直接回學員總表處理會比較快。</p>
          </div>
          <Link href="/admin/students" className="rounded-2xl border border-[#ead7c6] bg-white px-4 py-2 text-sm font-bold text-[#6b3b25]">
            回學員總表
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
