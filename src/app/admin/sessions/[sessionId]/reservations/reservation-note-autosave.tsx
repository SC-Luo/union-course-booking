"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveReservationLessonNotesInlineAction } from "@/app/admin/actions";

type ReservationNoteAutosaveProps = {
  reservationId: string;
  sessionId: string;
  field: "homework" | "note";
  defaultValue?: string;
  label: string;
  placeholder: string;
  mobileMode?: "details" | "inline";
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function ReservationNoteAutosave({
  reservationId,
  sessionId,
  field,
  defaultValue = "",
  label,
  placeholder,
  mobileMode = "details",
}: ReservationNoteAutosaveProps) {
  const [value, setValue] = useState(defaultValue);
  const [savedValue, setSavedValue] = useState(defaultValue);
  const [state, setState] = useState<SaveState>("idle");
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function save(nextValue: string) {
    if (nextValue === savedValue) {
      setState("idle");
      return;
    }

    const formData = new FormData();
    formData.set("reservationId", reservationId);
    formData.set("sessionId", sessionId);
    formData.set(field, nextValue);

    setState("saving");
    startTransition(async () => {
      const result = await saveReservationLessonNotesInlineAction(formData);
      if (result?.ok) {
        setSavedValue(nextValue);
        setState("saved");
        window.setTimeout(() => setState("idle"), 1200);
      } else {
        setState("error");
      }
    });
  }

  function scheduleSave(nextValue: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(nextValue === savedValue ? "idle" : "dirty");
    timerRef.current = setTimeout(() => {
      if (!composingRef.current) save(nextValue);
    }, 900);
  }

  const statusText =
    state === "saving" || isPending ? "儲存中…" :
    state === "saved" ? "已自動儲存" :
    state === "error" ? "儲存失敗" :
    state === "dirty" ? "輸入後自動儲存" :
    "";

  const labelClassName =
    mobileMode === "inline"
      ? "grid gap-1.5 rounded-2xl border border-[#f1e2d6] bg-white/80 px-3 py-2 md:relative md:block md:h-[60px] md:border-0 md:bg-transparent md:p-0"
      : "grid gap-1.5 md:relative md:block md:h-[60px]";

  const textareaClassName =
    "min-h-12 resize-y rounded-2xl border border-[#ead8ca]/70 bg-[#fffdf9] px-3 py-2.5 text-sm font-semibold leading-6 text-[#5A3726] outline-none transition placeholder:text-[#cdb9aa] hover:border-[#dbcabd] focus:border-[#E85F00] focus:bg-white focus:ring-2 focus:ring-orange-100 md:h-[60px] md:min-h-[60px] md:w-full md:resize-none md:rounded-xl md:border-[#ead8ca]/55 md:bg-[#fffdf9]/60 md:px-3 md:py-2 md:pr-16 md:font-medium md:leading-5 md:shadow-none";

  return (
    <label className={labelClassName}>
      <span className="text-xs font-black text-[#B46F4A] md:hidden">{label}</span>
      <textarea
        value={value}
        rows={2}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          if (!composingRef.current) scheduleSave(nextValue);
        }}
        onBlur={() => save(value)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          scheduleSave(event.currentTarget.value);
        }}
        className={textareaClassName}
        placeholder={placeholder}
      />
      <span className={`block min-h-4 text-right text-[11px] font-bold md:absolute md:bottom-1 md:right-2 md:min-h-0 md:rounded-full md:bg-[#fffdf9]/90 md:px-1.5 md:text-[10px] ${state === "error" ? "text-rose-600" : "text-[#B46F4A]"}`}>
        {statusText}
      </span>
    </label>
  );
}
