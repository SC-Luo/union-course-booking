export const courseTypes = [
  { id: "PT", name: "職前課程", description: "固定名冊：職前訓練、待業者或專班制課程。", rosterType: "fixed" },
  { id: "CT", name: "在職課程", description: "固定名冊：在職進修、產投或長期班級。", rosterType: "fixed" },
  { id: "SF", name: "技術課程", description: "彈性預約：可依場次或期間開放學員預約。", rosterType: "flexible" },
  { id: "CP", name: "競賽輔導", description: "彈性預約：競賽訓練、模擬賽與加強輔導。", rosterType: "flexible" },
  { id: "OT", name: "其他", description: "不一定：無法歸入前述類型的課程或特殊安排。", rosterType: "mixed" },
];

export const professionalCategories = [
  { id: "B", name: "美容", description: "美容丙乙級證照、臉部護膚、粉刺痘疤護理、裸妝、挽臉、耳燭、鑽石微雕。" },
  { id: "S", name: "美體", description: "SPA 舒壓、筋絡養生、芳療、體雕纖體、身體保養。" },
  { id: "N", name: "美甲", description: "美甲檢定、凝膠美甲、手足保養、問題甲處理。" },
  { id: "E", name: "美睫", description: "美睫檢定、植睫術、睫毛捲翹。" },
  { id: "H", name: "美髮", description: "美髮丙乙級證照、剪髮、染燙、造型設計。" },
  { id: "T", name: "紋繡", description: "紋繡檢定、半永久眉眼唇。" },
  { id: "W", name: "除毛", description: "熱臘除毛、私密除毛、雷射除毛等。" },
  { id: "O", name: "綜合", description: "講師才能、跨領域單元課程、其他未歸類課程。" },
  { id: "D", name: "數位行銷", description: "AI 應用、社群經營、數位工具與 Landing Page。" },
  { id: "M", name: "經營管理", description: "創業規劃、店長培訓、品牌行銷、產值管理。" },
  { id: "R", name: "競賽培訓", description: "鳳凰盃、中華盃、艾柏國際盃等競賽訓練。" },
];

export function getCourseTypeName(typeId?: string) {
  return courseTypes.find((type) => type.id === typeId)?.name ?? "其他";
}

export function getProfessionalCategoryName(categoryId: string) {
  return professionalCategories.find((category) => category.id === categoryId)?.name ?? "未分類";
}

export function inferCourseTypeFromCode(code?: string) {
  return code?.split("-")[0] ?? "";
}

export function inferCategoryFromCode(code?: string) {
  return code?.split("-")[1]?.replace(/[0-9]/g, "") ?? "";
}
