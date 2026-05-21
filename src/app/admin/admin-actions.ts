"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  inferCategoryFromCode,
  inferCourseTypeFromCode,
} from "@/lib/course-coding";
import {
  buildSessionDeadline,
  cancelReservationByStaff,
  deleteCourseSessionsAndReservations,
  deleteSessionAndReservations,
  getBookingData,
  setDocumentActive,
  updateReservationAttendance,
  upsertCategory,
  upsertCourse,
  upsertSession,
  upsertStudent,
} from "@/lib/booking-repository";
import type {
  AttendanceStatus,
  CourseCategory,
  CourseSession,
} from "@/lib/types";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeHexColor(value: FormDataEntryValue | null) {
  const color = String(value ?? "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
}

function normalizeAdminRedirect(
  value: FormDataEntryValue | null,
  fallback: string,
) {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/admin")) return fallback;
  if (path.includes(":") || path.startsWith("//")) return fallback;
  return path || fallback;
}

function generateCourseCode(
  courseType: string,
  categoryId: string,
  existingCodes: Array<string | undefined>,
) {
  const prefix = `${courseType}-${categoryId}`;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}(\\d{3})$`);
  const maxSequence = existingCodes.reduce((max, code) => {
    const match = code?.match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

function buildSessionId(
  courseId: string,
  date: string,
  startTime: string,
  topic: string,
) {
  const time = startTime.replace(":", "");
  const topicSlug = slugify(topic || "session");
  return `${courseId}-${date}-${time}-${topicSlug}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function updateAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `/admin/sessions/${sessionId}/reservations`,
  );
  const attendanceStatus = String(
    formData.get("attendanceStatus") ?? "",
  ) as AttendanceStatus;

  await updateReservationAttendance(reservationId, attendanceStatus);
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(redirectTo);
  revalidatePath(`/admin/sessions/${sessionId}/reservations`);
  redirect(redirectTo);
}

