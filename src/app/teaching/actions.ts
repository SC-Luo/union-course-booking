"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureSessionRosterReservation,
  getBookingData,
  markSessionReservationsAttended,
  updateReservationAttendanceBySessionStudent,
  upsertSession,
} from "@/lib/booking-repository";
import type { AttendanceStatus, Course, CourseSession, Instructor } from "@/lib/types";

function normalizeName(value?: string) {
  return String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();
}

function splitNames(values: Array<string | undefined> = []) {
  return values
    .flatMap((value) => String(value ?? "").split(/[,、，\/]/g))
    .map((value) => normalizeName(value))
    .filter(Boolean);
}

function instructorIdsByName(instructors: Instructor[], teacherName: string) {
  const normalized = normalizeName(teacherName);
  return new Set(
    instructors
      .filter((item) => item.isActive !== false && normalizeName(item.name) === normalized)
      .map((item) => item.id),
  );
}

function isTeachingSessionForName(
  course: Course,
  session: CourseSession,
  instructors: Instructor[],
  teacherName: string,
) {
  const normalized = normalizeName(teacherName);
  if (!normalized) return false;

  const matchedInstructorIds = instructorIdsByName(instructors, teacherName);
  const idCandidates = [
    session.instructorId,
    ...(session.assistantInstructorIds ?? []),
    course.primaryInstructorId,
    ...(course.assistantInstructorIds ?? []),
  ]
    .filter(Boolean)
    .map(String);

  if (idCandidates.some((id) => matchedInstructorIds.has(id))) return true;

  const nameCandidates = splitNames([
    session.instructorName,
    ...(session.assistantInstructorNames ?? []),
    course.primaryInstructorName,
    ...(course.assistantInstructorNames ?? []),
  ]);

  return nameCandidates.includes(normalized);
}

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, "~2F")
    .replace(/%5C/gi, "~5C");
}

function buildTeachingSessionPath(sessionId: string, teacherName: string, code?: string) {
  const params = new URLSearchParams();
  if (teacherName) params.set("name", teacherName);
  if (code) params.set("code", code);
  const query = params.toString();
  return `/teaching/sessions/${encodeRouteSegment(sessionId)}${query ? `?${query}` : ""}`;
}

function safeTeachingRedirectPath(path: string | null | undefined, fallback: string) {
  const raw = String(path ?? "").trim();
  if (!raw || !raw.startsWith("/teaching") || raw.startsWith("//")) return fallback;
  return raw;
}

function appendTeachingQuery(path: string, query: string) {
  const [withoutHash, hash = ""] = path.split("#", 2);
  const joiner = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${joiner}${query}${hash ? `#${hash}` : ""}`;
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
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return undefined;
  return Math.max(0.5, Math.round(((endMinutes - startMinutes) / 60) * 2) / 2);
}

async function resolveAuthorizedTeachingSession(sessionId: string, teacherName: string) {
  const data = await getBookingData();
  const course = (data.courses ?? []).find((item) =>
    (item.sessions ?? []).some((session) => session.id === sessionId),
  );
  const session = course?.sessions?.find((item) => item.id === sessionId);

  if (!course || !session) {
    return { ok: false as const, reason: "not-found" as const, data };
  }

  if (!teacherName || !isTeachingSessionForName(course, session, data.instructors ?? [], teacherName)) {
    return { ok: false as const, reason: "forbidden" as const, data, course, session };
  }

  return { ok: true as const, data, course, session };
}

export async function updateTeachingAttendanceAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const courseId = String(formData.get("courseId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const teacherName = String(formData.get("teacherName") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const attendanceStatus = String(formData.get("attendanceStatus") ?? "") as AttendanceStatus;
  const leaveHoursRaw = Number(formData.get("leaveHours") ?? 0);
  const leaveHours = Number.isFinite(leaveHoursRaw) && leaveHoursRaw > 0 ? leaveHoursRaw : undefined;
  const leaveStartTime = String(formData.get("leaveStartTime") ?? "").trim() || undefined;
  const leaveEndTime = String(formData.get("leaveEndTime") ?? "").trim() || undefined;
  const lateTime = String(formData.get("lateTime") ?? "").trim() || undefined;
  const effectiveLeaveHours = attendanceStatus === "leave" ? computeLeaveHoursFromTimeRange(leaveStartTime, leaveEndTime) ?? leaveHours : leaveHours;
  const fallback = sessionId ? `${buildTeachingSessionPath(sessionId, teacherName, code)}#attendance-list` : "/teaching/login";
  const redirectTo = safeTeachingRedirectPath(String(formData.get("redirectTo") ?? ""), fallback);

  if (!sessionId || !studentId || !["pending", "unchecked", "attended", "late", "absent", "leave"].includes(attendanceStatus)) {
    redirect(appendTeachingQuery(redirectTo, "attendance=invalid"));
  }

  const resolved = await resolveAuthorizedTeachingSession(sessionId, teacherName);
  if (!resolved.ok) {
    redirect(appendTeachingQuery(redirectTo, `attendance=${resolved.reason}`));
  }

  const existing = (resolved.data.reservations ?? []).find(
    (reservation) =>
      reservation.sessionId === resolved.session.id &&
      reservation.studentId === studentId &&
      reservation.status === "booked",
  );

  let targetReservationId = reservationId.startsWith("roster-") ? "" : reservationId;
  if (!targetReservationId && existing) {
    targetReservationId = existing.id;
  }
  if (!targetReservationId && courseId) {
    const result = await ensureSessionRosterReservation(studentId, courseId, resolved.session.id);
    if (result.ok) targetReservationId = result.reservation.id;
  }

  if (!targetReservationId) {
    redirect(appendTeachingQuery(redirectTo, "attendance=not-found"));
  }

  await updateReservationAttendanceBySessionStudent(targetReservationId, resolved.session.id, studentId, attendanceStatus, {
    leaveHours: effectiveLeaveHours,
    leaveStartTime,
    leaveEndTime,
    lateTime,
  });

  revalidatePath("/teaching");
  revalidatePath(buildTeachingSessionPath(resolved.session.id, teacherName).split("#")[0] || "/teaching");
  revalidatePath(redirectTo.split("#")[0] || "/teaching");
  redirect(redirectTo);
}

