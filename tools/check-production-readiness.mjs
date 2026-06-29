import process from "node:process";

const requiredVars = [
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
  "BOOKING_DATA_SOURCE",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

const optionalVars = [
  "GOOGLE_SHEETS_WEBHOOK_URL",
  "TEACHING_ACCESS_CODE",
];

console.log("=== 開始正式上線環境變數排查 ===");

let hasMissing = false;

for (const name of requiredVars) {
  const value = process.env[name];
  if (value && value.trim() !== "") {
    console.log(`[必填] ${name}: 存在`);
  } else {
    console.error(`[必填] ${name}: 缺少`);
    hasMissing = true;
  }
}

for (const name of optionalVars) {
  const value = process.env[name];
  if (value && value.trim() !== "") {
    console.log(`[選填] ${name}: 存在`);
  } else {
    console.log(`[選填] ${name}: 缺少 (不影響基本功能)`);
  }
}

const source = process.env.BOOKING_DATA_SOURCE;
if (source !== "firestore") {
  console.warn(`\n[警告] 目前 BOOKING_DATA_SOURCE 設為 "${source || "未設定"}"。正式環境中請務必設為 "firestore"！`);
}

if (hasMissing) {
  console.error("\n[錯誤] 排查失敗：缺少必要的環境變數！請在環境變數或 .env.local 中補齊。");
  process.exit(1);
} else {
  console.log("\n[成功] 所有必要環境變數檢查通過。");
  process.exit(0);
}
