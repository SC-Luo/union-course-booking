"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CourseFullCalendar } from "@/components/course-full-calendar";
import { canChangeReservation, formatReservationCutoff, getCategoryName, getRemainingSeats, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type CourseViewSwitcherProps = {
  courses: Course[];
  categories: CourseCategory[];
};

type Availability = {
  label: string;
  tone: "bookable" | "locked" | "full" | "closed";
};

function isReservableStatus(status?: string) {
  return ["scheduled", "rescheduled", "makeup", undefined, ""].includes(status);
}

function getSessionAvailability(course: Course, session: CourseSession): Availability {
  if (!course.isActive || !session.isActive) return { label: "未開放", tone: "closed" };
  if (!isReservableStatus(session.status)) {
    if (session.status === "cancelled") return { label: "已取消", tone: "closed" };
    if (session.status === "suspended") return { label: "停課", tone: "closed" };
    return { label: "不可預約", tone: "closed" };
  }
  if (getRemainingSeats(session) <= 0) return { label: "已額滿", tone: "full" };
  if (!canChangeReservation(session)) return { label: "已鎖定", tone: "locked" };
  return { label: "可預約", tone: "bookable" };
}

function getBookableSessions(course: Course) {
  return course.sessions
    .filter((session) => getSessionAvailability(course, session).tone === "bookable")
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

function getNearestSession(course: Course) {
  return [...course.sessions].filter((session) => session.isActive).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0] ?? course.sessions[0];
}

function statusClass(tone: Availability["tone"]) {
  if (tone === "bookable") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "locked") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "full") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function bookingHref(courseId: string, sessionId?: string) {
  const safeCourseId = encodeURIComponent(courseId);
  if (!sessionId) return `/courses/${safeCourseId}`;
  return `/courses/${safeCourseId}/book/${encodeURIComponent(sessionId)}`;
}

export function CourseViewSwitcher({ courses, categories }: CourseViewSwitcherProps) {
  const [viewMode, setViewMode] = useState<"card" | "calendar">("card");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const filteredCourses = useMemo(
    () => (selectedCategory ? courses.filter((course) => course.categoryId === selectedCategory) : courses),
    [courses, selectedCategory],
  );

  const selectedCategoryName = categories.find((item) => item.id === selectedCategory)?.name;

  return (
    <section className="space-y-5">
      <section className="rounded-3xl border border-[#ead8c6] bg-white/80 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#3a2a20]">課程分類</p>
            {selectedCategoryName ? <p className="mt-1 text-xs text-[#8a6a55]">目前顯示：{selectedCategoryName}</p> : <p className="mt-1 text-xs text-[#8a6a55]">選擇分類可快速找到課程</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedCategory("")} className={`rounded-full px-4 py-2 text-sm font-bold transition ${selectedCategory ? "border border-[#d8bda4] bg-white text-[#6f4325] hover:bg-[#fff4e8]" : "bg-[#9b4f1f] text-white shadow-sm"}`}>
            全部
          </button>
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedCategory(item.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${selectedCategory === item.id ? "bg-[#9b4f1f] text-white shadow-sm" : "border border-[#d8bda4] bg-white text-[#6f4325] hover:bg-[#fff4e8]"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color ?? "#d9823b" }} />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#ead8c6] bg-white/80 p-3 shadow-sm">
        <div className="px-2">
          <p className="text-sm font-black text-[#3a2a20]">選擇檢視方式</p>
          <p className="mt-1 text-xs text-[#8a6a55]">建議先用課程卡片確認可預約課程，也可以用日曆查日期。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-full bg-[#f3e1d0] p-1 text-sm font-bold">
          <button type="button" onClick={() => setViewMode("card")} className={`rounded-full px-4 py-2 transition ${viewMode === "card" ? "bg-[#9b4f1f] text-white shadow-sm" : "text-[#6f4325] hover:bg-white/60"}`}>
            課程卡片
          </button>
          <button type="button" onClick={() => setViewMode("calendar")} className={`rounded-full px-4 py-2 transition ${viewMode === "calendar" ? "bg-[#9b4f1f] text-white shadow-sm" : "text-[#6f4325] hover:bg-white/60"}`}>
            日曆看課
          </button>
        </div>
      </div>

      {viewMode === "card" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {filteredCourses.map((course) => {
            const category = categories.find((item) => item.id === course.categoryId);
            const courseColor = resolveCourseColor(course, category);
            const bookableSessions = getBookableSessions(course);
            const activeSessions = course.sessions.filter((session: CourseSession) => session.isActive);
            const remainingSeats = activeSessions.reduce((total: number, session: CourseSession) => total + getRemainingSeats(session), 0);
            const nextSession = bookableSessions[0] ?? getNearestSession(course);
            const availability = nextSession ? getSessionAvailability(course, nextSession) : { label: "尚無課堂", tone: "closed" as const };
            const hasBookableSession = bookableSessions.length > 0;

            return (
              <Link key={course.id} href={hasBookableSession && nextSession ? bookingHref(course.id, nextSession.id) : bookingHref(course.id)} className="group overflow-hidden rounded-[1.75rem] border border-[#ead8c6] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#d8bda4] hover:shadow-lg">
                <div className="h-1.5 w-full" style={{ backgroundColor: courseColor }} />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="mb-2 flex items-center gap-2 text-sm font-black" style={{ color: courseColor }}>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: courseColor }} aria-hidden="true" />
                        {getCategoryName(course.categoryId, categories)}
                      </p>
                      <h2 className="text-xl font-black leading-snug text-[#34231a]">{course.displayTitle ?? course.title}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${statusClass(availability.tone)}`}>{availability.label}</span>
                  </div>

                  <p className="mb-5 line-clamp-2 text-sm leading-6 text-[#7b6252]">{course.description}</p>

                  {nextSession ? (
                    <div className="grid gap-2 rounded-2xl bg-[#fff7ef] p-4 text-sm text-[#5f4634] sm:grid-cols-2">
                      <p><span className="font-bold">最近課堂：</span>{nextSession.date} {nextSession.startTime}</p>
                      <p><span className="font-bold">剩餘總名額：</span>{remainingSeats}</p>
                      <p className="sm:col-span-2"><span className="font-bold">地點：</span>{nextSession.location || "未提供"}</p>
                      <p className="sm:col-span-2"><span className="font-bold">預約鎖定：</span>{formatReservationCutoff(nextSession)}</p>
                    </div>
                  ) : null}

                  <p className={`mt-5 rounded-full px-4 py-3 text-center text-sm font-black text-white transition group-hover:opacity-90 ${hasBookableSession ? "" : "bg-stone-400"}`} style={hasBookableSession ? { backgroundColor: courseColor } : undefined}>
                    {hasBookableSession ? "確認資格並預約" : "查看課程資訊"}
                  </p>
                  <p className="mt-3 text-center text-xs leading-5 text-[#8a6a55]">開課前 7 天起，課堂將鎖定，無法新增或取消預約。</p>
                </div>
              </Link>
            );
          })}

          {filteredCourses.length === 0 ? <article className="rounded-[1.75rem] border border-[#ead8c6] bg-white p-6 text-[#7b6252] md:col-span-2">目前沒有符合條件的開放課程。</article> : null}
        </section>
      ) : (
        <CourseFullCalendar courses={filteredCourses} categories={categories} />
      )}
    </section>
  );
}
