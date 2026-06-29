"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Student } from "@/lib/types";
import {
  annualRevenueRangeOptions,
  businessCategorySuggestions,
  businessPlaceTypeOptions,
  businessRegistrationStatusOptions,
  capitalRangeOptions,
  customerTypeOptions,
  educationOptions,
  employeeCountRangeOptions,
  employeeStatusOptions,
  employmentStatusOptions,
  genderOptions,
  maritalStatusOptions,
  monthlyRevenueRangeOptions,
  operationModeOptions,
  startupStatusOptions,
  startupTypeOptions,
  workExperienceOptions,
  yesNoOptions,
} from "./student-profile-options";

type SectionId = "basic" | "contact" | "background" | "business" | "note";
type SectionStatus = "empty" | "missing" | "ready" | "confirmed" | "optional";

type StudentFormProps = {
  student?: Student;
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  submitLabel: string;
  redirectTo: string;
};

const SECTION_LABELS: Record<SectionId, string> = {
  basic: "基本資料",
  contact: "聯絡資料",
  background: "背景資料",
  business: "創業與營業資料",
  note: "備註與來源",
};

function splitChineseName(fullName: string) {
  if (!fullName) return { lastName: "", firstName: "" };
  const t = fullName.trim();
  if (t.includes(" ")) {
    const parts = t.split(/\s+/);
    return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
  }
  if (/[\u4e00-\u9fff]/.test(t)) {
    return { lastName: t[0], firstName: t.slice(1) };
  }
  return { lastName: "", firstName: t };
}

function splitEnglishName(fullName: string) {
  if (!fullName) return { lastName: "", firstName: "" };
  const t = fullName.trim();
  if (t.includes(" ")) {
    const parts = t.split(/\s+/);
    return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
  }
  return { lastName: "", firstName: t };
}

function RequiredMark() {
  return <span className="ml-1 text-[#c2410c]">*</span>;
}

function fieldClassName() {
  return "mt-2 w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[#ef6c00]";
}

