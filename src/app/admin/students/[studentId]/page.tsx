import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/page-shell";
import { getBookingData } from "@/lib/booking-repository";
import {
  getEnrollmentOfferingId,
  getEnrollmentSeatLabel,
  getOfferingPeriodLabel,
  resolveCourseColor,
} from "@/lib/course-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ q?: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "未設定";
  return value.slice(0, 10).replaceAll("-", "/");
}

function entitlementStatusText(status?: string) {
  if (status === "active") return "有效";
  if (status === "expired") return "已過期";
  if (status === "revoked") return "已撤銷";
  return "待確認";
}

function attendanceStatusText(status?: string) {
  if (status === "attended") return "已到";
  if (status === "absent") return "未到";
  if (status === "leave") return "請假";
  return "未點名";
}

function recordTypeText(type?: string) {
  if (type === "first_attendance_date") return "第一堂日期";
  if (type === "term_code") return "年度 / 期別代碼";
  if (type === "marker") return "標記";
  if (type === "registered_not_started") return "已報名未上課";
  if (type === "absence_or_no_show") return "缺席 / 未到";
  if (type === "note") return "備註";
  return "待人工判斷";
}

export default async function AdminStudentProfilePage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const { q = "" } = await searchParams;
  const data = await getBookingData();
  const student = data.students.find((item) => item.id === studentId);

  if (!student) notFound();

  const normalizedQuery = q.trim().toLowerCase();
  const matchedStudents = normalizedQuery
    ? data.students
        .filter((item) => item.isActive !== false)
        .filter((item) =>
          [item.name, item.phone, item.memberId, item.externalMemberNo, item.idNumberLast3]
            .map((value) => String(value ?? "").trim().toLowerCase())
            .some((value) => value.includes(normalizedQuery)),
        )
        .slice(0, 8)
    : [];

  const courseMap = new Map(data.courses.map((course) => [course.id, course]));
  const seriesMap = new Map(data.courseSeries.map((series) => [series.id, series]));
  const offeringMap = new Map(data.courseOfferings.map((offering) => [offering.id, offering]));
  const categoryMap = new Map(data.categories.map((category) => [category.id, category]));

  const reservations = data.reservations.filter(
    (reservation) => reservation.studentId === student.id || reservation.studentName === student.name,
  );
  const records = data.studentCourseRecords.filter((record) => record.studentId === student.id);
  const entitlements = data.entitlements.filter((entitlement) => entitlement.studentId === student.id);
  const attendanceRecords = data.attendanceRecords.filter((record) => record.studentId === student.id);
  const enrollments = data.enrollments.filter((enrollment) => enrollment.studentId === student.id);

  const attended =
    reservations.filter((reservation) => reservation.attendanceStatus === "attended").length +
    attendanceRecords.filter((record) => record.status === "attended").length;
  const absent =
    reservations.filter((reservation) => reservation.attendanceStatus === "absent").length +
    attendanceRecords.filter((record) => record.status === "absent").length;
  const unchecked =
    reservations.filter(
      (reservation) =>
        !reservation.attendanceStatus ||
        reservation.attendanceStatus === "pending" ||
        reservation.attendanceStatus === "unchecked",
    ).length + attendanceRecords.filter((record) => record.status === "unchecked").length;
  const activeEntitlements = entitlements.filter((entitlement) => entitlement.status === "active").length;
  const courseRecordCount = enrollments.length + records.length + reservations.length + attendanceRecords.length;

  return (
    <AdminShell resumeHref={`/admin/students/${student.id}`} resumeLabel="學習履歷">
      <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/admin/students" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          ← 返回名冊管理
        </Link>
        <form className="grid gap-2 sm:grid-cols-[minmax(260px,420px)_auto]">
          <input
            name="q"
            defaultValue={q}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm"
            placeholder="搜尋其他學員姓名、手機、會員編號"
          />
          <button className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">
            搜尋學員
          </button>
        </form>
      </section>

      {normalizedQuery ? (
        <section className="mb-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700">搜尋結果</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">搜尋「{q}」找到 {matchedStudents.length} 位學員</h2>
              <p className="mt-1 text-sm text-zinc-500">點選學員即可切換到下一位學員的履歷，不需要回名冊頁重新找。</p>
            </div>
            <Link href={`/admin/students/${student.id}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
              清除搜尋
            </Link>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {matchedStudents.length === 0 ? (
              <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500 md:col-span-2 lg:col-span-4">沒有找到符合的學員。</p>
            ) : (
              matchedStudents.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/students/${item.id}`}
                  className={`rounded-lg border p-3 text-sm hover:border-emerald-400 hover:bg-emerald-50/40 ${
                    item.id === student.id ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <span className="block font-semibold text-zinc-950">{item.name}</span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {item.phone || "無手機"}｜{item.externalMemberNo || item.memberId || "無會員編號"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">學員履歷</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{student.name}｜學習履歷總覽</h1>
            <p className="mt-3 text-sm text-zinc-500">
              會員編號：{student.externalMemberNo || student.memberId || "未設定"}｜資料來源：{student.source || "未標示"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[560px]">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-4">
              <p className="text-xs text-zinc-500">課程紀錄</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-950">{courseRecordCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-xs text-emerald-700">有效複訓</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-800">{activeEntitlements}</p>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-4">
              <p className="text-xs text-zinc-500">已到 / 未到</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-950">{attended}/{absent}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4">
              <p className="text-xs text-amber-700">未點名</p>
              <p className="mt-1 text-2xl font-semibold text-amber-800">{unchecked}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-950">基本資料</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">手機</dt>
              <dd className="font-medium text-zinc-950">{student.phone || "未設定"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">身分識別</dt>
              <dd className="font-medium text-zinc-950">{student.idNumberLast3 ? `末三碼 ${student.idNumberLast3}` : "未設定"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">生日</dt>
              <dd className="font-medium text-zinc-950">{formatDate(student.birthday)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">分會 / 地址</dt>
              <dd className="font-medium text-zinc-950">{student.branch || "未設定"} {student.address || ""}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">複訓資格</h2>
              <p className="mt-1 text-sm text-zinc-500">日期格會轉為一年複訓資格；同名課程不同年度會分開保存。</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">有效 {activeEntitlements} 筆</span>
          </div>
          <div className="mt-4 grid gap-3">
            {entitlements.length === 0 ? (
              <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">目前沒有複訓資格紀錄。</p>
            ) : (
              entitlements.map((entitlement) => {
                const series = seriesMap.get(entitlement.seriesId);
                const offering = entitlement.offeringId ? offeringMap.get(entitlement.offeringId) : undefined;
                return (
                  <div key={entitlement.id} className="rounded-lg border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-950">{series?.title ?? entitlement.seriesId}</p>
                        <p className="mt-1 text-sm text-zinc-500">{offering?.displayTitle ?? offering?.title ?? "未綁定年度課程"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entitlement.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                        {entitlementStatusText(entitlement.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600">有效期間：{formatDate(entitlement.startsAt)} ～ {formatDate(entitlement.endsAt)}</p>
                    <p className="mt-1 text-xs text-zinc-500">來源：{entitlement.sourceSheet || "系統紀錄"}</p>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">年度期別班級名冊</h2>
            <p className="mt-1 text-sm text-zinc-500">座號存在 enrollment，不寫在學員主檔；同一位學員可出現在不同年度期別班級。</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{enrollments.length} 筆名冊關係</span>
        </div>
        <div className="mt-4 grid gap-3">
          {enrollments.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">目前沒有班級名冊關係。</p>
          ) : (
            enrollments.map((enrollment) => {
              const offering = offeringMap.get(getEnrollmentOfferingId(enrollment));
              const series = offering ? seriesMap.get(offering.seriesId) : enrollment.seriesId ? seriesMap.get(enrollment.seriesId) : undefined;
              const category = series?.categoryId ? categoryMap.get(series.categoryId) : undefined;
              const color = series?.color || category?.color || "#a1a1aa";
              return (
                <article key={enrollment.id} className="rounded-xl border border-zinc-200 bg-white p-4" style={{ borderLeft: `6px solid ${color}` }}>
                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.65fr_0.8fr_0.8fr] lg:items-center">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">課程主檔</p>
                      <h3 className="mt-1 font-semibold text-zinc-950">{series?.title ?? enrollment.seriesId ?? "未綁定課程主檔"}</h3>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">年度期別</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">{getOfferingPeriodLabel(offering)}</p>
                      <p className="mt-1 text-xs text-zinc-500">{offering?.shortName ?? offering?.sourceSheet ?? "無來源簡稱"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">座號</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950">{getEnrollmentSeatLabel(enrollment, student) || "未設定"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">出席狀況</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        已到 {attendanceRecords.filter((record) => record.offeringId === getEnrollmentOfferingId(enrollment) && record.status === "attended").length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">檢定結果</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">待匯入</p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">課程紀錄</h2>
            <p className="mt-1 text-sm text-zinc-500">以下卡片呈現每一筆原始學習紀錄，方便辨認課程、年度期別與系統判斷。</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{records.length} 筆紀錄</span>
        </div>
        <div className="mt-4 grid gap-3">
          {records.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">目前沒有 Excel 課程紀錄。</p>
          ) : (
            records.map((record) => {
              const series = seriesMap.get(record.seriesId);
              const offering = record.offeringId ? offeringMap.get(record.offeringId) : undefined;
              const category = series?.categoryId ? categoryMap.get(series.categoryId) : undefined;
              const color = series?.color || category?.color || "#a1a1aa";
              return (
                <article key={record.id} className="rounded-xl border border-zinc-200 bg-white p-4" style={{ borderLeft: `6px solid ${color}` }}>
                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:items-center">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">課程主檔</p>
                      <h3 className="mt-1 font-semibold text-zinc-950">{series?.title ?? record.sourceColumn}</h3>
                      <p className="mt-1 text-xs text-zinc-500">來源欄位：{record.sourceColumn}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">年度期別</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">{getOfferingPeriodLabel(offering)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">原始紀錄</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">{record.rawValue || "空白"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-500">系統判斷</p>
                      <span className="mt-1 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{recordTypeText(record.recordType)}</span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">預約與出席紀錄</h2>
            <p className="mt-1 text-sm text-zinc-500">這裡會逐步整合自由預約課、固定名冊課與實際點名結果。</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">預約 {reservations.length} 筆｜點名 {attendanceRecords.length} 筆</span>
        </div>
        <div className="mt-4 grid gap-3">
          {reservations.length === 0 && attendanceRecords.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">目前沒有預約或出席紀錄。</p>
          ) : null}

          {reservations.map((reservation) => {
            const course = courseMap.get(reservation.courseId);
            const category = course ? categoryMap.get(course.categoryId) : undefined;
            const color = course ? resolveCourseColor(course, category) : "#a1a1aa";
            return (
              <div key={reservation.id} className="rounded-lg border border-zinc-200 bg-white p-4" style={{ borderLeft: `5px solid ${color}` }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-950">{course?.title ?? reservation.courseId}</p>
                    <p className="mt-1 text-sm text-zinc-500">預約時間：{reservation.bookedAt || "未記錄"}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{attendanceStatusText(reservation.attendanceStatus)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">檢定紀錄規劃</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">下一階段可在這裡接入檢定資料：檢定類型、報名日期、考試日期、考場、成績、通過狀態、證照字號與補考紀錄。</p>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-zinc-600">待接 certificationRecords</span>
        </div>
      </section>
    </AdminShell>
  );
}
