"use client";

import Link from "next/link";

type RosterFlowNavProps = {
  current: "students" | "imports" | "eligibility" | "history";
};

const links = [
  { key: "students", label: "學員名冊", href: "/admin/students" },
  { key: "imports", label: "匯入資料", href: "/admin/student-imports" },
  { key: "eligibility", label: "課程資格", href: "/admin/students?mode=eligibility" },
  { key: "history", label: "學員履歷", href: "/admin/students?mode=history" },
] as const;

export function RosterFlowNav({ current }: RosterFlowNavProps) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#a65f3b]">名冊流程導覽</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => {
          const isCurrent = link.key === current;
          return (
            <Link
              key={link.key}
              href={link.href}
              className={`rounded-2xl px-5 py-3 text-sm font-bold ${
                isCurrent
                  ? "bg-[#6b3b25] text-white"
                  : "border border-[#ead7c6] bg-white text-[#6b3b25]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
