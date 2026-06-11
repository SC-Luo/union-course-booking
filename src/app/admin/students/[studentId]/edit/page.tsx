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
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">編輯學員</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{student.name}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-600">
          你可以只更新需要的區塊，不需要一次填完整份資料。
        </p>
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
