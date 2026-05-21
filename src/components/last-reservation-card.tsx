"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type LastReservation = {
  reservationId?: string;
  courseId: string;
  sessionId: string;
  studentName: string;
  studentPhoneMasked?: string;
  courseTitle: string;
  sessionTime: string;
  savedAt: string;
};

const STORAGE_KEY = "union:lastReservation";

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getStoredReservation() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

function parseStoredReservation(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LastReservation;
    if (!parsed.reservationId || !parsed.courseTitle || !parsed.sessionTime) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function LastReservationCard() {
  const [isDismissed, setIsDismissed] = useState(false);
  const rawReservation = useSyncExternalStore(subscribeToStorage, getStoredReservation, getServerSnapshot);
  const reservation = useMemo(() => parseStoredReservation(rawReservation), [rawReservation]);

  if (!reservation || isDismissed) return null;

  return (
    <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
      <p className="mb-2 text-sm font-medium text-emerald-700">這台設備有上次預約紀錄</p>
      <h2 className="mb-3 text-xl font-semibold text-zinc-950">你已預約過課程</h2>

      <div className="grid gap-2 text-sm text-zinc-700">
        <p>課程：{reservation.courseTitle}</p>
        <p>時段：{reservation.sessionTime}</p>
        <p>姓名：{reservation.studentName}</p>
        {reservation.studentPhoneMasked ? <p>手機：{reservation.studentPhoneMasked}</p> : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/booking/search"
          className="rounded-md bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-800"
        >
          查看預約
        </Link>
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(STORAGE_KEY);
            setIsDismissed(true);
          }}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          不再顯示
        </button>
      </div>
    </section>
  );
}
