"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inferCategoryFromCode, inferCourseTypeFromCode } from "@/lib/course-coding";
import { setDocumentActive, updateReservationAttendance, upsertCategory, upsertCourse, upsertStudent } from "@/lib/booking-repository";
import type { AttendanceStatus, CourseCategory } from "@/lib/types";

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

export async function saveCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!id || !name) {
    redirect("/admin/categories?error=invalid");
  }

  const category: CourseCategory = {
    id,
    code: id,
    name,
    description,
    sortOrder: 0,
    isActive: formData.get("isActive") !== "false",
  };

  await upsertCategory(category);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  redirect("/admin/categories?saved=1");
}

export async function disableCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  await setDocumentActive("categories", id, false);
  revalidatePath("/admin/categories");
  redirect("/admin/categories?saved=1");
}

export async function saveCourseAction(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const id = String(formData.get("id") ?? code).trim() || code;
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? inferCategoryFromCode(code)).trim().toUpperCase();
  const courseType = String(formData.get("courseType") ?? inferCourseTypeFromCode(code)).trim().toUpperCase();

  if (!id || !title || !categoryId) {
    redirect("/admin/courses?error=invalid");
  }

  await upsertCourse({
    id,
    code,
    courseType,
    title,
    categoryId,
    description: String(formData.get("description") ?? "").trim(),
    defaultLocation: String(formData.get("defaultLocation") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    isActive: formData.get("isActive") !== "false",
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  redirect("/admin/courses?saved=1");
}

export async function disableCourseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  await setDocumentActive("courses", id, false);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  redirect("/admin/courses?saved=1");
}

export async function saveStudentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim() || `student-${crypto.randomUUID()}`;
  const name = String(formData.get("name") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  const seatNumber = Number(formData.get("seatNumber") ?? 0);

  if (!name || !classId || !seatNumber) {
    redirect("/admin/students?error=invalid");
  }

  await upsertStudent({
    id,
    classId,
    name,
    examGroup: String(formData.get("examGroup") ?? "").trim(),
    seatNumber,
    source: "後台手動維護",
    note: String(formData.get("note") ?? "").trim(),
    needsReview: formData.get("needsReview") === "true",
    isActive: formData.get("isActive") !== "false",
  });

  revalidatePath("/admin/students");
  redirect(`/admin/students?classId=${encodeURIComponent(classId)}&saved=1`);
}

export async function disableStudentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  await setDocumentActive("students", id, false);
  revalidatePath("/admin/students");
  redirect(`/admin/students?classId=${encodeURIComponent(classId)}&saved=1`);
}
