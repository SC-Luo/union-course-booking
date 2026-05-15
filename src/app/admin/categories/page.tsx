import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const { categories } = await getBookingData();

  return (
    <AdminShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">分類管理</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">課程分類</h1>
        </div>
        <button className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white">新增分類</button>
      </section>

      <section className="grid gap-4">
        {categories.map((category) => (
          <article key={category.id} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 md:grid-cols-[1fr_120px_120px_160px] md:items-center">
            <div>
              <p className="font-semibold text-zinc-950">{category.name}</p>
              <p className="mt-1 text-sm text-zinc-500">分類代碼：{category.id}</p>
            </div>
            <p className="text-sm text-zinc-600">排序 {category.sortOrder}</p>
            <p className="text-sm text-emerald-700">{category.isActive ? "啟用" : "停用"}</p>
            <div className="flex gap-2">
              <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">編輯</button>
              <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">停用</button>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
