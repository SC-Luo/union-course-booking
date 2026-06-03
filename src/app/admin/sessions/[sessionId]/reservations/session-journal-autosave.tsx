"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveSessionJournalInlineAction } from "@/app/admin/actions";

type SessionJournalAutosaveProps = {
  sessionId: string;
  field: "teachingContent" | "teacherNote" | "assistantNote" | "adminNote" | "abnormalStatus" | "followUpNote";
  defaultValue?: string;
  label: string;
  placeholder: string;
  rows?: number;
  tone?: "default" | "rose";
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function SessionJournalAutosave({
  sessionId,
  field,
  defaultValue = "",
  label,
  placeholder,
  rows = 4,
  tone = "default",
}: SessionJournalAutosaveProps) {
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
    formData.set("sessionId", sessionId);
    formData.set("field", field);
    formData.set("value", nextValue);

    setState("saving");
    startTransition(async () => {
      const result = await saveSessionJournalInlineAction(formData);
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

  const toneClass = tone === "rose"
    ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100"
    : "border-[#dbcabd] focus:border-[#E85F00] focus:ring-orange-100";

  return (
    <label className="grid gap-2 text-sm font-bold text-[#5A3726]">
      <span>{label}</span>
      <textarea
        value={value}
        rows={rows}
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
        className={`min-h-[112px] resize-y rounded-2xl border bg-white px-4 py-3 text-sm font-normal leading-6 text-[#5A3726] outline-none transition placeholder:text-[#c0aa9b] focus:ring-4 ${toneClass}`}
        placeholder={placeholder}
      />
      <span className={`min-h-4 text-right text-[11px] font-bold ${state === "error" ? "text-rose-600" : "text-[#B46F4A]"}`}>
        {statusText}
      </span>
    </label>
  );
}
