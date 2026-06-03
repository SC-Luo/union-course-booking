"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateRosterAttendanceAction } from "@/app/admin/actions";
import type { AttendanceStatus } from "@/lib/types";

type TimedStatus = "late" | "leave";

type AttendanceStatusControlsProps = {
  reservationId: string;
  sessionId: string;
  courseId: string;
  studentId?: string;
  teacherName?: string;
  currentStatus?: string;
  redirectTo: string;
  lateTime?: string;
  leaveStartTime?: string;
  leaveEndTime?: string;
  timeOptions?: string[];
  action?: (formData: FormData) => void | Promise<void>;
};

const STATUS_ITEMS: Array<{ status: AttendanceStatus; label: string }> = [
  { status: "attended", label: "已到" },
  { status: "absent", label: "未到" },
];

const ATTENDANCE_SCROLL_KEY = "union-admin-attendance-scroll-y";

function rememberAttendanceScroll() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ATTENDANCE_SCROLL_KEY, String(window.scrollY));
}

function restoreAttendanceScroll() {
  if (typeof window === "undefined") return;

  const saved = window.sessionStorage.getItem(ATTENDANCE_SCROLL_KEY);
  if (!saved) return;

  window.sessionStorage.removeItem(ATTENDANCE_SCROLL_KEY);
  const scrollY = Number(saved);

  if (!Number.isFinite(scrollY)) return;

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
  });
}

function attendanceActionButtonClass(status: AttendanceStatus, active: boolean) {
  const base = "inline-flex h-9 min-w-0 w-full shrink-0 items-center justify-center rounded-xl border px-1 text-[13px] font-black transition disabled:cursor-wait disabled:opacity-60 md:h-10 md:min-w-[64px] md:w-auto md:flex-none md:px-3 md:text-xs";
  const activeClass = status === "attended"
    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
    : status === "absent"
      ? "border-rose-500 bg-rose-500 text-white shadow-sm"
      : status === "late"
        ? "border-orange-500 bg-orange-500 text-white shadow-sm"
        : status === "leave"
          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
          : "border-[#6b3b25] bg-[#6b3b25] text-white shadow-sm";
  const inactiveClass = "border-[#ead8ca] bg-white text-[#6b3b25] hover:border-[#d7bda8] hover:bg-[#fffaf5]";

  return `${base} ${active ? activeClass : inactiveClass}`;
}

function isStatusActive(status: AttendanceStatus, currentStatus?: string, hasLeaveDetail = false) {
  return currentStatus === status ||
    (status === "pending" && (currentStatus === "reserved" || currentStatus === "pending")) ||
    (status === "leave" && hasLeaveDetail);
}

function buildFallbackTimeOptions() {
  return ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
}

function AttendanceHiddenFields({
  reservationId,
  sessionId,
  courseId,
  studentId,
  teacherName,
  status,
  redirectTo,
}: {
  reservationId: string;
  sessionId: string;
  courseId: string;
  studentId?: string;
  teacherName?: string;
  status: AttendanceStatus;
  redirectTo: string;
}) {
  return (
    <>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="studentId" value={studentId ?? ""} />
      {teacherName ? <input type="hidden" name="teacherName" value={teacherName} /> : null}
      <input type="hidden" name="attendanceStatus" value={status} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
    </>
  );
}

function SubmitButton({ status, active, label }: { status: AttendanceStatus; active: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={attendanceActionButtonClass(status, active)}>
      {pending ? "處理中…" : active ? `${label} ✓` : label}
    </button>
  );
}

