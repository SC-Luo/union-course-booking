"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelReservation, createReservation } from "@/lib/booking-repository";

function cleanPhoneLastThree(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 3);
}

export async function createReservationAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const phoneLastThree = cleanPhoneLastThree(formData.get("phoneLastThree"));
  const result = await createReservation({ courseId, sessionId, studentName, phoneLastThree });

  if (!result.ok) {
    redirect(`/courses/${courseId}/book/${sessionId}?error=${result.reason}`);
  }

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/courses/${result.courseId}`);
  revalidatePath(`/admin/courses/${result.courseId}/sessions`);
  revalidatePath(`/admin/sessions/${result.sessionId}/reservations`);

  redirect(`/booking/success?id=${result.reservation.id}`);
}

export async function cancelReservationAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const phoneLastThree = cleanPhoneLastThree(formData.get("phoneLastThree"));
  const result = await cancelReservation(reservationId, studentName, phoneLastThree);
  const query = new URLSearchParams({ name: studentName, phone: phoneLastThree });

  if (!result.ok) {
    query.set("error", result.reason);
    redirect(`/booking/search?${query.toString()}`);
  }

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/courses/${result.courseId}`);
  revalidatePath(`/admin/courses/${result.courseId}/sessions`);
  revalidatePath(`/admin/sessions/${result.sessionId}/reservations`);

  query.set("cancelled", "1");
  redirect(`/booking/search?${query.toString()}`);
}
