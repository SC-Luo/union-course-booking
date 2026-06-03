import { syncGoogleSheetsAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { EXPORT_TABLES } from "@/lib/sheet-export";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    googleSheetsSync?: string;
  }>;
};

function getSyncStatusMessage(status?: string) {
  if (!status) return null;

  if (status === "success") {
    return {
      tone: "success" as const,
      title: "同步成功",
      message: "已將目前系統資料同步到 Google 試算表。若資料較多，試算表可能需要稍等一下才會全部更新。",
    };
  }

  if (status === "not-configured") {
    return {
      tone: "warning" as const,
      title: "尚未設定 Google Sheet 同步",
      message: "請確認 GOOGLE_SHEETS_WEBHOOK_URL 與 GOOGLE_SHEETS_SYNC_TOKEN 已設定後，再重新執行同步。",
    };
  }

  return {
    tone: "error" as const,
    title: "同步失敗",
    message: "請檢查 Apps Script 部署、同步 token、試算表 ID 與試算表權限。原本系統資料不會受到影響。",
  };
}

function getTableDisplayName(fileName: string, label: string) {
  const prefix = fileName.match(/^\d+/)?.[0];
  return prefix ? `${prefix}_${label}` : label;
}

function getTechnicalName(fileName: string) {
  return fileName.replace(/\.csv$/i, "");
}

export default async function AdminExportsPage({ searchParams }: PageProps) {
  const data = await getBookingData();
  const params = await searchParams;
  const syncStatus = getSyncStatusMessage(params?.googleSheetsSync);

  const counts = Object.fromEntries(
    EXPORT_TABLES.map((table) => {
      const source = data[table.id];
      return [table.id, Array.isArray(source) ? source.length : 0];
    }),
  );

  return (
    <AdminShell currentSection="reports.sync">
      <section className="mb-6">
        <p className="text-sm font-medium text-sky-700">備份同步</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          資料備份與 Google Sheet 同步
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          將系統資料同步到 Google 試算表，或下載 Excel / CSV 作為外部報表、行政檢查與備份使用。Google Sheet 僅作為外部報表與備份，不作為系統主要資料來源。
        </p>
      </section>

      {syncStatus ? (
        <section
          className={`mb-6 rounded-2xl border p-5 text-sm leading-6 ${
            syncStatus.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : syncStatus.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <h2 className="font-semibold">{syncStatus.title}</h2>
          <p className="mt-1">{syncStatus.message}</p>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-700">Google Sheet 同步</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              同步到 Google 試算表
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              將目前系統資料同步到指定 Google 試算表，方便行政報表、備份與人工檢查。同步採手動觸發，失敗時不會影響 Firestore / JSON fallback 原本資料。
            </p>
          </div>
          <form action={syncGoogleSheetsAction}>
            <input type="hidden" name="mode" value="all" />
            <button className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-800">
              同步到 Google 試算表
            </button>
          </form>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">完整備份</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">
              下載完整 XLSX 備份
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              下載所有主要資料表，適合存到 Google Drive、交給行政人員備份，或作為離線檢查用檔案。
            </p>
          </div>
          <a
            href="/admin/exports/xlsx"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            下載 XLSX 備份
          </a>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-950">進階：單表 CSV 下載</h2>
        <p className="mt-2">
          一般備份建議使用上方 Google Sheet 同步或 XLSX 備份；只有需要單獨檢查某一類資料時，再下載個別 CSV。卡片主標題使用中文名稱，英文技術表名保留在小字，方便後續維護。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {EXPORT_TABLES.map((table) => (
          <article key={table.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  {getTableDisplayName(table.fileName, table.label)}
                </h2>
                <p className="mt-1 text-xs font-medium text-zinc-400">
                  技術表名：{String(table.id)}｜CSV：{getTechnicalName(table.fileName)}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{table.description}</p>
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
