import { StudentShell } from "@/components/page-shell";
import { submitNewStudentProfileAction } from "@/app/actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewStudentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isInvalid = params.error === "invalid";

  const categories = ["美容", "美體", "美甲", "美睫", "熱蠟", "皮膚管理", "其他"];

  return (
    <StudentShell>
      <div className="mx-auto max-w-2xl">
        <section className="mb-8 rounded-[2rem] border border-[#ead8c6] bg-gradient-to-br from-[#fffaf5] via-[#f8eadc] to-[#eed2b8] p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-black tracking-tight text-[#34231a] sm:text-4xl">
            新生資料填寫
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6f4b35]">
            請填寫基本聯絡資料，送出後工作人員會協助建立學員資料。
          </p>
        </section>

        {isInvalid ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm animate-pulse">
            資料尚未完整，請確認姓名、身分證字號、手機與生日是否已填寫。
          </div>
        ) : null}

        {params.error === "consent" ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm animate-pulse">
            請先勾選個資使用同意後再送出。
          </div>
        ) : null}

        <form
          action={submitNewStudentProfileAction}
          className="space-y-6 rounded-[2rem] border border-[#ead8c6] bg-white p-6 shadow-sm sm:p-8"
        >
          {/* 第一區：基本資料 */}
          <div>
            <h2 className="border-b border-[#f0e3d5] pb-2 text-lg font-black text-[#6b3b25]">
              第一區：基本資料
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="請填寫真實姓名"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  身分證字號 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  name="nationalId"
                  type="text"
                  placeholder="請填寫完整身分證字號"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  手機 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  name="phone"
                  type="tel"
                  placeholder="例如：0912345678"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  生日 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  name="birthday"
                  type="date"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  Email <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="example@email.com"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>
            </div>
          </div>

          {/* 第二區：聯絡資料 */}
          <div>
            <h2 className="border-b border-[#f0e3d5] pb-2 text-lg font-black text-[#6b3b25]">
              第二區：聯絡資料
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  通訊地址 <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <input
                  name="mailingAddress"
                  type="text"
                  placeholder="請填寫可收信的完整通訊地址"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  緊急聯絡人姓名 <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <input
                  name="emergencyContactName"
                  type="text"
                  placeholder="姓名"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  緊急聯絡人電話 <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <input
                  name="emergencyContactPhone"
                  type="tel"
                  placeholder="聯絡電話"
                  className="h-12 rounded-xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>
            </div>
          </div>

          {/* 第三區：學習需求 */}
          <div>
            <h2 className="border-b border-[#f0e3d5] pb-2 text-lg font-black text-[#6b3b25]">
              第三區：學習需求
            </h2>
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  目前是否從事相關行業 <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4a2a1a]">
                    <input
                      type="radio"
                      name="beautyRelated"
                      value="是"
                      className="h-4 w-4 border-[#ead7c6] text-[#ef6c00] focus:ring-[#f7c58d]/40"
                    />
                    是，我目前從事相關行業
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[#4a2a1a]">
                    <input
                      type="radio"
                      name="beautyRelated"
                      value="否"
                      className="h-4 w-4 border-[#ead7c6] text-[#ef6c00] focus:ring-[#f7c58d]/40"
                    />
                    否，我是初學者 / 想轉行
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  想了解的課程 <span className="text-zinc-500 text-xs">(選填，可複選)</span>
                </label>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
                  {categories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm text-[#4a2a1a]">
                      <input
                        type="checkbox"
                        name="interestedCourses"
                        value={cat}
                        className="h-4 w-4 rounded border-[#ead7c6] text-[#ef6c00] focus:ring-[#f7c58d]/40"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-[#4a2a1a]">
                  備註與其他需求 <span className="text-zinc-500 text-xs">(選填)</span>
                </label>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="若有其他想了解的事情，請寫在此處..."
                  className="rounded-xl border border-[#ead7c6] bg-white p-3 text-sm text-[#4a2a1a] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[#ef6c00] focus:ring-2 focus:ring-[#f7c58d]/40"
                />
              </div>
            </div>
          </div>

          {/* 第四區：個資同意 */}
          <div className="border-t border-[#f0e3d5] pt-6">
            <h2 className="text-lg font-black text-[#6b3b25] mb-3">
              第四區：個資使用同意
            </h2>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-[#4a2a1a]">
              <input
                required
                type="checkbox"
                name="consent"
                value="yes"
                className="mt-1 h-4 w-4 rounded border-[#ead7c6] text-[#ef6c00] focus:ring-[#f7c58d]/40 shrink-0"
              />
              <span className="leading-relaxed">
                我同意工會將本表單資料用於學員資料建立、課程聯繫與行政作業，不會公開顯示於前台頁面。 <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          {/* Honeypot 防垃圾送出欄位 */}
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />

          {/* 提醒與送出按鈕 */}
          <div className="border-t border-[#f0e3d5] pt-6">
            <p className="text-xs leading-5 text-zinc-500">
              送出後資料會進入工會學員資料庫，工作人員確認後會再與您聯繫。
            </p>
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#6b3b25] px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-[#522d1b] focus:outline-none focus:ring-2 focus:ring-[#f7c58d]"
            >
              送出資料
            </button>
          </div>
        </form>
      </div>
    </StudentShell>
  );
}
