"use client";

import Link from "next/link";
import { AdminShell } from "@/components/page-shell";
import { RosterFlowNav } from "@/components/roster-flow-nav";
import type { StudentDirectoryPageData } from "@/lib/booking-repository";
import {
  formatDate,
  formatDateTime,
  getStudentCompleteness,
  getStudentStatus,
} from "./student-profile-utils";
import { updateStudentIdentityStatusAction } from "@/app/admin/actions";
import { DeleteStudentButton } from "./DeleteStudentButton";

type StudentDirectoryPageProps = {
  data: StudentDirectoryPageData;
  q: string;
  status: string;
  saved?: string;
  error?: string;
  imported?: string;
  deleted?: string;
};

export function StudentDirectoryPage({
  data,
  q,
  status,
  saved,
  error,
  imported,
  deleted,
}: StudentDirectoryPageProps) {
  const students = data.students;
  const statusFilters = [
    ["all", "全部"],
    ["active", "啟用中"],
    ["review", "待確認"],
    ["inactive", "停用 / 歷史"],
  ] as const;

  const buildHref = (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") query.set(key, value);
    });
    const qs = query.toString();
    return `/admin/students${qs ? `?${qs}` : ""}`;
  };
  const classOptionLabel = (
    offering: StudentDirectoryPageData["courseOfferings"][number],
  ) =>
    [
      offering.displayTitle ??
        offering.displayName ??
        offering.classDisplayName ??
        offering.title ??
        offering.id,
      offering.year ? `${offering.year}` : "",
      offering.termLabel ?? (offering.term ? `${offering.term}` : ""),
    ]
      .filter(Boolean)
      .join(" / ");
  const activeView = data.mode;

  return (
    <AdminShell currentSection="roster.students">
      <section className="rounded-[2rem] border border-[#ead7c6] bg-white/85 p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950">學員名冊</h1>
      </section>

      {saved ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
          已更新學員資料{imported ? `，本次處理 ${imported} 筆` : ""}。
        </p>
      ) : null}
      {deleted ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
          「{decodeURIComponent(deleted)}」已永久刪除。
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700">
          {error === "has_relations"
            ? "此學員已有課程、報名、預約、點名或相關紀錄，無法永久刪除。若此學員已不再使用系統，請改用「停用」保留歷史資料。"
            : error === "student_not_found"
            ? "找不到該學員資料。"
            : error === "invalid"
            ? "送出失敗，請確認姓名、證件末三碼與手機號碼是否完整。"
            : decodeURIComponent(error)}
        </p>
      ) : null}

      <RosterFlowNav current="students" />

      {/* quick actions */}
      <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#a65f3b]">快速操作</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/students/new" className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
            新增學員
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold text-[#a65f3b]">學員總數</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">
              {data.totalCount.toLocaleString("zh-TW")}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              固定上限查詢；搜尋採 exact match，瀏覽採游標分頁。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["browse", "分頁瀏覽", buildHref({ status })],
              ["search", "搜尋學生", buildHref({ q, status })],
              [
                "class",
                "班級名冊",
                buildHref({
                  mode: "class",
                  offeringId: data.selectedOfferingId,
                  status,
                }),
              ],
              [
                "recent",
                "近期新增 30 筆",
                buildHref({ mode: "recent", q: undefined, status: undefined }),
              ],
            ].map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                className={`rounded-2xl border px-4 py-3 text-sm font-black ${
                  activeView === key
                    ? "border-[#ef6c00] bg-[#ef6c00] text-white"
                    : "border-[#ead7c6] bg-[#fffaf5] text-[#6b3b25]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              name="q"
              defaultValue={q}
              placeholder="會員編號、完整姓名、電話或身分末碼"
              className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none focus:border-[#ef6c00]"
            />
            <button className="rounded-2xl bg-[#ef6c00] px-5 py-3 text-sm font-bold text-white">
              搜尋
            </button>
          </form>
          {activeView === "class" ? (
            <form className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input type="hidden" name="mode" value="class" />
              <select
                name="offeringId"
                defaultValue={data.selectedOfferingId ?? ""}
                className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm font-bold text-[#4a2a1a] shadow-sm outline-none focus:border-[#ef6c00]"
              >
                <option value="">選擇班級</option>
                {data.courseOfferings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {classOptionLabel(offering)}
                  </option>
                ))}
              </select>
              <button className="rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white">
                查看班級
              </button>
            </form>
          ) : (
            <Link
              href="/admin/students?mode=class"
              className="flex h-12 items-center justify-center rounded-2xl bg-[#6b3b25] px-5 py-3 text-sm font-bold text-white"
            >
              進入班級名冊
            </Link>
          )}
        </div>
        {data.invalidCursor ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
            分頁游標無效，已改顯示第一頁。
          </p>
        ) : null}
      </section>

      {/* student list */}
      <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white shadow-sm">
        <div className="border-b border-[#ead7c6] p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <p className="text-sm font-semibold text-[#a65f3b]">搜尋與篩選</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">學員列表</h2>
            </div>
            <form className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                name="q"
                defaultValue={q}
                placeholder="搜尋姓名、手機、Email、會員編號"
                className="h-12 rounded-2xl border border-[#ead7c6] bg-white px-4 text-sm text-[#4a2a1a] shadow-sm outline-none focus:border-[#ef6c00]"
              />
              <button className="rounded-2xl bg-[#ef6c00] px-5 py-3 text-sm font-bold text-white">搜尋</button>
            </form>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusFilters.map(([key, label]) => (
              <Link
                key={key}
                href={buildHref({
                  mode: activeView === "class" ? "class" : undefined,
                  q,
                  offeringId: activeView === "class" ? data.selectedOfferingId : undefined,
                  status: key,
                })}
                className={`rounded-full border px-4 py-2 text-xs font-bold ${
                  status === key && activeView !== "recent"
                    ? "border-[#ef6c00] bg-[#ef6c00] text-white"
                    : "border-[#ead7c6] bg-white text-[#6b3b25]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[1.2fr_160px_140px_160px_110px_130px_170px] border-b border-[#ead7c6] bg-[#fff7ed] px-5 py-3 text-sm font-bold text-[#6b3b25] md:grid">
          <span>學員</span>
          <span>手機</span>
          <span>生日</span>
          <span>會員編號</span>
          <span>狀態</span>
          <span>完整度</span>
          <span>操作</span>
        </div>

        <div className="divide-y divide-[#f0dfcf]">
          {students.map((student) => {
            const studentStatus = getStudentStatus(student);
            const completeness = getStudentCompleteness(student);
            const isInactive = student.isActive === false;
            return (
              <div
                key={student.id}
                className="grid gap-3 px-5 py-4 transition hover:bg-[#fffaf5] md:grid-cols-[1.2fr_160px_140px_160px_110px_130px_170px] md:items-center"
              >
                <div>
                  <Link
                    href={`/admin/students/${student.id}`}
                    prefetch={false}
                    className="font-black text-zinc-950 hover:text-[#6b3b25]"
                  >
                    {student.name}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    末三碼：{student.idNumberLast3 || "未填"}｜來源：{student.source || "學員總表"}
                    {activeView === "recent"
                      ? `｜建立：${formatDateTime(student.createdAt)}`
                      : ""}
                  </p>
                </div>
                <div className="text-sm text-zinc-700">{student.phone || "未填"}</div>
                <div className="text-sm text-zinc-700">{formatDate(student.birthday)}</div>
                <div className="text-sm text-zinc-700">{student.memberNo || "未填"}</div>
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${studentStatus.className}`}>
                    {studentStatus.label}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${completeness.className}`}>
                    {completeness.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <Link
                    href={`/admin/students/${student.id}`}
                    prefetch={false}
                    className="rounded-full border border-[#ead7c6] bg-white px-3 py-1 text-xs font-bold text-[#6b3b25]"
                  >
                    查看
                  </Link>
                  <Link
                    href={`/admin/students/${student.id}/edit`}
                    prefetch={false}
                    className="rounded-full border border-[#ead7c6] bg-white px-3 py-1 text-xs font-bold text-[#6b3b25]"
                  >
                    編輯
                  </Link>
                  <form
                    action={updateStudentIdentityStatusAction}
                    onSubmit={(e) => {
                      const msg = isInactive
                        ? "確認啟用這位學員？啟用後將出現在啟用名冊。"
                        : "確認停用這位學員？停用後將不再出現在啟用名冊，但會保留歷史紀錄。";
                      if (!window.confirm(msg)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="studentId" value={student.id} />
                    <input type="hidden" name="status" value={isInactive ? "active" : "inactive"} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={buildHref({
                        mode: activeView === "class" ? "class" : undefined,
                        q,
                        offeringId:
                          activeView === "class" ? data.selectedOfferingId : undefined,
                        status,
                      })}
                    />
                    <button
                      type="submit"
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        isInactive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      }`}
                    >
                      {isInactive ? "啟用" : "停用"}
                    </button>
                  </form>
                  <DeleteStudentButton
                    studentId={student.id}
                    name={student.name}
                    createdAt={student.createdAt}
                    redirectTo={buildHref({
                      mode: activeView === "class" ? "class" : undefined,
                      q,
                      offeringId:
                        activeView === "class" ? data.selectedOfferingId : undefined,
                      status,
                    })}
                  />
                </div>
              </div>
            );
          })}
          {students.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">目前沒有符合條件的學員，請調整搜尋條件或先新增 / 匯入資料。</p>
          ) : null}
        </div>
        {activeView === "browse" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ead7c6] px-5 py-4">
            <p className="text-sm text-zinc-500">每頁最多 {data.pageSize} 筆</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildHref({ status })}
                className="rounded-full border border-[#ead7c6] bg-white px-4 py-2 text-sm font-bold text-[#6b3b25]"
              >
                第一頁
              </Link>
              {data.nextPageCursor ? (
                <Link
                  href={buildHref({ status, pageCursor: data.nextPageCursor })}
                  className="rounded-full bg-[#6b3b25] px-4 py-2 text-sm font-bold text-white"
                >
                  下一頁
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
