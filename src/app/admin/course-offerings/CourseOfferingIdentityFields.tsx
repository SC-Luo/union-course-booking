"use client";

import { useMemo, useState } from "react";

type SeriesOption = {
  id: string;
  title: string;
  code?: string;
  categoryId?: string;
  categoryName?: string;
  courseType?: string;
  color?: string;
  defaultCapacity?: number;
  defaultLocation?: string;
  defaultInstructorName?: string;
  rosterType?: string;
  courseMode?: string;
};

type Props = {
  seriesOptions: SeriesOption[];
  selectedSeriesId?: string;
};

type StatusOption = {
  id: string;
  label: string;
  description: string;
  tone: string;
};

const statusOptions: StatusOption[] = [
  { id: "open", label: "開放報名", description: "學員前台可以報名或預約", tone: "bg-emerald-50 text-emerald-700" },
  { id: "closed", label: "關閉報名", description: "前台暫停報名與預約", tone: "bg-[#fff6ed] text-[#8B5035]" },
  { id: "draft", label: "草稿", description: "行政先建檔，暫不對外開放", tone: "bg-amber-50 text-amber-700" },
];

const fieldFrameClass = "relative grid min-h-[118px] content-start gap-2 text-sm font-semibold text-[#4e4038]";
const helperClass = "flex min-h-[20px] items-center gap-2 text-xs font-normal leading-5 text-[#8a7c72]";
const triggerClass = "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#dbcabd] bg-white px-3 text-left font-normal text-[#1f1712] shadow-inner shadow-[#5A3726]/[0.02] transition hover:border-[#B46F4A] focus:outline-none focus:ring-2 focus:ring-[#E7892B]/25";
const menuClass = "absolute left-0 right-0 top-[76px] z-40 max-h-80 overflow-auto rounded-2xl border border-[#ead8ca] bg-white p-2 shadow-[0_20px_55px_rgba(90,55,38,0.16)]";

function buildTermLabel(term: string) {
  return term ? `第${term}期` : "";
}

function buildShortName(year: string, term: string, series?: SeriesOption) {
  const prefix = [year, term].filter(Boolean).join("-");
  const categoryName = series?.categoryName ?? series?.categoryId ?? "班級";
  return prefix ? `${prefix} ${categoryName}` : categoryName;
}

function buildOfferingCode(year: string, term: string, series?: SeriesOption) {
  const categoryId = series?.categoryId ?? "O";
  const courseType = series?.courseType ?? "OT";
  return [categoryId, courseType, year, term].filter(Boolean).join("-");
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 rounded-full border border-white shadow-sm ring-1 ring-[#dbcabd]"
      style={{ backgroundColor: color }}
    />
  );
}

