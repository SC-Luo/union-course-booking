"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { disableSessionAction, saveSessionAction } from "@/app/admin/actions";
import type { Course, CourseSession } from "@/lib/types";

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
  return `${Number(month)}/${Number(day)}（${getWeekdayLabel(dateKey)}）`;
}

function buildCalendarDays(currentMonth: Date, sessions: CourseSession[]) {
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

function getInitialMonth(firstDate: string) {
  const [year, month] = firstDate.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function SessionForm({
  course,
  session,
  date,
}: {
  course: Course;
  session?: CourseSession;
  date?: string;
}) {
  return (
    <form action={saveSessionAction} className="mt-3 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left">
      {session ? <input type="hidden" name="id" value={session.id} /> : null}
      <input type="hidden" name="courseId" value={course.id} />
      <input type="hidden" name="bookedCount" value={session?.bookedCount ?? 0} />
      <div className="grid gap-2 md:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          上課日期
          <input name="date" type="date" defaultValue={session?.date ?? date ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          開始時間
          <input name="startTime" type="time" defaultValue={session?.startTime ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          結束時間
          <input name="endTime" type="time" defaultValue={session?.endTime ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_120px]">
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          課堂內容
          <input name="topic" defaultValue={session?.topic ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="課堂內容" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-zinc-600">
          名額
          <input name="capacity" type="number" min={session?.bookedCount ?? 0} defaultValue={session?.capacity ?? course.totalCapacity ?? 40} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        地點
        <input name="location" defaultValue={session?.location ?? course.defaultLocation} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-600">
        預約截止時間
        <input name="bookingDeadline" defaultValue={session?.bookingDeadline ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="留空＝上課前一天 18:00" />
      </label>
      <input type="hidden" name="isActive" value={session?.isActive === false ? "false" : "true"} />
      <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">{session ? "儲存修改" : "新增這堂課"}</button>
    </form>
  );
}

type AdminCourseCalendarProps = {
  course: Course;
  categoryName: string;
  color: string;
};

export function AdminCourseCalendar({ course, categoryName, color }: AdminCourseCalendarProps) {
  const today = new Date();
  const todayKey = formatDateKey(today);

  const sessions = useMemo(() => {
    return course.sessions
      .filter((session) => session.isActive)
      .slice()
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [course.sessions]);

  const firstSessionDate = sessions[0]?.date ?? todayKey;
  const [currentMonth, setCurrentMonth] = useState(() => getInitialMonth(firstSessionDate));
  const [selectedDate, setSelectedDate] = useState(firstSessionDate);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth, sessions), [currentMonth, sessions]);
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
            點選有課卡片可直接修改時間；點選空白日期後可直接新增這一天的課堂，不會跳轉到其他頁面。
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{categoryName}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={goPreviousMonth} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
            上月
          </button>
          <button type="button" onClick={goToday} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
            今天
          </button>
          <button type="button" onClick={goNextMonth} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
            下月
          </button>
        </div>

        <h2 className="mb-3 text-center text-xl font-semibold text-zinc-950">{getMonthTitle(currentMonth)}</h2>

        <div className="grid grid-cols-7 border border-zinc-200 text-center text-xs font-semibold text-zinc-700">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <div key={day} className="border-b border-zinc-200 py-2">
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            const isSelected = day.date === selectedDate;

            return (
              <div
                key={`${day.date}-${index}`}
                className={`min-h-28 border-r border-t border-zinc-200 p-1 text-left align-top ${
                  isSelected ? "bg-emerald-50 ring-2 ring-inset ring-emerald-500" : "bg-white"
                } ${day.isCurrentMonth ? "text-zinc-950" : "text-zinc-300"}`}
              >
                <button type="button" onClick={() => setSelectedDate(day.date)} className="block w-full text-right text-xs">
                  {day.day}
                </button>
                <div className="mt-2 grid gap-1">
                  {day.sessions.map((session) => (
                    <details key={session.id} className="rounded-md border border-zinc-200 bg-white p-2 text-left" style={{ borderLeft: `5px solid ${color}` }}>
                      <summary className="cursor-pointer list-none">
                        <span className="block font-semibold text-zinc-950">{session.startTime} {session.topic || "未填單元"}</span>
                        <span className="block text-zinc-500">已報名 {session.bookedCount} / {session.capacity}</span>
                      </summary>
                      <SessionForm course={course} session={session} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/admin/sessions/${session.id}/reservations`} className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700">
                          名單 / 出席
                        </Link>
                        <form action={disableSessionAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="isActive" value="false" />
                          <button className="rounded-md border border-zinc-300 px-3 py-2 text-xs hover:bg-zinc-50">停用</button>
                        </form>
                      </div>
                    </details>
                  ))}
                  {day.sessions.length === 0 && day.isCurrentMonth ? (
                    <details>
                      <summary className="cursor-pointer rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-2 text-xs text-zinc-500 hover:bg-white">
                        ＋ 新增這天課堂
                      </summary>
                      <SessionForm course={course} date={day.date} />
                    </details>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-950">{getDisplayDate(selectedDate)} 的課程</h2>
        {selectedSessions.length === 0 ? (
          <div className="mt-3 rounded-md bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
            <p>這一天目前沒有課程時段。</p>
            <details className="mt-3">
              <summary className="cursor-pointer rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white">新增這一天的課堂</summary>
              <SessionForm course={course} date={selectedDate} />
            </details>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {selectedSessions.map((session) => (
              <details key={session.id} className="block rounded-lg border border-zinc-200 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-500">{categoryName}</p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-950">{session.topic || course.title}</h3>
                      <p className="mt-2 text-sm text-zinc-700">
                        時間：{session.startTime}{session.endTime ? ` - ${session.endTime}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">地點：{session.location}</p>
                      <p className="mt-2 text-sm font-medium text-emerald-700">
                        已報名：{session.bookedCount} / {session.capacity}
                      </p>
                    </div>
                  </div>
                </summary>
                <SessionForm course={course} session={session} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/sessions/${session.id}/reservations`} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
                    名單 / 出席
                  </Link>
                  <Link href={`/admin/sessions/${session.id}/reservations/export`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
                    匯出
                  </Link>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
