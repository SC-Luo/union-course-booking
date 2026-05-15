import Link from "next/link";
import type { ReactNode } from "react";

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f7f4]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            工會課程預約
          </Link>
          <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto sm:items-center sm:gap-3">
            <Link href="/booking/search" className="rounded-md border border-zinc-300 px-3 py-3 text-center font-medium text-zinc-700 hover:bg-zinc-50">
              查詢預約
            </Link>
            <Link href="/admin/login" className="rounded-md bg-zinc-900 px-3 py-3 text-center font-medium text-white hover:bg-zinc-700">
              後台
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const links = [
    { href: "/admin", label: "首頁" },
    { href: "/admin/courses", label: "課程" },
    { href: "/admin/categories", label: "分類" },
    { href: "/admin/students", label: "名冊" },
    { href: "/admin/stats", label: "統計" },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f8]">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <Link href="/admin" className="text-lg font-semibold text-zinc-900">
            工會後台
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-700 hover:bg-zinc-50">
                {link.label}
              </Link>
            ))}
            <Link href="/" className="rounded-md bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-700">
              學生端
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
    </main>
  );
}
