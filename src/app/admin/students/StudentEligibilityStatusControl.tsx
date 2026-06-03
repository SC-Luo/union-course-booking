"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { assignStudentsToCourseEligibilityAction } from "@/app/admin/actions";

type ActiveClassChip = {
  offeringId: string;
  seriesId: string;
  year: string;
  label: string;
};

type StudentEligibilityStatusControlProps = {
  studentId: string;
  seriesId: string;
  year: string;
  targetOfferingId: string;
  note?: string;
  currentStatus: string;
  statuses: readonly string[];
  currentClasses: ActiveClassChip[];
  selectedClass?: ActiveClassChip;
  q?: string;
};

function statusTone(status: string) {
  if (status === "已結訓") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (["未加入", ""].includes(status)) {
    return "border-zinc-200 bg-zinc-50 text-zinc-500";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function buildStudentsHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const qs = query.toString();
  return `/admin/students${qs ? `?${qs}` : ""}`;
}

function sameClass(a?: ActiveClassChip, b?: ActiveClassChip) {
  return Boolean(a?.offeringId && b?.offeringId && a.offeringId === b.offeringId);
}

function syncSelectedClass(
  classes: ActiveClassChip[],
  selectedClass: ActiveClassChip | undefined,
  nextStatus: string,
) {
  if (!selectedClass?.offeringId) return classes;

  if (nextStatus === "未加入") {
    return classes.filter((item) => !sameClass(item, selectedClass));
  }

  const exists = classes.some((item) => sameClass(item, selectedClass));
  if (exists) {
    return classes.map((item) => (sameClass(item, selectedClass) ? selectedClass : item));
  }
  return [...classes, selectedClass];
}

export function StudentEligibilityStatusControl({
  studentId,
  seriesId,
  year,
  targetOfferingId,
  note = "",
  currentStatus,
  statuses,
  currentClasses = [],
  selectedClass,
  q = "",
}: StudentEligibilityStatusControlProps) {
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const [localClasses, setLocalClasses] = useState<ActiveClassChip[]>(Array.isArray(currentClasses) ? currentClasses : []);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Keep the optimistic row state aligned when the table navigates to another student/class.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalStatus(currentStatus);
  }, [currentStatus, studentId, targetOfferingId]);

  useEffect(() => {
    // Keep the optimistic row state aligned when the table navigates to another student/class.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalClasses(Array.isArray(currentClasses) ? currentClasses : []);
  }, [currentClasses, studentId, targetOfferingId]);

  const hasSelectedClass = useMemo(
    () => (Array.isArray(localClasses) ? localClasses : []).some((item) => item.offeringId === targetOfferingId),
    [localClasses, targetOfferingId],
  );

  function updateStatus(nextStatus: string) {
    if (isPending || nextStatus === localStatus) return;

    const previousStatus = localStatus;
    const previousClasses = localClasses;
    setLocalStatus(nextStatus);
    setLocalClasses((classes) => syncSelectedClass(classes, selectedClass, nextStatus));
    setPendingStatus(nextStatus);
    setErrorMessage("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("studentIds", studentId);
      formData.append("seriesId", seriesId);
      formData.append("year", year);
      formData.append("targetOfferingId", targetOfferingId);
      formData.append("eligibilityStatus", nextStatus);
      formData.append("note", note);

      try {
        const result = (await assignStudentsToCourseEligibilityAction(formData)) as { ok?: boolean; error?: string } | void;
        if (result && "ok" in result && !result.ok) {
          setLocalStatus(previousStatus);
          setLocalClasses(previousClasses);
          setErrorMessage(result.error || "狀態更新失敗，請稍後再試。");
        }
      } catch {
        setLocalStatus(previousStatus);
        setLocalClasses(previousClasses);
        setErrorMessage("狀態更新失敗，請稍後再試。");
      } finally {
        setPendingStatus("");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        {Array.isArray(localClasses) && localClasses.length > 0 ? (
          localClasses.map((classItem) => {
            const activeClass = classItem.offeringId === targetOfferingId;
            return (
              <Link
                key={classItem.offeringId}
                href={buildStudentsHref({
                  mode: "eligibility",
                  seriesId: classItem.seriesId || seriesId,
                  year: classItem.year || year,
                  offeringId: classItem.offeringId,
                  q,
                })}
                scroll={false}
                className={`rounded-full border px-3 py-1.5 transition ${
                  activeClass
                    ? "border-[#ef6c00] bg-[#ef6c00] text-white shadow-sm"
                    : "border-[#ead7c6] bg-[#fff7ed] text-[#6b3b25] hover:border-[#ef6c00] hover:bg-white"
                }`}
                title="先點選這個班級，再調整右側狀態；右側狀態只代表目前選定的班級"
              >
                {classItem.label}
              </Link>
            );
          })
        ) : (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-500">
            尚未分配
          </span>
        )}
        {selectedClass?.offeringId && !hasSelectedClass ? (
          <span className="rounded-full border border-dashed border-[#ead7c6] bg-white px-3 py-1.5 text-zinc-400">
            目前選定：{selectedClass.label}
          </span>
        ) : null}
      </div>

      <div className="ml-auto w-full max-w-[280px]">
        <div className="flex w-full flex-nowrap overflow-hidden rounded-full border border-[#ead7c6] bg-white p-1 shadow-sm">
          {statuses.map((item) => {
            const isCurrent = item === localStatus;
            const isThisPending = pendingStatus === item;
            return (
              <button
                key={item}
                type="button"
                disabled={isPending}
                onClick={() => updateStatus(item)}
                className={`h-9 flex-1 rounded-full px-3 text-xs font-bold whitespace-nowrap transition disabled:cursor-wait disabled:opacity-70 ${
                  isCurrent
                    ? statusTone(item)
                    : "text-zinc-500 hover:bg-[#fff7ed] hover:text-[#6b3b25]"
                }`}
                aria-pressed={isCurrent}
                aria-busy={isThisPending}
              >
                {isThisPending ? "更新中" : item}
              </button>
            );
          })}
        </div>
        {errorMessage ? (
          <p className="mt-2 text-right text-xs font-bold text-rose-600">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </>
  );
}

