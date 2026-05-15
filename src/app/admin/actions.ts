"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateReservationAttendance } from "@/lib/booking-repository";
import type { AttendanceStatus } from "@/lib/types";

export async function updateAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const attendanceStatus = String(formData.get("attendanceStatus") ?? "") as AttendanceStatus;

  await updateReservationAttendance(reservationId, attendanceStatus);
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/admin/sessions/${sessionId}/reservations`);
  redirect(`/admin/sessions/${sessionId}/reservations`);
}
