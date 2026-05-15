"use client";

import { useState, type FormEvent } from "react";
import { createReservationAction } from "@/app/actions";

type BookingFormProps = {
  courseId: string;
  sessionId: string;
  error?: string;
};

const errorMessage: Record<string, string> = {
  invalid: "請確認姓名與手機末三碼都已填寫。",
  duplicate: "這位學員已預約過同一門課程，不能重複預約其他時段。",
  closed: "這個時段目前無法預約，可能已額滿或已關閉。",
};

export function BookingForm({ courseId, sessionId, error }: BookingFormProps) {
  const [studentName, setStudentName] = useState(() => (typeof window === "undefined" ? "" : (localStorage.getItem("booking.studentName") ?? "")));
  const [phoneLastThree, setPhoneLastThree] = useState(() => (typeof window === "undefined" ? "" : (localStorage.getItem("booking.phoneLastThree") ?? "")));

  function rememberStudent(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    localStorage.setItem("booking.studentName", String(form.get("studentName") ?? ""));
    localStorage.setItem("booking.phoneLastThree", String(form.get("phoneLastThree") ?? ""));
  }

  return (
    <form action={createReservationAction} onSubmit={rememberStudent} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage[error] ?? "預約失敗，請再確認資料。"}
        </p>
      ) : null}
      <label className="mb-4 block">
        <span className="mb-2 block text-base font-semibold text-zinc-800">姓名</span>
        <input
          name="studentName"
          required
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-4 py-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
          placeholder="請輸入姓名"
        />
      </label>
      <label className="mb-5 block">
        <span className="mb-2 block text-base font-semibold text-zinc-800">手機末三碼</span>
        <input
          name="phoneLastThree"
          required
          pattern="[0-9]{3}"
          value={phoneLastThree}
          onChange={(event) => setPhoneLastThree(event.target.value.replace(/\D/g, "").slice(0, 3))}
          className="w-full rounded-md border border-zinc-300 px-4 py-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
          inputMode="numeric"
          maxLength={3}
          placeholder="例如 168"
        />
      </label>
      <button type="submit" className="w-full rounded-md bg-emerald-700 px-5 py-4 text-center text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
        確認預約
      </button>
      <p className="mt-4 text-sm leading-6 text-zinc-500">這台裝置會記住姓名與手機末三碼，下次預約或查詢時會自動帶入。</p>
    </form>
  );
}
