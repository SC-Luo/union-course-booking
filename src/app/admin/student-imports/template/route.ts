import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const HEADERS = [
  "姓名",
  "證件末三碼",
  "手機",
  "英文姓名",
  "身分證字號",
  "生日",
  "性別",
  "出生地",
  "會員編號",
  "市話",
  "Email",
  "Line ID",
  "通訊地址",
  "戶籍地址",
  "緊急聯絡人",
  "緊急聯絡人電話",
  "最高學歷",
  "畢業學校",
  "科系",
  "婚姻狀態",
  "子女數",
  "子女年齡",
  "目前職業狀態",
  "公司名稱",
  "職稱",
  "工作年資",
  "產業類別",
  "美容相關行業",
  "創業狀態",
  "創業年資",
  "創業類型",
  "品牌名稱",
  "營業登記",
  "營業登記狀況",
  "統一編號",
  "主要營業項目",
  "營業場所類型",
  "營業地址",
  "經營型態",
  "主要客群",
  "服務項目說明",
  "固定員工",
  "員工人數級距",
  "正職人數",
  "兼職人數",
  "資本額級距",
  "月營業額級距",
  "年營業額級距",
  "資料來源",
  "備註",
];

const REQUIRED_MARKERS = HEADERS.map((h) =>
  ["姓名", "證件末三碼", "手機"].includes(h) ? "★必填" : "選填",
);

const EXAMPLE = [
  "王小美",
  "123",
  "0912345678",
  "Amy Wang",
  "A123456789",
  "1990-01-01",
  "女",
  "台北市",
  "M001",
  "0223456789",
  "test@example.com",
  "amy_wang",
  "台北市大安區復興南路一段100號",
  "台北市大安區復興南路一段100號",
  "王大明",
  "0912345670",
  "大學",
  "國立台灣大學",
  "企業管理",
  "已婚",
  "2",
  "3歲、5歲",
  "在職中",
  "美妝國際有限公司",
  "行銷經理",
  "5-10年",
  "美妝保養",
  "否",
  "尚未創業",
  "",
  "",
  "",
  "否",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "學員總表手動建立",
  "補登名冊",
];

export async function GET() {
  const wsData = [HEADERS, REQUIRED_MARKERS, EXAMPLE];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet["!freeze"] = { xSplit: 0, ySplit: 2 };

  worksheet["!cols"] = [
    { wch: 10 },  // 姓名
    { wch: 12 },  // 證件末三碼
    { wch: 13 },  // 手機
    { wch: 14 },  // 英文姓名
    { wch: 14 },  // 身分證字號
    { wch: 12 },  // 生日
    { wch: 8 },   // 性別
    { wch: 10 },  // 出生地
    { wch: 12 },  // 會員編號
    { wch: 12 },  // 市話
    { wch: 22 },  // Email
    { wch: 12 },  // Line ID
    { wch: 28 },  // 通訊地址
    { wch: 28 },  // 戶籍地址
    { wch: 14 },  // 緊急聯絡人
    { wch: 16 },  // 緊急聯絡人電話
    { wch: 10 },  // 最高學歷
    { wch: 18 },  // 畢業學校
    { wch: 14 },  // 科系
    { wch: 10 },  // 婚姻狀態
    { wch: 8 },   // 子女數
    { wch: 14 },  // 子女年齡
    { wch: 12 },  // 目前職業狀態
    { wch: 18 },  // 公司名稱
    { wch: 12 },  // 職稱
    { wch: 12 },  // 工作年資
    { wch: 12 },  // 產業類別
    { wch: 14 },  // 美容相關行業
    { wch: 12 },  // 創業狀態
    { wch: 10 },  // 創業年資
    { wch: 12 },  // 創業類型
    { wch: 14 },  // 品牌名稱
    { wch: 10 },  // 營業登記
    { wch: 14 },  // 營業登記狀況
    { wch: 14 },  // 統一編號
    { wch: 16 },  // 主要營業項目
    { wch: 14 },  // 營業場所類型
    { wch: 24 },  // 營業地址
    { wch: 12 },  // 經營型態
    { wch: 12 },  // 主要客群
    { wch: 24 },  // 服務項目說明
    { wch: 10 },  // 固定員工
    { wch: 14 },  // 員工人數級距
    { wch: 10 },  // 正職人數
    { wch: 10 },  // 兼職人數
    { wch: 14 },  // 資本額級距
    { wch: 14 },  // 月營業額級距
    { wch: 14 },  // 年營業額級距
    { wch: 20 },  // 資料來源
    { wch: 24 },  // 備註
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "學員匯入範本");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true }) as Buffer;
  const fileName = `union-course-student-import-template.xlsx`;
  const encodedFileName = encodeURIComponent(fileName);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "no-store",
    },
  });
}
