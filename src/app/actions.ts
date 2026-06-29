"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelReservation, createReservation, getCourseCatalog, getBookingData, upsertStudent } from "@/lib/booking-repository";
import { getCourse, getSession, isBookingCourse } from "@/lib/course-utils";
import type { Student } from "@/lib/types";

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
  const idNumberLast3 = cleanIdNumberLast3(formData.get("idNumberLast3") ?? formData.get("phoneLastThree"));

  const { courses } = await getCourseCatalog();
  const course = getCourse(courseId, courses);
  const session = course ? getSession(course, sessionId) : undefined;

  if (!course || !session) {
    return { error: "找不到課程或課堂，請回到課程列表重新操作。" };
  }

  if (!isBookingCourse(course)) {
    return { error: "此課程為固定名冊課程，不開放前台預約。" };
  }

  if (!studentName || idNumberLast3.length !== 3) {
    return { error: "請輸入姓名與身分證後三碼。" };
  }

  const result = await createReservation({
    courseId,
    sessionId,
    studentName,
    phoneLastThree: idNumberLast3,
    idNumberLast3,
  });

  if (!result.ok) {
    const reasonText: Record<string, string> = {
      not_booking: "此課程為固定名冊課程，不開放前台預約。",
      not_roster: "查無此課程名冊內的學員，請確認姓名是否與名冊一致。",
      identity_mismatch: "查無符合姓名與身分證後三碼的課程名冊資料，請確認資料是否與名冊一致。",
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

export async function submitNewStudentProfileAction(formData: FormData) {
  // Honeypot 防垃圾送出
  const website = String(formData.get("website") ?? "").trim();
  if (website) {
    redirect("/new-student/success");
  }

  // 個資同意驗證
  const consent = String(formData.get("consent") ?? "").trim();
  if (consent !== "yes") {
    redirect("/new-student?error=consent");
  }

  const name = String(formData.get("name") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();

  // 必填驗證：姓名、身分證字號、手機與生日
  if (!name || !nationalId || !phone || !birthday) {
    redirect("/new-student?error=invalid");
  }

  const cleanNationalId = nationalId;
  const idNumberLast3 = cleanNationalId.length >= 3 ? cleanNationalId.slice(-3) : "";

  const email = String(formData.get("email") ?? "").trim();
  const mailingAddress = String(formData.get("mailingAddress") ?? "").trim();
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim();
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim();
  const beautyRelated = String(formData.get("beautyRelated") ?? "").trim();
  const formNote = String(formData.get("note") ?? "").trim();

  // 課程興趣處理
  const interestedCourses = formData.getAll("interestedCourses").map(String);
  const interestedCoursesText = interestedCourses.join("、");

  // 取得現有資料做比對
  const data = await getBookingData();
  const students = data.students ?? [];

  // 精準與模糊比對 (改用 nationalId)
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

  // 處理備註附加
  let updatedNote = existing?.note || "";
  if (interestedCoursesText) {
    const tag = `[新生自填入口] 想了解課程：${interestedCoursesText}`;
    if (updatedNote) {
      if (!updatedNote.includes(tag)) {
        updatedNote = `${updatedNote}\n${tag}`;
      }
    } else {
      updatedNote = tag;
    }
  }
  if (formNote) {
    const userNoteTag = `[新生自填入口] 備註：${formNote}`;
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
    note: updatedNote,
    source: "新生自填入口",
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
    // 忽略在獨立測試環境下 Next.js 靜態快取存儲未就緒的錯誤
  }

  redirect(`/new-student/success?name=${encodeURIComponent(name)}&idNumberLast3=${encodeURIComponent(idNumberLast3)}`);
}
