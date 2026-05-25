"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteCourseOfferingCascade,
  getBookingData,
  upsertEnrollment,
  upsertStudent,
} from "@/lib/booking-repository";

function normalizeAdminRedirect(value: FormDataEntryValue | null, fallback: string) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/admin")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

function normalizeIdLastThree(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(-3);
}

function revalidateCourseOfferingPaths(legacyCourseId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/students");
  revalidatePath("/admin/stats");
  if (legacyCourseId) {
    revalidatePath(`/courses/${legacyCourseId}`);
    revalidatePath(`/admin/courses/${legacyCourseId}`);
    revalidatePath(`/admin/courses/${legacyCourseId}/sessions`);
  }
}

export async function clearCourseOfferingCascadeAction(formData: FormData) {
  const offeringId = String(formData.get("offeringId") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (!offeringId || confirmation !== "確認清除") {
    redirect("/admin/course-offerings?error=confirm-required");
  }

  await deleteCourseOfferingCascade(offeringId);
  revalidateCourseOfferingPaths(legacyCourseId);
  redirect("/admin/course-offerings?saved=cleared");
}

export async function addStudentToCourseOfferingAction(formData: FormData) {
  const offeringId = String(formData.get("offeringId") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const idNumberLast3 = normalizeIdLastThree(formData.get("idNumberLast3"));
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const examGroup = String(formData.get("examGroup") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), "/admin/course-offerings");
  const seatNumberValue = Number(formData.get("seatNumber") ?? 0);
  const seatNumber = Number.isFinite(seatNumberValue) && seatNumberValue > 0 ? seatNumberValue : undefined;

  if (!offeringId || !legacyCourseId || !name || idNumberLast3.length !== 3) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=student-invalid`);
  }

  const data = await getBookingData();
  const offering = data.courseOfferings.find((item) => item.id === offeringId);
  const course = data.courses.find((item) => item.id === legacyCourseId || item.offeringId === offeringId);

  if (!offering || !course) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=offering-not-found`);
  }

  const duplicated = data.students.some(
    (student) =>
      student.isActive !== false &&
      student.name.replace(/\s+/g, "") === name.replace(/\s+/g, "") &&
      String(student.idNumberLast3 ?? "") === idNumberLast3 &&
      (student.offeringId === offeringId || student.classId === course.id),
  );

  if (duplicated) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=student-duplicated`);
  }

  const now = new Date().toISOString();
  const id = `student-${crypto.randomUUID()}`;
  const finalSeatNumber = seatNumber ?? data.students.filter((student) => student.offeringId === offeringId || student.classId === course.id).length + 1;
  const classTitle = offering.classDisplayName ?? offering.displayTitle ?? offering.title ?? course.displayTitle ?? course.title;
  const classShortTitle = offering.shortName ?? course.shortName ?? course.shortTitle ?? offering.classIdentifier ?? course.id;

  await upsertStudent({
    id,
    externalMemberNo: `${classShortTitle}-${String(finalSeatNumber).padStart(3, "0")}`,
    memberId: `${classShortTitle}-${String(finalSeatNumber).padStart(3, "0")}`,
    classId: course.id,
    examGroup,
    seatNumber: finalSeatNumber,
    name,
    source: "manual",
    phone,
    idNumberLast3,
    birthday: birthday || null,
    branch: "",
    address: "",
    note,
    needsReview: false,
    isActive: true,
    sourceSheet: offering.sourceSheet,
    createdAt: now,
    updatedAt: now,
    offeringId,
    seriesId: offering.seriesId ?? course.seriesId,
    classTitle,
    classShortTitle,
    year: offering.year ?? course.year,
    term: offering.term ?? course.term,
    termLabel: offering.termLabel ?? course.termLabel,
    courseMasterId: offering.courseMasterId ?? offering.seriesId ?? course.courseMasterId,
  });

  await upsertEnrollment({
    id: `enroll-${id}-${offeringId}`,
    studentId: id,
    courseId: course.id,
    offeringId,
    courseOfferingId: offeringId,
    seriesId: offering.seriesId ?? course.seriesId,
    courseMasterId: offering.courseMasterId ?? offering.seriesId ?? course.courseMasterId,
    seatNumber: finalSeatNumber,
    seatNo: String(finalSeatNumber),
    groupLabel: examGroup,
    source: "manual",
    status: "active",
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
    year: offering.year ?? course.year,
    term: offering.term ?? course.term,
    termLabel: offering.termLabel ?? course.termLabel,
    classDisplayName: classTitle,
    note,
  });

  revalidateCourseOfferingPaths(course.id);
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}saved=student-added`);
}
