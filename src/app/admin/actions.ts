"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  inferCategoryFromCode,
  inferCourseTypeFromCode,
} from "@/lib/course-coding";
import { syncGoogleSheets } from "@/lib/google-sheets-sync";
import {
  buildSessionDeadline,
  cancelReservationByStaff,
  deleteCourseSessionsAndReservations,
  deleteSessionsByIds,
  deleteManagedDocument,
  deleteStudentIdentityDocument,
  getBookingData,
  setDocumentActive,
  updateReservationAttendance,
  updateReservationAttendanceBySessionStudent,
  updateReservationLessonNotes,
  markSessionReservationsAttended,
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
  ensureSessionRosterReservation,
} from "@/lib/booking-repository";
import type {
  AttendanceStatus,
  CourseCategory,
  CourseMode,
  CourseOffering,
  CourseSeries,
  CourseSession,
  Student,
  StudentCourseRecord,
  Instructor,
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function encodePathSegment(segment: string) {
  if (!segment) return segment;
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function encodeRouteSegment(segment: string) {
  return encodePathSegment(segment)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function buildAdminSessionReservationsPath(sessionId: string) {
  const safeSessionId = encodeRouteSegment(sessionId);
  return safeSessionId
    ? `/admin/sessions/${safeSessionId}/reservations`
    : "/admin/course-sessions";
}

function encodeQueryString(query: string) {
  if (!query) return "";
  return query
    .split("&")
    .map((pair) => {
      const [key, ...rest] = pair.split("=");
      const value = rest.join("=");
      const safeKey = encodePathSegment(key);
      const safeValue = value ? encodePathSegment(value) : "";
      return value ? `${safeKey}=${safeValue}` : safeKey;
    })
    .join("&");
}

function safeRedirectPath(
  path: string | null | undefined,
  fallback = "/admin",
) {
  const raw = String(path ?? "").trim();

  if (!raw || !raw.startsWith("/admin") || raw.startsWith("//")) {
    return fallback;
  }

  const hashIndex = raw.indexOf("#");
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : "";

  const queryIndex = beforeHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";

  const safePathname = pathname.split("/").map(encodePathSegment).join("/");
  const safeQuery = query ? `?${encodeQueryString(query)}` : "";
  const safeHash = hash ? `#${encodePathSegment(hash)}` : "";

  return `${safePathname}${safeQuery}${safeHash}`;
}

function normalizeAdminRedirect(
  value: FormDataEntryValue | null,
  fallback: string,
) {
  return safeRedirectPath(String(value ?? "").trim(), fallback);
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

function buildManagedId(
  prefix: string,
  parts: Array<string | number | undefined>,
) {
  return `${prefix}-${parts
    .map((part) => slugify(String(part ?? "")))
    .filter(Boolean)
    .join("-")}`;
}

function normalizeCourseMode(
  value: FormDataEntryValue | string | null | undefined,
  fallback?: string,
): CourseMode | undefined {
  const raw = String(value ?? fallback ?? "").trim();
  if (!raw) return undefined;

  if (raw === "roster_fixed" || raw === "fixed_roster_exam") {
    return "fixed_roster";
  }

  return raw as CourseMode;
}

function inferRosterTypeFromCourseMode(courseMode: CourseMode | undefined) {
  return courseMode === "booking_flexible" ? "booking" : "fixed";
}

function computeLeaveHoursFromTimeRange(start?: string, end?: string) {
  const parse = (value?: string) => {
    const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return undefined;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
    return hour * 60 + minute;
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes)
    return undefined;
  return Math.max(0.5, Math.round(((endMinutes - startMinutes) / 60) * 2) / 2);
}

export async function syncGoogleSheetsAction(formData: FormData) {
  const mode = String(formData.get("mode") ?? "all");

  if (mode !== "all") {
    redirect("/admin/exports?googleSheetsSync=failed");
  }

  const result = await syncGoogleSheets("all");

  if (!result.ok) {
    const status =
      result.reason === "not-configured" ? "not-configured" : "failed";
    redirect(`/admin/exports?googleSheetsSync=${status}`);
  }

  revalidatePath("/admin/exports");
  redirect("/admin/exports?googleSheetsSync=success");
}

export async function updateAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const attendanceStatus = String(
    formData.get("attendanceStatus") ?? "",
  ) as AttendanceStatus;
  const leaveHoursRaw = Number(formData.get("leaveHours") ?? 0);
  const leaveHours =
    Number.isFinite(leaveHoursRaw) && leaveHoursRaw > 0
      ? leaveHoursRaw
      : undefined;
  const leaveStartTime =
    String(formData.get("leaveStartTime") ?? "").trim() || undefined;
  const leaveEndTime =
    String(formData.get("leaveEndTime") ?? "").trim() || undefined;
  const lateTime = String(formData.get("lateTime") ?? "").trim() || undefined;
  const effectiveLeaveHours =
    attendanceStatus === "leave"
      ? (computeLeaveHoursFromTimeRange(leaveStartTime, leaveEndTime) ??
        leaveHours)
      : leaveHours;
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    buildAdminSessionReservationsPath(sessionId),
  );

  await updateReservationAttendance(reservationId, attendanceStatus, {
    leaveHours: effectiveLeaveHours,
    leaveStartTime,
    leaveEndTime,
    lateTime,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function updateRosterAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const attendanceStatus = String(
    formData.get("attendanceStatus") ?? "",
  ) as AttendanceStatus;
  const leaveHoursRaw = Number(formData.get("leaveHours") ?? 0);
  const leaveHours =
    Number.isFinite(leaveHoursRaw) && leaveHoursRaw > 0
      ? leaveHoursRaw
      : undefined;
  const leaveStartTime =
    String(formData.get("leaveStartTime") ?? "").trim() || undefined;
  const leaveEndTime =
    String(formData.get("leaveEndTime") ?? "").trim() || undefined;
  const lateTime = String(formData.get("lateTime") ?? "").trim() || undefined;
  const effectiveLeaveHours =
    attendanceStatus === "leave"
      ? (computeLeaveHoursFromTimeRange(leaveStartTime, leaveEndTime) ??
        leaveHours)
      : leaveHours;
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    buildAdminSessionReservationsPath(sessionId),
  );

  let targetReservationId = reservationId.startsWith("roster-")
    ? ""
    : reservationId;

  if (!targetReservationId && studentId && courseId && sessionId) {
    const data = await getBookingData();
    const existing = (data.reservations ?? []).find(
      (reservation) =>
        reservation.sessionId === sessionId &&
        reservation.studentId === studentId &&
        reservation.status === "booked",
    );

    if (existing) {
      targetReservationId = existing.id;
    } else {
      const result = await ensureSessionRosterReservation(
        studentId,
        courseId,
        sessionId,
      );
      if (result.ok) {
        targetReservationId = result.reservation.id;
      } else {
        const refreshed = await getBookingData();
        const created = (refreshed.reservations ?? []).find(
          (reservation) =>
            reservation.sessionId === sessionId &&
            reservation.studentId === studentId &&
            reservation.status === "booked",
        );
        if (created) targetReservationId = created.id;
      }
    }
  }

  if (targetReservationId) {
    await updateReservationAttendanceBySessionStudent(
      targetReservationId,
      sessionId,
      studentId,
      attendanceStatus,
      {
        leaveHours: effectiveLeaveHours,
        leaveStartTime,
        leaveEndTime,
        lateTime,
      },
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function bookRosterStudentByStaffAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId
      ? `${buildAdminSessionReservationsPath(sessionId)}#attendance-list`
      : "/admin/course-sessions",
  );

  if (!studentId || !courseId || !sessionId) {
    redirect(appendAdminQuery(redirectTo, "rosterBooking=invalid"));
  }

  const data = await getBookingData();
  const course = (data.courses ?? []).find(
    (item) => item.id === courseId || item.offeringId === courseId,
  );
  const session = course?.sessions?.find((item) => item.id === sessionId);

  if (!course || !session) {
    redirect(appendAdminQuery(redirectTo, "rosterBooking=invalid"));
  }

  const existing = (data.reservations ?? []).find(
    (reservation) =>
      reservation.sessionId === session.id &&
      reservation.studentId === studentId &&
      reservation.status === "booked",
  );

  if (!existing) {
    const bookedCount = (data.reservations ?? []).filter(
      (reservation) =>
        reservation.sessionId === session.id && reservation.status === "booked",
    ).length;
    const capacity = Number(session.capacity ?? 0);

    if (capacity > 0 && bookedCount >= capacity) {
      redirect(appendAdminQuery(redirectTo, "rosterBooking=full"));
    }
  }

  const result = await ensureSessionRosterReservation(
    studentId,
    course.id,
    session.id,
  );

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath("/admin/course-sessions");
  revalidatePath(`/admin/courses/${course.id}/sessions`);
  revalidatePath(buildAdminSessionReservationsPath(session.id));
  revalidatePath(redirectTo.split("#")[0] || "/admin");

  if (!result.ok) {
    redirect(appendAdminQuery(redirectTo, `rosterBooking=${result.reason}`));
  }

  redirect(appendAdminQuery(redirectTo, "rosterBooking=success"));
}

export async function markAllSessionStudentsAttendedAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId
      ? `${buildAdminSessionReservationsPath(sessionId)}#attendance-list`
      : "/admin/course-sessions",
  );

  if (!sessionId || !courseId) {
    redirect(redirectTo);
  }

  const data = await getBookingData();
  const course = (data.courses ?? []).find(
    (item) => item.id === courseId || item.offeringId === courseId,
  );
  const session = course?.sessions?.find((item) => item.id === sessionId);

  if (!course || !session) {
    redirect(redirectTo);
  }

  const offeringCandidates = new Set(
    [course.id, course.offeringId, session.offeringId]
      .filter(Boolean)
      .map(String),
  );
  const seriesCandidates = new Set(
    [
      course.seriesId,
      course.courseMasterId,
      course.courseSeriesId,
      session.seriesId,
    ]
      .filter(Boolean)
      .map(String),
  );

  const rosterStudentIds = (data.enrollments ?? [])
    .filter(
      (enrollment) =>
        !["cancelled", "inactive", "withdrawn", "deleted"].includes(
          String(enrollment.status ?? "active"),
        ),
    )
    .filter((enrollment) => {
      const enrollmentOfferingIds = [
        enrollment.offeringId,
        enrollment.courseOfferingId,
        enrollment.courseId,
      ]
        .filter(Boolean)
        .map(String);

      if (enrollmentOfferingIds.length > 0) {
        return enrollmentOfferingIds.some((id) => offeringCandidates.has(id));
      }

      const enrollmentSeriesIds = [
        enrollment.seriesId,
        enrollment.courseMasterId,
      ]
        .filter(Boolean)
        .map(String);

      return enrollmentSeriesIds.some((id) => seriesCandidates.has(id));
    })
    .map((enrollment) => String(enrollment.studentId ?? ""))
    .filter(Boolean);

  for (const studentId of Array.from(new Set(rosterStudentIds))) {
    await ensureSessionRosterReservation(studentId, course.id, session.id);
  }

  await markSessionReservationsAttended(session.id);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  revalidatePath("/admin/course-sessions");
  revalidatePath(`/admin/courses/${course.id}/sessions`);
  revalidatePath(buildAdminSessionReservationsPath(session.id));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function cancelReservationByStaffAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId
      ? buildAdminSessionReservationsPath(sessionId)
      : "/admin/course-sessions",
  );

  if (reservationId) {
    const result = await cancelReservationByStaff(reservationId);
    revalidatePath("/");
    if (result.ok) {
      revalidatePath(`/courses/${result.courseId}`);
      revalidatePath(`/admin/courses/${result.courseId}`);
      revalidatePath(`/admin/courses/${result.courseId}/sessions`);
      revalidatePath(buildAdminSessionReservationsPath(result.sessionId));
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function saveReservationLessonNotesAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId
      ? buildAdminSessionReservationsPath(sessionId)
      : "/admin/course-sessions",
  );

  if (!reservationId) {
    redirect(redirectTo);
  }

  const update: { homework?: string; note?: string } = {};
  if (formData.has("homework"))
    update.homework = String(formData.get("homework") ?? "").trim();
  if (formData.has("note"))
    update.note = String(formData.get("note") ?? "").trim();

  await updateReservationLessonNotes(reservationId, update);

  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}

export async function saveReservationLessonNotesInlineAction(
  formData: FormData,
) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();

  if (!reservationId) {
    return { ok: false as const, reason: "missing-reservation-id" as const };
  }

  const update: { homework?: string; note?: string } = {};
  if (formData.has("homework"))
    update.homework = String(formData.get("homework") ?? "").trim();
  if (formData.has("note"))
    update.note = String(formData.get("note") ?? "").trim();

  await updateReservationLessonNotes(reservationId, update);

  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  return { ok: true as const, savedAt: new Date().toISOString() };
}

const SESSION_JOURNAL_INLINE_FIELDS = new Set([
  "teachingContent",
  "teacherNote",
  "assistantNote",
  "adminNote",
  "abnormalStatus",
  "followUpNote",
]);

export async function saveSessionJournalInlineAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();

  if (!sessionId) {
    return { ok: false as const, reason: "missing-session-id" as const };
  }
  if (!SESSION_JOURNAL_INLINE_FIELDS.has(field)) {
    return { ok: false as const, reason: "invalid-field" as const };
  }

  const data = await getBookingData();
  const session = data.courses
    .flatMap((course) => course.sessions ?? [])
    .find((item) => item.id === sessionId);
  if (!session) {
    return { ok: false as const, reason: "session-not-found" as const };
  }

  const nextSession: CourseSession = {
    ...session,
    [field]: value,
    abnormalResolvedStatus:
      field === "followUpNote"
        ? value
          ? "resolved"
          : session.abnormalStatus
            ? "processing"
            : "unresolved"
        : field === "abnormalStatus"
          ? session.followUpNote
            ? "resolved"
            : value
              ? "processing"
              : "unresolved"
          : session.abnormalResolvedStatus,
    updatedAt: new Date().toISOString(),
  };

  await upsertSession(nextSession);
  revalidatePath(buildAdminSessionReservationsPath(sessionId));
  return { ok: true as const, savedAt: new Date().toISOString() };
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
  redirect("/admin/course-categories?saved=1");
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
  redirect("/admin/course-categories?saved=1");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const data = await getBookingData();
  const hasRelations =
    data.courseSeries.some((series) => series.categoryId === id) ||
    data.courseOfferings.some((offering) => offering.categoryId === id) ||
    data.courses.some((course) => course.categoryId === id);

  if (!id || hasRelations) {
    redirect("/admin/course-categories?error=category-in-use");
  }

  await deleteManagedDocument("categories", id);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-categories");
  redirect("/admin/course-categories?saved=1");
}

