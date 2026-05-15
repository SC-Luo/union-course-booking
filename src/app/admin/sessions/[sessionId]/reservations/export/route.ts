import { notFound } from "next/navigation";
import { getBookingData } from "@/lib/booking-repository";
import { getCourse, getSession } from "@/lib/course-utils";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function escapeCsv(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const { courses, reservations } = await getBookingData();
  const session = getSession(sessionId, courses);
  const course = session ? getCourse(session.courseId, courses) : undefined;

  if (!session || !course) {
    notFound();
  }

  const rows = [
    ["課程", "日期", "時間", "姓名", "手機末三碼", "預約時間", "預約狀態", "出席狀態"],
    ...reservations
      .filter((reservation) => reservation.sessionId === session.id)
      .map((reservation) => [
        course.title,
        session.date,
        `${session.startTime}-${session.endTime}`,
        reservation.studentName,
        reservation.phoneLastThree,
        reservation.bookedAt,
        reservation.status,
        reservation.attendanceStatus,
      ]),
  ];

  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${session.id}-reservations.csv"`,
    },
  });
}