function selectOptions(options: Array<{ value: string; label: string }>) {
  return (
    <>
      <option value="">請選擇</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#f0dfcf] bg-[#fffaf6] p-4">
      <div className="mb-4">
        <h4 className="text-sm font-black text-[#5A3726]">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function FloatingModal({
  title,
  children,
  onClose,
  footerLeft,
  footerRight,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-[28px] border border-[#ead8ca] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#f1e2d6] px-6 pb-4 pt-6">
          <h3 className="text-2xl font-black text-[#1f1712]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff1e7]"
          >
            關閉
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {footerLeft || footerRight ? (
          <div className="flex items-center justify-between gap-4 border-t border-[#f1e2d6] px-6 pb-6 pt-4">
            <div className="min-w-0 flex-1">{footerLeft}</div>
            <div className="flex shrink-0 items-center gap-3">{footerRight}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({
  index,
  title,
  subtitle,
  required,
  status,
  missingText,
  onClick,
}: {
  index: number;
  title: string;
  subtitle: string;
  required?: boolean;
  status: SectionStatus;
  missingText?: string;
  onClick: () => void;
}) {
  const borderColor = {
    empty: "border-[#ead7c6] bg-white",
    missing: "border-[#f0b38a] bg-[#fff7ed]",
    ready: "border-[#e6c56e] bg-[#fffbea]",
    confirmed: "border-[#8ac59a] bg-[#f4fff6]",
    optional: "border-[#d4c8c0] bg-[#faf8f6]",
  }[status];

  const badge = {
    empty: { text: "待確認", className: "border-zinc-200 bg-zinc-50 text-zinc-500" },
    missing: { text: missingText ?? "必填未完成", className: "border-[#f0b38a] bg-[#fff0e6] text-[#b85c1a]" },
    ready: { text: "可確認", className: "border-[#e6c56e] bg-[#fffbdf] text-[#8a6d00]" },
    confirmed: { text: "已完成", className: "border-[#8ac59a] bg-[#e6f7e9] text-[#1e7a3a]" },
    optional: { text: "可補充", className: "border-zinc-200 bg-zinc-50 text-zinc-400" },
  }[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[1.75rem] border p-5 text-left shadow-sm transition hover:shadow-md ${borderColor}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
          status === "confirmed"
            ? "bg-[#1e7a3a] text-white"
            : status === "missing"
              ? "bg-[#b85c1a] text-white"
              : status === "optional"
                ? "bg-[#d4c8c0] text-zinc-400"
                : "bg-[#e8d4c2] text-[#5A3726]"
        }`}
      >
        {status === "confirmed" ? "✓" : index}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-lg font-black text-zinc-950">{title}</p>
          {required ? <RequiredMark /> : null}
        </div>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-3 py-1 text-[13px] font-bold ${badge.className}`}
      >
        {badge.text}
      </span>
      <span
        className={`text-2xl font-black ${status === "confirmed" ? "text-[#1e7a3a]" : status === "optional" ? "text-[#d4c8c0]" : "text-[#B46F4A]"}`}
      >
        {status === "confirmed" ? "✓" : "›"}
      </span>
    </button>
  );
}

function HelperText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
      {children}
    </p>
  );
}

function extractLastThreeDigits(id: string): string {
  const digits = id.replace(/\D/g, "");
  return digits.slice(-3);
}

export function StudentForm({
  student,
  action,
  cancelHref,
  submitLabel,
  redirectTo,
}: StudentFormProps) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [openedSections, setOpenedSections] = useState<Record<SectionId, boolean>>({
    basic: false,
    contact: false,
    background: false,
    business: false,
    note: false,
  });
  const [confirmedSections, setConfirmedSections] = useState<Record<SectionId, boolean>>({
    basic: false,
    contact: false,
    background: false,
    business: false,
    note: false,
  });

  const initialName = splitChineseName(student?.name ?? "");
  const initialEnglish = splitEnglishName(student?.englishName ?? "");

  const [lastName, setLastName] = useState(initialName.lastName);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [englishLastName, setEnglishLastName] = useState(initialEnglish.lastName);
  const [englishFirstName, setEnglishFirstName] = useState(initialEnglish.firstName);
  const [nationalId, setNationalId] = useState(student?.nationalId ?? "");
  const [idNumberLast3, setIdNumberLast3] = useState(
    student?.idNumberLast3 ?? "",
  );
  const [phone, setPhone] = useState(student?.phone ?? "");

  const combinedName = lastName + firstName;
  const combinedEnglishName =
    englishLastName +
    (englishLastName && englishFirstName ? " " : "") +
    englishFirstName;
  const categoriesText = (student?.businessCategories ?? []).join("、");

  const derivedLast3 = nationalId ? extractLastThreeDigits(nationalId) : "";
  const hasIdLast3 = idNumberLast3.length === 3;
  const hasDerivedId = derivedLast3.length === 3;
  const basicRequiredOk =
    lastName.trim() !== "" &&
    firstName.trim() !== "" &&
    (hasIdLast3 || hasDerivedId);
  const contactRequiredOk = phone.trim() !== "";

  function getSectionStatus(id: SectionId): SectionStatus {
    if (confirmedSections[id]) return "confirmed";
    const opened = openedSections[id];
    if (id === "basic") {
      if (!basicRequiredOk) return opened ? "missing" : "empty";
      return "ready";
    }
    if (id === "contact") {
      if (!contactRequiredOk) return opened ? "missing" : "empty";
      return "ready";
    }
    return "optional";
  }

  function getMissingText(id: SectionId): string | undefined {
    if (id === "basic") {
      const missing: string[] = [];
      if (lastName.trim() === "") missing.push("姓氏");
      if (firstName.trim() === "") missing.push("名字");
      if (!hasIdLast3 && !hasDerivedId) missing.push("證件末三碼");
      return missing.length > 0 ? `缺少：${missing.join("、")}` : undefined;
    }
    if (id === "contact") {
      if (phone.trim() === "") return "缺少：手機";
    }
    return undefined;
  }

  function handleOpenSection(id: SectionId) {
    setOpenedSections((prev) => ({ ...prev, [id]: true }));
    setOpenSection(id);
  }

  function handleConfirmSection(id: SectionId) {
    if (id === "basic" && !basicRequiredOk) return;
    if (id === "contact" && !contactRequiredOk) return;
    setConfirmedSections((prev) => ({ ...prev, [id]: true }));
    setOpenSection(null);
  }

  function handleCloseWithoutConfirm() {
    setOpenSection(null);
  }

  const REQUIRED_SECTIONS: SectionId[] = ["basic", "contact"];
  const completedCount = REQUIRED_SECTIONS.filter((id) => confirmedSections[id]).length;
  const canSubmit = REQUIRED_SECTIONS.every((id) => confirmedSections[id]) && basicRequiredOk && contactRequiredOk;

  const unconfirmedRequired = REQUIRED_SECTIONS.filter(
    (id) => !confirmedSections[id],
  );
  const missingList = unconfirmedRequired
    .map((id) => SECTION_LABELS[id])
    .join("、");

  const numericThirdDigits = nationalId.replace(/\D/g, "");

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={student?.id ?? ""} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="name" value={combinedName} />
      <input type="hidden" name="englishName" value={combinedEnglishName} />
      <input type="hidden" name="nationalId" value={nationalId} />
      <input type="hidden" name="idNumberLast3" value={idNumberLast3 || derivedLast3} />
      <input type="hidden" name="phone" value={phone} />

      {/* progress row */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ead7c6] bg-white/80 px-5 py-3 text-sm shadow-sm">
        <span className="font-bold text-zinc-700">必填進度：</span>
        <div className="flex gap-1">
          {REQUIRED_SECTIONS.map((id) => (
            <span
              key={id}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                confirmedSections[id]
                  ? "bg-[#1e7a3a] text-white"
                  : getSectionStatus(id) === "missing"
                    ? "bg-[#b85c1a] text-white"
                    : "bg-[#e8d4c2] text-[#5A3726]"
              }`}
              title={SECTION_LABELS[id]}
            >
              {confirmedSections[id] ? "✓" : REQUIRED_SECTIONS.indexOf(id) + 1}
            </span>
          ))}
        </div>
        <span className="text-zinc-500">
          必填完成 {completedCount} / {REQUIRED_SECTIONS.length}
        </span>
      </div>

      <div className="grid gap-3">
        <SectionCard
          index={1}
          title="基本資料"
          subtitle="姓名、性別、生日、身分證、會員編號"
          required
          status={getSectionStatus("basic")}
          missingText={getMissingText("basic")}
          onClick={() => handleOpenSection("basic")}
        />
        <SectionCard
          index={2}
          title="聯絡資料"
          subtitle="手機、Email、地址、緊急聯絡人"
          required
          status={getSectionStatus("contact")}
          missingText={getMissingText("contact")}
          onClick={() => handleOpenSection("contact")}
        />
        <SectionCard
          index={3}
          title="背景資料"
          subtitle="學歷、婚姻、職業、產業"
          status={getSectionStatus("background")}
          onClick={() => handleOpenSection("background")}
        />
        <SectionCard
          index={4}
          title="創業與營業資料"
          subtitle="創業狀態、品牌、營業登記、營運資訊"
          status={getSectionStatus("business")}
          onClick={() => handleOpenSection("business")}
        />
        <SectionCard
          index={5}
          title="備註與來源"
          subtitle="補充說明與來源註記"
          status={getSectionStatus("note")}
          onClick={() => handleOpenSection("note")}
        />
      </div>

      {/* SECTION: basic */}
      {openSection === "basic" && (
        <FloatingModal
          title="基本資料"
          onClose={handleCloseWithoutConfirm}
          footerLeft={
            basicRequiredOk ? (
              <span className="text-sm text-zinc-500">此區塊可以確認</span>
            ) : (
              <span className="text-sm font-bold text-[#b85c1a]">
                {getMissingText("basic")}
              </span>
            )
          }
          footerRight={
            <>
              <button
                type="button"
                onClick={handleCloseWithoutConfirm}
                className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-2.5 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed]"
              >
                稍後再填
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSection("basic")}
                disabled={!basicRequiredOk}
                className="rounded-2xl bg-[#1e7a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                完成此區塊
              </button>
            </>
          }
        >
          <div className="grid gap-5">
            <FieldGroup title="姓名識別" description="建立學員主檔的基本識別。">
              <label className="text-sm font-bold text-zinc-700">
                姓氏
                <RequiredMark />
                <input
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (confirmedSections.basic) setConfirmedSections((prev) => ({ ...prev, basic: false }));
                  }}
                  required
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                名字
                <RequiredMark />
                <input
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (confirmedSections.basic) setConfirmedSections((prev) => ({ ...prev, basic: false }));
                  }}
                  required
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                英文姓氏
                <input
                  value={englishLastName}
                  onChange={(e) => setEnglishLastName(e.target.value)}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                英文名字
                <input
                  value={englishFirstName}
                  onChange={(e) => setEnglishFirstName(e.target.value)}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup
              title="證件與個人資訊"
              description="身分證字號與證件末三碼擇一；系統會以末三碼作為快速識別。"
            >
              <label className="text-sm font-bold text-zinc-700">
                身分證字號<span className="ml-1 text-xs text-zinc-400">（與末三碼擇一）</span>
                <input
                  value={nationalId}
                  onChange={(e) => {
                    setNationalId(e.target.value);
                    if (confirmedSections.basic) setConfirmedSections((prev) => ({ ...prev, basic: false }));
                  }}
                  className={fieldClassName()}
                />
                {numericThirdDigits.length >= 3 ? (
                  <HelperText>
                    將使用末三碼：
                    <span className="font-bold text-[#b85c1a]">
                      {extractLastThreeDigits(nationalId)}
                    </span>
                  </HelperText>
                ) : null}
              </label>
              <label className="text-sm font-bold text-zinc-700">
                證件末三碼<span className="ml-1 text-xs text-zinc-400">（與身分證字號擇一）</span>
                <input
                  value={idNumberLast3}
                  onChange={(e) => {
                    setIdNumberLast3(e.target.value.replace(/\D/g, "").slice(0, 3));
                    if (confirmedSections.basic) setConfirmedSections((prev) => ({ ...prev, basic: false }));
                  }}
                  maxLength={3}
                  inputMode="numeric"
                  className={fieldClassName()}
                />
                <HelperText>
                  身分證字號或證件末三碼擇一；系統會以末三碼作為快速識別。
                </HelperText>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                生日
                <input
                  name="birthday"
                  defaultValue={student?.birthday ?? ""}
                  placeholder="YYYY-MM-DD"
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                性別
                <select
                  name="gender"
                  defaultValue={student?.gender ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(genderOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                出生地
                <input
                  name="birthPlace"
                  defaultValue={student?.birthPlace ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="系統管理">
              <label className="text-sm font-bold text-zinc-700">
                會員編號
                <input
                  name="memberNo"
                  defaultValue={student?.memberNo ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                狀態
                <select
                  name="rosterStatus"
                  defaultValue={
                    student?.isActive === false
                      ? "inactive"
                      : student?.needsReview
                        ? "review"
                        : "active"
                  }
                  className={fieldClassName()}
                >
                  <option value="active">啟用中</option>
                  <option value="review">待確認</option>
                  <option value="inactive">停用 / 歷史</option>
                </select>
              </label>
            </FieldGroup>
          </div>
        </FloatingModal>
      )}

      {/* SECTION: contact */}
      {openSection === "contact" && (
        <FloatingModal
          title="聯絡資料"
          onClose={handleCloseWithoutConfirm}
          footerLeft={
            contactRequiredOk ? (
              <span className="text-sm text-zinc-500">此區塊可以確認</span>
            ) : (
              <span className="text-sm font-bold text-[#b85c1a]">
                {getMissingText("contact")}
              </span>
            )
          }
          footerRight={
            <>
              <button
                type="button"
                onClick={handleCloseWithoutConfirm}
                className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-2.5 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed]"
              >
                稍後再填
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSection("contact")}
                disabled={!contactRequiredOk}
                className="rounded-2xl bg-[#1e7a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                完成此區塊
              </button>
            </>
          }
        >
          <div className="grid gap-5">
            <FieldGroup title="主要聯絡方式">
              <label className="text-sm font-bold text-zinc-700">
                手機
                <RequiredMark />
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (confirmedSections.contact) setConfirmedSections((prev) => ({ ...prev, contact: false }));
                  }}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                市內電話
                <input
                  name="landline"
                  defaultValue={student?.landline ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                Email
                <input
                  name="email"
                  defaultValue={student?.email ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                Line ID
                <input
                  name="lineId"
                  defaultValue={student?.lineId ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="地址資訊">
              <label className="text-sm font-bold text-zinc-700 md:col-span-2">
                通訊地址
                <input
                  name="mailingAddress"
                  defaultValue={student?.mailingAddress ?? student?.address ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700 md:col-span-2">
                戶籍地址
                <input
                  name="householdAddress"
                  defaultValue={student?.householdAddress ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="緊急聯絡人">
              <label className="text-sm font-bold text-zinc-700">
                緊急聯絡人
                <input
                  name="emergencyContactName"
                  defaultValue={student?.emergencyContactName ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                緊急聯絡人電話
                <input
                  name="emergencyContactPhone"
                  defaultValue={student?.emergencyContactPhone ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>
          </div>
        </FloatingModal>
      )}

      {/* SECTION: background */}
      {openSection === "background" && (
        <FloatingModal
          title="背景資料"
          onClose={handleCloseWithoutConfirm}
          footerLeft={
            <span className="text-sm text-zinc-500">此區塊可以確認，未來可再補資料</span>
          }
          footerRight={
            <>
              <button
                type="button"
                onClick={handleCloseWithoutConfirm}
                className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-2.5 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed]"
              >
                稍後再填
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSection("background")}
                className="rounded-2xl bg-[#1e7a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
              >
                完成此區塊
              </button>
            </>
          }
        >
          <div className="grid gap-5">
            <FieldGroup title="學歷">
              <label className="text-sm font-bold text-zinc-700">
                最高學歷
                <select
                  name="educationLevel"
                  defaultValue={student?.educationLevel ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(educationOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                畢業學校
                <input
                  name="graduationSchool"
                  defaultValue={student?.graduationSchool ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                科系
                <input
                  name="major"
                  defaultValue={student?.major ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="家庭狀態">
              <label className="text-sm font-bold text-zinc-700">
                婚姻狀態
                <select
                  name="maritalStatus"
                  defaultValue={student?.maritalStatus ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(maritalStatusOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                子女數
                <input
                  name="childrenCount"
                  type="number"
                  min="0"
                  defaultValue={student?.childrenCount ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                子女年齡
                <input
                  name="childrenAges"
                  defaultValue={student?.childrenAges ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="工作背景">
              <label className="text-sm font-bold text-zinc-700">
                目前職業狀態
                <select
                  name="employmentStatus"
                  defaultValue={student?.employmentStatus ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(employmentStatusOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                公司名稱
                <input
                  name="companyName"
                  defaultValue={student?.companyName ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                職稱
                <input
                  name="jobTitle"
                  defaultValue={student?.jobTitle ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                工作年資
                <select
                  name="workExperience"
                  defaultValue={student?.workExperience ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(workExperienceOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                產業類別
                <input
                  name="industryCategory"
                  defaultValue={student?.industryCategory ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                美容相關行業
                <select
                  name="beautyRelated"
                  defaultValue={student?.beautyRelated ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(yesNoOptions)}
                </select>
              </label>
            </FieldGroup>
          </div>
        </FloatingModal>
      )}

      {/* SECTION: business */}
      {openSection === "business" && (
        <FloatingModal
          title="創業與營業資料"
          onClose={handleCloseWithoutConfirm}
          footerLeft={
            <span className="text-sm text-zinc-500">此區塊可以確認，未來可再補資料</span>
          }
          footerRight={
            <>
              <button
                type="button"
                onClick={handleCloseWithoutConfirm}
                className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-2.5 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed]"
              >
                稍後再填
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSection("business")}
                className="rounded-2xl bg-[#1e7a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
              >
                完成此區塊
              </button>
            </>
          }
        >
          <div className="grid gap-5">
            <FieldGroup title="創業狀態">
              <label className="text-sm font-bold text-zinc-700">
                創業狀態
                <select
                  name="startupStatus"
                  defaultValue={student?.startupStatus ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(startupStatusOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                創業年資
                <select
                  name="startupExperience"
                  defaultValue={student?.startupExperience ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(workExperienceOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                創業類型
                <select
                  name="startupType"
                  defaultValue={student?.startupType ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(startupTypeOptions)}
                </select>
              </label>
            </FieldGroup>

            <FieldGroup title="品牌與登記">
              <label className="text-sm font-bold text-zinc-700">
                品牌名稱
                <input
                  name="brandName"
                  defaultValue={student?.brandName ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                營業登記
                <select
                  name="hasBusinessRegistration"
                  defaultValue={student?.hasBusinessRegistration ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(yesNoOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                營業登記狀況
                <select
                  name="businessRegistrationStatus"
                  defaultValue={student?.businessRegistrationStatus ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(businessRegistrationStatusOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                統一編號
                <input
                  name="taxId"
                  defaultValue={student?.taxId ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="營運內容">
              <label className="text-sm font-bold text-zinc-700 md:col-span-2">
                主要營業項目
                <input
                  name="businessCategoriesText"
                  defaultValue={categoriesText}
                  placeholder={businessCategorySuggestions.join("、")}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                營業場所類型
                <select
                  name="businessPlaceType"
                  defaultValue={student?.businessPlaceType ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(businessPlaceTypeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700 md:col-span-2">
                營業地址
                <input
                  name="businessAddress"
                  defaultValue={student?.businessAddress ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                經營型態
                <select
                  name="operationMode"
                  defaultValue={student?.operationMode ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(operationModeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                主要客群
                <select
                  name="customerType"
                  defaultValue={student?.customerType ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(customerTypeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                服務項目說明
                <textarea
                  name="serviceDescription"
                  rows={4}
                  defaultValue={student?.serviceDescription ?? ""}
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>

            <FieldGroup title="規模與營收">
              <label className="text-sm font-bold text-zinc-700">
                固定員工
                <select
                  name="employeeStatus"
                  defaultValue={student?.employeeStatus ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(employeeStatusOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                員工人數級距
                <select
                  name="employeeCountRange"
                  defaultValue={student?.employeeCountRange ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(employeeCountRangeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                正職人數
                <input
                  name="fullTimeEmployees"
                  type="number"
                  min="0"
                  defaultValue={student?.fullTimeEmployees ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                兼職人數
                <input
                  name="partTimeEmployees"
                  type="number"
                  min="0"
                  defaultValue={student?.partTimeEmployees ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                資本額級距
                <select
                  name="capitalRange"
                  defaultValue={student?.capitalRange ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(capitalRangeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                月營業額級距
                <select
                  name="monthlyRevenueRange"
                  defaultValue={student?.monthlyRevenueRange ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(monthlyRevenueRangeOptions)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">
                年營業額級距
                <select
                  name="annualRevenueRange"
                  defaultValue={student?.annualRevenueRange ?? ""}
                  className={fieldClassName()}
                >
                  {selectOptions(annualRevenueRangeOptions)}
                </select>
              </label>
            </FieldGroup>
          </div>
        </FloatingModal>
      )}

      {/* SECTION: note */}
      {openSection === "note" && (
        <FloatingModal
          title="備註與來源"
          onClose={handleCloseWithoutConfirm}
          footerLeft={
            <span className="text-sm text-zinc-500">此區塊可以確認，未來可再補資料</span>
          }
          footerRight={
            <>
              <button
                type="button"
                onClick={handleCloseWithoutConfirm}
                className="rounded-2xl border border-[#ead8ca] bg-white px-5 py-2.5 text-sm font-bold text-[#6b3b25] hover:bg-[#fff7ed]"
              >
                稍後再填
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSection("note")}
                className="rounded-2xl bg-[#1e7a3a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
              >
                完成此區塊
              </button>
            </>
          }
        >
          <div className="grid gap-5">
            <FieldGroup title="資料來源與備註">
              <label className="text-sm font-bold text-zinc-700">
                資料來源
                <input
                  name="source"
                  defaultValue={student?.source ?? ""}
                   placeholder="例如：學員名冊手動建立、LINE 一對一、Excel 匯入、現場報名"
                  className={fieldClassName()}
                />
              </label>
              <label className="text-sm font-bold text-zinc-700">
                備註
                <textarea
                  name="note"
                  rows={4}
                  defaultValue={student?.note ?? ""}
                  placeholder="可記錄特殊需求、補充說明、後續待確認事項"
                  className={fieldClassName()}
                />
              </label>
            </FieldGroup>
          </div>
        </FloatingModal>
      )}

      {/* bottom actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-700">
              必填完成 {completedCount} / {REQUIRED_SECTIONS.length}
            </span>
            {unconfirmedRequired.length > 0 ? (
              <span className="text-sm text-zinc-500">
                ｜尚未完成必填：{missingList}
              </span>
            ) : null}
          </div>
          {!canSubmit ? (
            <p className="mt-1 text-xs text-[#b85c1a]">
              請先完成基本資料與聯絡資料兩個必填區塊
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={cancelHref}
            className="rounded-2xl border border-[#ead7c6] bg-white px-5 py-3 text-sm font-bold text-[#6b3b25]"
          >
            取消
          </a>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-2xl bg-[#6b3b25] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
