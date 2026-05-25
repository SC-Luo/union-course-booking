"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inferCategoryFromCode, inferCourseTypeFromCode } from "@/lib/course-coding";
import {
  buildSessionDeadline,
  cancelReservationByStaff,
  deleteCourseSessionsAndReservations,
  deleteManagedDocument,
  deleteStudentIdentityDocument,
  getBookingData,
  setDocumentActive,
  updateReservationAttendance,
  upsertCategory,
  upsertCourse,
  upsertCourseOffering,
  upsertCourseSeries,
  upsertEnrollment,
  upsertSession,
  upsertStudent,
  upsertStudentCourseRecord,
  upsertInstructor,
  deleteInstructorIdentityDocument,
  removeStudentCourseEligibility,
  addStudentToSessionRoster,
} from "@/lib/booking-repository";
import type { AttendanceStatus, CourseCategory, CourseOffering, CourseSeries, CourseSession, Student, StudentCourseRecord } from "@/lib/types";

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

function generateCourseCode(courseType: string, categoryId: string, existingCodes: Array<string | undefined>) {
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

function buildSessionId(courseId: string, date: string, startTime: string, topic: string) {
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

function normalizeAdminRedirect(value: FormDataEntryValue | null, fallback: string) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/admin")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

function normalizeStringList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumber(value: FormDataEntryValue | null, fallback?: number) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildManagedId(prefix: string, parts: Array<string | number | undefined>) {
  return `${prefix}-${parts.map((part) => slugify(String(part ?? ""))).filter(Boolean).join("-")}`;
}

export async function updateAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const attendanceStatus = String(formData.get("attendanceStatus") ?? "") as AttendanceStatus;
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `/admin/sessions/${sessionId}/reservations`,
  );

  await updateReservationAttendance(reservationId, attendanceStatus);
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath(`/admin/sessions/${sessionId}/reservations`);
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function cancelReservationByStaffAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId ? `/admin/sessions/${sessionId}/reservations` : "/admin/course-sessions",
  );

  if (reservationId) {
    const result = await cancelReservationByStaff(reservationId);
    revalidatePath("/");
    if (result.ok) {
      revalidatePath(`/courses/${result.courseId}`);
      revalidatePath(`/admin/courses/${result.courseId}`);
      revalidatePath(`/admin/courses/${result.courseId}/sessions`);
      revalidatePath(`/admin/sessions/${result.sessionId}/reservations`);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  if (sessionId) revalidatePath(`/admin/sessions/${sessionId}/reservations`);
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function saveCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = normalizeHexColor(formData.get("color"));

  if (!id || !name) {
    redirect("/admin/categories?error=invalid");
  }

  const existing = (await getBookingData()).categories.find((category) => category.id === id);

  const category: CourseCategory = {
    id,
    code: id,
    name,
    description,
    sortOrder: existing?.sortOrder ?? 0,
    isActive: formData.get("isActive") ? formData.get("isActive") !== "false" : (existing?.isActive ?? true),
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
  revalidatePath("/admin/course-categories");
  redirect("/admin/categories?saved=1");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const data = await getBookingData();
  const hasRelations =
    data.courseSeries.some((series) => series.categoryId === id) ||
    data.courseOfferings.some((offering) => offering.categoryId === id) ||
    data.courses.some((course) => course.categoryId === id);

  if (!id || hasRelations) {
    redirect("/admin/categories?error=category-in-use");
  }

  await deleteManagedDocument("categories", id);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-categories");
  redirect("/admin/categories?saved=1");
}

export async function saveCourseSeriesAction(formData: FormData) {
  const currentId = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim().toUpperCase();
  const courseType = String(formData.get("courseType") ?? "").trim().toUpperCase();
  const now = new Date().toISOString();

  if (!title || !categoryId || !courseType) {
    redirect("/admin/course-masters?error=invalid");
  }

  const data = await getBookingData();
  const existing = currentId ? data.courseSeries.find((series) => series.id === currentId) : undefined;
  const shouldKeepExistingCode = Boolean(
    existing?.code &&
      existing.categoryId === categoryId &&
      existing.courseType === courseType,
  );
  const code = shouldKeepExistingCode
    ? existing?.code
    : generateCourseCode(
        courseType,
        categoryId,
        data.courseSeries
          .filter((series) => series.id !== currentId)
          .map((series) => series.code),
      );
  const id = currentId || buildManagedId("course-master", [categoryId, courseType, code || title]);
  const defaultCapacity = normalizeNumber(formData.get("defaultCapacity"), existing?.defaultCapacity);
  const color = normalizeHexColor(formData.get("color"));

  const series: CourseSeries = {
    ...(existing ?? {}),
    id,
    code,
    title,
    name: String(formData.get("name") ?? title).trim() || title,
    categoryId,
    courseType,
    defaultCourseMode: String(formData.get("defaultCourseMode") ?? existing?.defaultCourseMode ?? "").trim() || undefined,
    defaultCapacity,
    defaultLocation: String(formData.get("defaultLocation") ?? "").trim(),
    defaultInstructorId: String(formData.get("defaultInstructorId") ?? existing?.defaultInstructorId ?? "").trim() || undefined,
    defaultInstructorName: String(formData.get("defaultInstructorName") ?? existing?.defaultInstructorName ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    color: color ?? existing?.color,
    isActive: formData.get("isActive") !== "false",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await upsertCourseSeries(series);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  redirect("/admin/course-masters?saved=1");
}

export async function disableCourseSeriesAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("courseSeries", id, nextActive);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  redirect("/admin/course-masters?saved=1");
}

export async function deleteCourseSeriesAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const data = await getBookingData();
  const hasRelations =
    data.courseOfferings.some((offering) => offering.seriesId === id || offering.courseSeriesId === id || offering.courseMasterId === id) ||
    data.courses.some((course) => course.seriesId === id || course.courseSeriesId === id || course.courseMasterId === id);

  if (!id || hasRelations) {
    redirect("/admin/course-masters?error=in-use");
  }

  await deleteManagedDocument("courseSeries", id);
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  redirect("/admin/course-masters?saved=1");
}

export async function saveCourseOfferingAction(formData: FormData) {
  const currentId = String(formData.get("id") ?? "").trim();
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const year = normalizeNumber(formData.get("year"));
  const term = String(formData.get("term") ?? "").trim();
  const now = new Date().toISOString();

  if (!seriesId || !year || !term) {
    redirect("/admin/course-offerings?error=invalid");
  }

  const data = await getBookingData();
  const series = data.courseSeries.find((item) => item.id === seriesId);
  const existing = currentId ? data.courseOfferings.find((offering) => offering.id === currentId) : undefined;
  const termNumber = normalizeNumber(formData.get("termNumber"), Number(term)) || existing?.termNumber;
  const termLabel = String(formData.get("termLabel") ?? existing?.termLabel ?? (termNumber ? `第${termNumber}期` : `第${term}期`)).trim();
  const id = currentId || buildManagedId("offering", [seriesId, year, term]);
  const title = String(formData.get("title") ?? existing?.title ?? series?.title ?? "").trim();
  const classDisplayName = String(formData.get("classDisplayName") ?? "").trim() || `${title}｜${year}年｜${termLabel}`;
  const legacyCourseId = String(formData.get("legacyCourseId") ?? existing?.legacyCourseId ?? `class-${id}`).trim();
  const capacity = normalizeNumber(formData.get("capacity"), existing?.capacity ?? series?.defaultCapacity);
  const color = normalizeHexColor(formData.get("color"));
  const isActive = formData.get("isActive") !== "false";
  const bookingStatus = String(formData.get("bookingStatus") ?? existing?.bookingStatus ?? (isActive ? "open" : "closed")).trim();

  const offering: CourseOffering = {
    ...(existing ?? {}),
    id,
    seriesId,
    courseSeriesId: seriesId,
    courseMasterId: seriesId,
    legacyCourseId,
    categoryId: String(formData.get("categoryId") ?? series?.categoryId ?? existing?.categoryId ?? "").trim() || undefined,
    code: String(formData.get("code") ?? existing?.code ?? "").trim() || undefined,
    title,
    displayTitle: classDisplayName,
    displayName: classDisplayName,
    shortName: String(formData.get("shortName") ?? existing?.shortName ?? "").trim() || undefined,
    year,
    term,
    termNumber,
    termLabel,
    classIdentifier: String(formData.get("classIdentifier") ?? existing?.classIdentifier ?? `${year}-${term}`).trim(),
    classDisplayName,
    rosterType: String(formData.get("rosterType") ?? existing?.rosterType ?? "fixed").trim(),
    courseType: String(formData.get("courseType") ?? existing?.courseType ?? series?.courseType ?? "").trim() || undefined,
    courseMode: String(formData.get("courseMode") ?? existing?.courseMode ?? series?.defaultCourseMode ?? "").trim() || undefined,
    sourceSheet: String(formData.get("sourceSheet") ?? existing?.sourceSheet ?? "").trim() || undefined,
    location: String(formData.get("location") ?? existing?.location ?? series?.defaultLocation ?? "").trim() || undefined,
    capacity,
    primaryInstructorId: String(formData.get("primaryInstructorId") ?? existing?.primaryInstructorId ?? "").trim() || undefined,
    primaryInstructorName: String(formData.get("primaryInstructorName") ?? existing?.primaryInstructorName ?? "").trim() || undefined,
    assistantInstructorIds: normalizeStringList(formData.get("assistantInstructorIds")),
    assistantInstructorNames: normalizeStringList(formData.get("assistantInstructorNames")),
    bookingStatus,
    bookingOpen: bookingStatus === "open" || bookingStatus === "active",
    status: bookingStatus === "closed" ? "closed" : bookingStatus === "draft" ? "draft" : "open",
    color: color ?? existing?.color ?? series?.color,
    startDate: String(formData.get("startDate") ?? existing?.startDate ?? "").trim() || undefined,
    endDate: String(formData.get("endDate") ?? existing?.endDate ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim(),
    isActive,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await upsertCourseOffering(offering);

  await upsertCourse({
    id: legacyCourseId,
    code: offering.code ?? legacyCourseId,
    courseType: offering.courseType,
    title,
    categoryId: offering.categoryId ?? series?.categoryId ?? "O",
    description: String(formData.get("description") ?? existing?.notes ?? series?.description ?? "").trim(),
    defaultLocation: offering.location ?? series?.defaultLocation ?? "",
    notes: offering.notes ?? "",
    isActive,
    color: offering.color,
    capacityMode: "course",
    totalCapacity: capacity,
    seriesId,
    courseSeriesId: seriesId,
    courseMasterId: seriesId,
    offeringId: id,
    year,
    term,
    termNumber,
    termLabel,
    displayTitle: classDisplayName,
    displayName: classDisplayName,
    shortTitle: offering.shortName,
    shortName: offering.shortName,
    classIdentifier: offering.classIdentifier,
    classDisplayName,
    courseMode: offering.courseMode,
    rosterType: offering.rosterType,
    primaryInstructorId: offering.primaryInstructorId,
    primaryInstructorName: offering.primaryInstructorName,
    assistantInstructorIds: offering.assistantInstructorIds,
    assistantInstructorNames: offering.assistantInstructorNames,
    bookingOpen: offering.bookingOpen,
    status: offering.status,
    createdAt: data.courses.find((course) => course.id === legacyCourseId)?.createdAt ?? now,
    updatedAt: now,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  revalidatePath(`/admin/courses/${legacyCourseId}`);
  redirect("/admin/course-offerings?saved=1");
}

export async function disableCourseOfferingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("courseOfferings", id, nextActive);
  if (legacyCourseId) await setDocumentActive("courses", legacyCourseId, nextActive);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  if (legacyCourseId) revalidatePath(`/admin/courses/${legacyCourseId}`);
  redirect("/admin/course-offerings?saved=1");
}

export async function deleteCourseOfferingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const data = await getBookingData();
  const hasRelations =
    data.enrollments.some((enrollment) => enrollment.offeringId === id || enrollment.courseOfferingId === id || enrollment.courseId === legacyCourseId) ||
    data.students.some((student) => student.offeringId === id || student.classId === legacyCourseId) ||
    data.reservations.some((reservation) => reservation.offeringId === id || reservation.courseId === legacyCourseId) ||
    data.courses.some((course) => course.id === legacyCourseId && course.sessions.length > 0);

  if (!id || hasRelations) {
    redirect("/admin/course-offerings?error=in-use");
  }

  await deleteManagedDocument("courseOfferings", id);
  if (legacyCourseId) await deleteManagedDocument("courses", legacyCourseId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  redirect("/admin/course-offerings?saved=1");
}


export async function saveCourseAction(formData: FormData) {
  const currentId = String(formData.get("id") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), currentId ? `/admin/courses/${currentId}` : "/admin/courses");
  const currentCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? inferCategoryFromCode(currentCode)).trim().toUpperCase();
  const courseType = String(formData.get("courseType") ?? inferCourseTypeFromCode(currentCode) ?? "SF").trim().toUpperCase();
  const color = normalizeHexColor(formData.get("color"));

  if (!title || !categoryId || !courseType) {
    redirect("/admin/courses?error=invalid");
  }

  const data = await getBookingData();
  const existingCourse = currentId ? data.courses.find((course) => course.id === currentId) : undefined;
  const capacityMode = String(formData.get("capacityMode") ?? existingCourse?.capacityMode ?? "course") === "session" ? "session" : "course";
  const parsedTotalCapacity = Number(formData.get("totalCapacity") ?? existingCourse?.totalCapacity ?? 0);
  const totalCapacity = Number.isFinite(parsedTotalCapacity) && parsedTotalCapacity > 0 ? parsedTotalCapacity : undefined;

  const code =
    existingCourse?.code ??
    (currentCode || generateCourseCode(courseType, categoryId, data.courses.map((course) => course.code)));
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
  revalidatePath(redirectTo.split("#")[0] || `/admin/courses/${id}`);
  redirect(redirectTo.includes("?") ? `${redirectTo}&saved=1` : `${redirectTo}?saved=1`);
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
  const id = String(formData.get("id") ?? "").trim() || `session-${crypto.randomUUID()}`;
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);

  if (!courseId || !date || !startTime || !endTime || capacity < 0) {
    redirect(redirectTo || `/admin/courses/${courseId}/sessions?error=invalid`);
  }

  const data = await getBookingData();
  const existingSession = data.courses.flatMap((course) => course.sessions).find((session) => session.id === id);
  const bookedCount = Math.max(Number(formData.get("bookedCount") ?? existingSession?.bookedCount ?? 0), 0);
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
    bookingDeadline: String(formData.get("bookingDeadline") ?? "").trim() || buildSessionDeadline(date),
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
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), courseId ? `/admin/courses/${courseId}` : "/admin/courses");
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

  if (!courseId || !startDate || !endDate || weekdays.length === 0 || !startTime || !endTime || capacity < 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) {
    redirect("/admin/courses?error=invalid");
  }

  const existingKeys = new Set(course.sessions.map((session) => `${session.courseId}|${session.date}|${session.startTime}`));
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
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
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
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function disableSessionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    courseId ? `/admin/courses/${courseId}/sessions` : "/admin",
  );
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("sessions", id, nextActive);
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function bulkDisableSessionsAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    courseId ? `/admin/courses/${courseId}` : "/admin",
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

