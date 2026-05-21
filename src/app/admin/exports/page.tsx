import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { EXPORT_TABLES } from "@/lib/sheet-export";

export const dynamic = "force-dynamic";

export default async function AdminExportsPage() {
  const data = await getBookingData();

  const counts = Object.fromEntries(
    EXPORT_TABLES.map((table) => {
      const source = data[table.id];
      return [table.id, Array.isArray(source) ? source.length : 0];
    }),
  );

  return (
    <AdminShell>
      <section className="mb-6">
        <p className="text-sm font-medium text-emerald-700">Google Sheet 備份</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">匯出系統資料</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          這裡先採用手動同步：可一鍵下載 Google Sheet 匯入檔 XLSX，也可單獨下載 CSV。Google Sheet 作為備份與人工檢查，不直接覆蓋系統資料。
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">建議使用</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">一鍵下載 Google Sheet 匯入檔</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              下載單一 XLSX 檔後，上傳到 Google Drive 或 Google Sheet，就會保留多個工作表分頁。這比逐一匯入 CSV 更適合同事查看與備份。
            </p>
          </div>
          <a
            href="/admin/exports/xlsx"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            下載 XLSX 匯入檔
          </a>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <h2 className="font-semibold">使用方式</h2>
        <p className="mt-2">
          若只需要單張資料表，可以下載單一 CSV；若要完整備份，建議使用上方 XLSX 匯入檔。
          XLSX 上傳到 Google Drive 後，可直接用 Google Sheet 開啟，並保留 01_students、02_courseSeries 等分頁。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {EXPORT_TABLES.map((table) => (
          <article key={table.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{table.fileName.replace(".csv", "")}｜{table.label}</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{table.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                {counts[table.id] ?? 0} 筆
              </span>
            </div>
            <a
              href={`/admin/exports/download?table=${table.id}`}
              className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              下載 CSV
            </a>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