function TimedModal({
  status,
  reservationId,
  sessionId,
  courseId,
  studentId,
  teacherName,
  redirectTo,
  defaultLateTime,
  defaultLeaveStartTime,
  defaultLeaveEndTime,
  options,
  action,
  onClose,
}: {
  status: TimedStatus;
  reservationId: string;
  sessionId: string;
  courseId: string;
  studentId?: string;
  teacherName?: string;
  redirectTo: string;
  defaultLateTime: string;
  defaultLeaveStartTime: string;
  defaultLeaveEndTime: string;
  options: string[];
  action: (formData: FormData) => void | Promise<void>;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();
  const title = status === "late" ? "標記遲到時間" : "標記請假時段";
  const description = status === "late" ? "選擇學員實際到達時間。" : "選擇學員請假的開始與結束時間。";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 py-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[28px] border border-[#ead8ca] bg-white p-5 shadow-2xl">
        <div className="mb-4">
          <p className="text-sm font-black text-[#1f1712]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#8a7c72]">{description}</p>
        </div>
        <form action={action} onSubmit={rememberAttendanceScroll} className="grid gap-4">
          <AttendanceHiddenFields reservationId={reservationId} sessionId={sessionId} courseId={courseId} studentId={studentId} teacherName={teacherName} status={status} redirectTo={redirectTo} />
          {status === "late" ? (
            <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
              到達時間
              <select
                name="lateTime"
                defaultValue={defaultLateTime}
                className="h-12 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                aria-label="遲到時間"
              >
                {options.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                請假開始
                <select
                  name="leaveStartTime"
                  defaultValue={defaultLeaveStartTime}
                  className="h-12 rounded-2xl border border-violet-200 bg-violet-50 px-4 text-sm font-bold text-violet-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  aria-label="請假開始時間"
                >
                  {options.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
                請假結束
                <select
                  name="leaveEndTime"
                  defaultValue={defaultLeaveEndTime}
                  className="h-12 rounded-2xl border border-violet-200 bg-violet-50 px-4 text-sm font-bold text-violet-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  aria-label="請假結束時間"
                >
                  {options.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-3 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed] disabled:cursor-wait disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl bg-[#5A3726] px-5 py-3 text-sm font-bold text-white shadow-sm hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "處理中…" : "確認"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AttendanceStatusControls({
  reservationId,
  sessionId,
  courseId,
  studentId,
  teacherName,
  currentStatus,
  redirectTo,
  lateTime,
  leaveStartTime,
  leaveEndTime,
  timeOptions = [],
  action = updateRosterAttendanceAction,
}: AttendanceStatusControlsProps) {
  const [modalStatus, setModalStatus] = useState<TimedStatus | null>(null);
  const options = useMemo(() => timeOptions.length > 0 ? timeOptions : buildFallbackTimeOptions(), [timeOptions]);
  const defaultLateTime = lateTime || options[0] || "09:00";
  const defaultLeaveStartTime = leaveStartTime || options[0] || "09:00";
  const defaultLeaveEndTime = leaveEndTime || options[Math.min(options.length - 1, 1)] || "09:30";
  const hasLeaveDetail = Boolean(leaveStartTime || leaveEndTime);

  useEffect(() => {
    restoreAttendanceScroll();
  }, []);

  return (
    <>
      <div className="grid grid-cols-4 gap-1 md:flex md:flex-nowrap md:items-center md:overflow-x-auto md:pb-1 xl:overflow-visible">
        {STATUS_ITEMS.map((item) => {
          const active = isStatusActive(item.status, currentStatus, hasLeaveDetail);
          return (
            <form key={item.status} action={action} onSubmit={rememberAttendanceScroll}>
              <AttendanceHiddenFields reservationId={reservationId} sessionId={sessionId} courseId={courseId} studentId={studentId} teacherName={teacherName} status={item.status} redirectTo={redirectTo} />
              <SubmitButton status={item.status} active={active} label={item.label} />
            </form>
          );
        })}
        <button
          type="button"
          onClick={() => setModalStatus("late")}
          className={attendanceActionButtonClass("late", currentStatus === "late")}
        >
          {currentStatus === "late" ? "遲到 ✓" : "遲到"}
        </button>
        <button
          type="button"
          onClick={() => setModalStatus("leave")}
          className={attendanceActionButtonClass("leave", isStatusActive("leave", currentStatus, hasLeaveDetail))}
        >
          {isStatusActive("leave", currentStatus, hasLeaveDetail) ? "請假 ✓" : "請假"}
        </button>
      </div>

      {modalStatus ? (
        <TimedModal
          status={modalStatus}
          reservationId={reservationId}
          sessionId={sessionId}
          courseId={courseId}
          studentId={studentId}
          teacherName={teacherName}
          redirectTo={redirectTo}
          defaultLateTime={defaultLateTime}
          defaultLeaveStartTime={defaultLeaveStartTime}
          defaultLeaveEndTime={defaultLeaveEndTime}
          options={options}
          action={action}
          onClose={() => setModalStatus(null)}
        />
      ) : null}
    </>
  );
}