function normalizeIdLast3(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "").slice(-3);
}

function normalizeRosterText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function splitRosterLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((item) => item.trim());
  return line.split(",").map((item) => item.trim());
}

function getRosterColumnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function getRosterCell(cells: string[], index: number) {
  return index >= 0 ? String(cells[index] ?? "").trim() : "";
}

function buildStudentReturnUrl(classId: string, extra?: string) {
  const suffix = extra ? `&${extra}` : "";
  return `/admin/students?classId=${encodeURIComponent(classId)}${suffix}`;
}

async function resolveRosterContext(classId: string) {
  const data = await getBookingData();
  const course = data.courses.find((item) => item.id === classId);
  const offering = data.courseOfferings.find((item) => item.legacyCourseId === classId || item.id === course?.offeringId);
  const offeringId = offering?.id ?? course?.offeringId ?? classId;
  const seriesId = offering?.seriesId ?? offering?.courseMasterId ?? course?.seriesId ?? course?.courseMasterId ?? `series-${classId}`;
  const courseTitle = offering?.displayTitle ?? course?.displayTitle ?? course?.title ?? "未命名課程";
  return { data, course, offering, offeringId, seriesId, courseTitle };
}

export async function saveStudentAction(formData: FormData) {
  const rawId = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  const seatNumber = Number(formData.get("seatNumber") ?? 0);
  const idNumberLast3 = normalizeIdLast3(formData.get("idNumberLast3"));
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const examGroup = String(formData.get("examGroup") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name || !classId || !seatNumber || idNumberLast3.length !== 3) {
    redirect(buildStudentReturnUrl(classId || "all", "error=invalid"));
  }

  const { data, course, offering, offeringId, seriesId, courseTitle } = await resolveRosterContext(classId);
  const now = new Date().toISOString();
  const matchedStudent = rawId
    ? data.students.find((student) => student.id === rawId)
    : data.students.find(
        (student) =>
          student.name === name &&
          student.idNumberLast3 === idNumberLast3 &&
          (student.offeringId === offeringId || student.classId === classId),
      );
  const id = matchedStudent?.id ?? `student-${crypto.randomUUID()}`;

  const nextStudent: Student = {
    ...(matchedStudent ?? {}),
    id,
    name,
    phone,
    birthday: birthday || null,
    idNumberLast3,
    classId,
    offeringId,
    seriesId,
    courseMasterId: seriesId,
    classTitle: courseTitle,
    classShortTitle: offering?.shortName ?? course?.shortName ?? courseTitle,
    year: offering?.year ?? course?.year,
    term: offering?.term ?? course?.term,
    termLabel: offering?.termLabel ?? course?.termLabel,
    seatNumber,
    examGroup,
    source: matchedStudent?.source ?? "後台手動新增",
    note,
    needsReview: formData.get("needsReview") === "true",
    isActive: formData.get("isActive") !== "false",
    updatedAt: now,
    createdAt: matchedStudent?.createdAt ?? now,
  };

  await upsertStudent(nextStudent);
  await upsertEnrollment({
    id: `enroll-${id}-${offeringId}`,
    studentId: id,
    courseId: classId,
    offeringId,
    courseOfferingId: offeringId,
    seriesId,
    courseMasterId: seriesId,
    seatNumber,
    seatNo: String(seatNumber),
    groupLabel: examGroup,
    source: "manual",
    status: "active",
    joinedAt: now,
    updatedAt: now,
    createdAt: now,
  });

  revalidatePath("/admin/students");
  redirect(buildStudentReturnUrl(classId, "saved=1"));
}

