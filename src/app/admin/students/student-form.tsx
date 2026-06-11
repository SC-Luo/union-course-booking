import type { ReactNode } from "react";
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

function fieldClassName() {
  return "mt-2 w-full rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[#ef6c00]";
}

function sectionCard(title: string, description: string, content: ReactNode) {
  return (
    <section className="rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
      <div className="border-b border-[#f0dfcf] pb-4">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <div className="mt-5">{content}</div>
    </section>
  );
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

export function StudentForm({
  student,
  action,
  cancelHref,
  submitLabel,
  redirectTo,
}: StudentFormProps) {
  const categoriesText = (student?.businessCategories ?? []).join("、");

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="id" value={student?.id ?? ""} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {sectionCard(
        "基本資料",
        "先建立學員身份，再慢慢補完整資料。姓名與證件資訊建議至少填一種完整識別方式。",
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold text-zinc-700">
            姓名
            <input name="name" defaultValue={student?.name ?? ""} required className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            英文名／羅馬拼音
            <input name="englishName" defaultValue={student?.englishName ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            性別
            <select name="gender" defaultValue={student?.gender ?? ""} className={fieldClassName()}>
              {selectOptions(genderOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            生日
            <input name="birthday" defaultValue={student?.birthday ?? ""} placeholder="YYYY-MM-DD" className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            身分證字號／居留證號
            <input name="nationalId" defaultValue={student?.nationalId ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            證件末三碼
            <input name="idNumberLast3" defaultValue={student?.idNumberLast3 ?? ""} maxLength={3} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            出生地
            <input name="birthPlace" defaultValue={student?.birthPlace ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            會員編號
            <input name="memberNo" defaultValue={student?.memberNo ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            狀態
            <select name="rosterStatus" defaultValue={student?.isActive === false ? "inactive" : student?.needsReview ? "review" : "active"} className={fieldClassName()}>
              <option value="active">啟用中</option>
              <option value="review">待確認</option>
              <option value="inactive">停用 / 歷史</option>
            </select>
          </label>
        </div>,
      )}

      {sectionCard(
        "聯絡資料",
        "學生端查詢與聯繫常用欄位集中在這裡。",
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold text-zinc-700">
            手機
            <input name="phone" defaultValue={student?.phone ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            市內電話
            <input name="landline" defaultValue={student?.landline ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            Email
            <input name="email" defaultValue={student?.email ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            Line ID
            <input name="lineId" defaultValue={student?.lineId ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700 md:col-span-2">
            通訊地址
            <input name="mailingAddress" defaultValue={student?.mailingAddress ?? student?.address ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700 md:col-span-2">
            戶籍地址
            <input name="householdAddress" defaultValue={student?.householdAddress ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            緊急聯絡人
            <input name="emergencyContactName" defaultValue={student?.emergencyContactName ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            緊急聯絡人電話
            <input name="emergencyContactPhone" defaultValue={student?.emergencyContactPhone ?? ""} className={fieldClassName()} />
          </label>
        </div>,
      )}

      {sectionCard(
        "背景資料",
        "這一區是補充資料，沒有資料也不會影響先建立學員。",
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold text-zinc-700">
            最高學歷
            <select name="educationLevel" defaultValue={student?.educationLevel ?? ""} className={fieldClassName()}>
              {selectOptions(educationOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            畢業學校
            <input name="graduationSchool" defaultValue={student?.graduationSchool ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            科系
            <input name="major" defaultValue={student?.major ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            婚姻狀態
            <select name="maritalStatus" defaultValue={student?.maritalStatus ?? ""} className={fieldClassName()}>
              {selectOptions(maritalStatusOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            子女數
            <input name="childrenCount" type="number" min="0" defaultValue={student?.childrenCount ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            子女年齡
            <input name="childrenAges" defaultValue={student?.childrenAges ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            目前職業狀態
            <select name="employmentStatus" defaultValue={student?.employmentStatus ?? ""} className={fieldClassName()}>
              {selectOptions(employmentStatusOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            公司名稱
            <input name="companyName" defaultValue={student?.companyName ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            職稱
            <input name="jobTitle" defaultValue={student?.jobTitle ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            工作年資
            <select name="workExperience" defaultValue={student?.workExperience ?? ""} className={fieldClassName()}>
              {selectOptions(workExperienceOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            產業類別
            <input name="industryCategory" defaultValue={student?.industryCategory ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            是否從事美容相關行業
            <select name="beautyRelated" defaultValue={student?.beautyRelated ?? ""} className={fieldClassName()}>
              {selectOptions(yesNoOptions)}
            </select>
          </label>
        </div>,
      )}

      {sectionCard(
        "創業與營業資料",
        "這些欄位可先當補充資料，之後要做同步匯入時也能直接沿用。",
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold text-zinc-700">
            是否已創業
            <select name="startupStatus" defaultValue={student?.startupStatus ?? ""} className={fieldClassName()}>
              {selectOptions(startupStatusOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            創業年資
            <select name="startupExperience" defaultValue={student?.startupExperience ?? ""} className={fieldClassName()}>
              {selectOptions(workExperienceOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            創業類型
            <select name="startupType" defaultValue={student?.startupType ?? ""} className={fieldClassName()}>
              {selectOptions(startupTypeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            品牌名稱
            <input name="brandName" defaultValue={student?.brandName ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            是否有營業登記
            <select name="hasBusinessRegistration" defaultValue={student?.hasBusinessRegistration ?? ""} className={fieldClassName()}>
              {selectOptions(yesNoOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            營業登記狀況
            <select name="businessRegistrationStatus" defaultValue={student?.businessRegistrationStatus ?? ""} className={fieldClassName()}>
              {selectOptions(businessRegistrationStatusOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            統一編號
            <input name="taxId" defaultValue={student?.taxId ?? ""} className={fieldClassName()} />
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
            <select name="businessPlaceType" defaultValue={student?.businessPlaceType ?? ""} className={fieldClassName()}>
              {selectOptions(businessPlaceTypeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700 md:col-span-2">
            營業地址
            <input name="businessAddress" defaultValue={student?.businessAddress ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            經營型態
            <select name="operationMode" defaultValue={student?.operationMode ?? ""} className={fieldClassName()}>
              {selectOptions(operationModeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            主要客群
            <select name="customerType" defaultValue={student?.customerType ?? ""} className={fieldClassName()}>
              {selectOptions(customerTypeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            是否有固定員工
            <select name="employeeStatus" defaultValue={student?.employeeStatus ?? ""} className={fieldClassName()}>
              {selectOptions(employeeStatusOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700 xl:col-span-3">
            主要服務項目說明
            <textarea name="serviceDescription" rows={4} defaultValue={student?.serviceDescription ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            員工人數
            <select name="employeeCountRange" defaultValue={student?.employeeCountRange ?? ""} className={fieldClassName()}>
              {selectOptions(employeeCountRangeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            正職人數
            <input name="fullTimeEmployees" type="number" min="0" defaultValue={student?.fullTimeEmployees ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            兼職 / PT 人數
            <input name="partTimeEmployees" type="number" min="0" defaultValue={student?.partTimeEmployees ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            資本額級距
            <select name="capitalRange" defaultValue={student?.capitalRange ?? ""} className={fieldClassName()}>
              {selectOptions(capitalRangeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            月營業額級距
            <select name="monthlyRevenueRange" defaultValue={student?.monthlyRevenueRange ?? ""} className={fieldClassName()}>
              {selectOptions(monthlyRevenueRangeOptions)}
            </select>
          </label>
          <label className="text-sm font-bold text-zinc-700">
            年營業額級距
            <select name="annualRevenueRange" defaultValue={student?.annualRevenueRange ?? ""} className={fieldClassName()}>
              {selectOptions(annualRevenueRangeOptions)}
            </select>
          </label>
        </div>,
      )}

      {sectionCard(
        "備註與來源",
        "保留工作人員補充說明與來源註記。",
        <div className="grid gap-4">
          <label className="text-sm font-bold text-zinc-700">
            備註
            <textarea name="note" rows={4} defaultValue={student?.note ?? ""} className={fieldClassName()} />
          </label>
          <label className="text-sm font-bold text-zinc-700">
            資料來源
            <input name="source" defaultValue={student?.source ?? ""} className={fieldClassName()} />
          </label>
        </div>,
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <a
          href={cancelHref}
          className="rounded-2xl border border-[#ead7c6] bg-white px-5 py-3 text-sm font-bold text-[#6b3b25]"
        >
          取消
        </a>
        <button className="rounded-2xl bg-[#6b3b25] px-6 py-3 text-sm font-bold text-white">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
