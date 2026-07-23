"use client";

import { removeStudentFromCourseOfferingAction } from "@/app/admin/actions";

type WithdrawStudentButtonProps = {
  studentId: string;
  offeringId: string;
  redirectTo: string;
};

export function WithdrawStudentButton({
  studentId,
  offeringId,
  redirectTo,
}: WithdrawStudentButtonProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("確定要將此學員退出班級嗎？此操作將解除該學員在此班級的資格。")) {
      e.preventDefault();
    }
  };

  return (
    <form action={removeStudentFromCourseOfferingAction} onSubmit={handleSubmit}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button type="submit" className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline">
        退出班級
      </button>
    </form>
  );
}
