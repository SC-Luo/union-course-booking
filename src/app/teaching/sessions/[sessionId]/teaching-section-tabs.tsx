"use client";

import { useEffect, useState } from "react";

const TABS = [
  { href: "#summary", label: "\u6458\u8981" },
  { href: "#attendance-list", label: "\u9ede\u540d" },
  { href: "#lesson-journal", label: "\u7d00\u9304" },
];

function getActiveHash() {
  if (typeof window === "undefined") return "#summary";
  return window.location.hash || "#summary";
}

export function TeachingSectionTabs() {
  const [activeHash, setActiveHash] = useState(getActiveHash);

  useEffect(() => {
    function handleHashChange() {
      setActiveHash(getActiveHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
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