export async function completeTeachingAttendanceAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const teacherName = String(formData.get("teacherName") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const fallback = sessionId ? `${buildTeachingSessionPath(sessionId, teacherName, code)}#attendance-list` : "/teaching/login";
  const redirectTo = safeTeachingRedirectPath(String(formData.get("redirectTo") ?? ""), fallback);

  const resolved = await resolveAuthorizedTeachingSession(sessionId, teacherName);
  if (!resolved.ok) {
    redirect(appendTeachingQuery(redirectTo, `attendance=${resolved.reason}`));
  }

  await markSessionReservationsAttended(resolved.session.id);
  revalidatePath("/teaching");
  revalidatePath(buildTeachingSessionPath(resolved.session.id, teacherName));
  redirect(redirectTo);
}

const TEACHING_JOURNAL_FIELDS = new Set([
  "teachingContent",
  "teacherNote",
  "assistantNote",
  "adminNote",
  "abnormalStatus",
  "followUpNote",
]);

export async function saveTeachingJournalAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const teacherName = String(formData.get("teacherName") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const sessionStatus = String(formData.get("sessionStatus") ?? "").trim();
  const attendanceStatus = String(formData.get("attendanceStatus") ?? "").trim();
  const fallback = sessionId ? `${buildTeachingSessionPath(sessionId, teacherName, code)}#lesson-journal` : "/teaching/login";
  const redirectTo = safeTeachingRedirectPath(String(formData.get("redirectTo") ?? ""), fallback);

  const hasJournalField = Boolean(field);
  const hasSessionStatus = Boolean(sessionStatus);
  const hasAttendanceStatus = Boolean(attendanceStatus);

  if (hasJournalField && !TEACHING_JOURNAL_FIELDS.has(field)) {
    redirect(appendTeachingQuery(redirectTo, "journal=invalid"));
  }

  if (
    hasSessionStatus &&
    !["scheduled", "suspended", "makeup", "rescheduled", "cancelled"].includes(sessionStatus)
  ) {
    redirect(appendTeachingQuery(redirectTo, "sessionStatus=invalid"));
  }

  if (
    hasAttendanceStatus &&
    !["not_started", "in_progress", "completed"].includes(attendanceStatus)
  ) {
    redirect(appendTeachingQuery(redirectTo, "attendanceStatus=invalid"));
  }

  if (!hasJournalField && !hasSessionStatus && !hasAttendanceStatus) {
    redirect(appendTeachingQuery(redirectTo, "journal=empty"));
  }

  const resolved = await resolveAuthorizedTeachingSession(sessionId, teacherName);
  if (!resolved.ok) {
    redirect(appendTeachingQuery(redirectTo, `journal=${resolved.reason}`));
  }

  const abnormalStatus = field === "abnormalStatus" ? value : resolved.session.abnormalStatus ?? "";
  const followUpNote = field === "followUpNote" ? value : resolved.session.followUpNote ?? "";
  const updatedSession: CourseSession = {
    ...resolved.session,
    ...(hasJournalField ? { [field]: value } : {}),
    ...(hasSessionStatus ? { sessionStatus } : {}),
    ...(hasAttendanceStatus ? { attendanceStatus } : {}),
    abnormalResolvedStatus:
      field === "abnormalStatus" || field === "followUpNote"
        ? followUpNote
          ? "resolved"
          : abnormalStatus
            ? "processing"
            : "unresolved"
        : resolved.session.abnormalResolvedStatus,
    updatedAt: new Date().toISOString(),
  };

  await upsertSession(updatedSession);
  revalidatePath("/teaching");
  revalidatePath(buildTeachingSessionPath(resolved.session.id, teacherName));
  revalidatePath(redirectTo.split("#")[0] || "/teaching");
  redirect(redirectTo);
}
