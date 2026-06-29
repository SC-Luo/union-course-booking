import Link from "next/link";
import { adminLoginAction } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
        <Link href="/" className="mb-5 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-950">
          返回學生端
        </Link>
        <p className="mb-2 text-sm font-medium text-emerald-700">工作人員後台</p>
        <h1 className="text-2xl font-semibold text-zinc-950">登入管理系統</h1>
        {error ? <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">密碼不正確，請重新輸入。</p> : null}
        <form action={adminLoginAction} className="mt-6 grid gap-4">
          <input type="hidden" name="next" value={next || ""} />
          <label>
            <span className="mb-2 block text-base font-semibold text-zinc-800">後台密碼</span>
            <input name="password" className="w-full rounded-md border border-zinc-300 px-4 py-4 text-base" type="password" autoComplete="current-password" />
          </label>
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-4 text-center text-base font-semibold text-white hover:bg-zinc-700">
            登入
          </button>
        </form>
      </section>
    </main>
  );
}
