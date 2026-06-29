import Link from "next/link";
import { saveStudentIdentityAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { StudentForm } from "../student-form";

export const dynamic = "force-dynamic";

export default function NewStudentPage() {
  return (
    <AdminShell currentSection="roster.students" resumeHref="/admin/students" resumeLabel="學員名冊">
      <div className="mb-4">
        <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm font-bold text-[#6b3b25] hover:text-[#ef6c00]">
          ← 返回學員名冊
        </Link>
      </div>
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950">新增學員</h1>
      </section>

      <div className="mt-6">
        <StudentForm
          action={saveStudentIdentityAction}
          cancelHref="/admin/students"
          redirectTo="/admin/students"
          submitLabel="建立學員"
        />
      </div>
    </AdminShell>
  );
}
