"use client";

import { useMemo, useState } from "react";
import { CourseFullCalendar } from "@/components/course-full-calendar";
import type { Course, CourseCategory } from "@/lib/types";

type CourseViewSwitcherProps = {
  courses: Course[];
  categories: CourseCategory[];
};

export function CourseViewSwitcher({ courses, categories }: CourseViewSwitcherProps) {
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
            {selectedCategoryName ? (
              <p className="mt-1 text-xs text-[#8a6a55]">目前顯示：{selectedCategoryName}</p>
            ) : (
              <p className="mt-1 text-xs text-[#8a6a55]">選擇分類後，日曆只會顯示該分類課程。</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              selectedCategory
                ? "border border-[#d8bda4] bg-white text-[#6f4325] hover:bg-[#fff4e8]"
                : "bg-[#9b4f1f] text-white shadow-sm"
            }`}
          >
            全部
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCategory(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                selectedCategory === item.id
                  ? "bg-[#9b4f1f] text-white shadow-sm"
                  : "border border-[#d8bda4] bg-white text-[#6f4325] hover:bg-[#fff4e8]"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color ?? "#d9823b" }} />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#ead8c6] bg-white/80 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#9b4f1f]">日曆看課</p>
            <h2 className="mt-1 text-2xl font-black text-[#34231a]">依日期選擇上課時段</h2>
            <p className="mt-2 text-sm leading-6 text-[#8a6a55]">
              前台改以日曆為主要入口。預約制課程可從課堂日期進入預約；固定名冊課程只作為課表資訊顯示。
            </p>
          </div>
          <p className="rounded-full border border-[#ead8c6] bg-[#fffaf5] px-4 py-2 text-xs font-bold text-[#6f4325]">
            共 {filteredCourses.length} 門課程
          </p>
        </div>

        {filteredCourses.length > 0 ? (
          <CourseFullCalendar courses={filteredCourses} categories={categories} />
        ) : (
          <article className="rounded-[1.75rem] border border-[#ead8c6] bg-white p-6 text-[#7b6252]">
            目前沒有符合條件的開放課程。
          </article>
        )}
      </section>
    </section>
  );
}
