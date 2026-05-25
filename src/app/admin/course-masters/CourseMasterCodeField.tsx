"use client";

import { useMemo, useState } from "react";

type CategoryOption = {
  id: string;
  code?: string;
  name: string;
  description?: string;
  color?: string;
};

type CourseTypeOption = {
  id: string;
  name: string;
  description?: string;
};

type Props = {
  categories: CategoryOption[];
  courseTypes: CourseTypeOption[];
  existingCodes: string[];
  initialCategoryId?: string;
  initialCourseType?: string;
  initialCode?: string;
};

const fieldFrameClass = "relative grid min-h-[118px] content-start gap-2 text-sm font-semibold text-[#4e4038]";
const helperClass = "flex min-h-[20px] items-center gap-2 text-xs font-normal leading-5 text-[#8a7c72]";
const triggerClass = "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#dbcabd] bg-white px-3 text-left font-normal text-[#1f1712] shadow-inner shadow-[#5A3726]/[0.02] transition hover:border-[#B46F4A] focus:outline-none focus:ring-2 focus:ring-[#E7892B]/25";
const menuClass = "absolute left-0 right-0 top-[76px] z-30 max-h-72 overflow-auto rounded-2xl border border-[#ead8ca] bg-white p-2 shadow-[0_20px_55px_rgba(90,55,38,0.16)]";

function generateCode(courseType: string, categoryId: string, existingCodes: string[]) {
  if (!courseType || !categoryId) return "";

  const prefix = `${courseType}-${categoryId}`;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}(\\d{3})$`);
  const maxSequence = existingCodes.reduce((max, code) => {
    const match = code?.match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 rounded-full border border-white shadow-sm ring-1 ring-[#dbcabd]"
      style={{ backgroundColor: color }}
    />
  );
}

export function CourseMasterCodeField({
  categories,
  courseTypes,
  existingCodes,
  initialCategoryId,
  initialCourseType,
  initialCode,
}: Props) {
  const firstCategoryId = categories[0]?.id ?? "";
  const firstCourseType = courseTypes[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(initialCategoryId || firstCategoryId);
  const [courseType, setCourseType] = useState(initialCourseType || firstCourseType);
  const [openMenu, setOpenMenu] = useState<"category" | "type" | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? categories[0],
    [categories, categoryId],
  );

  const selectedCourseType = useMemo(
    () => courseTypes.find((type) => type.id === courseType) ?? courseTypes[0],
    [courseType, courseTypes],
  );

  const generatedCode = useMemo(() => {
    if (initialCode && initialCategoryId === categoryId && initialCourseType === courseType) {
      return initialCode;
    }

    return generateCode(courseType, categoryId, existingCodes.filter((code) => code !== initialCode));
  }, [categoryId, courseType, existingCodes, initialCategoryId, initialCode, initialCourseType]);

  const categoryColor = selectedCategory?.color ?? "#B46F4A";

  return (
    <>
      <div className={fieldFrameClass}>
        <span>所屬類別</span>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="color" value={categoryColor} />
        <button
          type="button"
          className={triggerClass}
          onClick={() => setOpenMenu(openMenu === "category" ? null : "category")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ColorDot color={categoryColor} />
            <span className="shrink-0 font-black text-[#5A3726]">{selectedCategory?.code ?? selectedCategory?.id}</span>
            <span className="truncate">{selectedCategory?.name ?? "請選擇類別"}</span>
          </span>
          <span className="text-[#B46F4A]">⌄</span>
        </button>
        {openMenu === "category" ? (
          <div className={menuClass}>
            {categories.map((category) => {
              const isSelected = category.id === categoryId;
              const color = category.color ?? "#B46F4A";
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-[#fff2e8] text-[#5A3726] ring-1 ring-[#E7892B]/35" : "text-[#4e4038] hover:bg-[#fffaf5]"
                  }`}
                  onClick={() => {
                    setCategoryId(category.id);
                    setOpenMenu(null);
                  }}
                >
                  <ColorDot color={color} />
                  <span className="w-10 shrink-0 font-black">{category.code ?? category.id}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
                  {isSelected ? <span className="text-xs font-bold text-[#E85F00]">已選</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        <span className={helperClass}>
          <ColorDot color={categoryColor} />
          代表色跟隨類別
        </span>
      </div>

      <div className={fieldFrameClass}>
        <span>課程類型</span>
        <input type="hidden" name="courseType" value={courseType} />
        <button
          type="button"
          className={triggerClass}
          onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="rounded-full bg-[#fff6ed] px-2.5 py-1 text-xs font-black text-[#8B5035]">{selectedCourseType?.id}</span>
            <span className="truncate">{selectedCourseType?.name ?? "請選擇類型"}</span>
          </span>
          <span className="text-[#B46F4A]">⌄</span>
        </button>
        {openMenu === "type" ? (
          <div className={menuClass}>
            {courseTypes.map((type) => {
              const isSelected = type.id === courseType;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`grid w-full gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-[#fff2e8] text-[#5A3726] ring-1 ring-[#E7892B]/35" : "text-[#4e4038] hover:bg-[#fffaf5]"
                  }`}
                  onClick={() => {
                    setCourseType(type.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="font-black">{type.name}</span>
                  <span className="text-xs font-normal leading-5 text-[#8a7c72]">{type.description ?? type.id}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <span className={helperClass}>影響目錄代碼前綴與名冊類型。</span>
      </div>

      <label className={fieldFrameClass}>
        <span>目錄代碼</span>
        <div className="flex h-12 items-center gap-2 rounded-2xl border border-[#dbcabd] bg-[#fffaf5] px-3 shadow-inner shadow-[#5A3726]/[0.03]">
          <input
            name="code"
            value={generatedCode}
            readOnly
            className="min-w-0 flex-1 bg-transparent font-mono text-base font-black uppercase text-[#5A3726] outline-none"
          />
          <span className="shrink-0 rounded-full bg-[#f5e6d9] px-2.5 py-1 text-xs font-bold text-[#8B5035]">自動產生</span>
        </div>
        <span className={helperClass}>同組合已有資料時，流水號自動 +1。</span>
      </label>
    </>
  );
}
