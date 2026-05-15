import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
        <p className="mb-2 text-sm font-medium text-emerald-700">工作人員後台</p>
        <h1 className="text-2xl font-semibold text-zinc-950">登入管理系統</h1>
        <form className="mt-6 grid gap-4">
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">帳號</span>
            <input className="w-full rounded-md border border-zinc-300 px-3 py-3" placeholder="admin" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-zinc-700">密碼</span>
            <input className="w-full rounded-md border border-zinc-300 px-3 py-3" type="password" />
          </label>
          <Link href="/admin" className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700">
            登入
          </Link>
        </form>
      </section>
    </main>
  );
}