export function CourseOfferingIdentityFields({ seriesOptions, selectedSeriesId }: Props) {
  const initialSeries = seriesOptions.find((series) => series.id === selectedSeriesId) ?? seriesOptions[0];
  const [seriesId, setSeriesId] = useState(initialSeries?.id ?? "");
  const [bookingStatus, setBookingStatus] = useState("open");
  const [openMenu, setOpenMenu] = useState<"series" | "status" | null>(null);
  const [year, setYear] = useState("115");
  const [term, setTerm] = useState("1");
  const [shortNameTouched, setShortNameTouched] = useState(false);
  const [capacityTouched, setCapacityTouched] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [instructorTouched, setInstructorTouched] = useState(false);
  const [assistantInstructorNames, setAssistantInstructorNames] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const selectedSeries = useMemo(
    () => seriesOptions.find((series) => series.id === seriesId) ?? seriesOptions[0],
    [seriesOptions, seriesId],
  );

  const selectedStatus = useMemo(
    () => statusOptions.find((status) => status.id === bookingStatus) ?? statusOptions[0],
    [bookingStatus],
  );

  const computedShortName = buildShortName(year, term, selectedSeries);
  const [manualShortName, setManualShortName] = useState(computedShortName);
  const shortName = shortNameTouched ? manualShortName : computedShortName;
  const termLabel = buildTermLabel(term);
  const classIdentifier = [year, term].filter(Boolean).join("-");
  const classDisplayName = selectedSeries?.title
    ? `${selectedSeries.title}｜${year}年｜${termLabel}`
    : `${year}年｜${termLabel}`;
  const offeringCode = buildOfferingCode(year, term, selectedSeries);
  const color = selectedSeries?.color ?? "#B46F4A";
  const capacity = capacityTouched ? undefined : selectedSeries?.defaultCapacity;
  const location = locationTouched ? undefined : selectedSeries?.defaultLocation;
  const instructor = instructorTouched ? undefined : selectedSeries?.defaultInstructorName;

  return (
    <>
      <input type="hidden" name="seriesId" value={seriesId} />
      <input type="hidden" name="bookingStatus" value={bookingStatus} />
      <input type="hidden" name="categoryId" value={selectedSeries?.categoryId ?? ""} />
      <input type="hidden" name="courseType" value={selectedSeries?.courseType ?? ""} />
      <input type="hidden" name="courseMode" value={selectedSeries?.courseMode ?? ""} />
      <input type="hidden" name="rosterType" value={selectedSeries?.rosterType ?? ""} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="title" value={selectedSeries?.title ?? ""} />
      <input type="hidden" name="code" value={offeringCode} />
      <input type="hidden" name="classIdentifier" value={classIdentifier} />
      <input type="hidden" name="classDisplayName" value={classDisplayName} />
      <input type="hidden" name="termNumber" value={term} />
      <input type="hidden" name="termLabel" value={termLabel} />

      <div className="xl:col-span-2 rounded-[24px] border border-[#ead8ca] bg-[#fffaf5]/70 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">第一步</p>
        <h3 className="mt-1 text-base font-black text-[#1f1712]">建立班級識別</h3>
        <p className="mt-1 text-xs leading-5 text-[#8a7c72]">
          選擇課程目錄後，系統會帶出類別色、預設名額、預設地點與講師；年度加期別會形成班級容器。
        </p>
      </div>

      <div className={fieldFrameClass}>
        <span>課程目錄</span>
        <button
          type="button"
          className={triggerClass}
          onClick={() => setOpenMenu(openMenu === "series" ? null : "series")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ColorDot color={color} />
            <span className="shrink-0 rounded-full bg-[#fff6ed] px-2.5 py-1 text-xs font-black text-[#8B5035]">
              {selectedSeries?.code ?? selectedSeries?.categoryId ?? "目錄"}
            </span>
            <span className="truncate font-semibold">{selectedSeries?.title ?? "請先建立課程目錄"}</span>
          </span>
          <span className="text-[#B46F4A]">⌄</span>
        </button>
        {openMenu === "series" ? (
          <div className={menuClass}>
            {seriesOptions.map((series) => {
              const isSelected = series.id === seriesId;
              const seriesColor = series.color ?? "#B46F4A";
              return (
                <button
                  key={series.id}
                  type="button"
                  className={`grid w-full gap-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-[#fff2e8] text-[#5A3726] ring-1 ring-[#E7892B]/35" : "text-[#4e4038] hover:bg-[#fffaf5]"
                  }`}
                  onClick={() => {
                    setSeriesId(series.id);
                    setCapacityTouched(false);
                    setLocationTouched(false);
                    setInstructorTouched(false);
                    setOpenMenu(null);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ColorDot color={seriesColor} />
                    <span className="shrink-0 rounded-full bg-[#fff6ed] px-2 py-0.5 text-xs font-black text-[#8B5035]">
                      {series.code ?? series.categoryId ?? "目錄"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-black">{series.title}</span>
                    {isSelected ? <span className="text-xs font-bold text-[#E85F00]">已選</span> : null}
                  </span>
                  <span className="pl-6 text-xs font-normal leading-5 text-[#8a7c72]">
                    {series.categoryName ?? series.categoryId ?? "未分類"}｜{series.courseType ?? "未設類型"}｜預設名額 {series.defaultCapacity ?? "未設"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <span className={helperClass}>
          <ColorDot color={color} />
          {selectedSeries?.code ?? selectedSeries?.categoryName ?? "課程目錄"}
        </span>
      </div>

      <div className={fieldFrameClass}>
        <span>班級狀態</span>
        <button
          type="button"
          className={triggerClass}
          onClick={() => setOpenMenu(openMenu === "status" ? null : "status")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${selectedStatus.tone}`}>{selectedStatus.label}</span>
            <span className="truncate text-sm text-[#66584f]">{selectedStatus.description}</span>
          </span>
          <span className="text-[#B46F4A]">⌄</span>
        </button>
        {openMenu === "status" ? (
          <div className={menuClass}>
            {statusOptions.map((status) => {
              const isSelected = status.id === bookingStatus;
              return (
                <button
                  key={status.id}
                  type="button"
                  className={`grid w-full gap-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-[#fff2e8] text-[#5A3726] ring-1 ring-[#E7892B]/35" : "text-[#4e4038] hover:bg-[#fffaf5]"
                  }`}
                  onClick={() => {
                    setBookingStatus(status.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${status.tone}`}>{status.label}</span>
                    {isSelected ? <span className="text-xs font-bold text-[#E85F00]">已選</span> : null}
                  </span>
                  <span className="text-xs font-normal leading-5 text-[#8a7c72]">{status.description}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <span className={helperClass}>影響學員前台是否可報名或預約。</span>
      </div>

      <div className="grid gap-3 xl:col-span-2 xl:grid-cols-3">
        <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
          年度
          <input
            name="year"
            type="number"
            min={1}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
            placeholder="115"
          />
          <span className="h-5 text-xs font-normal text-[#8a7c72]">例如 115。</span>
        </label>

        <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
          期別
          <input
            name="term"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
            placeholder="1"
          />
          <span className="h-5 text-xs font-normal text-[#8a7c72]">系統會自動轉為 {termLabel || "第1期"}，不用另外填標籤。</span>
        </label>

        <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
          班級簡稱
          <input
            name="shortName"
            value={shortName}
            onChange={(event) => {
              setShortNameTouched(true);
              setManualShortName(event.target.value);
            }}
            className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
            placeholder="115-1 美容"
          />
          <span className="h-5 text-xs font-normal text-[#8a7c72]">用於後台列表與快速辨識。</span>
        </label>
      </div>

      <div className="xl:col-span-2 mt-2 border-t border-[#f1e2d6] pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B46F4A]">第二步</p>
        <h3 className="mt-1 text-base font-black text-[#1f1712]">填寫班級基本資料</h3>
      </div>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        總名額
        <input
          name="capacity"
          type="number"
          min={0}
          defaultValue={capacity}
          onChange={() => setCapacityTouched(true)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
          placeholder="40"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">預設可由課程目錄帶入。</span>
      </label>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        地點
        <input
          name="location"
          defaultValue={location}
          onChange={() => setLocationTouched(true)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
          placeholder="工會教室"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">可在單一場次再覆寫。</span>
      </label>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        主要講師
        <input
          name="primaryInstructorName"
          defaultValue={instructor}
          onChange={() => setInstructorTouched(true)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
          placeholder="講師姓名"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">未來可串接講師資料庫。</span>
      </label>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        助教 / 協同講師
        <input
          name="assistantInstructorNames"
          value={assistantInstructorNames}
          onChange={(event) => setAssistantInstructorNames(event.target.value)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
          placeholder="用逗號分隔"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">例如 王小明, 陳小美。</span>
      </label>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        開始日期
        <input
          name="startDate"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">可先留空，排場次後再補。</span>
      </label>

      <label className="grid min-h-[92px] content-start gap-2 text-sm font-semibold text-[#4e4038]">
        結束日期
        <input
          name="endDate"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="h-12 rounded-2xl border border-[#dbcabd] bg-white px-3 font-normal"
        />
        <span className="h-5 text-xs font-normal text-[#8a7c72]">用於報名與鎖定提醒。</span>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#4e4038] xl:col-span-2">
        備註
        <textarea
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-24 rounded-2xl border border-[#dbcabd] bg-white px-3 py-3 font-normal"
          placeholder="班級備註、行政提醒或特殊安排"
        />
      </label>
    </>
  );
}

export default CourseOfferingIdentityFields;
