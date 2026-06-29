"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function BookingSearchAutofill() {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("union_booking_student_profile");
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile && profile.name) {
          if (profile.idNumberLast3 && profile.idNumberLast3.length === 3) {
            router.replace(`/booking/search?name=${encodeURIComponent(profile.name)}&idNumberLast3=${encodeURIComponent(profile.idNumberLast3)}`);
          } else {
            router.replace(`/booking/search?name=${encodeURIComponent(profile.name)}`);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [router]);

  return null;
}

export function BookingSearchResetBanner({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("union_booking_student_profile");
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile && profile.name === currentName) {
          setTimeout(() => setShow(true), 0);
        }
      }
    } catch {
      // ignore
    }
  }, [currentName]);

  if (!show) return null;

  const handleClear = () => {
    try {
      localStorage.removeItem("union_booking_student_profile");
    } catch {
      // ignore
    }
    router.replace("/booking/search");
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-3 text-sm text-[#7c5035]">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#ef6c00] shrink-0 animate-ping" />
        <span>已帶入最近一次使用的學員資料。</span>
      </div>
      <button
        onClick={handleClear}
        className="rounded-xl bg-white border border-[#ead8c6] px-3.5 py-1.5 text-xs font-bold text-[#ef6c00] hover:bg-[#fff9f3] transition shadow-sm"
      >
        改用其他姓名查詢
      </button>
    </div>
  );
}
