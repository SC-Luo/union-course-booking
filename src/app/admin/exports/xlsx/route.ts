import { getBookingData } from "@/lib/booking-repository";
import {
  buildGoogleSheetImportFileName,
  buildGoogleSheetImportWorkbook,
} from "@/lib/sheet-export-xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBookingData();
  const workbook = buildGoogleSheetImportWorkbook(data);
  const fileName = buildGoogleSheetImportFileName();
  const encodedFileName = encodeURIComponent(fileName);

  return new Response(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "no-store",
    },
  });
}