export async function cancelReservationByStaffAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  const result = await cancelReservationByStaff(reservationId);
  revalidatePath("/");
  if (result.ok) {
    revalidatePath(`/courses/${result.courseId}`);
    revalidatePath(`/admin/courses/${result.courseId}`);
    revalidatePath(`/admin/courses/${result.courseId}/sessions`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/admin/sessions/${sessionId}/reservations`);
  redirect(`/admin/sessions/${sessionId}/reservations`);
}

export async function saveCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
    .trim()
    .toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = normalizeHexColor(formData.get("color"));

  if (!id || !name) {
    redirect("/admin/categories?error=invalid");
  }

  const existing = (await getBookingData()).categories.find(
    (category) => category.id === id,
  );

  const category: CourseCategory = {
    id,
    code: id,
    name,
    description,
    sortOrder: existing?.sortOrder ?? 0,
    isActive: formData.get("isActive")
      ? formData.get("isActive") !== "false"
      : (existing?.isActive ?? true),
    color: color ?? existing?.color,
  };

  await upsertCategory(category);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  redirect("/admin/categories?saved=1");
}

export async function disableCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("categories", id, nextActive);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  redirect("/admin/categories?saved=1");
}

export async function saveCourseAction(formData: FormData) {
  const currentId = String(formData.get("id") ?? "").trim();
  const currentCode = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(
    formData.get("categoryId") ?? inferCategoryFromCode(currentCode),
  )
    .trim()
    .toUpperCase();
  const courseType = String(
    formData.get("courseType") ?? inferCourseTypeFromCode(currentCode) ?? "SF",
  )
    .trim()
    .toUpperCase();
  const color = normalizeHexColor(formData.get("color"));

  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/courses",
  );

  if (!title || !categoryId || !courseType) {
    redirect(`${redirectTo}?error=invalid`);
  }

  const data = await getBookingData();
  const existingCourse = currentId
    ? data.courses.find((course) => course.id === currentId)
    : undefined;
  const capacityMode =
    String(
      formData.get("capacityMode") ?? existingCourse?.capacityMode ?? "course",
    ) === "session"
      ? "session"
      : "course";
  const parsedTotalCapacity = Number(
    formData.get("totalCapacity") ?? existingCourse?.totalCapacity ?? 0,
  );
  const totalCapacity =
    Number.isFinite(parsedTotalCapacity) && parsedTotalCapacity > 0
      ? parsedTotalCapacity
      : undefined;

  const code =
    existingCourse?.code ??
    (currentCode ||
      generateCourseCode(
        courseType,
        categoryId,
        data.courses.map((course) => course.code),
      ));
  const id = currentId || `${code.toLowerCase()}-${slugify(title)}`;

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
    color: color ?? existingCourse?.color,
    capacityMode,
    totalCapacity,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  redirect(`${redirectTo}?saved=1&courseId=${encodeURIComponent(id)}`);
}

export async function disableCourseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("courses", id, nextActive);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  redirect("/admin/courses?saved=1");
}

export async function saveSessionAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  const id =
    String(formData.get("id") ?? "").trim() || `session-${crypto.randomUUID()}`;
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);

  if (!courseId || !date || !startTime || !endTime || capacity < 0) {
    redirect(redirectTo || `/admin/courses/${courseId}/sessions?error=invalid`);
  }

  const data = await getBookingData();
  const existingSession = data.courses
    .flatMap((course) => course.sessions)
    .find((session) => session.id === id);
  const bookedCount = Math.max(
    Number(formData.get("bookedCount") ?? existingSession?.bookedCount ?? 0),
    0,
  );
  const session: CourseSession = {
    id,
    courseId,
    date,
    startTime,
    endTime,
    topic: String(formData.get("topic") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    capacity: Math.max(capacity, bookedCount),
    bookedCount,
    bookingDeadline:
      String(formData.get("bookingDeadline") ?? "").trim() ||
      buildSessionDeadline(date),
    isActive: formData.get("isActive") !== "false",
  };

  await upsertSession(session);
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  redirect(redirectTo || `/admin/courses/${courseId}/sessions?saved=1`);
}

export async function bulkCreateSessionsAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const weekdays = formData.getAll("weekdays").map((value) => Number(value));
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const topic = String(formData.get("topic") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const bookingDeadline = String(formData.get("bookingDeadline") ?? "").trim();
  const isActive = formData.get("isActive") !== "false";

  if (
    !courseId ||
    !startDate ||
    !endDate ||
    weekdays.length === 0 ||
    !startTime ||
    !endTime ||
    capacity < 0
  ) {
    redirect(redirectTo || `/admin/courses/${courseId}/sessions?error=invalid`);
  }

  const data = await getBookingData();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) {
    redirect("/admin/courses?error=invalid");
  }

  const existingKeys = new Set(
    course.sessions.map(
      (session) => `${session.courseId}|${session.date}|${session.startTime}`,
    ),
  );
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const created: CourseSession[] = [];

  for (let current = start; current <= end; current = addDays(current, 1)) {
    if (!weekdays.includes(current.getDay())) continue;

    const date = formatDate(current);
    const key = `${courseId}|${date}|${startTime}`;
    if (existingKeys.has(key)) continue;

    const id = buildSessionId(courseId, date, startTime, topic);
    created.push({
      id,
      courseId,
      date,
      startTime,
      endTime,
      topic,
      location,
      capacity,
      bookedCount: 0,
      bookingDeadline: bookingDeadline || buildSessionDeadline(date),
      isActive,
    });
    existingKeys.add(key);
  }

  if (created.length === 0) {
    redirect(redirectTo || `/admin/courses/${courseId}/sessions?error=invalid`);
  }

  for (const session of created) {
    await upsertSession(session);
  }

  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  redirect(redirectTo || `/admin/courses/${courseId}/sessions?saved=1`);
}

export async function disableSessionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `/admin/courses/${courseId}`,
  );

  if (!id || !courseId) {
    redirect("/admin?error=invalid");
  }

  await deleteSessionAndReservations(id);
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  redirect(redirectTo);
}

export async function bulkDisableSessionsAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `/admin/courses/${courseId}`,
  );

  if (!courseId) {
    redirect("/admin?error=invalid");
  }

  await deleteCourseSessionsAndReservations(courseId);
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  redirect(redirectTo);
}

export async function saveStudentAction(formData: FormData) {
  const id =
    String(formData.get("id") ?? "").trim() || `student-${crypto.randomUUID()}`;
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
