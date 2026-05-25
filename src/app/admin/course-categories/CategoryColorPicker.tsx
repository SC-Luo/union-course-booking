"use client";

import { useRef, useState } from "react";

const colorOptions = [
  { value: "#E85F00", label: "Sun-Kissed Clay" },
  { value: "#E7892B", label: "Honeycomb" },
  { value: "#B46F4A", label: "Copper Dust" },
  { value: "#8B5035", label: "Terracotta" },
  { value: "#5A3726", label: "Deep Clay" },
  { value: "#ec4899", label: "Pink" },
  { value: "#10b981", label: "Green" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#06b6d4", label: "Cyan" },
];

function normalizeColor(color?: string) {
  return (color || colorOptions[0].value).toLowerCase();
}

export function CategoryColorPicker({
  name = "color",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selectedColor, setSelectedColor] = useState(normalizeColor(defaultValue));
  const selectedOption = colorOptions.find((option) => option.value.toLowerCase() === selectedColor) ?? colorOptions[0];

  function handleSelectColor(color: string) {
    setSelectedColor(color.toLowerCase());

    // 選到顏色後立即收合色票，避免還要再點一次上方箭頭。
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedOption.value} />
      <details ref={detailsRef} className="group">
        <summary className="flex h-12 list-none cursor-pointer items-center justify-between rounded-2xl border border-[#dbcabd] bg-white px-4 text-sm font-semibold text-[#4e4038] shadow-inner shadow-[#5A3726]/[0.03] marker:content-none">
          <span className="flex items-center gap-3">
            <span
              className="inline-flex h-6 w-6 rounded-full border-2 border-white shadow-sm ring-1 ring-[#dbcabd]"
              style={{ backgroundColor: selectedOption.value }}
              aria-hidden="true"
            />
            <span>選擇色彩</span>
          </span>
          <span className="text-[#8a7c72] transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full min-w-[260px] rounded-2xl border border-[#e6d4c7] bg-white p-3 shadow-[0_18px_45px_rgba(90,55,38,0.12)]">
          <div className="grid grid-cols-5 gap-2">
            {colorOptions.map((color) => {
              const isSelected = color.value.toLowerCase() === selectedColor;
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleSelectColor(color.value)}
                  className={
                    isSelected
                      ? "flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7ad8f] bg-[#fff6ed] ring-2 ring-[#c37c52]"
                      : "flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent hover:border-[#ead8ca] hover:bg-[#fff8f1]"
                  }
                  aria-label={`選擇色彩 ${color.label}`}
                  title={color.value}
                >
                  <span
                    className="inline-flex h-8 w-8 rounded-full border-2 border-white shadow-sm ring-1 ring-[#dbcabd]"
                    style={{ backgroundColor: color.value }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#8a7c72]">
            已選擇：<span className="font-semibold text-[#5A3726]">{selectedOption.value}</span>
          </p>
        </div>
      </details>
    </div>
  );
}
