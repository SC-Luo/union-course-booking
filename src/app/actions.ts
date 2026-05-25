"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelReservation, createReservation } from "@/lib/booking-repository";

function cleanIdNumberLast3(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 3);
}

export type CreateReservationFormState = {
  error?: string;
};

export async function createReservationAction(
  _prevState: CreateReservationFormState,
  formData: FormData,
): Promise<CreateReservationFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const result = await createReservation({
    courseId,
    sessionId,
    studentName,
    // 前台預約改為只用姓名比對課程名單；身分證後三碼不再作為預約資格輸入。
    phoneLastThree: "",
  });

  if (!result.ok) {
    return { error: result.reason };
  }

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/courses/${result.courseId}`);
  revalidatePath(`/admin/courses/${result.courseId}/sessions`);
  revalidatePath(`/admin/sessions/${result.sessionId}/reservations`);

  redirect(`/booking/success?id=${encodeURIComponent(result.reservation.id)}`);
}

export async function cancelReservationAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const idNumberLast3 = cleanIdNumberLast3(formData.get("idNumberLast3") ?? formData.get("phoneLastThree"));
  const result = await cancelReservation(reservationId, studentName, idNumberLast3);
  const query = new URLSearchParams({ name: studentName });

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

  redirect(`/booking/search?${query.toString()}`);
}
