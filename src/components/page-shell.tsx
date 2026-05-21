/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
  resumeHref?: string;
  resumeLabel?: string;
};

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f7f4]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm text-white"
              aria-hidden="true"
            >
              ⌂
            </span>
            <span>工會課程預約</span>
          </a>
          <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto sm:items-center sm:gap-3">
            <a
              href="/booking/search"
              className="rounded-md border border-zinc-300 px-3 py-3 text-center font-medium text-zinc-700 hover:bg-zinc-50"
            >
              查詢預約
            </a>
            <a
              href="/admin/login"
              className="rounded-md bg-zinc-900 px-3 py-3 text-center font-medium text-white hover:bg-zinc-700"
            >
              後台
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}

export function AdminShell({
  children,
  resumeHref = "/admin/students",
  resumeLabel = "學習履歷",
}: AdminShellProps) {
  const links = [
    { href: "/admin", label: "後台首頁" },
    { href: "/admin/categories", label: "課程分類" },
    { href: "/admin/students", label: "班級名冊" },
    { href: "/admin/stats", label: "課程統計" },
    { href: resumeHref, label: resumeLabel },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f8]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <a href="/admin" className="text-lg font-semibold text-zinc-900">
            工會後台
          </a>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map((link) => (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/"
              className="rounded-md bg-zinc-900 px-3 py-2 text-white transition-colors hover:bg-zinc-700"
            >
              學生端
            </a>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
    </main>
  );
}
