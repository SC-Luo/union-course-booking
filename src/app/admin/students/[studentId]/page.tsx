import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import type { Student } from "@/lib/types";
import { formatDate, getStudentCompleteness, getStudentStatus, text } from "../student-profile-utils";
import { deleteStudentIdentityAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

function valueOrDash(value: unknown) {
  return text(value) || "未填";
}

function section(
  title: string,
  description: string,
  children: ReactNode,
) {
  return (
    <section className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
      <div className="border-b border-[#f0dfcf] pb-4">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function infoGrid(items: Array<[string, string]>) {
  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm font-bold text-zinc-500">{label}</dt>
          <dd className="mt-1 text-sm text-zinc-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getRecentCourseSummary(student: Student, data: Awaited<ReturnType<typeof getBookingData>>) {
  const enrollments = data.enrollments.filter((item) => item.studentId === student.id);
  const reservations = data.reservations.filter(
    (item) => item.studentId === student.id || item.studentName === student.name,
  );
  const offeringMap = new Map(data.courseOfferings.map((item) => [item.id, item]));
  const courseMap = new Map(data.courses.map((item) => [item.id, item]));

  return {
    enrollmentCount: enrollments.length,
    reservationCount: reservations.length,
    courseNames: enrollments
      .slice(0, 5)
      .map((enrollment) => {
        const offering = offeringMap.get(enrollment.offeringId);
        const course = enrollment.courseId ? courseMap.get(enrollment.courseId) : undefined;
        return (
          offering?.displayTitle ??
          offering?.displayName ??
          offering?.title ??
          course?.displayTitle ??
          course?.title ??
          enrollment.classDisplayName ??
          "未命名班級"
        );
      }),
  };
}

export default async function AdminStudentProfilePage({ params }: PageProps) {
  const { studentId } = await params;
  const data = await getBookingData();
  const student = data.students.find((item) => item.id === studentId);

  if (!student) notFound();

  const studentStatus = getStudentStatus(student);
  const completeness = getStudentCompleteness(student);
  const summary = getRecentCourseSummary(student, data);
  const recentImports = data.importBatches
    .filter((batch) =>
      [batch.note, batch.fileName, batch.sourceFile]
        .map((value) => text(value))
        .join(" ")
        .includes(student.name),
    )
    .slice(0, 3);

  return (
    <AdminShell currentSection="roster.students" resumeHref="/admin/students" resumeLabel="學員名冊">
      <div className="mb-4">
        <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm font-bold text-[#6b3b25] hover:text-[#ef6c00]">
          ← 返回學員名冊
        </Link>
      </div>
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">{student.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">查看完整資料</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/students/${student.id}/edit`}
              className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white"
            >
              編輯學員
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold ${studentStatus.className}`}>
              {studentStatus.label}
            </span>
            <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold ${completeness.className}`}>
              {completeness.label}
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["手機", valueOrDash(student.phone)],
              ["會員編號", valueOrDash(student.memberNo)],
              ["生日", formatDate(student.birthday)],
              ["最近班級數", String(summary.enrollmentCount)],
              ["預約紀錄數", String(summary.reservationCount)],
              ["最後更新", formatDate(student.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] px-4 py-4">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-2 text-lg font-black text-zinc-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-zinc-950">最近相關班級</h2>
          <div className="mt-4 grid gap-3">
            {summary.courseNames.length === 0 ? (
              <p className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] px-4 py-4 text-sm text-zinc-500">
                目前沒有關聯班級。
              </p>
            ) : (
              summary.courseNames.map((name) => (
                <div key={name} className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] px-4 py-4 text-sm font-bold text-zinc-900">
                  {name}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5">
        {section(
          "基本資料",
          "學員身份辨識與主要主檔欄位。",
          infoGrid([
            ["姓名", valueOrDash(student.name)],
            ["英文名／羅馬拼音", valueOrDash(student.englishName)],
            ["性別", valueOrDash(student.gender)],
            ["生日", formatDate(student.birthday)],
            ["身分證／居留證", valueOrDash(student.nationalId)],
            ["證件末三碼", valueOrDash(student.idNumberLast3)],
            ["出生地", valueOrDash(student.birthPlace)],
            ["會員編號", valueOrDash(student.memberNo)],
            ["資料來源", valueOrDash(student.source)],
          ]),
        )}

        {section(
          "聯絡資料",
          "學生端查詢與工作人員聯繫常用欄位。",
          infoGrid([
            ["手機", valueOrDash(student.phone)],
            ["市內電話", valueOrDash(student.landline)],
            ["Email", valueOrDash(student.email)],
            ["Line ID", valueOrDash(student.lineId)],
            ["通訊地址", valueOrDash(student.mailingAddress || student.address)],
            ["戶籍地址", valueOrDash(student.householdAddress)],
            ["緊急聯絡人", valueOrDash(student.emergencyContactName)],
            ["緊急聯絡人電話", valueOrDash(student.emergencyContactPhone)],
          ]),
        )}

        {section(
          "背景資料",
          "學歷、職業與創業背景。",
          infoGrid([
            ["最高學歷", valueOrDash(student.educationLevel)],
            ["畢業學校", valueOrDash(student.graduationSchool)],
            ["科系", valueOrDash(student.major)],
            ["婚姻狀態", valueOrDash(student.maritalStatus)],
            ["子女數", valueOrDash(student.childrenCount)],
            ["子女年齡", valueOrDash(student.childrenAges)],
            ["目前職業狀態", valueOrDash(student.employmentStatus)],
            ["公司名稱", valueOrDash(student.companyName)],
            ["職稱", valueOrDash(student.jobTitle)],
            ["工作年資", valueOrDash(student.workExperience)],
            ["產業類別", valueOrDash(student.industryCategory)],
            ["美容相關行業", valueOrDash(student.beautyRelated)],
          ]),
        )}

        {section(
          "創業與營業資料",
          "保留未來與外部資料同步時需要的欄位。",
          <>
            {infoGrid([
              ["是否已創業", valueOrDash(student.startupStatus)],
              ["創業年資", valueOrDash(student.startupExperience)],
              ["創業類型", valueOrDash(student.startupType)],
              ["品牌名稱", valueOrDash(student.brandName)],
              ["是否有營業登記", valueOrDash(student.hasBusinessRegistration)],
              ["營業登記狀況", valueOrDash(student.businessRegistrationStatus)],
              ["統一編號", valueOrDash(student.taxId)],
              ["營業場所類型", valueOrDash(student.businessPlaceType)],
              ["營業地址", valueOrDash(student.businessAddress)],
              ["經營型態", valueOrDash(student.operationMode)],
              ["主要客群", valueOrDash(student.customerType)],
              ["固定員工", valueOrDash(student.employeeStatus)],
              ["員工人數", valueOrDash(student.employeeCountRange)],
              ["正職人數", valueOrDash(student.fullTimeEmployees)],
              ["兼職 / PT 人數", valueOrDash(student.partTimeEmployees)],
              ["資本額級距", valueOrDash(student.capitalRange)],
              ["月營業額級距", valueOrDash(student.monthlyRevenueRange)],
              ["年營業額級距", valueOrDash(student.annualRevenueRange)],
            ])}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] p-4">
                <p className="text-sm font-bold text-zinc-500">主要營業項目</p>
                <p className="mt-2 text-sm text-zinc-900">
                  {(student.businessCategories ?? []).length > 0
                    ? student.businessCategories?.join("、")
                    : "未填"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] p-4">
                <p className="text-sm font-bold text-zinc-500">主要服務項目說明</p>
                <p className="mt-2 text-sm text-zinc-900">{valueOrDash(student.serviceDescription)}</p>
              </div>
            </div>
          </>,
        )}

        {section(
          "備註與系統資訊",
          "工作人員備註、資料狀態與最近匯入來源。",
          <>
            {infoGrid([
              ["備註", valueOrDash(student.note)],
              ["建立時間", formatDate(student.createdAt)],
              ["更新時間", formatDate(student.updatedAt)],
              ["狀態", studentStatus.label],
            ])}
            <div className="mt-5 rounded-2xl border border-[#f0dfcf] bg-[#fffaf5] p-4">
              <p className="text-sm font-bold text-zinc-500">最近匯入批次</p>
              <div className="mt-3 grid gap-2">
                {recentImports.length === 0 ? (
                  <p className="text-sm text-zinc-500">目前沒有直接匹配到這位學員姓名的匯入備註。</p>
                ) : (
                  recentImports.map((batch) => (
                    <div key={batch.id} className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-zinc-900">
                      {valueOrDash(batch.note || batch.fileName || batch.sourceFile)}｜{formatDate(batch.importedAt || batch.createdAt)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
        )}
      </div>

      <section className="mt-8 rounded-[1.75rem] border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
        <h2 className="text-lg font-black text-zinc-950">危險區</h2>
        <p className="mt-1 text-sm text-zinc-500">停用學員後將不再顯示於啟用名冊，但會保留所有歷史資料。</p>
        <form action={deleteStudentIdentityAction} className="mt-4">
          <input type="hidden" name="studentId" value={student.id} />
          <input type="hidden" name="redirectTo" value="/admin/students" />
          <button
            type="submit"
            className="rounded-2xl border border-rose-300 bg-white px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
          >
            停用學員
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
