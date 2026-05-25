"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { createReservationAction, type CreateReservationFormState } from "@/app/actions";

type BookingFormProps = {
  courseId: string;
  sessionId: string;
  courseTitle: string;
  sessionTime: string;
};

const errorMessage: Record<string, string> = {
  invalid: "請輸入名冊上的姓名。",
  duplicate: "這位學員已經預約過這門課程，不能重複預約其他時段。",
  closed: "這個課堂目前無法預約，可能已額滿、已進入開課前鎖定期、停課或已取消。",
  not_roster: "你目前不在這個班級名冊內，無法完成預約。請確認姓名是否與名冊一致，若資料無誤仍無法預約，請聯絡工會協助確認。",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-[#9b4f1f] px-5 py-4 text-center text-base font-bold text-white shadow-sm transition hover:bg-[#7d3e18] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c7ac94]"
    >
      {pending ? "送出中..." : "確認名單並預約"}
    </button>
  );
}

export function BookingForm({ courseId, sessionId, courseTitle, sessionTime }: BookingFormProps) {
  const [studentName, setStudentName] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem("booking.studentName") ?? "")
  );
  const [state, formAction] = useActionState<CreateReservationFormState, FormData>(createReservationAction, {});

  function rememberStudent(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const rememberedStudentName = String(form.get("studentName") ?? "").trim();

    localStorage.setItem("booking.studentName", rememberedStudentName);
    localStorage.removeItem("booking.idNumberLast3");
    localStorage.removeItem("booking.phoneLastThree");
    localStorage.setItem(
      "union:pendingReservation",
      JSON.stringify({
        courseId,
        sessionId,
        studentName: rememberedStudentName,
        courseTitle,
        sessionTime,
        savedAt: new Date().toISOString(),
      })
    );
  }

  return (
    <form action={formAction} onSubmit={rememberStudent} className="rounded-[1.75rem] border border-[#ead8c6] bg-white p-5 shadow-sm">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="mb-5 rounded-2xl bg-[#fff7ef] p-4 text-sm leading-6 text-[#6f4b35]">
        <p className="font-bold text-[#34231a]">名單制預約確認</p>
        <p className="mt-1">請輸入報名名冊中的姓名。系統確認你在本班名單內後，才會完成預約。</p>
      </div>

      {state.error ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {errorMessage[state.error] ?? "預約失敗，請再確認資料。"}
        </p>
      ) : null}

      <label className="mb-5 block">
        <span className="mb-2 block text-base font-bold text-[#34231a]">預約姓名</span>
        <input
          name="studentName"
          required
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          className="w-full rounded-2xl border border-[#d8bda4] bg-[#fffaf5] px-4 py-4 text-base outline-none transition focus:border-[#9b4f1f] focus:bg-white focus:ring-4 focus:ring-[#f3e1d0]"
          placeholder="請輸入名冊上的姓名"
        />
      </label>

      <SubmitButton />

      <p className="mt-4 text-sm leading-6 text-[#8a6a55]">這台裝置會記住姓名，方便下次預約或查詢。</p>
    </form>
  );
}
