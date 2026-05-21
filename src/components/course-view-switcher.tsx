"use client";

import Link from "next/link";
import { useState } from "react";
import { CourseFullCalendar } from "@/components/course-full-calendar";
import { CourseStatusBadge } from "@/components/status-badge";
import { getCategoryName, getCourseStatus, getRemainingSeats, resolveCourseColor } from "@/lib/course-utils";
import type { Course, CourseCategory, CourseSession } from "@/lib/types";

type CourseViewSwitcherProps = {
  courses: Course[];
  categories: CourseCategory[];
};

export function CourseViewSwitcher({ courses, categories }: CourseViewSwitcherProps) {
  const [viewMode, setViewMode] = useState<"card" | "calendar">("calendar");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode("card")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            viewMode === "card"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          卡片檢視
        </button>

        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            viewMode === "calendar"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          日曆檢視
        </button>
      </div>

      {viewMode === "card" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => {
            const status = getCourseStatus(course);
            const category = categories.find((item) => item.id === course.categoryId);
            const courseColor = resolveCourseColor(course, category);
            const activeSessions = course.sessions.filter((session: CourseSession) => session.isActive);
            const remainingSeats = activeSessions.reduce(
              (total: number, session: CourseSession) => total + getRemainingSeats(session),
              0
            );
            const nextSession = activeSessions[0] ?? course.sessions[0];

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
              >
                <div className="h-2 w-full" style={{ backgroundColor: courseColor }} />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: courseColor }}>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: courseColor }} aria-hidden="true" />
                        {getCategoryName(course.categoryId, categories)}
                      </p>
                      <h2 className="text-xl font-semibold text-zinc-950">{course.title}</h2>
                    </div>

                    <CourseStatusBadge status={status} />
                  </div>

                  <p className="mb-5 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {course.description}
                  </p>

                  <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                    <p>
                      最近時段：{nextSession.date} {nextSession.startTime}
                    </p>
                    <p>剩餘名額：{remainingSeats}</p>
                    <p className="sm:col-span-2">地點：{nextSession.location}</p>
                  </div>

                  <p className="mt-5 rounded-md px-4 py-3 text-center text-sm font-semibold text-white transition group-hover:opacity-90" style={{ backgroundColor: courseColor }}>
                    查看可預約時段
                  </p>
                </div>
              </Link>
            );
          })}

          {courses.length === 0 ? (
            <article className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600 md:col-span-2">
              目前沒有符合條件的開放課程。
            </article>
          ) : null}
        </section>
      ) : (
        <CourseFullCalendar courses={courses} categories={categories} />
      )}
    </section>
  );
}
