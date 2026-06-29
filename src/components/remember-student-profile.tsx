"use client";

import { useEffect } from "react";

export function RememberStudentProfile({ name, idNumberLast3 = "" }: { name: string; idNumberLast3?: string }) {
  useEffect(() => {
    if (!name) return;
    try {
      localStorage.setItem(
        "union_booking_student_profile",
        JSON.stringify({
          name,
          idNumberLast3,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error("Failed to remember student profile", err);
    }
  }, [name, idNumberLast3]);

  return null;
}
