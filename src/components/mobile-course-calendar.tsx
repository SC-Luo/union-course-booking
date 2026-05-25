"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { canChangeReservation, formatReservationCutoff, getCategoryName, getRemainingSeats, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type MobileCourseCalendarProps = { courses: Course[]; categories: CourseCategory[] };

type CalendarSessionItem = {
  courseId: string;
  sessionId: string;
  courseTitle: string;
  categoryId: string;
  categoryName: string;
  color: string;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  remainingSeats: number;
  label: string;
  tone: "bookable" | "locked" | "full" | "closed";
  isBookable: boolean;
};

function getShortCourseTitle(title: string) {
  return title.replace("保證班", "").replace("課程", "").replace("證照", "").trim();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthTitle(date: Date) { return `${date.getFullYear()}年${date.getMonth() + 1}月`; }
function getWeekdayLabel(dateKey: string) { const date = new Date(`${dateKey}T00:00:00`); return ["日", "一", "二", "三", "四", "五", "六"][date.getDay()]; }
function getDisplayDate(dateKey: string) { const [, month, day] = dateKey.split("-"); return `${Number(month)}/${Number(day)}（${getWeekdayLabel(dateKey)}）`; }
function isReservableStatus(status?: string) { return ["scheduled", "rescheduled", "makeup", undefined, ""].includes(status); }
function getAvailability(course: Course, session: CourseSession) {
  if (!course.isActive || !session.isActive) return { label: "未開放", tone: "closed" as const };
  if (!isReservableStatus(session.status)) {
    if (session.status === "cancelled") return { label: "已取消", tone: "closed" as const };
    if (session.status === "suspended") return { label: "停課", tone: "closed" as const };
    return { label: "不可約", tone: "closed" as const };
  }
  if (getRemainingSeats(session) <= 0) return { label: "額滿", tone: "full" as const };
  if (!canChangeReservation(session)) return { label: "已鎖定", tone: "locked" as const };
  return { label: "可預約", tone: "bookable" as const };
}
function bookingHref(courseId: string, sessionId?: string) {
  const safeCourseId = encodeURIComponent(courseId);
  if (!sessionId) return `/courses/${safeCourseId}`;
  return `/courses/${safeCourseId}/book/${encodeURIComponent(sessionId)}`;
}

function statusClass(tone: CalendarSessionItem["tone"]) {
  if (tone === "bookable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "locked") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "full") return "border-stone-200 bg-stone-100 text-stone-600";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function buildCalendarDays(currentMonth: Date, sessions: CalendarSessionItem[]) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateKey = formatDateKey(date);
    return { date: dateKey, day: date.getDate(), isCurrentMonth: date.getMonth() === month, sessions: sessions.filter((session) => session.date === dateKey) };
  });
}

