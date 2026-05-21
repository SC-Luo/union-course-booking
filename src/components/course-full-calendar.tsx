"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileCourseCalendar } from "@/components/mobile-course-calendar";
import { getRemainingSeats, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type CourseFullCalendarProps = {
  courses: Course[];
  categories: CourseCategory[];
};

type CalendarSession = {
  course: Course;
  session: CourseSession;
  color: string;
  remainingSeats: number;
  isFull: boolean;
  shortTitle: string;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function buildCalendarDays(currentMonth: Date, sessions: CalendarSession[]) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      date: dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === formatDateKey(new Date()),
      sessions: sessions.filter((item) => item.session.date === dateKey),
    };
  });
}

function getInitialMonth(firstDate: string) {
  const [year, month] = firstDate.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function CourseFullCalendar({ courses, categories }: CourseFullCalendarProps) {
  const router = useRouter();
  const today = new Date();
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
            return {
              course,
              session,
              color,
              remainingSeats,
              isFull: remainingSeats <= 0,
              shortTitle: getShortCourseTitle(course.title),
            } satisfies CalendarSession;
          });
      })
      .sort((a, b) => `${a.session.date} ${a.session.startTime}`.localeCompare(`${b.session.date} ${b.session.startTime}`));
  }, [courses, categories]);

  // 前台日曆預設停在「今天所在月份」，避免第一筆未來課程把使用者帶到錯誤月份。
  const [currentMonth, setCurrentMonth] = useState(() => getInitialMonth(todayKey));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth, calendarSessions),
    [currentMonth, calendarSessions],
  );
  const selectedSessions = calendarSessions.filter((item) => item.session.date === selectedDate);

  function goPreviousMonth() {
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1));
  }

  function goNextMonth() {
    setCurrentMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1));
  }

  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  function openSession(item: CalendarSession) {
    if (item.course.id && item.session.id) {
      router.push(`/courses/${item.course.id}/book/${item.session.id}`);
    } else {
      router.push(`/courses/${item.course.id}`);
    }
  }

  return (
    <section className="space-y-4">
      <div className="block md:hidden">
        <MobileCourseCalendar courses={courses} categories={categories} />
      </div>

      <div className="hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPreviousMonth}
              className="rounded-md bg-slate-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-md bg-slate-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              ›
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-md bg-slate-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-600 active:scale-[0.98]"
            >
              今天
            </button>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-950">{getMonthTitle(currentMonth)}</h2>
          <div className="w-[120px]" />
        </div>

        <div className="grid grid-cols-7 border border-zinc-200 text-center text-sm font-semibold text-zinc-800">
          {["週日", "週一", "週二", "週三", "週四", "週五", "週六"].map((day) => (
            <div key={day} className="border-b border-zinc-200 py-3">
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            const isSelected = day.date === selectedDate;
            return (
              <div
                key={`${day.date}-${index}`}
                className={`min-h-[150px] border-r border-t border-zinc-200 p-2 align-top transition-colors ${
                  day.isCurrentMonth ? "bg-white text-zinc-950" : "bg-zinc-50 text-zinc-300"
                } ${isSelected ? "bg-amber-50/60 ring-2 ring-inset ring-amber-300" : "hover:bg-zinc-50"}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`mb-2 flex w-full items-center justify-end rounded-md px-1 py-1 text-sm transition ${
                    isSelected ? "font-semibold text-zinc-950" : "hover:bg-zinc-100"
                  } ${day.isToday ? "text-amber-700" : ""}`}
                >
                  {day.day}
                </button>
                <div className="grid gap-1.5">
                  {day.sessions.map((item) => (
                    <button
                      key={item.session.id}
                      type="button"
                      onClick={() => openSession(item)}
                      className="group overflow-hidden rounded-lg p-2 text-left text-white shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                      style={{ backgroundColor: item.isFull ? "#a1a1aa" : item.color }}
                      title={`${item.shortTitle} ${item.session.startTime}-${item.session.endTime}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold">
                          {item.session.startTime}-{item.session.endTime}
                        </span>
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">
                          {item.isFull ? "額滿" : `剩 ${item.remainingSeats}`}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">{item.shortTitle}</div>
                      <div className="mt-1 truncate text-[11px] text-white/90">
                        名額 {item.session.bookedCount}/{item.session.capacity}
                      </div>
                      {item.session.location ? (
                        <div className="truncate text-[10px] text-white/75">{item.session.location}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">{getDisplayDate(selectedDate)} 的可預約課程</h3>
            <p className="mt-1 text-sm text-zinc-500">滑鼠移到日期格會有 hover 回饋，點選日期後可在下方查看當日詳細時段。</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {selectedSessions.length} 堂
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {selectedSessions.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">這一天目前沒有可預約的課程。</p>
          ) : (
            selectedSessions.map((item) => (
              <button
                key={item.session.id}
                type="button"
                onClick={() => openSession(item)}
                className="rounded-xl border border-zinc-200 bg-white p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: item.isFull ? "#a1a1aa" : item.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-500">{item.course.title}</p>
                        <h4 className="mt-1 text-base font-semibold text-zinc-950">{item.session.topic || "課程時段"}</h4>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isFull ? "bg-zinc-100 text-zinc-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {item.isFull ? "已額滿" : `尚餘 ${item.remainingSeats} 位`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                      <p>時間：{item.session.startTime} - {item.session.endTime}</p>
                      <p>名額：{item.session.bookedCount}/{item.session.capacity}</p>
                      <p>地點：{item.session.location || "未提供"}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
