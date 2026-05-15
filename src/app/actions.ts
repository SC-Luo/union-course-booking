"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readBookingData, writeBookingData } from "@/lib/data-store";
import type { Reservation } from "@/lib/types";

function cleanPhoneLastThree(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 3);
}

export async function createReservationAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const phoneLastThree = cleanPhoneLastThree(formData.get("phoneLastThree"));
  const data = readBookingData();
  const course = data.courses.find((item) => item.id === courseId);
  const session = course?.sessions.find((item) => item.id === sessionId);

  if (!course || !session || !studentName || phoneLastThree.length !== 3) {
    redirect(`/courses/${courseId}/book/${sessionId}?error=invalid`);
  }

  const hasDuplicate = data.reservations.some(
    (reservation) =>
      reservation.courseId === course.id &&
      reservation.status === "booked" &&
      reservation.studentName === studentName &&
      reservation.phoneLastThree === phoneLastThree,
  );

  if (hasDuplicate) {
    redirect(`/courses/${courseId}/book/${sessionId}?error=duplicate`);
  }

  if (!course.isActive || !session.isActive || session.bookedCount >= session.capacity) {
    redirect(`/courses/${courseId}/book/${sessionId}?error=closed`);
  }

  const now = new Date();
  const reservation: Reservation = {
    id: `r-${now.getTime()}`,
    courseId: course.id,
    sessionId: session.id,
    studentName,
    phoneLastThree,
    bookedAt: now.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    status: "booked",
    attendanceStatus: "pending",
  };

  session.bookedCount += 1;
  data.reservations.push(reservation);
  writeBookingData(data);

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/courses/${course.id}`);
  revalidatePath(`/admin/courses/${course.id}/sessions`);
  revalidatePath(`/admin/sessions/${session.id}/reservations`);

  redirect(`/booking/success?id=${reservation.id}`);
}
