"use client";

import { useMemo, useState } from "react";
import { getCategoryName, getRemainingSeats, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type MobileCourseCalendarProps = {
  courses: Course[];
  categories: CourseCategory[];
};

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
  isFull: boolean;
};

function getShortCourseTitle(title: string) {
  return title
    .replace("保證班", "")
    .replace("課程", "")
    .replace("證照", "")
    .trim();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getWeekdayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
}

function getDisplayDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  const normalizedMonth = Number(month);
  const normalizedDay = Number(day);
  const weekday = getWeekdayLabel(dateKey);

  return `${normalizedMonth}/${normalizedDay}（${weekday}）`;
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

    return {
      date: dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      sessions: sessions.filter((session) => session.date === dateKey),
    };
  });
}

export function MobileCourseCalendar({ courses, categories }: MobileCourseCalendarProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);

  const sessions = useMemo<CalendarSessionItem[]>(() => {
    return courses
      .flatMap((course) =>
        course.sessions
          .filter((session: CourseSession) => session.isActive)
          .map((session: CourseSession) => {
            const remainingSeats = getRemainingSeats(session);
            const category = categories.find((item) => item.id === course.categoryId);
            const color = resolveCourseColor(course, category);

            return {
              courseId: course.id,
              sessionId: session.id ?? `${course.id}-${session.date}-${session.startTime}`,
              courseTitle: getShortCourseTitle(course.title),
              categoryId: course.categoryId,
              categoryName: getCategoryName(course.categoryId, categories),
              color,
              date: session.date,
              startTime: session.startTime,
              endTime: session.endTime,
              location: session.location,
              remainingSeats,
              isFull: remainingSeats <= 0,
            };
          })
      )
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return a.startTime.localeCompare(b.startTime);
      });
  }, [courses, categories]);

  const firstSessionDate = sessions[0]?.date ?? todayKey;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const [year, month] = firstSessionDate.split("-").map(Number);
    return new Date(year, month - 1, 1);
  });

  const [selectedDate, setSelectedDate] = useState(firstSessionDate);

  const visibleCategories = useMemo(() => {
    return Array.from(new Map(sessions.map((session) => [session.categoryId, session])).values());
  }, [sessions]);

  const calendarDays = useMemo(() => {
    return buildCalendarDays(currentMonth, sessions);
  }, [currentMonth, sessions]);

  const selectedSessions = sessions.filter((session) => session.date === selectedDate);

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

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-medium text-zinc-900">課程日期說明</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            有顏色圓點的日期代表當天有課程，點選日期後可查看詳細場次。
          </p>
          {visibleCategories.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">目前沒有可顯示的課程類別。</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-3">
              {visibleCategories.map((session) => (
                <div key={session.categoryId} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: session.color }} />
                  <span>{session.categoryName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={goPreviousMonth}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            上月
          </button>

          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
          >
            今天
          </button>

          <button
            type="button"
            onClick={goNextMonth}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            下月
          </button>
        </div>

        <h2 className="mb-3 text-center text-xl font-semibold text-zinc-950">
          {getMonthTitle(currentMonth)}
        </h2>

        <div className="grid grid-cols-7 border border-zinc-200 text-center text-xs font-semibold text-zinc-700">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <div key={day} className="border-b border-zinc-200 py-2">
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            const isSelected = day.date === selectedDate;
            const visibleDots = day.sessions.slice(0, 3);
            const hiddenCount = day.sessions.length - visibleDots.length;

            return (
              <button
                key={`${day.date}-${index}`}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`min-h-16 border-r border-t border-zinc-200 p-1 text-left align-top ${
                  isSelected ? "bg-emerald-50 ring-2 ring-inset ring-emerald-500" : "bg-white"
                } ${day.isCurrentMonth ? "text-zinc-950" : "text-zinc-300"}`}
              >
                <div className="text-right text-xs">{day.day}</div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {visibleDots.map((session) => (
                    <span
                      key={session.sessionId}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: session.isFull ? "#d4d4d8" : session.color }}
                    />
                  ))}

                  {hiddenCount > 0 ? (
                    <span className="text-[10px] leading-none text-zinc-500">+{hiddenCount}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-950">
          {getDisplayDate(selectedDate)} 的課程
        </h2>
        {selectedSessions.length === 0 ? (
          <div className="mt-3 rounded-md bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
            <p>這一天目前沒有可預約課程。</p>
            <p className="mt-1">你可以點選月曆中有顏色圓點的日期查看其他課程。</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {selectedSessions.map((session) => (
              <a
                key={session.sessionId}
                href={`/courses/${session.courseId}/book/${session.sessionId}`}
                className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: session.isFull ? "#d4d4d8" : session.color }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-500">{session.categoryName}</p>

                    <h3 className="mt-1 text-base font-semibold text-zinc-950">{session.courseTitle}</h3>

                    <p className="mt-2 text-sm text-zinc-700">
                      時間：{session.startTime}
                      {session.endTime ? ` - ${session.endTime}` : ""}
                    </p>

                    <p className="mt-1 text-sm text-zinc-700">地點：{session.location}</p>

                    <p className={`mt-2 text-sm font-medium ${session.isFull ? "text-zinc-500" : "text-emerald-700"}`}>
                      {session.isFull ? "已額滿" : `剩餘名額：${session.remainingSeats}`}
                    </p>
                  </div>
                </div>

                <p className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white">
                  預約課程
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
