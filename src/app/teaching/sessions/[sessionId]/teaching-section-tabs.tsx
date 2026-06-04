"use client";

import { useEffect, useState } from "react";

const DEFAULT_ACTIVE_HASH = "#summary";

const TABS = [
  { href: "#summary", label: "摘要" },
  { href: "#attendance-list", label: "點名" },
  { href: "#lesson-journal", label: "紀錄" },
];

function getActiveHash() {
  if (typeof window === "undefined") return DEFAULT_ACTIVE_HASH;
  return window.location.hash || DEFAULT_ACTIVE_HASH;
}

export function TeachingSectionTabs() {
  // Keep the first render identical between server and client.
  // The current browser hash is applied only after mount to avoid hydration mismatch.
  const [activeHash, setActiveHash] = useState(DEFAULT_ACTIVE_HASH);

  useEffect(() => {
    function syncActiveHash() {
      setActiveHash(getActiveHash());
    }

    syncActiveHash();
    window.addEventListener("hashchange", syncActiveHash);
    return () => window.removeEventListener("hashchange", syncActiveHash);
  }, []);

  return (
    <nav className="fixed inset-x-4 bottom-4 z-40 mx-auto grid max-w-md grid-cols-3 gap-2 rounded-[24px] border border-[#ead8ca] bg-white/95 p-2 shadow-xl backdrop-blur lg:hidden">
      {TABS.map((tab) => {
        const isActive = activeHash === tab.href;
        return (
          <a
            key={tab.href}
            href={tab.href}
            onClick={() => setActiveHash(tab.href)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-2xl px-3 py-2 text-center text-xs font-black transition ${
              isActive ? "bg-[#5A3726] text-white shadow-sm" : "bg-[#fffaf5] text-[#5A3726] hover:bg-[#fff1e3]"
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