function SessionModal({ item, onClose }: { item: CalendarSessionItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2218]/55 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#ead8c6] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold" style={{ color: item.color }}>{item.categoryName}</p>
            <h3 className="mt-2 text-xl font-black text-[#34231a]">{item.courseTitle}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#d8bda4] px-3 py-2 text-sm font-bold text-[#6f4325]">關閉</button>
        </div>
        <div className="mt-4 grid gap-2 rounded-2xl bg-[#fff7ef] p-4 text-sm text-[#6f4b35]">
          <p><span className="font-bold text-[#34231a]">日期：</span>{item.date}</p>
          <p><span className="font-bold text-[#34231a]">時間：</span>{item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}</p>
          <p><span className="font-bold text-[#34231a]">地點：</span>{item.location || "未提供"}</p>
          <p><span className="font-bold text-[#34231a]">課堂狀態：</span><span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-black ${statusClass(item.tone)}`}>{item.label}</span></p>
          <p><span className="font-bold text-[#34231a]">剩餘名額：</span>{item.remainingSeats}</p>
          <p><span className="font-bold text-[#34231a]">預約鎖定：</span>{formatReservationCutoff({ date: item.date })}</p>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#7b6252]">開課前 7 天起，課堂會鎖定，無法新增或取消預約。</p>
        <div className="mt-5 grid gap-3">
          <Link href={item.isBookable ? bookingHref(item.courseId, item.sessionId) : bookingHref(item.courseId)} className={`rounded-full px-5 py-3 text-center text-sm font-black text-white ${item.isBookable ? "bg-[#9b4f1f]" : "bg-stone-400"}`}>
            {item.isBookable ? "確認資格並預約" : "查看課程資訊"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MobileCourseCalendar({ courses, categories }: MobileCourseCalendarProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);

  const sessions = useMemo<CalendarSessionItem[]>(() => courses.flatMap((course) => course.sessions.filter((session: CourseSession) => session.isActive).map((session: CourseSession) => {
    const remainingSeats = getRemainingSeats(session);
    const category = categories.find((item) => item.id === course.categoryId);
    const color = resolveCourseColor(course, category);
    const availability = getAvailability(course, session);
    return {
      courseId: course.id,
      sessionId: session.id ?? `${course.id}-${session.date}-${session.startTime}`,
      courseTitle: getShortCourseTitle(course.displayTitle ?? course.title),
      categoryId: course.categoryId,
      categoryName: getCategoryName(course.categoryId, categories),
      color,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
      remainingSeats,
      label: availability.label,
      tone: availability.tone,
      isBookable: availability.tone === "bookable",
    };
  })).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)), [courses, categories]);

  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [modalSession, setModalSession] = useState<CalendarSessionItem | null>(null);
  const visibleCategories = useMemo(() => Array.from(new Map(sessions.map((session) => [session.categoryId, session])).values()), [sessions]);
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth, sessions), [currentMonth, sessions]);
  const selectedSessions = sessions.filter((session) => session.date === selectedDate);

  return (
    <section className="space-y-4">
      <div className="rounded-[1.5rem] border border-[#ead8c6] bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-black text-[#34231a]">日曆看課</p>
          <p className="mt-1 text-xs leading-5 text-[#8a6a55]">點選日期看課程，再點課堂卡片打開預約視窗。</p>
          {visibleCategories.length > 0 ? <div className="mt-3 flex flex-wrap gap-3">{visibleCategories.map((session) => <div key={session.categoryId} className="flex items-center gap-2 text-sm text-[#6f4b35]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: session.color }} /><span>{session.categoryName}</span></div>)}</div> : null}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="rounded-full bg-[#3a2a20] px-3 py-2 text-sm font-bold text-white">上月</button>
          <button type="button" onClick={() => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }} className="rounded-full border border-[#d8bda4] bg-white px-3 py-2 text-sm font-bold text-[#6f4325]">今天</button>
          <button type="button" onClick={() => setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="rounded-full bg-[#3a2a20] px-3 py-2 text-sm font-bold text-white">下月</button>
        </div>

        <h2 className="mb-3 text-center text-xl font-black text-[#34231a]">{getMonthTitle(currentMonth)}</h2>
        <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[#ead8c6] text-center text-xs font-bold text-[#6b4b36]">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div key={day} className="border-b border-[#ead8c6] bg-[#fff7ef] py-2">{day}</div>)}
          {calendarDays.map((day, index) => {
            const isSelected = day.date === selectedDate;
            const visibleDots = day.sessions.slice(0, 3);
            const hiddenCount = day.sessions.length - visibleDots.length;
            return (
              <button key={`${day.date}-${index}`} type="button" onClick={() => setSelectedDate(day.date)} className={`min-h-16 border-r border-t border-[#ead8c6] p-1 text-left align-top ${isSelected ? "bg-[#fff4e8] ring-2 ring-inset ring-[#d9823b]" : "bg-white"} ${day.isCurrentMonth ? "text-[#34231a]" : "text-[#c7ac94]"}`}>
                <div className="text-right text-xs">{day.day}</div>
                <div className="mt-2 flex flex-wrap gap-1">{visibleDots.map((session) => <span key={session.sessionId} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: session.color }} />)}{hiddenCount > 0 ? <span className="text-[10px] leading-none text-[#8a6a55]">+{hiddenCount}</span> : null}</div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-[1.5rem] border border-[#ead8c6] bg-white p-4 shadow-sm">
        <h2 className="text-base font-black text-[#34231a]">{getDisplayDate(selectedDate)} 的課程</h2>
        {selectedSessions.length === 0 ? <div className="mt-3 rounded-2xl bg-[#fff7ef] p-4 text-sm leading-6 text-[#8a6a55]"><p>這一天目前沒有課程。</p><p className="mt-1">你可以點選月曆中有顏色圓點的日期查看其他課程。</p></div> : <div className="mt-4 space-y-3">{selectedSessions.map((session) => <button key={session.sessionId} type="button" onClick={() => setModalSession(session)} className="block w-full rounded-2xl border border-[#ead8c6] p-4 text-left transition hover:border-[#d8bda4] hover:bg-[#fffaf5]"><div className="flex items-start gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: session.color }} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-[#8a6a55]">{session.categoryName}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-black ${statusClass(session.tone)}`}>{session.label}</span></div><h3 className="mt-1 text-base font-black text-[#34231a]">{session.courseTitle}</h3><p className="mt-2 text-sm text-[#6f4b35]">時間：{session.startTime}{session.endTime ? ` - ${session.endTime}` : ""}</p><p className="mt-1 text-sm text-[#6f4b35]">地點：{session.location || "未提供"}</p><p className="mt-1 text-sm text-[#6f4b35]">剩餘名額：{session.remainingSeats}</p></div></div></button>)}</div>}
      </section>

      <SessionModal item={modalSession} onClose={() => setModalSession(null)} />
    </section>
  );
}
