"use client";

import { useMemo, useState } from "react";

const statusOptions = [
  { id: "open", label: "開放報名", description: "學員前台可報名或預約。" },
  { id: "closed", label: "關閉報名", description: "保留資料，但不再接受報名。" },
  { id: "draft", label: "草稿", description: "暫存年度課程，尚未對外開放。" },
];

function buildTermLabel(term: string) {
  const clean = String(term ?? "").trim();
  if (!clean) return "";
  if (clean.includes("期")) return clean;
  return `第${clean}期`;
}

type Props = {
  initialYear?: string | number;
  initialTerm?: string | number;
  initialClassDisplayName?: string;
  initialCapacity?: string | number;
  initialBookingStatus?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialPrimaryInstructorName?: string;
  initialLocation?: string;
  initialNotes?: string;
};

const fieldClass = "grid gap-1 text-sm font-semibold text-[#4e4038]";
const inputClass = "h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10";
const helperClass = "text-xs font-normal leading-5 text-[#8a7c72]";

export function CourseOfferingEditFields({
  initialYear,
  initialTerm,
  initialClassDisplayName,
  initialCapacity,
  initialBookingStatus = "open",
  initialStartDate,
  initialEndDate,
  initialPrimaryInstructorName,
  initialLocation,
  initialNotes,
}: Props) {
  const [year, setYear] = useState(String(initialYear ?? ""));
  const [term, setTerm] = useState(String(initialTerm ?? ""));
  const termLabel = useMemo(() => buildTermLabel(term), [term]);

  return (
    <>
      <div className="rounded-[22px] border border-[#ead8ca] bg-white/70 p-4">
        <p className="text-xs font-bold text-[#B46F4A]">班級識別</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1.4fr]">
          <label className={fieldClass}>
            年度
            <input
              name="year"
              type="number"
              defaultValue={year}
              onChange={(event) => setYear(event.target.value)}
              className={inputClass}
              placeholder="115"
            />
            <span className={helperClass}>例如 115。</span>
          </label>
          <label className={fieldClass}>
            期別
            <input
              name="term"
              defaultValue={term}
              onChange={(event) => setTerm(event.target.value)}
              className={inputClass}
              placeholder="1"
            />
            <span className={helperClass}>系統會自動顯示為 {termLabel || "第1期"}。</span>
          </label>
          <label className={fieldClass}>
            班級顯示名稱
            <input
              name="classDisplayName"
              defaultValue={initialClassDisplayName}
              className={inputClass}
              placeholder={`${year || "115"}年｜${termLabel || "第1期"}`}
            />
            <span className={helperClass}>只在需要自訂名稱時調整。</span>
          </label>
        </div>
        <input type="hidden" name="termLabel" value={termLabel} />
      </div>

      <div className="rounded-[22px] border border-[#ead8ca] bg-white/70 p-4">
        <p className="text-xs font-bold text-[#B46F4A]">班級基本資料</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className={fieldClass}>
            名額
            <input name="capacity" type="number" defaultValue={initialCapacity} className={inputClass} />
          </label>
          <label className={fieldClass}>
            報名狀態
            <select name="bookingStatus" defaultValue={initialBookingStatus} className={inputClass}>
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            開始日期
            <input name="startDate" type="date" defaultValue={initialStartDate} className={inputClass} />
          </label>
          <label className={fieldClass}>
            結束日期
            <input name="endDate" type="date" defaultValue={initialEndDate} className={inputClass} />
          </label>
          <label className={`${fieldClass} md:col-span-2`}>
            主要講師
            <input name="primaryInstructorName" defaultValue={initialPrimaryInstructorName} className={inputClass} placeholder="講師姓名" />
          </label>
          <label className={`${fieldClass} md:col-span-2`}>
            地點
            <input name="location" defaultValue={initialLocation} className={inputClass} placeholder="上課地點" />
          </label>
          <label className={`${fieldClass} md:col-span-2`}>
            備註
            <textarea name="notes" defaultValue={initialNotes} className="min-h-24 rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal outline-none transition focus:border-[#E7892B] focus:ring-4 focus:ring-[#E7892B]/10" />
          </label>
        </div>
      </div>
    </>
  );
}

export default CourseOfferingEditFields;
