import type { AttendanceStatus, CourseStatus, ReservationStatus } from "@/lib/types";

const courseStatusText: Record<CourseStatus, string> = {
  available: "可預約",
  full: "額滿",
  closed: "已截止",
};

const courseStatusClass: Record<CourseStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  full: "border-amber-200 bg-amber-50 text-amber-700",
  closed: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

const reservationStatusText: Record<ReservationStatus, string> = {
  booked: "已預約",
  cancelled: "已取消",
};

const attendanceStatusText: Record<AttendanceStatus, string> = {
  pending: "待確認",
  attended: "已到",
  absent: "未到",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${courseStatusClass[status]}`}>
      {courseStatusText[status]}
    </span>
  );
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
      {reservationStatusText[status]}
    </span>
  );
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const className =
    status === "attended"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "absent"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-zinc-200 bg-zinc-100 text-zinc-600";

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {attendanceStatusText[status]}
    </span>
  );
}
