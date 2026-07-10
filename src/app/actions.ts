"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelReservation, createReservation, getBookingData, upsertStudent, getFirestoreDb, generateNextStudentNumber } from "@/lib/booking-repository";
import type { Student } from "@/lib/types";

function cleanIdNumberLast3(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 3);
}

function isFirestoreQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message);
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
  const idNumberLast3 = cleanIdNumberLast3(formData.get("idNumberLast3") ?? formData.get("phoneLastThree"));

  if (!studentName || idNumberLast3.length !== 3) {
    return { error: "請填寫完整姓名與證件末三碼。" };
  }

  let result;
  try {
    result = await createReservation({
      courseId,
      sessionId,
      studentName,
      phoneLastThree: idNumberLast3,
      idNumberLast3,
    });
  } catch (error) {
    return {
      error: isFirestoreQuotaError(error)
        ? "目前系統資料暫時忙碌，請稍後再試。"
        : "目前無法完成預約，請稍後再試。",
    };
  }

  if (!result.ok) {
    const reasonText: Record<string, string> = {
      not_booking: "這門課目前不是開放預約的課程。",
      not_roster: "查無符合資格的學員資料，請先確認是否已加入對應班級名冊。",
      identity_mismatch: "姓名或證件末三碼與名冊資料不符，請重新確認後再試。",
      duplicate: "您已預約這堂課程。",
      duplicate_course: "您已預約此課程，如需更換時段，請先取消原預約後再重新預約。",
      duplicate_cycle: "您本週已預約此課程其他日期，如需更換日期，請先取消原預約後再重新預約。",
      closed: "這堂課目前無法預約，可能已截止、額滿或狀態已變更。",
      invalid: "找不到課程或課堂，請回到課程列表重新操作。",
      system_unavailable: "目前系統資料暫時忙碌，請稍後再試。",
    };
    return { error: reasonText[result.reason] ?? result.reason };
  }

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(encodeURI(`/courses/${result.courseId}`));
  revalidatePath(encodeURI(`/admin/courses/${result.courseId}/sessions`));
  revalidatePath(encodeURI(`/admin/sessions/${result.sessionId}/reservations`));

  redirect(`/booking/success?id=${encodeURIComponent(result.reservation.id)}`);
}

export async function cancelReservationAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const studentName = String(formData.get("studentName") ?? "").trim();
  const idNumberLast3 = cleanIdNumberLast3(formData.get("idNumberLast3") ?? formData.get("phoneLastThree"));
  const result = await cancelReservation(reservationId, studentName, idNumberLast3);
  const query = new URLSearchParams({ name: studentName, idNumberLast3 });

  if (!result.ok) {
    query.set("error", result.reason);
    redirect(`/booking/search?${query.toString()}`);
  }

  revalidatePath("/");
  revalidatePath("/booking/search");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(encodeURI(`/courses/${result.courseId}`));
  revalidatePath(encodeURI(`/admin/courses/${result.courseId}/sessions`));
  revalidatePath(encodeURI(`/admin/sessions/${result.sessionId}/reservations`));

  redirect(`/booking/search?${query.toString()}`);
}

export async function submitNewStudentProfileAction(formData: FormData) {
  // Honeypot ?脣??暸
  const website = String(formData.get("website") ?? "").trim();
  if (website) {
    redirect("/new-student/success");
  }

  // ????撽?
  const consent = String(formData.get("consent") ?? "").trim();
  if (consent !== "yes") {
    redirect("/new-student?error=consent");
  }

  const name = String(formData.get("name") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const mailingAddress = String(formData.get("mailingAddress") ?? "").trim();
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim();
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim();
  const beautyRelated = String(formData.get("beautyRelated") ?? "").trim();
  const plannedBusinessCategories = formData.getAll("plannedBusinessCategories").map(String);
  const plannedBusinessCategoryOther = String(formData.get("plannedBusinessCategoryOther") ?? "").trim();
  const formNote = String(formData.get("note") ?? "").trim();

  if (!name || !nationalId || !phone || !birthday || !mailingAddress) {
    redirect("/new-student?error=invalid");
  }

  const cleanNationalId = nationalId;
  const idNumberLast3 = cleanNationalId.length >= 3 ? cleanNationalId.slice(-3) : "";

  // 隤脩??閎??
  const interestedCourses = formData.getAll("interestedCourses").map(String);
  const interestedCoursesText = interestedCourses.join(", ");

  // ???暹?鞈???撠?
  const data = await getBookingData();
  const students = data.students ?? [];

  // 蝎暹??芋蝟?撠?(?寧 nationalId)
  const exactExisting = students.find(
    (student) =>
      student.name === name &&
      student.nationalId === cleanNationalId &&
      student.phone === phone
  );

  const looseExisting = students.find(
    (student) =>
      student.name === name &&
      student.nationalId === cleanNationalId
  );

  const existing = exactExisting ?? looseExisting;

  // Generate member number if not exists
  let memberNo = existing?.memberNo;
  if (!memberNo) {
    const db = getFirestoreDb();
    memberNo = await generateNextStudentNumber(db);
  }

  // ???酉??
  let updatedNote = existing?.note || "";
  if (interestedCoursesText) {
    const tag = `[?啁??芸‵?亙] ?喃?閫?玨蝔?${interestedCoursesText}`;
    if (updatedNote) {
      if (!updatedNote.includes(tag)) {
        updatedNote = `${updatedNote}\n${tag}`;
      }
    } else {
      updatedNote = tag;
    }
  }

  if (formNote) {
    const userNoteTag = `[新學員表單] 備註：${formNote}`;
    if (updatedNote) {
      if (!updatedNote.includes(userNoteTag)) {
        updatedNote = `${updatedNote}\n${userNoteTag}`;
      }
    } else {
      updatedNote = userNoteTag;
    }
  }

  const updatedStudent: Student = {
    ...existing,
    id: existing?.id ?? `student-${crypto.randomUUID()}`,
    name,
    nationalId: cleanNationalId,
    idNumberLast3,
    phone,
    birthday,
    email: email || existing?.email || "",
    mailingAddress: mailingAddress || existing?.mailingAddress || "",
    address: mailingAddress || existing?.address || "",
    emergencyContactName: emergencyContactName || existing?.emergencyContactName || "",
    emergencyContactPhone: emergencyContactPhone || existing?.emergencyContactPhone || "",
    beautyRelated: beautyRelated || existing?.beautyRelated || "",
    plannedBusinessCategories: plannedBusinessCategories.length > 0 ? plannedBusinessCategories : existing?.plannedBusinessCategories || [],
    plannedBusinessCategoryOther: plannedBusinessCategoryOther || existing?.plannedBusinessCategoryOther || "",
    memberNo,
    note: updatedNote,
    source: "?啁??芸‵?亙",
    isActive: true,
    needsReview: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await upsertStudent(updatedStudent);

  try {
    revalidatePath("/admin/students");
    revalidatePath("/new-student");
  } catch {
    // 敹賜?函蝡葫閰衣憓? Next.js ??敹怠?摮?芸停蝺??航炊
  }

  redirect(`/new-student/success?name=${encodeURIComponent(name)}&idNumberLast3=${encodeURIComponent(idNumberLast3)}`);
}



