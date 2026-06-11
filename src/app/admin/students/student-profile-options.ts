export type StudentOption = {
  value: string;
  label: string;
};

export const genderOptions: StudentOption[] = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" },
];

export const educationOptions: StudentOption[] = [
  { value: "國小", label: "國小" },
  { value: "國中", label: "國中" },
  { value: "高中職", label: "高中職" },
  { value: "專科", label: "專科" },
  { value: "大學", label: "大學" },
  { value: "碩士", label: "碩士" },
  { value: "博士", label: "博士" },
];

export const maritalStatusOptions: StudentOption[] = [
  { value: "未婚", label: "未婚" },
  { value: "已婚", label: "已婚" },
  { value: "離婚", label: "離婚" },
  { value: "喪偶", label: "喪偶" },
];

export const employmentStatusOptions: StudentOption[] = [
  { value: "在職", label: "在職" },
  { value: "自營作業", label: "自營作業" },
  { value: "待業", label: "待業" },
  { value: "學生", label: "學生" },
  { value: "家管", label: "家管" },
  { value: "退休", label: "退休" },
  { value: "其他", label: "其他" },
];

export const workExperienceOptions: StudentOption[] = [
  { value: "未滿1年", label: "未滿 1 年" },
  { value: "1-3年", label: "1-3 年" },
  { value: "3-5年", label: "3-5 年" },
  { value: "5-10年", label: "5-10 年" },
  { value: "10年以上", label: "10 年以上" },
];

export const yesNoOptions: StudentOption[] = [
  { value: "是", label: "是" },
  { value: "否", label: "否" },
];

export const startupStatusOptions: StudentOption[] = [
  { value: "是", label: "已創業" },
  { value: "否", label: "尚未創業" },
  { value: "規劃中", label: "規劃中" },
];

export const startupTypeOptions: StudentOption[] = [
  { value: "自創品牌", label: "自創品牌" },
  { value: "加盟", label: "加盟" },
  { value: "合夥", label: "合夥" },
  { value: "承接現有店面", label: "承接現有店面" },
  { value: "其他", label: "其他" },
];

export const businessRegistrationStatusOptions: StudentOption[] = [
  { value: "已登記", label: "已登記" },
  { value: "未登記", label: "未登記" },
  { value: "免登記", label: "免登記" },
];

export const businessPlaceTypeOptions: StudentOption[] = [
  { value: "店面", label: "店面" },
  { value: "個人工作室", label: "個人工作室" },
  { value: "百貨專櫃", label: "百貨專櫃" },
  { value: "行動服務", label: "行動服務（到府）" },
  { value: "網路經營", label: "網路經營" },
  { value: "沙龍", label: "沙龍" },
  { value: "會館", label: "會館" },
  { value: "其他", label: "其他" },
];

export const operationModeOptions: StudentOption[] = [
  { value: "個人工作室", label: "個人工作室" },
  { value: "店面經營", label: "店面經營" },
  { value: "連鎖加盟", label: "連鎖加盟" },
  { value: "美容沙龍", label: "美容沙龍" },
  { value: "SPA會館", label: "SPA 會館" },
  { value: "醫美診所", label: "醫美診所" },
  { value: "教育培訓", label: "教育培訓" },
  { value: "其他", label: "其他" },
];

export const customerTypeOptions: StudentOption[] = [
  { value: "一般消費者", label: "一般消費者" },
  { value: "高端客戶", label: "高端客戶" },
  { value: "學生族群", label: "學生族群" },
  { value: "企業團體", label: "企業團體" },
  { value: "混合客群", label: "混合客群" },
  { value: "其他", label: "其他" },
];

export const employeeStatusOptions: StudentOption[] = [
  { value: "有", label: "有" },
  { value: "無", label: "無" },
  { value: "僅本人", label: "僅本人" },
];

export const employeeCountRangeOptions: StudentOption[] = [
  { value: "0人（僅本人）", label: "0 人（僅本人）" },
  { value: "1-3人", label: "1-3 人" },
  { value: "4-10人", label: "4-10 人" },
  { value: "11-30人", label: "11-30 人" },
  { value: "31-50人", label: "31-50 人" },
  { value: "51人以上", label: "51 人以上" },
];

export const capitalRangeOptions: StudentOption[] = [
  { value: "無資本額", label: "無資本額" },
  { value: "未滿50萬", label: "未滿 50 萬" },
  { value: "50-100萬", label: "50-100 萬" },
  { value: "100-500萬", label: "100-500 萬" },
  { value: "500-1000萬", label: "500-1000 萬" },
  { value: "1000萬以上", label: "1000 萬以上" },
];

export const monthlyRevenueRangeOptions: StudentOption[] = [
  { value: "未滿5萬", label: "未滿 5 萬" },
  { value: "5-10萬", label: "5-10 萬" },
  { value: "10-30萬", label: "10-30 萬" },
  { value: "30-50萬", label: "30-50 萬" },
  { value: "50-100萬", label: "50-100 萬" },
  { value: "100萬以上", label: "100 萬以上" },
];

export const annualRevenueRangeOptions: StudentOption[] = [
  { value: "未滿60萬", label: "未滿 60 萬" },
  { value: "60-120萬", label: "60-120 萬" },
  { value: "120-360萬", label: "120-360 萬" },
  { value: "360-600萬", label: "360-600 萬" },
  { value: "600-1200萬", label: "600-1200 萬" },
  { value: "1200萬以上", label: "1200 萬以上" },
];

export const businessCategorySuggestions = [
  "美甲",
  "美睫",
  "美容護膚",
  "SPA／芳療",
  "熱蠟除毛",
  "皮膚管理",
  "紋繡",
  "美體雕塑",
  "美髮",
  "其他",
];
