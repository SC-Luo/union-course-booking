import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const KEY_PATH = path.join(process.cwd(), "firebase-admin-key.json");

const COLLECTIONS = [
  "categories",
  "courses",
  "sessions",
  "reservations",
  "students",
  "courseSeries",
  "courseOfferings",
  "courseSessions",
  "enrollments",
  "attendanceRecords",
  "instructors",
  "entitlements",
  "importBatches"
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getCredential() {
  if (fs.existsSync(KEY_PATH)) {
    const key = readJson(KEY_PATH);
    if (key) {
      return {
        credential: cert(key),
        projectId: key.project_id,
      };
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Please place firebase-admin-key.json in project root, or set environment variables."
    );
  }

  return {
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  };
}

function initDb() {
  const { credential, projectId } = getCredential();
  if (!getApps().length) {
    initializeApp({ credential, projectId });
  }
  return { db: getFirestore(), projectId };
}

function getTypeName(val) {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (Array.isArray(val)) return "array";
  if (val instanceof Timestamp) return "Timestamp (Firestore)";
  if (val instanceof Date) return "Date (JS)";
  if (typeof val === "object") return "object";
  return typeof val;
}

function anonymizeId(id) {
  if (typeof id !== "string") return String(id);
  if (id.length <= 6) return "***";
  return id.slice(0, 3) + "..." + id.slice(-3);
}

// Check Date/Time Format
function checkDateFormat(value) {
  if (value instanceof Timestamp) return "Timestamp";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "String (YYYY-MM-DD)";
    if (/^\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}$/.test(value)) return "String (YYYY/MM/DD HH:mm)";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return "String (ISO)";
    return "String (Other Format)";
  }
  return getTypeName(value);
}

async function analyzeCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs;
  const count = docs.length;

  const fieldTypes = {}; // fieldName -> { typeName -> count }
  const fieldMissingCount = {}; // fieldName -> count
  const invalidEnumValues = []; // { id, field, val, expected }
  const customWarnings = []; // string

  // Keep track of all fields seen across all docs
  const allFields = new Set();

  for (const doc of docs) {
    const data = doc.data();
    Object.keys(data).forEach((f) => allFields.add(f));
  }

  for (const doc of docs) {
    const data = doc.data();
    const docId = doc.id;

    for (const field of allFields) {
      if (!(field in data)) {
        fieldMissingCount[field] = (fieldMissingCount[field] || 0) + 1;
        continue;
      }

      const val = data[field];
      const t = getTypeName(val);

      if (!fieldTypes[field]) fieldTypes[field] = {};
      fieldTypes[field][t] = (fieldTypes[field][t] || 0) + 1;

      // Custom schema rules per collection
      if (collectionName === "reservations") {
        if (field === "status") {
          const valid = ["booked", "cancelled"];
          if (!valid.includes(val)) {
            invalidEnumValues.push({ id: docId, field, val, expected: valid });
          }
        }
        if (field === "attendanceStatus") {
          const valid = ["pending", "unchecked", "attended", "absent", "late", "leave"];
          if (!valid.includes(val)) {
            invalidEnumValues.push({ id: docId, field, val, expected: valid });
          }
        }
      }
    }

    // Specific relational / structural validations
    if (collectionName === "sessions") {
      const courseId = data.courseId;
      if (courseId === undefined) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'courseId' is missing`);
      } else if (typeof courseId !== "string") {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'courseId' type is ${getTypeName(courseId)} (expected string)`);
      }

      const capacity = data.capacity;
      if (capacity === undefined) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'capacity' is missing`);
      } else if (typeof capacity !== "number") {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'capacity' type is ${getTypeName(capacity)} (expected number)`);
      }

      const bookedCount = data.bookedCount;
      if (bookedCount === undefined) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'bookedCount' is missing`);
      } else if (typeof bookedCount !== "number") {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'bookedCount' type is ${getTypeName(bookedCount)} (expected number)`);
      }
    }

    if (collectionName === "reservations") {
      if (data.sessionId === undefined) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'sessionId' is missing`);
      }
      if (data.courseId === undefined) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'courseId' is missing`);
      }
    }

    if (collectionName === "students") {
      // Check query fields existence
      const nameExist = data.name !== undefined;
      const phoneExist = data.phone !== undefined;
      const idNumLast3Exist = data.idNumberLast3 !== undefined;
      const phoneLast3Exist = data.phoneLastThree !== undefined; // legacy fallback

      if (!nameExist) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: 'name' is missing`);
      }
      if (!phoneExist && !data.phoneLastThree) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: Both 'phone' and 'phoneLastThree' are missing`);
      }
      if (!idNumLast3Exist && !phoneLast3Exist) {
        customWarnings.push(`Doc ${anonymizeId(docId)}: Both 'idNumberLast3' and 'phoneLastThree' are missing`);
      }
    }
  }

  // Analyze Date fields formats
  const dateFieldsStats = {};
  const potentialDateFields = ["createdAt", "updatedAt", "bookedAt", "cancelledAt", "date", "bookingDeadline", "startsAt", "endsAt", "joinedAt", "leftAt"];
  for (const field of potentialDateFields) {
    if (allFields.has(field)) {
      dateFieldsStats[field] = {};
      for (const doc of docs) {
        const data = doc.data();
        if (field in data) {
          const fmt = checkDateFormat(data[field]);
          dateFieldsStats[field][fmt] = (dateFieldsStats[field][fmt] || 0) + 1;
        } else {
          dateFieldsStats[field]["missing"] = (dateFieldsStats[field]["missing"] || 0) + 1;
        }
      }
    }
  }

  return {
    count,
    allFields: Array.from(allFields),
    fieldTypes,
    fieldMissingCount,
    invalidEnumValues,
    customWarnings,
    dateFieldsStats
  };
}

