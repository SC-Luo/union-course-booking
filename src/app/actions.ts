"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelReservation, createReservation, getCourseCatalog } from "@/lib/booking-repository";
import { getCourse, getSession, isBookingCourse } from "@/lib/course-utils";

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

  const { courses } = await getCourseCatalog();
  const course = getCourse(courseId, courses);
  const session = course ? getSession(course, sessionId) : undefined;

  if (!course || !session) {
    return { error: "找不到課程或課堂，請回到課程列表重新操作。" };
  }

  if (!isBookingCourse(course)) {
    return { error: "此課程為固定名冊課程，不開放前台預約。" };
  }

  const result = await createReservation({
    courseId,
    sessionId,
    studentName,
    // 前台預約改為只用姓名比對課程名單；身分證後三碼不再作為預約資格輸入。
    phoneLastThree: "",
  });

  if (!result.ok) {
    const reasonText: Record<string, string> = {
      not_booking: "此課程為固定名冊課程，不開放前台預約。",
      not_roster: "查無此課程名冊內的學員，請確認姓名是否與名冊一致。",
      duplicate: "你已經預約過這一堂課。",
      closed: "此課堂目前已額滿、鎖定或未開放預約。",
      invalid: "預約資料不完整，請回到課程列表重新操作。",
    };
    return { error: reasonText[result.reason] ?? result.reason };
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