export async function saveCourseSeriesAction(formData: FormData) {
  const currentId = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "")
    .trim()
    .toUpperCase();
  const courseType = String(formData.get("courseType") ?? "")
    .trim()
    .toUpperCase();
  const now = new Date().toISOString();

  if (!title || !categoryId || !courseType) {
    redirect("/admin/course-masters?error=invalid");
  }

  const data = await getBookingData();
  const existing = currentId
    ? data.courseSeries.find((series) => series.id === currentId)
    : undefined;
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
  const id =
    currentId ||
    buildManagedId("course-master", [categoryId, courseType, code || title]);
  const defaultCapacity = normalizeNumber(
    formData.get("defaultCapacity"),
    existing?.defaultCapacity,
  );
  const color = normalizeHexColor(formData.get("color"));

  const series: CourseSeries = {
    ...(existing ?? {}),
    id,
    code,
    title,
    name: String(formData.get("name") ?? title).trim() || title,
    categoryId,
    courseType,
    defaultCourseMode: normalizeCourseMode(
      formData.get("defaultCourseMode"),
      existing?.defaultCourseMode,
    ),
    defaultCapacity,
    defaultLocation: String(formData.get("defaultLocation") ?? "").trim(),
    defaultInstructorId:
      String(
        formData.get("defaultInstructorId") ??
          existing?.defaultInstructorId ??
          "",
      ).trim() || undefined,
    defaultInstructorName:
      String(
        formData.get("defaultInstructorName") ??
          existing?.defaultInstructorName ??
          "",
      ).trim() || undefined,
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
    data.courseOfferings.some(
      (offering) =>
        offering.seriesId === id ||
        offering.courseSeriesId === id ||
        offering.courseMasterId === id,
    ) ||
    data.courses.some(
      (course) =>
        course.seriesId === id ||
        course.courseSeriesId === id ||
        course.courseMasterId === id,
    );

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
  const existing = currentId
    ? data.courseOfferings.find((offering) => offering.id === currentId)
    : undefined;
  const termNumber =
    normalizeNumber(formData.get("termNumber"), Number(term)) ||
    existing?.termNumber;
  const termLabel = String(
    formData.get("termLabel") ??
      existing?.termLabel ??
      (termNumber ? `第${termNumber}期` : `第${term}期`),
  ).trim();
  const id = currentId || buildManagedId("offering", [seriesId, year, term]);
  const title = String(
    formData.get("title") ?? existing?.title ?? series?.title ?? "",
  ).trim();
  const classDisplayName =
    String(formData.get("classDisplayName") ?? "").trim() ||
    `${title}｜${year}年｜${termLabel}`;
  const legacyCourseId = String(
    formData.get("legacyCourseId") ?? existing?.legacyCourseId ?? `class-${id}`,
  ).trim();
  const capacity = normalizeNumber(
    formData.get("capacity"),
    existing?.capacity ?? series?.defaultCapacity,
  );
  const color = normalizeHexColor(formData.get("color"));
  const requestedLifecycle = String(formData.get("courseLifecycle") ?? "").trim();
  const fallbackStatus = String(
    formData.get("bookingStatus") ??
      existing?.bookingStatus ??
      existing?.status ??
      "open",
  ).trim();
  const requestedStatus = requestedLifecycle || fallbackStatus;
  const bookingStatus =
    requestedStatus === "archived"
      ? "archived"
      : requestedStatus === "closed"
        ? "closed"
        : requestedStatus === "draft"
          ? "draft"
          : "open";
  const isActive = requestedLifecycle
    ? bookingStatus !== "archived"
    : formData.get("isActive") !== "false" && bookingStatus !== "archived";
  const courseMode =
    normalizeCourseMode(
      formData.get("courseMode"),
      existing?.courseMode ?? series?.defaultCourseMode,
    ) ??
    (String(formData.get("rosterType") ?? existing?.rosterType ?? "").trim() ===
    "booking"
      ? "booking_flexible"
      : "fixed_roster");
  const rosterType = inferRosterTypeFromCourseMode(courseMode);
  const normalizedOfferingStatus =
    bookingStatus === "archived"
      ? "archived"
      : bookingStatus === "closed"
        ? "closed"
        : bookingStatus === "draft"
          ? "draft"
          : "open";
  const bookingOpen =
    normalizedOfferingStatus === "open" && courseMode === "booking_flexible";

  const offering: CourseOffering = {
    ...(existing ?? {}),
    id,
    seriesId,
    courseSeriesId: seriesId,
    courseMasterId: seriesId,
    legacyCourseId,
    categoryId:
      String(
        formData.get("categoryId") ??
          series?.categoryId ??
          existing?.categoryId ??
          "",
      ).trim() || undefined,
    code:
      String(formData.get("code") ?? existing?.code ?? "").trim() || undefined,
    title,
    displayTitle: classDisplayName,
    displayName: classDisplayName,
    shortName:
      String(formData.get("shortName") ?? existing?.shortName ?? "").trim() ||
      undefined,
    year,
    term,
    termNumber,
    termLabel,
    classIdentifier: String(
      formData.get("classIdentifier") ??
        existing?.classIdentifier ??
        `${year}-${term}`,
    ).trim(),
    classDisplayName,
    rosterType,
    courseType:
      String(
        formData.get("courseType") ??
          existing?.courseType ??
          series?.courseType ??
          "",
      ).trim() || undefined,
    courseMode,
    sourceSheet:
      String(
        formData.get("sourceSheet") ?? existing?.sourceSheet ?? "",
      ).trim() || undefined,
    location:
      String(
        formData.get("location") ??
          existing?.location ??
          series?.defaultLocation ??
          "",
      ).trim() || undefined,
    capacity,
    primaryInstructorId:
      String(
        formData.get("primaryInstructorId") ??
          existing?.primaryInstructorId ??
          "",
      ).trim() || undefined,
    primaryInstructorName:
      String(
        formData.get("primaryInstructorName") ??
          existing?.primaryInstructorName ??
          "",
      ).trim() || undefined,
    assistantInstructorIds: normalizeStringList(
      formData.get("assistantInstructorIds"),
    ),
    assistantInstructorNames: normalizeStringList(
      formData.get("assistantInstructorNames"),
    ),
    bookingStatus,
    bookingOpen,
    status: normalizedOfferingStatus,
    color: color ?? existing?.color ?? series?.color,
    startDate:
      String(formData.get("startDate") ?? existing?.startDate ?? "").trim() ||
      undefined,
    endDate:
      String(formData.get("endDate") ?? existing?.endDate ?? "").trim() ||
      undefined,
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
    description: String(
      formData.get("description") ??
        existing?.notes ??
        series?.description ??
        "",
    ).trim(),
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
    createdAt:
      data.courses.find((course) => course.id === legacyCourseId)?.createdAt ??
      now,
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

export async function archiveCourseOfferingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "archived").trim() === "closed" ? "closed" : "archived";

  if (!id) {
    redirect("/admin/course-offerings?error=invalid");
  }

  const data = await getBookingData();
  const existingOffering = data.courseOfferings.find((offering) => offering.id === id);
  const existingCourse = data.courses.find(
    (course) => course.id === legacyCourseId || course.offeringId === id,
  );

  if (!existingOffering) {
    redirect("/admin/course-offerings?error=invalid");
  }

  const now = new Date().toISOString();
  const archived = nextStatus === "archived";

  await upsertCourseOffering({
    ...existingOffering,
    bookingStatus: nextStatus,
    bookingOpen: false,
    status: nextStatus,
    isActive: true,
    updatedAt: now,
  });

  if (existingCourse) {
    await upsertCourse({
      ...existingCourse,
      bookingOpen: false,
      status: nextStatus,
      isActive: archived ? false : true,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath("/admin/course-offerings");
  revalidatePath("/admin/course-masters");
  revalidatePath("/admin/course-categories");
  if (existingCourse?.id) revalidatePath(`/admin/courses/${existingCourse.id}`);
  redirect(archived ? "/admin/course-offerings?saved=1" : "/admin/course-offerings?saved=1&showArchived=1");
}

export async function disableCourseOfferingAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const legacyCourseId = String(formData.get("legacyCourseId") ?? "").trim();
  const nextActive = String(formData.get("isActive") ?? "false") === "true";
  await setDocumentActive("courseOfferings", id, nextActive);
  if (legacyCourseId)
    await setDocumentActive("courses", legacyCourseId, nextActive);
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
    data.enrollments.some(
      (enrollment) =>
        enrollment.offeringId === id ||
        enrollment.courseOfferingId === id ||
        enrollment.courseId === legacyCourseId,
    ) ||
    data.students.some(
      (student) =>
        student.offeringId === id || student.classId === legacyCourseId,
    ) ||
    data.reservations.some(
      (reservation) =>
        reservation.offeringId === id ||
        reservation.courseId === legacyCourseId,
    ) ||
    data.courses.some(
      (course) => course.id === legacyCourseId && course.sessions.length > 0,
    );

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
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    currentId ? `/admin/courses/${currentId}` : "/admin/courses",
  );
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

  if (!title || !categoryId || !courseType) {
    redirect("/admin/courses?error=invalid");
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
  revalidatePath(redirectTo.split("#")[0] || `/admin/courses/${id}`);
  redirect(
    redirectTo.includes("?")
      ? `${redirectTo}&saved=1`
      : `${redirectTo}?saved=1`,
  );
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
  const status =
    String(
      formData.get("status") ??
        formData.get("sessionStatus") ??
        existingSession?.status ??
        existingSession?.sessionStatus ??
        "scheduled",
    ).trim() || "scheduled";
  const isActive = formData.has("isActive")
    ? formData.get("isActive") !== "false"
    : status !== "cancelled" && status !== "suspended";
  const instructorId = String(
    formData.get("instructorId") ?? existingSession?.instructorId ?? "",
  ).trim();
  const assistantInstructorIds = Array.from(
    new Set(
      formData
        .getAll("assistantInstructorIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  const instructorName = instructorId
    ? data.instructors?.find((instructor) => instructor.id === instructorId)
        ?.name
    : existingSession?.instructorName;
  const assistantInstructorNames = assistantInstructorIds
    .map(
      (assistantId) =>
        data.instructors?.find((instructor) => instructor.id === assistantId)
          ?.name,
    )
    .filter((name): name is string => Boolean(name));
  const now = new Date().toISOString();
  const session: CourseSession = {
    ...existingSession,
    id,
    courseId,
    date,
    startTime,
    endTime,
    topic: String(formData.get("topic") ?? existingSession?.topic ?? "").trim(),
    location: String(
      formData.get("location") ?? existingSession?.location ?? "",
    ).trim(),
    capacity: Math.max(capacity, bookedCount),
    bookedCount,
    bookingDeadline:
      String(
        formData.get("bookingDeadline") ??
          existingSession?.bookingDeadline ??
          "",
      ).trim() || buildSessionDeadline(date),
    isActive,
    status,
    sessionStatus: status,
    instructorId: instructorId || undefined,
    instructorName,
    assistantInstructorIds,
    assistantInstructorNames,
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
  };

  await upsertSession(session);
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  revalidatePath(`/admin/sessions/${id}/reservations`);
  redirect(redirectTo || `/admin/courses/${courseId}/sessions?saved=1`);
}

export async function bulkCreateSessionsAction(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    courseId ? `/admin/courses/${courseId}` : "/admin/courses",
  );
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 0);
  const topic = String(formData.get("topic") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const bookingDeadline = String(formData.get("bookingDeadline") ?? "").trim();
  const isActive = formData.get("isActive") !== "false";
  const syncExistingSessions = String(formData.get("syncExistingSessions") ?? "false") === "true";
  const instructorId = String(formData.get("instructorId") ?? "").trim();
  const assistantInstructorIds = Array.from(
    new Set(
      formData
        .getAll("assistantInstructorIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (
    !courseId ||
    !startDate ||
    !endDate ||
    weekdays.length === 0 ||
    !startTime ||
    !endTime ||
    capacity < 0
  ) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const course = data.courses.find((item) => item.id === courseId);
  if (!course) {
    redirect("/admin/courses?error=invalid");
  }

  const instructorName = instructorId ? getInstructorNameFromAnySource(data, instructorId) : "";
  const assistantInstructorNames = getInstructorNamesFromIds(data, assistantInstructorIds);

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const expectedDateSet = new Set<string>();
  for (let current = start; current <= end; current = addDays(current, 1)) {
    if (!weekdays.includes(current.getDay())) continue;
    expectedDateSet.add(formatDate(current));
  }

  if (expectedDateSet.size === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const existingSessionsInRange = (course.sessions ?? []).filter((session) => {
    if (!session.date) return false;
    const sessionDate = new Date(`${session.date}T00:00:00`);
    return !Number.isNaN(sessionDate.getTime()) && sessionDate >= start && sessionDate <= end;
  });

  const hasExistingRecords = existingSessionsInRange.some((session) => {
    const bookedCount = Number(session.bookedCount ?? 0);
    const hasReservations = data.reservations?.some((reservation) => reservation.sessionId === session.id) ?? false;
    const hasAttendanceRecords =
      data.attendanceRecords?.some((record) => record.sessionId === session.id) ?? false;
    return bookedCount > 0 || hasReservations || hasAttendanceRecords;
  });

  if (syncExistingSessions && hasExistingRecords) {
    redirect(appendAdminQuery(redirectTo, "error=has-records"));
  }

  if (syncExistingSessions && existingSessionsInRange.length > 0) {
    await deleteSessionsByIds(existingSessionsInRange.map((session) => session.id));
  }

  let changedCount = 0;

  for (const date of expectedDateSet) {
    const session: CourseSession = {
      id: buildSessionId(courseId, date, startTime, topic),
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
      status: "scheduled",
      sessionStatus: "scheduled",
      instructorId: instructorId || undefined,
      instructorName: instructorName || undefined,
      assistantInstructorIds,
      assistantInstructorNames,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertSession(session);
    changedCount += 1;
  }

  if (changedCount === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/course-sessions");
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
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(-3);
}

function normalizeRosterText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function splitRosterLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((item) => item.trim());
  return line.split(",").map((item) => item.trim());
}

function getRosterColumnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) =>
    aliases.some((alias) => header.includes(alias)),
  );
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
  const offering = data.courseOfferings.find(
    (item) => item.legacyCourseId === classId || item.id === course?.offeringId,
  );
  const offeringId = offering?.id ?? course?.offeringId ?? classId;
  const seriesId =
    offering?.seriesId ??
    offering?.courseMasterId ??
    course?.seriesId ??
    course?.courseMasterId ??
    `series-${classId}`;
  const courseTitle =
    offering?.displayTitle ??
    course?.displayTitle ??
    course?.title ??
    "未命名課程";
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

  const { data, course, offering, offeringId, seriesId, courseTitle } =
    await resolveRosterContext(classId);
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

  const { data, course, offering, offeringId, seriesId, courseTitle } =
    await resolveRosterContext(classId);
  const lines = rosterText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    redirect(buildStudentReturnUrl(classId, "error=invalid"));
  }

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) =>
    /姓名|身分證|後三碼|手機|電話|座號|生日|備註|組別|班別/i.test(cell),
  );
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const nameIndex = hasHeader
    ? getRosterColumnIndex(headers, ["姓名", "學員", "name"])
    : 0;
  const idIndex = hasHeader
    ? getRosterColumnIndex(headers, [
        "身分證後三碼",
        "後三碼",
        "末三碼",
        "idNumberLast3",
        "idLast3",
      ])
    : 1;
  const phoneIndex = hasHeader
    ? getRosterColumnIndex(headers, ["手機", "電話", "phone"])
    : 2;
  const birthdayIndex = hasHeader
    ? getRosterColumnIndex(headers, ["生日", "birthday"])
    : 3;
  const seatIndex = hasHeader
    ? getRosterColumnIndex(headers, ["座號", "seat"])
    : 4;
  const groupIndex = hasHeader
    ? getRosterColumnIndex(headers, ["組別", "班別", "分組", "group"])
    : 5;
  const noteIndex = hasHeader
    ? getRosterColumnIndex(headers, ["備註", "note"])
    : 6;

  let importedCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = splitRosterLine(row);
    const name = getRosterCell(cells, nameIndex);
    const idNumberLast3 = normalizeIdLast3(getRosterCell(cells, idIndex));
    const seatNumber = Number(
      getRosterCell(cells, seatIndex) || importedCount + 1,
    );

    if (
      !name ||
      idNumberLast3.length !== 3 ||
      !Number.isFinite(seatNumber) ||
      seatNumber <= 0
    ) {
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
  if (["可上課", "上課中", "是", "Y", "YES", "否", "N", "NO"].includes(raw))
    return "上課中";
  if (
    ["已結訓", "已完成", "completed", "已通過", "通過", "passed"].includes(raw)
  )
    return "已結訓";
  if (["未加入", "取消", "退出", "withdrawn"].includes(raw)) return "未加入";
  return raw;
}

function appendAdminQuery(url: string, extra: string) {
  const [base, hash = ""] = url.split("#");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${extra}${hash ? `#${hash}` : ""}`;
}

function buildStudentsReturn(
  params: Record<string, string | number | undefined>,
  extra?: string,
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      String(value).trim() !== "" &&
      String(value) !== "all"
    )
      query.set(key, String(value));
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

async function resolveEligibilityContext(
  seriesId: string,
  yearValue: string,
  targetOfferingId?: string,
) {
  const data = await getBookingData();
  const directSeries = data.courseSeries.find(
    (item) =>
      item.id === seriesId ||
      (item as CourseSeries & { courseMasterId?: string }).courseMasterId ===
        seriesId,
  );
  const relatedOffering = data.courseOfferings.find(
    (item) =>
      item.seriesId === seriesId ||
      item.courseMasterId === seriesId ||
      item.courseSeriesId === seriesId ||
      item.id === seriesId ||
      item.legacyCourseId === seriesId,
  );
  const targetOffering = targetOfferingId
    ? data.courseOfferings.find(
        (item) =>
          item.id === targetOfferingId ||
          item.legacyCourseId === targetOfferingId,
      )
    : undefined;
  const fallbackSeriesId =
    relatedOffering?.seriesId ||
    relatedOffering?.courseMasterId ||
    relatedOffering?.courseSeriesId ||
    seriesId;
  const series: CourseSeries | undefined =
    directSeries ??
    (relatedOffering
      ? {
          id: fallbackSeriesId,
          title: relatedOffering.title,
          categoryId: relatedOffering.categoryId ?? "",
          courseType: relatedOffering.courseType,
          color: relatedOffering.color,
          isActive: relatedOffering.isActive ?? true,
        }
      : undefined);
  const year = Number(
    yearValue ||
      targetOffering?.year ||
      relatedOffering?.year ||
      new Date().getFullYear() - 1911,
  );

  if (!seriesId || !series || !Number.isFinite(year)) {
    return { data, series: undefined, targetOffering, year: undefined };
  }

  return { data, series, targetOffering, year };
}

function getOrCreateStudentIdentity(
  data: Awaited<ReturnType<typeof getBookingData>>,
  input: {
    id?: string;
    name: string;
    idNumberLast3: string;
    phone?: string;
    birthday?: string;
    note?: string;
  },
) {
  const now = new Date().toISOString();
  const existing = input.id
    ? data.students.find((student) => student.id === input.id)
    : data.students.find(
        (student) =>
          student.name === input.name &&
          student.idNumberLast3 === input.idNumberLast3,
      );

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
  const eligibilityStatus = normalizeEligibilityStatus(
    formData.get("eligibilityStatus"),
  );
  const targetOfferingId = String(
    formData.get("targetOfferingId") ?? "",
  ).trim();
  const note = String(formData.get("note") ?? "").trim();

  const { data, series, targetOffering, year } =
    await resolveEligibilityContext(seriesId, yearValue, targetOfferingId);
  if (!name || idNumberLast3.length !== 3 || !series || !year) {
    redirect(
      buildStudentsReturn({ seriesId, year: yearValue }, "error=invalid"),
    );
  }

  const now = new Date().toISOString();
  const { student } = getOrCreateStudentIdentity(data, {
    name,
    idNumberLast3,
    phone,
    birthday,
    note,
  });
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
  const { data, series, year } = await resolveEligibilityContext(
    seriesId,
    yearValue,
  );

  if (!series || !year || !rosterText) {
    redirect(
      buildStudentsReturn({ seriesId, year: yearValue }, "error=invalid"),
    );
  }

  const lines = rosterText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0)
    redirect(buildStudentsReturn({ seriesId, year }, "error=invalid"));

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) =>
    /姓名|身分證|後三碼|手機|電話|生日|資格|美容丙級|檢定|通過|備註/i.test(
      cell,
    ),
  );
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;

  const nameIndex = hasHeader
    ? getRosterColumnIndex(headers, ["姓名", "學員", "name"])
    : 0;
  const idIndex = hasHeader
    ? getRosterColumnIndex(headers, [
        "身分證後三碼",
        "後三碼",
        "末三碼",
        "idNumberLast3",
        "idLast3",
      ])
    : 1;
  const phoneIndex = hasHeader
    ? getRosterColumnIndex(headers, ["手機", "電話", "phone"])
    : 2;
  const birthdayIndex = hasHeader
    ? getRosterColumnIndex(headers, ["生日", "birthday"])
    : 3;
  const statusIndex = hasHeader
    ? getRosterColumnIndex(headers, [
        "資格狀態",
        "上課資格",
        "課程資格",
        "美容丙級",
        "狀態",
        "是否通過",
        "通過",
      ])
    : 4;
  const examTermIndex = hasHeader
    ? getRosterColumnIndex(headers, ["檢定梯次", "梯次", "年度課程", "期別"])
    : 5;
  const noteIndex = hasHeader
    ? getRosterColumnIndex(headers, ["備註", "note"])
    : 6;

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
      ? data.courseOfferings.find(
          (offering) =>
            (offering.seriesId === series.id ||
              offering.courseMasterId === series.id) &&
            String(offering.year) === String(year) &&
            [
              offering.id,
              offering.legacyCourseId,
              offering.termLabel,
              String(offering.term ?? ""),
              offering.shortName,
              offering.code,
            ].some((value) => String(value ?? "").includes(examTerm)),
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
  redirect(
    buildStudentsReturn(
      { seriesId: series.id, year },
      `saved=1&imported=${importedCount}`,
    ),
  );
}

export async function saveStudentIdentityAction(formData: FormData) {
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/students",
  );
  const rawId = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const inferredLast3 = nationalId ? nationalId.replace(/\D/g, "").slice(-3) : "";
  const idNumberLast3 =
    normalizeIdLast3(formData.get("idNumberLast3")) || inferredLast3;
  const rosterStatus = String(formData.get("rosterStatus") ?? "active").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const memberNo = String(formData.get("memberNo") ?? "").trim();
  const businessCategories = String(
    formData.get("businessCategoriesText") ?? "",
  )
    .split(/[、,，;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();

  if (!name || idNumberLast3.length !== 3) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const now = new Date().toISOString();
  const existing = rawId
    ? data.students.find((student) => student.id === rawId)
    : data.students.find(
        (student) =>
          student.name === name && student.idNumberLast3 === idNumberLast3,
      );

  await upsertStudent({
    ...(existing ?? {}),
    id: existing?.id ?? `student-${crypto.randomUUID()}`,
    name,
    englishName:
      String(formData.get("englishName") ?? "").trim() || existing?.englishName,
    gender: String(formData.get("gender") ?? "").trim() || existing?.gender,
    idNumberLast3,
    nationalId: nationalId || existing?.nationalId,
    phone,
    landline:
      String(formData.get("landline") ?? "").trim() || existing?.landline,
    email: String(formData.get("email") ?? "").trim() || existing?.email,
    lineId: String(formData.get("lineId") ?? "").trim() || existing?.lineId,
    birthday: birthday || null,
    birthPlace:
      String(formData.get("birthPlace") ?? "").trim() || existing?.birthPlace,
    address:
      String(formData.get("mailingAddress") ?? "").trim() || existing?.address,
    mailingAddress:
      String(formData.get("mailingAddress") ?? "").trim() ||
      existing?.mailingAddress,
    householdAddress:
      String(formData.get("householdAddress") ?? "").trim() ||
      existing?.householdAddress,
    emergencyContactName:
      String(formData.get("emergencyContactName") ?? "").trim() ||
      existing?.emergencyContactName,
    emergencyContactPhone:
      String(formData.get("emergencyContactPhone") ?? "").trim() ||
      existing?.emergencyContactPhone,
    memberNo: memberNo || existing?.memberNo,
    educationLevel:
      String(formData.get("educationLevel") ?? "").trim() ||
      existing?.educationLevel,
    graduationSchool:
      String(formData.get("graduationSchool") ?? "").trim() ||
      existing?.graduationSchool,
    major: String(formData.get("major") ?? "").trim() || existing?.major,
    maritalStatus:
      String(formData.get("maritalStatus") ?? "").trim() ||
      existing?.maritalStatus,
    childrenCount:
      normalizeNumber(formData.get("childrenCount")) ?? existing?.childrenCount,
    childrenAges:
      String(formData.get("childrenAges") ?? "").trim() ||
      existing?.childrenAges,
    employmentStatus:
      String(formData.get("employmentStatus") ?? "").trim() ||
      existing?.employmentStatus,
    companyName:
      String(formData.get("companyName") ?? "").trim() ||
      existing?.companyName,
    jobTitle:
      String(formData.get("jobTitle") ?? "").trim() || existing?.jobTitle,
    workExperience:
      String(formData.get("workExperience") ?? "").trim() ||
      existing?.workExperience,
    industryCategory:
      String(formData.get("industryCategory") ?? "").trim() ||
      existing?.industryCategory,
    beautyRelated:
      String(formData.get("beautyRelated") ?? "").trim() ||
      existing?.beautyRelated,
    startupStatus:
      String(formData.get("startupStatus") ?? "").trim() ||
      existing?.startupStatus,
    startupExperience:
      String(formData.get("startupExperience") ?? "").trim() ||
      existing?.startupExperience,
    startupType:
      String(formData.get("startupType") ?? "").trim() ||
      existing?.startupType,
    brandName:
      String(formData.get("brandName") ?? "").trim() || existing?.brandName,
    hasBusinessRegistration:
      String(formData.get("hasBusinessRegistration") ?? "").trim() ||
      existing?.hasBusinessRegistration,
    businessRegistrationStatus:
      String(formData.get("businessRegistrationStatus") ?? "").trim() ||
      existing?.businessRegistrationStatus,
    taxId: String(formData.get("taxId") ?? "").trim() || existing?.taxId,
    businessCategories:
      businessCategories.length > 0
        ? businessCategories
        : existing?.businessCategories,
    businessPlaceType:
      String(formData.get("businessPlaceType") ?? "").trim() ||
      existing?.businessPlaceType,
    businessAddress:
      String(formData.get("businessAddress") ?? "").trim() ||
      existing?.businessAddress,
    operationMode:
      String(formData.get("operationMode") ?? "").trim() ||
      existing?.operationMode,
    customerType:
      String(formData.get("customerType") ?? "").trim() ||
      existing?.customerType,
    employeeStatus:
      String(formData.get("employeeStatus") ?? "").trim() ||
      existing?.employeeStatus,
    serviceDescription:
      String(formData.get("serviceDescription") ?? "").trim() ||
      existing?.serviceDescription,
    employeeCountRange:
      String(formData.get("employeeCountRange") ?? "").trim() ||
      existing?.employeeCountRange,
    fullTimeEmployees:
      normalizeNumber(formData.get("fullTimeEmployees")) ??
      existing?.fullTimeEmployees,
    partTimeEmployees:
      normalizeNumber(formData.get("partTimeEmployees")) ??
      existing?.partTimeEmployees,
    capitalRange:
      String(formData.get("capitalRange") ?? "").trim() ||
      existing?.capitalRange,
    monthlyRevenueRange:
      String(formData.get("monthlyRevenueRange") ?? "").trim() ||
      existing?.monthlyRevenueRange,
    annualRevenueRange:
      String(formData.get("annualRevenueRange") ?? "").trim() ||
      existing?.annualRevenueRange,
    note,
    source:
      String(formData.get("source") ?? "").trim() ||
      existing?.source ||
      "學員總表手動建立",
    isActive: rosterStatus !== "inactive",
    needsReview: rosterStatus === "review",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  revalidatePath("/admin/students");
  revalidatePath("/admin/student-imports");
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function updateStudentIdentityStatusAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const status = String(formData.get("status") ?? "active").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/students?mode=students#student-list",
  );
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
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/students?mode=students#student-list",
  );
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
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/students?mode=students#student-list",
  );
  if (!studentId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  await setDocumentActive("students", studentId, false);
  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function deleteSelectedStudentIdentitiesAction(
  formData: FormData,
) {
  const studentIds = formData
    .getAll("studentIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/students?mode=students#student-list",
  );
  if (studentIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  for (const studentId of studentIds) {
    await setDocumentActive("students", studentId, false);
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  redirect(
    appendAdminQuery(redirectTo, `saved=1&imported=${studentIds.length}`),
  );
}

export async function bulkImportStudentIdentitiesAction(formData: FormData) {
  const importMode = String(formData.get("importMode") ?? "studentsOnly").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    "/admin/student-imports",
  );
  const rosterText = normalizeRosterText(formData.get("rosterText"));
  if (!rosterText) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const lines = rosterText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const firstCells = splitRosterLine(lines[0]);
  const hasHeader = firstCells.some((cell) =>
    /姓名|學員|name|末三碼|手機|電話|生日|會員|備註/i.test(cell),
  );
  const headers = hasHeader ? firstCells : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const nameIndex = hasHeader
    ? getRosterColumnIndex(headers, ["姓名", "學員", "name"])
    : 0;
  const idIndex = hasHeader
    ? getRosterColumnIndex(headers, ["末三碼", "證件", "idNumberLast3", "idLast3"])
    : 1;
  const phoneIndex = hasHeader
    ? getRosterColumnIndex(headers, ["手機", "電話", "phone"])
    : 2;
  const birthdayIndex = hasHeader
    ? getRosterColumnIndex(headers, ["生日", "birthday"])
    : 3;
  const memberIndex = hasHeader
    ? getRosterColumnIndex(headers, ["會員編號", "會員", "memberNo", "member"])
    : 4;
  const noteIndex = hasHeader
    ? getRosterColumnIndex(headers, ["備註", "note"])
    : 5;

  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const targetOfferingId = String(formData.get("targetOfferingId") ?? "").trim();
  const importNote = String(formData.get("note") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(
    formData.get("eligibilityStatus"),
  );
  const needsEligibility =
    importMode === "withEligibility" || importMode === "withEnrollment";
  const needsEnrollment = importMode === "withEnrollment";
  const { series, targetOffering, year } = needsEligibility
    ? await resolveEligibilityContext(seriesId, yearValue, targetOfferingId)
    : { series: undefined, targetOffering: undefined, year: undefined };

  if (needsEligibility && (!series || !year)) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }
  if (needsEnrollment && (!series || !year || !targetOffering)) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  let importedCount = 0;
  let linkedCount = 0;
  let enrolledCount = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const cells = splitRosterLine(row);
    const name = getRosterCell(cells, nameIndex);
    const idNumberLast3 = normalizeIdLast3(getRosterCell(cells, idIndex));
    if (!name || idNumberLast3.length !== 3) continue;

    const existing = data.students.find(
      (student) =>
        student.name === name && student.idNumberLast3 === idNumberLast3,
    );
    const studentId = existing?.id ?? `student-${crypto.randomUUID()}`;

    await upsertStudent({
      ...(existing ?? {}),
      id: studentId,
      name,
      idNumberLast3,
      phone: getRosterCell(cells, phoneIndex) || existing?.phone || "",
      birthday:
        getRosterCell(cells, birthdayIndex) || existing?.birthday || null,
      memberNo: getRosterCell(cells, memberIndex) || existing?.memberNo,
      note: getRosterCell(cells, noteIndex) || importNote || existing?.note,
      source: existing?.source ?? "Excel / CSV 學員總表匯入",
      isActive: true,
      needsReview: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    if (needsEligibility && series && year) {
      const recordId = `elig-${studentId}-${series.id}-${year}`;
      const existingRecord = data.studentCourseRecords?.find(
        (record) =>
          record.id === recordId ||
          (record.studentId === studentId &&
            (record.seriesId === series.id ||
              record.courseMasterId === series.id) &&
            String(record.year ?? record.sourceRocYear ?? "") === String(year)),
      );

      await upsertStudentCourseRecord({
        ...(existingRecord ?? {}),
        id: existingRecord?.id ?? recordId,
        studentId,
        seriesId: series.id,
        courseMasterId: series.id,
        offeringId: targetOffering?.id,
        sourceColumn: "????",
        rawValue: eligibilityStatus,
        normalizedValue: eligibilityStatus,
        recordType: "roster",
        sourceRocYear: year,
        year,
        term: targetOffering?.term,
        termLabel: targetOffering?.termLabel,
        classDisplayName:
          targetOffering?.displayTitle ??
          targetOffering?.displayName ??
          targetOffering?.title,
        note: getRosterCell(cells, noteIndex) || importNote,
        importedAt: existingRecord?.importedAt ?? now,
        createdAt: existingRecord?.createdAt ?? now,
        updatedAt: now,
      });
      linkedCount += 1;
    }

    if (needsEnrollment && series && targetOffering && year) {
      const enrollmentId = `enroll-${studentId}-${targetOffering.id}`;
      const existingEnrollment = data.enrollments?.find(
        (item) => item.id === enrollmentId,
      );
      await upsertEnrollment({
        ...(existingEnrollment ?? {}),
        id: enrollmentId,
        studentId,
        offeringId: targetOffering.id,
        courseOfferingId: targetOffering.id,
        seriesId: series.id,
        courseMasterId: series.id,
        enrollmentType: "roster",
        status: eligibilityStatus === "???" ? "completed" : "active",
        joinedAt: existingEnrollment?.joinedAt ?? now,
        year,
        term: targetOffering.term,
        termLabel: targetOffering.termLabel,
        classDisplayName:
          targetOffering.displayTitle ??
          targetOffering.displayName ??
          targetOffering.title,
        note: getRosterCell(cells, noteIndex) || importNote,
        createdAt: existingEnrollment?.createdAt ?? now,
        updatedAt: now,
      });
      enrolledCount += 1;
    }

    importedCount += 1;
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/student-imports");
  revalidatePath("/");
  redirect(
    appendAdminQuery(
      redirectTo,
      `saved=1&imported=${importedCount}&linked=${linkedCount}&enrolled=${enrolledCount}`,
    ),
  );
}

export async function assignStudentsToCourseEligibilityAction(
  formData: FormData,
) {
  const studentIds = formData
    .getAll("studentIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(
    formData.get("eligibilityStatus"),
  );
  const targetOfferingId = String(
    formData.get("targetOfferingId") ?? "",
  ).trim();
  const note = String(formData.get("note") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    buildStudentsReturn({ mode: "eligibility", seriesId, year: yearValue }),
  );

  const { data, series, targetOffering, year } =
    await resolveEligibilityContext(seriesId, yearValue, targetOfferingId);
  if (!series || !year || studentIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const now = new Date().toISOString();
  const isClearingEligibility = eligibilityStatus === "未加入";
  for (const studentId of studentIds) {
    const student = data.students.find((item) => item.id === studentId);
    if (!student) continue;

    const recordId = `elig-${student.id}-${series.id}-${year}`;
    const existingRecord = data.studentCourseRecords?.find(
      (record) =>
        record.id === recordId ||
        (record.studentId === student.id &&
          (record.seriesId === series.id ||
            record.courseMasterId === series.id) &&
          String(record.year ?? record.sourceRocYear ?? "") === String(year)),
    );

    if (targetOffering) {
      const enrollmentId = `enroll-${student.id}-${targetOffering.id}`;
      const existingEnrollment = data.enrollments?.find(
        (item) => item.id === enrollmentId,
      );
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
        joinedAt:
          existingEnrollment?.joinedAt ??
          (isClearingEligibility ? undefined : now),
        leftAt: isClearingEligibility ? now : existingEnrollment?.leftAt,
        year,
        term: targetOffering.term,
        termLabel: targetOffering.termLabel,
        classDisplayName:
          targetOffering.displayTitle ??
          targetOffering.displayName ??
          targetOffering.title,
        note,
        createdAt: existingEnrollment?.createdAt ?? now,
        updatedAt: now,
      });
    } else if (isClearingEligibility) {
      if (!existingRecord) continue;
      await removeStudentCourseEligibility(student.id, series.id, year);
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
      classDisplayName:
        targetOffering?.displayTitle ??
        targetOffering?.displayName ??
        targetOffering?.title,
      note,
      importedAt: existingRecord?.importedAt ?? now,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/students");
  // 成功時只 revalidate，不 redirect，降低後台點選狀態後畫面跳動。
}

export async function bulkUpdateStudentCourseEligibilityAction(
  formData: FormData,
) {
  const recordIds = formData
    .getAll("recordIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const seriesId = String(formData.get("seriesId") ?? "").trim();
  const yearValue = String(formData.get("year") ?? "").trim();
  const eligibilityStatus = normalizeEligibilityStatus(
    formData.get("eligibilityStatus"),
  );
  const targetOfferingId = String(
    formData.get("targetOfferingId") ?? "",
  ).trim();
  const note = String(formData.get("note") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    buildStudentsReturn({ mode: "eligibility", seriesId, year: yearValue }) +
      "#qualification-bulk",
  );

  if (recordIds.length === 0) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const data = await getBookingData();
  const targetOffering = targetOfferingId
    ? data.courseOfferings.find(
        (item) =>
          item.id === targetOfferingId ||
          item.legacyCourseId === targetOfferingId,
      )
    : undefined;
  const year = Number(yearValue || targetOffering?.year || "");
  let updatedCount = 0;

  for (const recordId of recordIds) {
    const existing = data.studentCourseRecords.find(
      (record) => record.id === recordId,
    );
    if (!existing) continue;

    const isClearingEligibility = eligibilityStatus === "未加入";
    if (isClearingEligibility) {
      const removeSeriesId =
        existing.seriesId || existing.courseMasterId || seriesId;
      const removeYear = existing.year ?? existing.sourceRocYear ?? yearValue;
      if (removeSeriesId && removeYear) {
        await removeStudentCourseEligibility(
          existing.studentId,
          removeSeriesId,
          removeYear,
        );
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
      classDisplayName: targetOffering
        ? (targetOffering.displayTitle ?? targetOffering.title)
        : existing.classDisplayName,
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
  const eligibilityStatus = normalizeEligibilityStatus(
    formData.get("eligibilityStatus"),
  );
  const targetOfferingId = String(
    formData.get("targetOfferingId") ?? "",
  ).trim();
  const note = String(formData.get("note") ?? "").trim();
  const data = await getBookingData();
  const existing = data.studentCourseRecords.find(
    (record) => record.id === recordId,
  );
  const targetOffering = targetOfferingId
    ? data.courseOfferings.find((item) => item.id === targetOfferingId)
    : undefined;

  if (!existing) {
    redirect(
      buildStudentsReturn(
        { mode: "eligibility", seriesId, year: yearValue },
        "error=invalid",
      ),
    );
  }

  const year = Number(
    yearValue ||
      existing.year ||
      existing.sourceRocYear ||
      targetOffering?.year ||
      "",
  );
  const isClearingEligibility = eligibilityStatus === "未加入";
  if (isClearingEligibility) {
    const removeSeriesId =
      existing.seriesId || existing.courseMasterId || seriesId;
    const removeYear = existing.year ?? existing.sourceRocYear ?? yearValue;
    if (removeSeriesId && removeYear) {
      await removeStudentCourseEligibility(
        existing.studentId,
        removeSeriesId,
        removeYear,
      );
    }
    revalidatePath("/");
    revalidatePath("/admin/students");
    redirect(
      buildStudentsReturn(
        {
          mode: "eligibility",
          seriesId: existing.seriesId,
          year: year || existing.year,
        },
        "saved=1",
      ),
    );
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
  redirect(
    buildStudentsReturn(
      {
        mode: "eligibility",
        seriesId: existing.seriesId,
        year: year || existing.year,
      },
      "saved=1",
    ),
  );
}

export async function addStudentToSessionRosterAction(formData: FormData) {
  const studentId = String(formData.get("studentId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    `${buildAdminSessionReservationsPath(sessionId)}#attendance-list`,
  );

  if (!studentId || !courseId || !sessionId) {
    redirect(appendAdminQuery(redirectTo, "error=invalid"));
  }

  const result = await addStudentToSessionRoster(
    studentId,
    courseId,
    sessionId,
  );
  revalidatePath("/");
  revalidatePath("/admin/students");
  revalidatePath("/admin/course-sessions");
  revalidatePath(`/admin/courses/${courseId}/sessions`);
  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));

  if (!result.ok) {
    redirect(appendAdminQuery(redirectTo, `error=${result.reason}`));
  }

  redirect(appendAdminQuery(redirectTo, "saved=1"));
}

