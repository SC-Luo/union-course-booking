"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MobileCourseCalendar } from "@/components/mobile-course-calendar";
import { canChangeReservation, formatReservationCutoff, getRemainingSeats, isSessionBookableByStatus, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type CourseFullCalendarProps = { courses: Course[]; categories: CourseCategory[] };
const TAIPEI_TIMEZONE = "Asia/Taipei";

type AvailabilityTone = "bookable" | "locked" | "full" | "closed";

type CalendarSession = {
  course: Course;
  session: CourseSession;
  color: string;
  remainingSeats: number;
  isBookable: boolean;
  shortTitle: string;
  label: string;
  tone: AvailabilityTone;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTaipeiDateParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  return { year, month, day };
}

function getTaipeiToday() {
  const { year, month, day } = getTaipeiDateParts();
  return new Date(year, month - 1, day);
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getShortCourseTitle(title: string) {
  return title.replace("保證班", "").replace("課程", "").replace("證照", "").trim();
}

function getDisplayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${year}/${month}/${day}（${weekday}）`;
}

function getSessionDisplayStatus(session: CourseSession) {
  return String(session.sessionStatus ?? session.status ?? "scheduled").trim() || "scheduled";
}

function getAvailability(course: Course, session: CourseSession) {
  const status = getSessionDisplayStatus(session);

  if (!course.isActive || session.isActive === false) return { label: "未開放", tone: "closed" as const };
  if (status === "cancelled") return { label: "已取消", tone: "closed" as const };
  if (status === "suspended") return { label: "本堂停課", tone: "closed" as const };
  if (status === "makeup") return { label: "補課", tone: "bookable" as const };
  if (status === "rescheduled") return { label: "已調課", tone: "closed" as const };
  if (!isSessionBookableByStatus(session)) return { label: "暫不開放", tone: "closed" as const };
  if (getRemainingSeats(session) <= 0) return { label: "額滿", tone: "full" as const };
  if (!canChangeReservation(session)) return { label: "報名截止", tone: "locked" as const };
  return { label: "可預約", tone: "bookable" as const };
}

function statusClass(tone: AvailabilityTone) {
  if (tone === "bookable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "locked") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "full") return "border-stone-200 bg-stone-100 text-stone-600";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function buildCalendarDays(currentMonth: Date, sessions: CalendarSession[]) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());
  const taipeiTodayKey = formatDateKey(getTaipeiToday());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateKey = formatDateKey(date);
    return {
      date: dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === taipeiTodayKey,
      sessions: sessions.filter((item) => item.session.date === dateKey),
    };
  });
}

function bookingHref(courseId: string, sessionId?: string) {
  const safeCourseId = encodeURIComponent(courseId);
  if (!sessionId) return `/courses/${safeCourseId}`;
  return `/courses/${safeCourseId}/book/${encodeURIComponent(sessionId)}`;
}

function SessionModal({ item, onClose }: { item: CalendarSession | null; onClose: () => void }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2218]/55 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold" style={{ color: item.color }}>{item.course.displayTitle ?? item.course.title}</p>
            <h3 className="mt-2 text-2xl font-black text-[#34231a]">{item.session.topic || "課堂時段"}</h3>
            <p className="mt-2 text-sm leading-6 text-[#7b6252]">{item.session.date}｜{item.session.startTime} - {item.session.endTime}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#d8bda4] px-4 py-2 text-sm font-bold text-[#6f4325] hover:bg-[#fff4e8]">關閉</button>
        </div>

        <div className="grid gap-3 rounded-3xl bg-[#fff7ef] p-4 text-sm text-[#6f4b35] sm:grid-cols-2">
          <p><span className="font-bold text-[#34231a]">課堂狀態：</span><span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-black ${statusClass(item.tone)}`}>{item.label}</span></p>
          <p><span className="font-bold text-[#34231a]">剩餘名額：</span>{item.remainingSeats}</p>
          <p className="sm:col-span-2"><span className="font-bold text-[#34231a]">地點：</span>{item.session.location || "未提供"}</p>
          <p className="sm:col-span-2"><span className="font-bold text-[#34231a]">報名截止：</span>{formatReservationCutoff(item.session)}</p>
        </div>

        <div className="mt-5 rounded-3xl border border-[#ead8c6] bg-white p-4 text-sm leading-6 text-[#7b6252]">
          <p className="font-bold text-[#34231a]">預約說明</p>
          <p className="mt-2">預約時只需輸入名冊中的姓名。開課前 7 天起停止新增或取消預約。</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-full border border-[#d8bda4] px-5 py-3 text-sm font-bold text-[#6f4325] hover:bg-[#fff4e8]">先關閉</button>
          <Link href={item.isBookable ? bookingHref(item.course.id, item.session.id) : bookingHref(item.course.id)} className={`rounded-full px-5 py-3 text-center text-sm font-black text-white ${item.isBookable ? "bg-[#9b4f1f] hover:bg-[#7d3e18]" : "bg-stone-400 hover:bg-stone-500"}`}>
            {item.isBookable ? "確認資格並預約" : "查看課程資訊"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CourseFullCalendar({ courses, categories }: CourseFullCalendarProps) {
  const today = getTaipeiToday();
  const todayKey = formatDateKey(today);

  const calendarSessions = useMemo(() => {
    return courses
      .flatMap((course) => {
        const category = categories.find((item) => item.id === course.categoryId);
        const color = resolveCourseColor(course, category);
        return course.sessions
          .filter((session) => session.isActive)
          .map((session) => {
            const remainingSeats = getRemainingSeats(session);
            const availability = getAvailability(course, session);
            return {
              course,
              session,
              color,
              remainingSeats,
              isBookable: availability.tone === "bookable",
              shortTitle: getShortCourseTitle(course.displayTitle ?? course.title),
              label: availability.label,
              tone: availability.tone,
            } satisfies CalendarSession;
          });
      })
      .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));
  }, [courses, categories]);

  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [modalSession, setModalSession] = useState<CalendarSession | null>(null);
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth, calendarSessions), [currentMonth, calendarSessions]);
  const selectedSessions = calendarSessions.filter((item) => item.session.date === selectedDate);

  return (
    <section className="space-y-4">
      <div className="block md:hidden"><MobileCourseCalendar courses={courses} categories={categories} /></div>

      <div className="hidden rounded-[1.75rem] border border-[#ead8c6] bg-white p-4 shadow-sm md:block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#9b4f1f]">日曆看課</p>
            <h2 className="mt-1 text-2xl font-black text-[#34231a]">{getMonthTitle(currentMonth)}</h2>
            <p className="mt-1 text-sm text-[#8a6a55]">點擊課堂卡片會在中間開啟預約視窗，不會離開目前頁面。</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))} className="rounded-full bg-[#3a2a20] px-4 py-3 text-sm font-bold text-white shadow-sm">上月</button>
            <button type="button" onClick={() => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }} className="rounded-full border border-[#d8bda4] bg-white px-4 py-3 text-sm font-bold text-[#6f4325]">今天</button>
            <button type="button" onClick={() => setCurrentMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))} className="rounded-full bg-[#3a2a20] px-4 py-3 text-sm font-bold text-white shadow-sm">下月</button>
          </div>
        </div>

        <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[#ead8c6] text-center text-sm font-bold text-[#6b4b36]">
          {["週日", "週一", "週二", "週三", "週四", "週五", "週六"].map((day) => <div key={day} className="border-b border-[#ead8c6] bg-[#fff7ef] py-3">{day}</div>)}
          {calendarDays.map((day, index) => {
            const isSelected = day.date === selectedDate;
            return (
              <div key={`${day.date}-${index}`} className={`min-h-[168px] border-r border-t border-[#ead8c6] p-2 align-top transition ${day.isCurrentMonth ? "bg-white text-[#34231a]" : "bg-[#fbf4ed] text-[#c7ac94]"} ${isSelected ? "bg-[#fffaf5] ring-2 ring-inset ring-[#d9823b]" : "hover:bg-[#fffaf5]"}`}>
                <button type="button" onClick={() => setSelectedDate(day.date)} className={`mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm transition ${isSelected ? "bg-[#fff0dd] font-black text-[#34231a]" : "hover:bg-[#f8eadc]"} ${day.isToday ? "text-[#9b4f1f]" : ""}`}>
                  <span>{day.isToday ? "今天" : ""}</span>
                  <span>{day.day}</span>
                </button>
                <div className="grid gap-2">
                  {day.sessions.slice(0, 3).map((item) => (
                    <button key={item.session.id} type="button" onClick={() => setModalSession(item)} className="rounded-2xl border border-[#ead8c6] bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8bda4] hover:shadow-md">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-black text-[#3a2a20]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.session.startTime}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${statusClass(item.tone)}`}>{item.label}</span>
                      </div>
                      <div className="line-clamp-2 text-sm font-black leading-5 text-[#34231a]">{item.shortTitle}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#8a6a55]">
                        <span>{item.session.location || "未提供"}</span>
                        <span>剩 {item.remainingSeats}</span>
                      </div>
                    </button>
                  ))}
                  {day.sessions.length > 3 ? <p className="text-left text-[11px] font-semibold text-[#8a6a55]">另有 {day.sessions.length - 3} 堂</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden rounded-[1.75rem] border border-[#ead8c6] bg-white p-5 shadow-sm md:block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#34231a]">{getDisplayDate(selectedDate)} 的課程</h3>
            <p className="mt-1 text-sm text-[#8a6a55]">點擊下方課堂卡片，可直接打開預約浮動視窗。</p>
          </div>
          <span className="rounded-full bg-[#fff4e8] px-3 py-1 text-xs font-black text-[#9b4f1f]">{selectedSessions.length} 堂</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {selectedSessions.length === 0 ? <p className="rounded-2xl bg-[#fff7ef] p-4 text-sm text-[#8a6a55] lg:col-span-2">這一天目前沒有課程。</p> : selectedSessions.map((item) => (
            <button key={item.session.id} type="button" onClick={() => setModalSession(item)} className="rounded-2xl border border-[#ead8c6] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#d8bda4] hover:shadow-md">
              <div className="flex items-start gap-4">
                <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#8a6a55]">{item.course.displayTitle ?? item.course.title}</p>
                      <h4 className="mt-1 text-base font-black text-[#34231a]">{item.session.topic || "課程時段"}</h4>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.tone)}`}>{item.label}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#6f4b35] sm:grid-cols-3"><p>時間：{item.session.startTime} - {item.session.endTime}</p><p>剩餘：{item.remainingSeats}</p><p>地點：{item.session.location || "未提供"}</p></div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <SessionModal item={modalSession} onClose={() => setModalSession(null)} />
    </section>
  );
}
