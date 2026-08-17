"use client";

import { useState } from "react";
import { hardDeleteStudentIdentityAction } from "@/app/admin/actions";
import { formatDateTime } from "./student-profile-utils";

type DeleteStudentButtonProps = {
  studentId: string;
  name: string;
  createdAt?: string | null;
  redirectTo: string;
};

export function DeleteStudentButton({
  studentId,
  name,
  createdAt,
  redirectTo,
}: DeleteStudentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#ead7c6] bg-white px-3 py-1 text-xs font-bold text-[#6b3b25] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
      >
        刪除
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-student-title"
            className="w-full max-w-md rounded-3xl border border-[#ead7c6] bg-white p-6 shadow-xl"
          >
            <h2
              id="delete-student-title"
              className="text-lg font-black text-zinc-950"
            >
              永久刪除學員？
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              將永久刪除「{name}」的學員資料
              {createdAt ? `（建立於 ${formatDateTime(createdAt)}）` : ""}
              ，刪除後無法復原。此操作適合用於建錯資料。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[#ead7c6] bg-white px-5 py-2 text-sm font-bold text-[#6b3b25] hover:bg-[#fffaf5]"
              >
                取消
              </button>
              <form action={hardDeleteStudentIdentityAction}>
                <input type="hidden" name="studentId" value={studentId} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button
                  type="submit"
                  className="rounded-full border border-rose-300 bg-rose-600 px-5 py-2 text-sm font-bold text-white hover:bg-rose-700"
                >
                  確認刪除
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}