export async function bulkImportStudentsAction(formData: FormData) {
  const classId = String(formData.get("classId") ?? "").trim();
  const rosterText = normalizeRosterText(formData.get("rosterText"));

  if (!classId || !rosterText) {
    redirect(buildStudentReturnUrl(classId || "all", "error=invalid"));
  }

  const { data, course, offering, offeringId, seriesId, courseTitle } = await resolveRosterContext(classId);
  const lines = rosterText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    redirect(buildStudentReturnUrl(classId, "error=invalid"));
  }

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) => /姓名|身分證|後三碼|手機|電話|座號|生日|備註|組別|班別/i.test(cell));
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const nameIndex = hasHeader ? getRosterColumnIndex(headers, ["姓名", "學員", "name"]) : 0;
  const idIndex = hasHeader ? getRosterColumnIndex(headers, ["身分證後三碼", "後三碼", "末三碼", "idNumberLast3", "idLast3"]) : 1;
  const phoneIndex = hasHeader ? getRosterColumnIndex(headers, ["手機", "電話", "phone"]) : 2;
  const birthdayIndex = hasHeader ? getRosterColumnIndex(headers, ["生日", "birthday"]) : 3;
  const seatIndex = hasHeader ? getRosterColumnIndex(headers, ["座號", "seat"]) : 4;
  const groupIndex = hasHeader ? getRosterColumnIndex(headers, ["組別", "班別", "分組", "group"]) : 5;
  const noteIndex = hasHeader ? getRosterColumnIndex(headers, ["備註", "note"]) : 6;

  let importedCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = splitRosterLine(row);
    const name = getRosterCell(cells, nameIndex);
    const idNumberLast3 = normalizeIdLast3(getRosterCell(cells, idIndex));
    const seatNumber = Number(getRosterCell(cells, seatIndex) || importedCount + 1);

    if (!name || idNumberLast3.length !== 3 || !Number.isFinite(seatNumber) || seatNumber <= 0) {
      continue;
    }

    const matchedStudent = data.students.find(
      (student) =>
        student.name === name &&
        student.idNumberLast3 === idNumberLast3 &&
        (student.offeringId === offeringId || student.classId === classId),
    );
    const id = matchedStudent?.id ?? `student-${crypto.randomUUID()}`;
    const examGroup = getRosterCell(cells, groupIndex);

    await upsertStudent({
      ...(matchedStudent ?? {}),
      id,
      name,
      idNumberLast3,
      phone: getRosterCell(cells, phoneIndex),
      birthday: getRosterCell(cells, birthdayIndex) || null,
      classId,
      offeringId,
      seriesId,
      courseMasterId: seriesId,
      classTitle: courseTitle,
      classShortTitle: offering?.shortName ?? course?.shortName ?? courseTitle,
      year: offering?.year ?? course?.year,
      term: offering?.term ?? course?.term,
      termLabel: offering?.termLabel ?? course?.termLabel,
      seatNumber,
      examGroup,
      note: getRosterCell(cells, noteIndex),
      source: "Excel / CSV 批次匯入",
      isActive: true,
      needsReview: false,
      updatedAt: now,
      createdAt: matchedStudent?.createdAt ?? now,
    });

    await upsertEnrollment({
      id: `enroll-${id}-${offeringId}`,
      studentId: id,
      courseId: classId,
      offeringId,
      courseOfferingId: offeringId,
      seriesId,
      courseMasterId: seriesId,
      seatNumber,
      seatNo: String(seatNumber),
      groupLabel: examGroup,
      source: "excel_import",
      status: "active",
      joinedAt: matchedStudent ? undefined : now,
      updatedAt: now,
      createdAt: matchedStudent?.createdAt ?? now,
    });

    importedCount += 1;
  }

  revalidatePath("/admin/students");
  redirect(buildStudentReturnUrl(classId, `saved=1&imported=${importedCount}`));
}

