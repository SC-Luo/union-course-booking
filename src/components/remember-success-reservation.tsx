"use client";

import { useEffect } from "react";

const PENDING_KEY = "union:pendingReservation";
const LAST_KEY = "union:lastReservation";

export function RememberSuccessReservation() {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PENDING_KEY);
      if (!raw) return;

      const pending = JSON.parse(raw);

      if (!pending.courseId || !pending.sessionId || !pending.courseTitle || !pending.sessionTime) {
        window.localStorage.removeItem(PENDING_KEY);
        return;
      }

      window.localStorage.setItem(
        LAST_KEY,
        JSON.stringify({
          ...pending,
          savedAt: new Date().toISOString(),
        }),
      );

      window.localStorage.setItem(
        "union_booking_student_profile",
        JSON.stringify({
          name: pending.studentName,
          idNumberLast3: pending.idNumberLast3,
          updatedAt: new Date().toISOString(),
        })
      );

      window.localStorage.removeItem(PENDING_KEY);
    } catch {
      window.localStorage.removeItem(PENDING_KEY);
    }
  }, []);

  return null;
}