export async function saveInstructorIdentityAction(formData: FormData) {
  const instructorId = String(formData.get("instructorId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const specialties = formData
    .getAll("specialties")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();
  const isActive = formData.has("isActive")
    ? formData.getAll("isActive").includes("true")
    : true;

  if (!name) {
    redirect(buildStudentsReturn({ mode: "instructors" }, "error=invalid"));
  }

  const data = await getBookingData();
  const now = new Date().toISOString();
  const existing =
    data.instructors?.find((item) => item.id === instructorId) ??
    data.instructors?.find(
      (item) => item.name === name && (phone ? item.phone === phone : true),
    );
  const id = existing?.id ?? (instructorId || `instructor-${crypto.randomUUID()}`);

  await upsertInstructor({
    ...(existing ?? {}),
    id,
    name,
    phone,
    specialties,
    note,
    source: existing?.source ?? "後台手動建立",
    isActive,
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

function getInstructorFromRoster(
  instructors: Instructor[] | undefined,
  instructorId: string,
) {
  return (instructors ?? []).find(
    (instructor) => instructor.id === instructorId,
  );
}

function addInstructorNameCandidate(
  candidates: Map<string, string>,
  id?: unknown,
  name?: unknown,
) {
  const normalizedName = String(name ?? "").trim();
  const normalizedId = String(id ?? "").trim() || normalizedName;
  if (normalizedId && normalizedName && !candidates.has(normalizedId)) {
    candidates.set(normalizedId, normalizedName);
  }
}

function collectInstructorNameCandidates(
  candidates: Map<string, string>,
  record: any,
) {
  if (!record) return;
  addInstructorNameCandidate(
    candidates,
    record.primaryInstructorId ??
      record.instructorId ??
      record.defaultInstructorId,
    record.primaryInstructorName ??
      record.instructorName ??
      record.defaultInstructorName,
  );
  const assistantIds = Array.isArray(record.assistantInstructorIds)
    ? record.assistantInstructorIds
    : [];
  const assistantNames = Array.isArray(record.assistantInstructorNames)
    ? record.assistantInstructorNames
    : [];
  assistantNames.forEach((name: string, index: number) =>
    addInstructorNameCandidate(candidates, assistantIds[index] ?? name, name),
  );
}

function getInstructorNameFromAnySource(data: any, instructorId: string) {
  const id = String(instructorId ?? "").trim();
  if (!id) return "";
  const rosterName = getInstructorFromRoster(data.instructors, id)?.name;
  if (rosterName) return rosterName;

  const candidates = new Map<string, string>();
  (data.courses ?? []).forEach((record: any) =>
    collectInstructorNameCandidates(candidates, record),
  );
  (data.courseOfferings ?? []).forEach((record: any) =>
    collectInstructorNameCandidates(candidates, record),
  );
  (data.courseSeries ?? []).forEach((record: any) =>
    collectInstructorNameCandidates(candidates, record),
  );
  (data.courseSessions ?? []).forEach((record: any) =>
    collectInstructorNameCandidates(candidates, record),
  );
  (data.courses ?? [])
    .flatMap((course: any) => course.sessions ?? [])
    .forEach((record: any) =>
      collectInstructorNameCandidates(candidates, record),
    );
  return candidates.get(id) ?? id;
}

function getInstructorNamesFromIds(data: any, instructorIds: string[]) {
  return instructorIds
    .map((id) => getInstructorNameFromAnySource(data, id))
    .filter((name): name is string => Boolean(name && name.trim()));
}

export async function saveSessionJournalAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const redirectTo = normalizeAdminRedirect(
    formData.get("redirectTo"),
    sessionId
      ? buildAdminSessionReservationsPath(sessionId)
      : "/admin/course-sessions",
  );

  if (!sessionId) {
    redirect(redirectTo);
  }

  const data = await getBookingData();
  const session = data.courses
    .flatMap((course) => course.sessions ?? [])
    .find((item) => item.id === sessionId);

  if (!session) {
    redirect(redirectTo);
  }

  const now = new Date().toISOString();
  const abnormalStatus = String(formData.get("abnormalStatus") ?? "").trim();
  const followUpNote = String(formData.get("followUpNote") ?? "").trim();
  const abnormalResolvedStatus = followUpNote
    ? "resolved"
    : abnormalStatus
      ? "processing"
      : "unresolved";
  const instructorId = String(formData.get("instructorId") ?? "").trim();
  const instructorName = getInstructorNameFromAnySource(data, instructorId);
  const assistantInstructorIds = Array.from(
    new Set(
      formData
        .getAll("assistantInstructorIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  const assistantInstructorNames = getInstructorNamesFromIds(
    data,
    assistantInstructorIds,
  );
  const date =
    String(formData.get("date") ?? session.date ?? "").trim() || session.date;
  const startTime =
    String(formData.get("startTime") ?? session.startTime ?? "").trim() ||
    session.startTime;
  const endTime =
    String(formData.get("endTime") ?? session.endTime ?? "").trim() ||
    session.endTime;
  const location =
    String(formData.get("location") ?? session.location ?? "").trim() ||
    session.location;
  const topic = String(formData.get("topic") ?? session.topic ?? "").trim();

  const updatedSession: CourseSession = {
    ...session,
    date,
    startTime,
    endTime,
    topic,
    location,
    instructorId: instructorId || undefined,
    instructorName: instructorName || undefined,
    assistantInstructorIds,
    assistantInstructorNames,
    status: String(
      formData.get("sessionStatus") ??
        session.sessionStatus ??
        session.status ??
        "scheduled",
    ),
    sessionStatus: String(
      formData.get("sessionStatus") ??
        session.sessionStatus ??
        session.status ??
        "scheduled",
    ),
    isActive: formData.has("sessionStatus")
      ? !["cancelled", "suspended"].includes(String(formData.get("sessionStatus") ?? ""))
      : session.isActive,
    attendanceStatus: String(
      formData.get("attendanceStatus") ??
        session.attendanceStatus ??
        "not_started",
    ),
    teachingContent: formData.has("teachingContent")
      ? String(formData.get("teachingContent") ?? "").trim()
      : session.teachingContent,
    teacherNote: formData.has("teacherNote")
      ? String(formData.get("teacherNote") ?? "").trim()
      : session.teacherNote,
    assistantNote: formData.has("assistantNote")
      ? String(formData.get("assistantNote") ?? "").trim()
      : session.assistantNote,
    adminNote: formData.has("adminNote")
      ? String(formData.get("adminNote") ?? "").trim()
      : session.adminNote,
    abnormalStatus: formData.has("abnormalStatus")
      ? abnormalStatus
      : session.abnormalStatus,
    followUpNote: formData.has("followUpNote")
      ? followUpNote
      : session.followUpNote,
    abnormalResolvedStatus:
      formData.has("abnormalStatus") || formData.has("followUpNote")
        ? abnormalResolvedStatus
        : session.abnormalResolvedStatus,
    updatedAt: now,
  };

  await upsertSession(updatedSession);
  revalidatePath("/admin");
  revalidatePath("/admin/course-sessions");
  if (sessionId) revalidatePath(buildAdminSessionReservationsPath(sessionId));
  revalidatePath(redirectTo.split("#")[0] || "/admin");
  redirect(redirectTo);
}
