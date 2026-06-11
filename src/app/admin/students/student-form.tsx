"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
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

type StudentFormProps = {
  student?: Student;
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  submitLabel: string;
  redirectTo: string;
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

function FloatingModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-[#ead8ca] bg-white p-6 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#f1e2d6] pb-4">
          <h3 className="text-2xl font-black text-[#1f1712]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#ead8ca] bg-[#fffaf5] px-4 py-2 text-sm font-black text-[#5A3726] hover:bg-[#fff1e7]"
          >
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 text-left shadow-sm transition hover:border-[#E7892B]/40 hover:shadow-md"
    >
      <div className="flex-1">
        <p className="text-lg font-black text-zinc-950">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <span className="text-2xl font-black text-[#B46F4A]">›</span>
    </button>
  );
}

export function StudentForm({
  student,
  action,
  cancelHref,
  submitLabel,
  redirectTo,
}: StudentFormProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const closeSection = useCallback(() => setOpenSection(null), []);

  const initialName = splitChineseName(student?.name ?? "");
  const initialEnglish = splitEnglishName(student?.englishName ?? "");

  const [lastName, setLastName] = useState(initialName.lastName);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [englishLastName, setEnglishLastName] = useState(initialEnglish.lastName);
  const [englishFirstName, setEnglishFirstName] = useState(
    initialEnglish.firstName,
  );

  const combinedName = lastName + firstName;
  const combinedEnglishName =
    englishLastName +
    (englishLastName && englishFirstName ? " " : "") +
    englishFirstName;

  const categoriesText = (student?.businessCategories ?? []).join("、");

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={student?.id ?? ""} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="name" value={combinedName} />
      <input type="hidden" name="englishName" value={combinedEnglishName} />

      <div className="grid gap-3">
        <SectionCard
          title="基本資料"
          subtitle="姓名、性別、生日、身分證、會員編號"
          onClick={() => setOpenSection("basic")}
        />
        <SectionCard
          title="聯絡資料"
          subtitle="手機、Email、地址、緊急聯絡人"
          onClick={() => setOpenSection("contact")}
        />
        <SectionCard
          title="背景資料"
          subtitle="學歷、婚姻、職業、產業"
          onClick={() => setOpenSection("background")}
        />
        <SectionCard
          title="創業與營業資料"
          subtitle="創業狀態、品牌、營業登記、營運資訊"
          onClick={() => setOpenSection("business")}
        />
        <SectionCard
          title="備註與來源"
          subtitle="補充說明與來源註記"
          onClick={() => setOpenSection("note")}
        />
      </div>

      {openSection === "basic" && (
        <FloatingModal title="基本資料" onClose={closeSection}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-bold text-zinc-700">
              姓氏
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-bold text-zinc-700">
              名字
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
              生日
              <input
                name="birthday"
                defaultValue={student?.birthday ?? ""}
                placeholder="YYYY-MM-DD"
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-bold text-zinc-700">
              身分證字號
              <input
                name="nationalId"
                defaultValue={student?.nationalId ?? ""}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-bold text-zinc-700">
              證件末三碼
              <input
                name="idNumberLast3"
                defaultValue={student?.idNumberLast3 ?? ""}
                maxLength={3}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-bold text-zinc-700">
              出生地
              <input
                name="birthPlace"
                defaultValue={student?.birthPlace ?? ""}
                className={fieldClassName()}
              />
            </label>
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
          </div>
        </FloatingModal>
      )}

      {openSection === "contact" && (
        <FloatingModal title="聯絡資料" onClose={closeSection}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-bold text-zinc-700">
              手機
              <input
                name="phone"
                defaultValue={student?.phone ?? ""}
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
          </div>
        </FloatingModal>
      )}

      {openSection === "background" && (
        <FloatingModal title="背景資料" onClose={closeSection}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        </FloatingModal>
      )}

      {openSection === "business" && (
        <FloatingModal title="創業與營業資料" onClose={closeSection}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              服務項目說明
              <textarea
                name="serviceDescription"
                rows={4}
                defaultValue={student?.serviceDescription ?? ""}
                className={fieldClassName()}
              />
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
          </div>
        </FloatingModal>
      )}

      {openSection === "note" && (
        <FloatingModal title="備註與來源" onClose={closeSection}>
          <div className="grid gap-4">
            <label className="text-sm font-bold text-zinc-700">
              備註
              <textarea
                name="note"
                rows={4}
                defaultValue={student?.note ?? ""}
                className={fieldClassName()}
              />
            </label>
            <label className="text-sm font-bold text-zinc-700">
              資料來源
              <input
                name="source"
                defaultValue={student?.source ?? ""}
                className={fieldClassName()}
              />
            </label>
          </div>
        </FloatingModal>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <a
          href={cancelHref}
          className="rounded-2xl border border-[#ead7c6] bg-white px-5 py-3 text-sm font-bold text-[#6b3b25]"
        >
          取消
        </a>
        <button
          type="submit"
          className="rounded-2xl bg-[#6b3b25] px-6 py-3 text-sm font-bold text-white"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