async function main() {
  console.log("=== Firestore Schema 檢查 ===");
  let db, projectId;
  try {
    const initRes = initDb();
    db = initRes.db;
    projectId = initRes.projectId;
    console.log(`成功連接 Firestore 專案: [${projectId}]`);
  } catch (error) {
    console.error("❌ 無法初始化 Firestore:", error.message);
    process.exit(1);
  }

  console.log("\n開始掃描 Firestore 集合...\n");

  const results = {};
  for (const col of COLLECTIONS) {
    try {
      console.log(`正在讀取集合 [${col}]...`);
      results[col] = await analyzeCollection(db, col);
    } catch (error) {
      console.error(`❌ 讀取集合 [${col}] 失敗:`, error.message);
      results[col] = { error: error.message };
    }
  }

  console.log("\n=============================================");
  console.log("               Firestore 診斷報告            ");
  console.log("=============================================");
  console.log(`專案 ID: ${projectId}`);
  console.log(`時間: ${new Date().toLocaleString("zh-TW")}`);

  for (const [col, res] of Object.entries(results)) {
    console.log(`\n---------------------------------------------`);
    console.log(`集合: 【 ${col} 】`);
    console.log(`---------------------------------------------`);

    if (res.error) {
      console.log(`  ❌ 讀取失敗: ${res.error}`);
      continue;
    }

    console.log(`  * 文件總數: ${res.count} 筆`);
    if (res.count === 0) continue;

    console.log(`  * 欄位型別統計:`);
    Object.entries(res.fieldTypes).forEach(([field, types]) => {
      const typeStr = Object.entries(types)
        .map(([t, c]) => `${t}: ${c}`)
        .join(", ");
      const missing = res.fieldMissingCount[field] || 0;
      const missingStr = missing > 0 ? ` (缺 ${missing} 筆)` : "";
      console.log(`    - ${field.padEnd(25)} : ${typeStr}${missingStr}`);
    });

    if (Object.keys(res.dateFieldsStats).length > 0) {
      console.log(`  * 日期時間格式統計:`);
      Object.entries(res.dateFieldsStats).forEach(([field, stats]) => {
        const statsStr = Object.entries(stats)
          .map(([fmt, c]) => `${fmt}: ${c}`)
          .join(", ");
        console.log(`    - ${field.padEnd(25)} : ${statsStr}`);
      });
    }

    if (res.invalidEnumValues.length > 0) {
      console.log(`  * ⚠️ 異常枚舉值 (Enum Warnings) [共 ${res.invalidEnumValues.length} 筆]:`);
      res.invalidEnumValues.forEach(({ id, field, val, expected }) => {
        console.log(
          `    - 文件 ID: ${anonymizeId(id)} | 欄位: ${field} | 當前值: "${val}" | 預期值: [${expected.join(", ")}]`
        );
      });
    }

    if (res.customWarnings.length > 0) {
      console.log(`  * ⚠️ 自訂欄位規則警告 [共 ${res.customWarnings.length} 筆]:`);
      res.customWarnings.slice(0, 15).forEach((warning) => {
        console.log(`    - ${warning}`);
      });
      if (res.customWarnings.length > 15) {
        console.log(`    - ... 還有其餘 ${res.customWarnings.length - 15} 筆警告`);
      }
    }
  }

  console.log("\n=============================================");
  console.log("診斷結束。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
