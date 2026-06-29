import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ name?: string; error?: string }>;
};

export default async function TeachingLoginPage({ searchParams }: PageProps) {
  const { name = "", error = "" } = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7efe7] px-4 py-8 text-[#1f1712] sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[32px] border border-[#ead8ca] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#B46F4A]">Teaching Desk</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1f1712]">授課工作台</h1>
            <p className="mt-3 text-sm leading-6 text-[#7a6b60]">
              講師與助教權限相同。第一版先以姓名登入，只顯示自己負責的課堂。
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              找不到符合的授課人員，或通行碼不正確。請確認輸入資訊是否一致。
            </div>
          ) : null}

          <form action="/teaching" method="get" className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-[#5A3726]">
              授課人員姓名
              <input
                name="name"
                defaultValue={name}
                autoComplete="name"
                className="h-12 rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 text-base font-bold outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100"
                placeholder="請輸入姓名，例如：王小明"
                required
              />
            </label>
            {process.env.TEACHING_ACCESS_CODE ? (
              <label className="grid gap-2 text-sm font-black text-[#5A3726]">
                授課通行碼
                <input
                  name="code"
                  type="password"
                  required
                  className="h-12 rounded-2xl border border-[#dbcabd] bg-[#fffdf9] px-4 text-base font-bold outline-none transition focus:border-[#E85F00] focus:ring-4 focus:ring-orange-100"
                  placeholder="請輸入通行碼"
                />
              </label>
            ) : null}
            <button className="h-12 rounded-2xl bg-[#5A3726] px-5 text-sm font-black text-white shadow-sm transition hover:brightness-105">
              進入授課工作台
            </button>
          </form>

          <div className="mt-6 border-t border-[#f1e2d6] pt-4 text-xs leading-5 text-[#8a7c72]">
            <p>目前登入方式為第一版簡化流程。若同名或看不到課堂，請由秘書處確認講師名冊與課堂講師設定。</p>
            <Link href="/" className="mt-3 inline-flex font-black text-[#E85F00] hover:underline">
              返回學員前台
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
