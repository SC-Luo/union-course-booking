import {
  bulkImportStudentIdentitiesAction,
} from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { RosterFlowNav } from "@/components/roster-flow-nav";
import { getBookingData } from "@/lib/booking-repository";
import { ImportClientForm } from "./import-client-form";

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

export default async function StudentImportsPage({ searchParams }: PageProps) {
  const { saved, error, imported, linked, enrolled } = await searchParams;
  const data = await getBookingData();
  const offerings = data.courseOfferings
    .filter((offering) => offering.isActive !== false)
    .sort((a, b) => {
      const yearDiff = Number(b.year ?? 0) - Number(a.year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "zh-Hant");
    });

  return (
    <AdminShell currentSection="roster.students">
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950">學員資料匯入</h1>
        <p className="mt-2 text-sm text-zinc-500">下載範本、填寫資料後上傳，系統會先檢查再匯入。</p>
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

      <RosterFlowNav current="imports" />

      <ImportClientForm
        action={bulkImportStudentIdentitiesAction}
        offerings={offerings}
      />
    </AdminShell>
  );
}
