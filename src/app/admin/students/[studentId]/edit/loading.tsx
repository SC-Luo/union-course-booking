import { AdminShell } from "@/components/page-shell";

export default function LoadingStudentEditPage() {
  return (
    <AdminShell currentSection="roster.students">
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">正在載入學員資料…</p>
        <div className="mt-4 h-8 w-48 animate-pulse rounded-2xl bg-[#f3dfcf]" />
      </section>
    </AdminShell>
  );
}
