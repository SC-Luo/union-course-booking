"use client";

import { useState, type FormEvent } from "react";
import { createReservationAction } from "@/app/actions";

type BookingFormProps = {
  courseId: string;
  sessionId: string;
  courseTitle: string;
  sessionTime: string;
  error?: string;
};

const errorMessage: Record<string, string> = {
  invalid: "請確認姓名與身分證末三碼都已填寫。",
  duplicate: "這位學員已預約過同一門課程，不能重複預約其他時段。",
  closed: "這個時段目前無法預約，可能已額滿、已關閉，或已超過前一天 18:00 的截止時間。",
};

export function BookingForm({ courseId, sessionId, courseTitle, sessionTime, error }: BookingFormProps) {
  const [studentName, setStudentName] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem("booking.studentName") ?? ""),
  );
  const [idNumberLast3, setIdNumberLast3] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (localStorage.getItem("booking.idNumberLast3") ??
          // 相容舊版：如果使用者之前只存過手機末三碼，先帶入，送出後會改存新 key。
          localStorage.getItem("booking.phoneLastThree") ??
          ""),
  );

  function rememberStudent(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const studentName = String(form.get("studentName") ?? "").trim();
    const idNumberLast3 = String(form.get("idNumberLast3") ?? "")
      .replace(/\D/g, "")
      .slice(0, 3);

    localStorage.setItem("booking.studentName", studentName);
    localStorage.setItem("booking.idNumberLast3", idNumberLast3);
    localStorage.removeItem("booking.phoneLastThree");

    localStorage.setItem(
      "union:pendingReservation",
      JSON.stringify({
        courseId,
        sessionId,
        studentName,
        studentIdNumberMasked: `***${idNumberLast3}`,
        courseTitle,
        sessionTime,
        savedAt: new Date().toISOString(),
      }),
    );
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
        <span className="mb-2 block text-base font-semibold text-zinc-800">身分證末三碼</span>
        <input
          name="idNumberLast3"
          required
          pattern="[0-9]{3}"
          value={idNumberLast3}
          onChange={(event) => setIdNumberLast3(event.target.value.replace(/\D/g, "").slice(0, 3))}
          className="w-full rounded-md border border-zinc-300 px-4 py-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
          inputMode="numeric"
          maxLength={3}
          placeholder="例如 123"
        />
      </label>
      <button type="submit" className="w-full rounded-md bg-emerald-700 px-5 py-4 text-center text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
        確認預約
      </button>
      <p className="mt-4 text-sm leading-6 text-zinc-500">這台裝置會記住姓名與身分證末三碼，下次預約或查詢時會自動帶入。</p>
    </form>
  );
}
