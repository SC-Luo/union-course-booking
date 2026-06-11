import { saveStudentIdentityAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { StudentForm } from "../student-form";

export const dynamic = "force-dynamic";

export default function NewStudentPage() {
  return (
    <AdminShell currentSection="roster.students" resumeHref="/admin/students" resumeLabel="學員總表">
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">新增學員</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">先建基本資料，再慢慢補完整資料</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-600">
          這個頁面只處理單一學員主檔。課程資格、班級與匯入流程請到對應工具頁處理。
        </p>
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
