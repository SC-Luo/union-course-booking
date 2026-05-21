import { getBookingData } from "@/lib/booking-repository";
import { buildSheetCsv } from "@/lib/sheet-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tableId = url.searchParams.get("table") ?? "";
  const data = await getBookingData();
  const result = buildSheetCsv(data, tableId);

  if (!result) {
    return new Response("Unknown export table", { status: 404 });
  }

  const encodedFileName = encodeURIComponent(result.table.fileName);

  return new Response(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.table.fileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "no-store",
    },
  });
}
