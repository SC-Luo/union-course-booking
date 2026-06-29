import Link from "next/link";
import { notFound } from "next/navigation";
import { saveStudentIdentityAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import { StudentForm } from "../../student-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function EditStudentPage({ params }: PageProps) {
  const { studentId } = await params;
  const data = await getBookingData();
  const student = data.students.find((item) => item.id === studentId);

  if (!student) notFound();

  return (
    <AdminShell currentSection="roster.students" resumeHref={`/admin/students/${student.id}`} resumeLabel="學員詳細頁">
      <div className="mb-4">
        <Link href={`/admin/students/${student.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-[#6b3b25] hover:text-[#ef6c00]">
          ← 返回學員資料
        </Link>
      </div>
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950">編輯學員資料</h1>
      </section>

      <div className="mt-6">
        <StudentForm
          student={student}
          action={saveStudentIdentityAction}
          cancelHref={`/admin/students/${student.id}`}
          redirectTo={`/admin/students/${student.id}`}
          submitLabel="儲存變更"
        />
      </div>
    </AdminShell>
  );
}
