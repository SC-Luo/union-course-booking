"use client";

import { useState, type FormEvent } from "react";

type SearchFormProps = {
  name: string;
};

export function SearchForm({ name }: SearchFormProps) {
  const [studentName, setStudentName] = useState(() => name || (typeof window === "undefined" ? "" : (localStorage.getItem("booking.studentName") ?? "")));

  function rememberStudent(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    localStorage.setItem("booking.studentName", String(form.get("name") ?? ""));
  }

  return (
    <form onSubmit={rememberStudent} className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1fr_140px] md:items-end">
        <label>
          <span className="mb-2 block text-base font-semibold text-zinc-800">姓名</span>
          <input
            name="name"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-4 py-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
            placeholder="請輸入名冊中的姓名"
          />
        </label>
        <button type="submit" className="rounded-md bg-emerald-700 px-5 py-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-800">
          查詢
        </button>
      </div>
    </form>
  );
}