export async function disableStudentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  await setDocumentActive("students", id, false);
  revalidatePath("/admin/students");
  redirect(`/admin/students?classId=${encodeURIComponent(classId)}&saved=1`);
}


function normalizeEligibilityStatus(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "上課中";
  if (["可上課", "上課中", "是", "Y", "YES", "否", "N", "NO"].includes(raw)) return "上課中";
  if (["已結訓", "已完成", "completed", "已通過", "通過", "passed"].includes(raw)) return "已結訓";
  if (["未加入", "取消", "退出", "withdrawn"].includes(raw)) return "未加入";
  return raw;
}

function isEligibilityBookable(status: string) {
  return !["已通過", "通過", "停用", "退訓", "取消資格", "不可預約", "passed", "inactive", "withdrawn"].some((word) => status.toLowerCase().includes(word.toLowerCase()));
}


function appendAdminQuery(url: string, extra: string) {
  const [base, hash = ""] = url.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${extra}${hash ? `#${hash}` : ""}`;
}

function buildStudentsReturn(params: Record<string, string | number | undefined>, extra?: string) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== "" && String(value) !== "all") query.set(key, String(value));
  });
  if (extra) {
    for (const part of extra.split("&")) {
      const [key, value = ""] = part.split("=");
      if (key) query.set(key, value);
    }
  }
  const qs = query.toString();
  return `/admin/students${qs ? `?${qs}` : ""}`;
}

async function resolveEligibilityContext(seriesId: string, yearValue: string, targetOfferingId?: string) {
  const data = await getBookingData();
  const directSeries = data.courseSeries.find((item) => item.id === seriesId || (item as CourseSeries & { courseMasterId?: string }).courseMasterId === seriesId);
  const relatedOffering = data.courseOfferings.find(
    (item) => item.seriesId === seriesId || item.courseMasterId === seriesId || item.courseSeriesId === seriesId || item.id === seriesId || item.legacyCourseId === seriesId,
  );
  const targetOffering = targetOfferingId
    ? data.courseOfferings.find((item) => item.id === targetOfferingId || item.legacyCourseId === targetOfferingId)
    : undefined;
  const fallbackSeriesId = relatedOffering?.seriesId || relatedOffering?.courseMasterId || relatedOffering?.courseSeriesId || seriesId;
  const series: CourseSeries | undefined = directSeries ?? (relatedOffering
    ? {
        id: fallbackSeriesId,
        title: relatedOffering.title,
        categoryId: relatedOffering.categoryId ?? "",
        courseType: relatedOffering.courseType,
        color: relatedOffering.color,
        isActive: relatedOffering.isActive ?? true,
      }
    : undefined);
  const year = Number(yearValue || targetOffering?.year || relatedOffering?.year || new Date().getFullYear() - 1911);

  if (!seriesId || !series || !Number.isFinite(year)) {
    return { data, series: undefined, targetOffering, year: undefined };
  }

  return { data, series, targetOffering, year };
}

function getOrCreateStudentIdentity(data: Awaited<ReturnType<typeof getBookingData>>, input: {
  id?: string;
  name: string;
  idNumberLast3: string;
  phone?: string;
  birthday?: string;
  note?: string;
}) {
  const now = new Date().toISOString();
  const existing = input.id
    ? data.students.find((student) => student.id === input.id)
    : data.students.find((student) => student.name === input.name && student.idNumberLast3 === input.idNumberLast3);

  const id = existing?.id ?? `student-${crypto.randomUUID()}`;
  const student: Student = {
    ...(existing ?? {}),
    id,
    name: input.name,
    idNumberLast3: input.idNumberLast3,
    phone: input.phone ?? existing?.phone ?? "",
    birthday: input.birthday || existing?.birthday || null,
    note: input.note ?? existing?.note,
    source: existing?.source ?? "學員總表",
    isActive: existing?.isActive ?? true,
    needsReview: existing?.needsReview ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return { existing, student };
}

export async function saveStudentEligibilityAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const idNumberLast3 = normalizeIdLast3(formData.get("idNumberLast3"));
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(formData.get("eligibilityStatus"));
  const targetOfferingId = String(formData.get("targetOfferingId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const { data, series, targetOffering, year } = await resolveEligibilityContext(seriesId, yearValue, targetOfferingId);
  if (!name || idNumberLast3.length !== 3 || !series || !year) {
    redirect(buildStudentsReturn({ seriesId, year: yearValue }, "error=invalid"));
  }

  const now = new Date().toISOString();
  const { student } = getOrCreateStudentIdentity(data, { name, idNumberLast3, phone, birthday, note });
  await upsertStudent(student);

  const record: StudentCourseRecord = {
    id: `elig-${student.id}-${series.id}-${year}`,
    studentId: student.id,
    seriesId: series.id,
    courseMasterId: series.id,
    offeringId: targetOffering?.id,
    sourceColumn: "課程資格",
    rawValue: eligibilityStatus,
    normalizedValue: eligibilityStatus,
    recordType: "roster",
    sourceRocYear: year,
    year,
    term: targetOffering?.term,
    termLabel: targetOffering?.termLabel,
    classDisplayName: targetOffering?.displayTitle ?? targetOffering?.title,
    note,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await upsertStudentCourseRecord(record);
  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(buildStudentsReturn({ seriesId: series.id, year }, "saved=1"));
}

export async function bulkImportStudentEligibilitiesAction(formData: FormData) {
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const rosterText = normalizeRosterText(formData.get("rosterText"));
  const { data, series, year } = await resolveEligibilityContext(seriesId, yearValue);

  if (!series || !year || !rosterText) {
    redirect(buildStudentsReturn({ seriesId, year: yearValue }, "error=invalid"));
  }

  const lines = rosterText.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) redirect(buildStudentsReturn({ seriesId, year }, "error=invalid"));

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) => /姓名|身分證|後三碼|手機|電話|生日|資格|美容丙級|檢定|通過|備註/i.test(cell));
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;

  const nameIndex = hasHeader ? getRosterColumnIndex(headers, ["姓名", "學員", "name"]) : 0;
  const idIndex = hasHeader ? getRosterColumnIndex(headers, ["身分證後三碼", "後三碼", "末三碼", "idNumberLast3", "idLast3"]) : 1;
  const phoneIndex = hasHeader ? getRosterColumnIndex(headers, ["手機", "電話", "phone"]) : 2;
  const birthdayIndex = hasHeader ? getRosterColumnIndex(headers, ["生日", "birthday"]) : 3;
  const statusIndex = hasHeader ? getRosterColumnIndex(headers, ["資格狀態", "上課資格", "課程資格", "美容丙級", "狀態", "是否通過", "通過"]) : 4;
  const examTermIndex = hasHeader ? getRosterColumnIndex(headers, ["檢定梯次", "梯次", "年度課程", "期別"]) : 5;
  const noteIndex = hasHeader ? getRosterColumnIndex(headers, ["備註", "note"]) : 6;

  let importedCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = splitRosterLine(row);
    const name = getRosterCell(cells, nameIndex);
    const idNumberLast3 = normalizeIdLast3(getRosterCell(cells, idIndex));
    if (!name || idNumberLast3.length !== 3) continue;

    const phone = getRosterCell(cells, phoneIndex);
    const birthday = getRosterCell(cells, birthdayIndex);
    const rawStatus = getRosterCell(cells, statusIndex) || "可上課";
    const eligibilityStatus = normalizeEligibilityStatus(rawStatus);
    const examTerm = getRosterCell(cells, examTermIndex);
    const targetOffering = examTerm
      ? data.courseOfferings.find((offering) =>
          (offering.seriesId === series.id || offering.courseMasterId === series.id) &&
          String(offering.year) === String(year) &&
          [offering.id, offering.legacyCourseId, offering.termLabel, String(offering.term ?? ""), offering.shortName, offering.code].some((value) => String(value ?? "").includes(examTerm)),
        )
      : undefined;

    const { student } = getOrCreateStudentIdentity(data, {
      name,
      idNumberLast3,
      phone,
      birthday,
      note: getRosterCell(cells, noteIndex),
    });

    await upsertStudent(student);
    await upsertStudentCourseRecord({
      id: `elig-${student.id}-${series.id}-${year}`,
      studentId: student.id,
      seriesId: series.id,
      courseMasterId: series.id,
      offeringId: targetOffering?.id,
      sourceColumn: "課程資格",
      rawValue: eligibilityStatus,
      normalizedValue: eligibilityStatus,
      recordType: "roster",
      sourceRocYear: year,
      year,
      term: targetOffering?.term,
      termLabel: targetOffering?.termLabel,
      classDisplayName: targetOffering?.displayTitle ?? targetOffering?.title,
      note: getRosterCell(cells, noteIndex),
      importedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    importedCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(buildStudentsReturn({ seriesId: series.id, year }, `saved=1&imported=${importedCount}`));
}

export async function saveStudentIdentityAction(formData: FormData) {
  const rawId = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const idNumberLast3 = normalizeIdLast3(formData.get("idNumberLast3"));
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const memberNo = String(formData.get("memberNo") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name || idNumberLast3.length !== 3) {
    redirect("/admin/students?mode=students&error=invalid");
  }

  const data = await getBookingData();
  const now = new Date().toISOString();
  const existing = rawId
    ? data.students.find((student) => student.id === rawId)
    : data.students.find((student) => student.name === name && student.idNumberLast3 === idNumberLast3);

  await upsertStudent({
    ...(existing ?? {}),
    id: existing?.id ?? `student-${crypto.randomUUID()}`,
    name,
    idNumberLast3,
    phone,
    birthday: birthday || null,
    memberNo: memberNo || existing?.memberNo,
    note,
    source: existing?.source ?? "學員總表手動建立",
    isActive: formData.get("isActive") !== "false",
    needsReview: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  revalidatePath("/admin/students");
  redirect("/admin/students?mode=students&saved=1");
}

export async function updateStudentIdentityStatusAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), "/admin/students?mode=students#student-list");
  if (!studentId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const existing = data.students.find((student) => student.id === studentId);
  if (!existing) {
    redirect(appendAdminQuery(redirectTo, "error=not-found"));
  }

  const now = new Date().toISOString();
  await upsertStudent({
    ...existing,
    isActive: status !== "inactive",
    needsReview: status === "review",
    updatedAt: now,
  });

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function hardDeleteStudentIdentityAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), "/admin/students?mode=students#student-list");
  if (!studentId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  await deleteStudentIdentityDocument(studentId);
  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function deleteStudentIdentityAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), "/admin/students?mode=students#student-list");
  if (!studentId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  await setDocumentActive("students", studentId, false);
  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function deleteSelectedStudentIdentitiesAction(formData: FormData) {
  const studentIds = formData.getAll("studentIds").map((value) => String(value ?? "").trim()).filter(Boolean);
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), "/admin/students?mode=students#student-list");
  if (studentIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  for (const studentId of studentIds) {
    await setDocumentActive("students", studentId, false);
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, `saved=1&imported=${studentIds.length}`));
}

export async function bulkImportStudentIdentitiesAction(formData: FormData) {
  const rosterText = normalizeRosterText(formData.get("rosterText"));
  if (!rosterText) redirect("/admin/students?mode=students&error=invalid");

  const data = await getBookingData();
  const lines = rosterText.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) redirect("/admin/students?mode=students&error=invalid");

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) => /姓名|學員|身分證|後三碼|末三碼|手機|電話|生日|會員|備註/i.test(cell));
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const nameIndex = hasHeader ? getRosterColumnIndex(headers, ["姓名", "學員", "name"]) : 0;
  const idIndex = hasHeader ? getRosterColumnIndex(headers, ["身分證後三碼", "後三碼", "末三碼", "idNumberLast3", "idLast3"]) : 1;
  const phoneIndex = hasHeader ? getRosterColumnIndex(headers, ["手機", "電話", "phone"]) : 2;
  const birthdayIndex = hasHeader ? getRosterColumnIndex(headers, ["生日", "birthday"]) : 3;
  const memberIndex = hasHeader ? getRosterColumnIndex(headers, ["會員編號", "會員", "memberNo", "member"]) : 4;
  const noteIndex = hasHeader ? getRosterColumnIndex(headers, ["備註", "note"]) : 5;

  let importedCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = splitRosterLine(row);
    const name = getRosterCell(cells, nameIndex);
    const idNumberLast3 = normalizeIdLast3(getRosterCell(cells, idIndex));
    if (!name || idNumberLast3.length !== 3) continue;

    const existing = data.students.find((student) => student.name === name && student.idNumberLast3 === idNumberLast3);
    await upsertStudent({
      ...(existing ?? {}),
      id: existing?.id ?? `student-${crypto.randomUUID()}`,
      name,
      idNumberLast3,
      phone: getRosterCell(cells, phoneIndex) || existing?.phone || "",
      birthday: getRosterCell(cells, birthdayIndex) || existing?.birthday || null,
      memberNo: getRosterCell(cells, memberIndex) || existing?.memberNo,
      note: getRosterCell(cells, noteIndex) || existing?.note,
      source: existing?.source ?? "Excel / CSV 學員總表匯入",
      isActive: true,
      needsReview: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    importedCount += 1;
  }

  revalidatePath("/admin/students");
  redirect(`/admin/students?mode=students&saved=1&imported=${importedCount}`);
}

export async function assignStudentsToCourseEligibilityAction(formData: FormData) {
  const studentIds = formData.getAll("studentIds").map((value) => String(value ?? "").trim()).filter(Boolean);
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(formData.get("eligibilityStatus"));
  const targetOfferingId = String(formData.get("targetOfferingId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(formData.get("redirectTo"), buildStudentsReturn({ mode: "eligibility", seriesId, year: yearValue }));

  const { data, series, targetOffering, year } = await resolveEligibilityContext(seriesId, yearValue, targetOfferingId);
  if (!series || !year || studentIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const now = new Date().toISOString();
  const isClearingEligibility = eligibilityStatus === "未加入";
  let assignedCount = 0;

  for (const studentId of studentIds) {
    const student = data.students.find((item) => item.id === studentId);
    if (!student) continue;

    const recordId = `elig-${student.id}-${series.id}-${year}`;
    const existingRecord = data.studentCourseRecords?.find(
      (record) =>
        record.id === recordId ||
        (record.studentId === student.id &&
          (record.seriesId === series.id || record.courseMasterId === series.id) &&
          String(record.year ?? record.sourceRocYear ?? "") === String(year)),
    );

    if (targetOffering) {
      const enrollmentId = `enroll-${student.id}-${targetOffering.id}`;
      const existingEnrollment = data.enrollments?.find((item) => item.id === enrollmentId);
      const enrollmentStatus = isClearingEligibility
        ? "withdrawn"
        : eligibilityStatus === "已結訓"
          ? "completed"
          : "active";

      await upsertEnrollment({
        ...(existingEnrollment ?? {}),
        id: enrollmentId,
        studentId: student.id,
        offeringId: targetOffering.id,
        courseOfferingId: targetOffering.id,
        seriesId: series.id,
        courseMasterId: series.id,
        enrollmentType: "roster",
        status: enrollmentStatus,
        joinedAt: existingEnrollment?.joinedAt ?? (isClearingEligibility ? undefined : now),
        leftAt: isClearingEligibility ? now : existingEnrollment?.leftAt,
        year,
        term: targetOffering.term,
        termLabel: targetOffering.termLabel,
        classDisplayName: targetOffering.displayTitle ?? targetOffering.displayName ?? targetOffering.title,
        note,
        createdAt: existingEnrollment?.createdAt ?? now,
        updatedAt: now,
      });
    } else if (isClearingEligibility) {
      if (!existingRecord) continue;
      await removeStudentCourseEligibility(student.id, series.id, year);
      assignedCount += 1;
      continue;
    }

    await upsertStudentCourseRecord({
      ...(existingRecord ?? {}),
      id: existingRecord?.id ?? recordId,
      studentId: student.id,
      seriesId: series.id,
      courseMasterId: series.id,
      offeringId: targetOffering?.id,
      sourceColumn: "課程狀態",
      rawValue: eligibilityStatus,
      normalizedValue: eligibilityStatus,
      recordType: "roster",
      sourceRocYear: year,
      year,
      term: targetOffering?.term,
      termLabel: targetOffering?.termLabel,
      classDisplayName: targetOffering?.displayTitle ?? targetOffering?.displayName ?? targetOffering?.title,
      note,
      importedAt: existingRecord?.importedAt ?? now,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    });
    assignedCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  // 成功時只 revalidate，不 redirect，降低後台點選狀態後畫面跳動。
}

export async function bulkUpdateStudentCourseEligibilityAction(formData: FormData) {
  const recordIds = formData.getAll("recordIds").map((value) => String(value ?? "").trim()).filter(Boolean);
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(formData.get("eligibilityStatus"));
  const targetOfferingId = String(formData.get("targetOfferingId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    buildStudentsReturn({ mode: "eligibility", seriesId, year: yearValue }) + "#qualification-bulk",
  );

  if (recordIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const targetOffering = targetOfferingId
    ? data.courseOfferings.find((item) => item.id === targetOfferingId || item.legacyCourseId === targetOfferingId)
    : undefined;
  const year = Number(yearValue || targetOffering?.year || "");
  let updatedCount = 0;

  for (const recordId of recordIds) {
    const existing = data.studentCourseRecords.find((record) => record.id === recordId);
    if (!existing) continue;

    const isClearingEligibility = eligibilityStatus === "未加入";
    if (isClearingEligibility) {
      const removeSeriesId = existing.seriesId || existing.courseMasterId || seriesId;
      const removeYear = existing.year ?? existing.sourceRocYear ?? yearValue;
      if (removeSeriesId && removeYear) {
        await removeStudentCourseEligibility(existing.studentId, removeSeriesId, removeYear);
        updatedCount += 1;
      }
      continue;
    }

    await upsertStudentCourseRecord({
      ...existing,
      offeringId: targetOffering?.id ?? existing.offeringId,
      rawValue: eligibilityStatus,
      normalizedValue: eligibilityStatus,
      year: Number.isFinite(year) ? year : existing.year,
      sourceRocYear: Number.isFinite(year) ? year : existing.sourceRocYear,
      term: targetOffering ? targetOffering.term : existing.term,
      termLabel: targetOffering ? targetOffering.termLabel : existing.termLabel,
      classDisplayName: targetOffering ? (targetOffering.displayTitle ?? targetOffering.title) : existing.classDisplayName,
      note: note || existing.note,
      updatedAt: new Date().toISOString(),
    });
    updatedCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, `saved=1&imported=${updatedCount}`));
}

export async function updateStudentCourseEligibilityAction(formData: FormData) {
  const recordId = String(formData.get("recordId") ?? "").trim();
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(formData.get("eligibilityStatus"));
  const targetOfferingId = String(formData.get("targetOfferingId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const data = await getBookingData();
  const existing = data.studentCourseRecords.find((record) => record.id === recordId);
  const targetOffering = targetOfferingId ? data.courseOfferings.find((item) => item.id === targetOfferingId) : undefined;

  if (!existing) {
    redirect(buildStudentsReturn({ mode: "eligibility", seriesId, year: yearValue }, "error=invalid"));
  }

  const year = Number(yearValue || existing.year || existing.sourceRocYear || targetOffering?.year || "");
  const isClearingEligibility = eligibilityStatus === "未加入";
  if (isClearingEligibility) {
    const removeSeriesId = existing.seriesId || existing.courseMasterId || seriesId;
    const removeYear = existing.year ?? existing.sourceRocYear ?? yearValue;
    if (removeSeriesId && removeYear) {
      await removeStudentCourseEligibility(existing.studentId, removeSeriesId, removeYear);
    }
    revalidatePath("/");
    revalidatePath("/admin/students");
    redirect(buildStudentsReturn({ mode: "eligibility", seriesId: existing.seriesId, year: year || existing.year }, "saved=1"));
  }

  await upsertStudentCourseRecord({
    ...existing,
    offeringId: targetOffering?.id,
    rawValue: eligibilityStatus,
    normalizedValue: eligibilityStatus,
    year: Number.isFinite(year) ? year : existing.year,
    sourceRocYear: Number.isFinite(year) ? year : existing.sourceRocYear,
    term: targetOffering?.term,
    termLabel: targetOffering?.termLabel,
    classDisplayName: targetOffering?.displayTitle ?? targetOffering?.title,
    note,
    updatedAt: new Date().toISOString(),
  });

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(buildStudentsReturn({ mode: "eligibility", seriesId: existing.seriesId, year: year || existing.year }, "saved=1"));
}


export async function addStudentToSessionRosterAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `/admin/sessions/${sessionId}/reservations#attendance-list`,
  );

  if (!studentId || !courseId || !sessionId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const result = await addStudentToSessionRoster(studentId, courseId, sessionId);
  revalidatePath("/");
  revalidatePath("/admin/students");
  revalidatePath("/admin/course-sessions");
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  revalidatePath(`/admin/sessions/${sessionId}/reservations`);

  if (!result.ok) {
    redirect(appendAdminQuery(redirectTo, `error=${result.reason}`));
  }

  redirect(appendAdminQuery(redirectTo, "saved=1"));
}


export async function saveInstructorIdentityAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const specialties = formData
    .getAll("specialties")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();

  if (!name) {
    redirect(buildStudentsReturn({ mode: "instructors" }, "error=invalid"));
  }

  const data = await getBookingData();
  const now = new Date().toISOString();
  const existing = data.instructors?.find(
    (item) =>
      item.name === name &&
      (phone ? item.phone === phone : true),
  );
  const id = existing?.id ?? `instructor-${crypto.randomUUID()}`;

  await upsertInstructor({
    ...(existing ?? {}),
    id,
    name,
    phone,
    specialties,
    note,
    source: existing?.source ?? "後台手動建立",
    isActive: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  revalidatePath("/admin/students");
  redirect(buildStudentsReturn({ mode: "instructors" }, "saved=1"));
}

export async function deleteInstructorIdentityAction(formData: FormData) {
  const instructorId = String(formData.get("instructorId") ?? "").trim();

  if (!instructorId) {
    redirect(buildStudentsReturn({ mode: "instructors" }, "error=invalid"));
  }

  await deleteInstructorIdentityDocument(instructorId);
  revalidatePath("/admin/students");
  redirect(buildStudentsReturn({ mode: "instructors" }, "saved=1"));
}
