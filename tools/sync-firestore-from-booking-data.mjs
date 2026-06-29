import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

const DATA_PATH = path.join(process.cwd(), "data", "booking-data.json");
const KEY_PATH = path.join(process.cwd(), "firebase-admin-key.json");
const BACKUP_ROOT = path.join(process.cwd(), "firestore-backups");
const TARGET_COLLECTIONS = [
  "categories",
  "courses",
  "sessions",
  "reservations",
  "students",
  "courseSeries",
  "courseOfferings",
  "courseSessions",
  "studentCourseRecords",
  "enrollments",
  "attendanceRecords",
  "instructors",
  "entitlements",
  "importBatches",
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getLocalRecords(data, collectionId) {
  if (collectionId === "sessions" && (!Array.isArray(data.sessions) || data.sessions.length === 0)) {
    return (data.courses ?? []).flatMap((course) =>
      (course.sessions ?? []).map((session) => ({
        ...session,
        courseId: session.courseId ?? course.id,
        offeringId: session.offeringId ?? course.offeringId ?? course.id,
        seriesId: session.seriesId ?? course.seriesId,
        categoryId: session.categoryId ?? course.categoryId,
      })),
    );
  }

  return data[collectionId] ?? [];
}

function getCredential() {
  if (fs.existsSync(KEY_PATH)) {
    const key = readJson(KEY_PATH);
    return {
      credential: cert(key),
      projectId: key.project_id,
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials.");
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

async function listTopCollections(db) {
  const collections = await db.listCollections();
  return collections.map((collection) => collection.id).sort();
}

async function listCollectionDocs(db, collectionId) {
  const snapshot = await db.collection(collectionId).orderBy(FieldPath.documentId()).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function backupCollections(db, collectionIds) {
  const backupDir = path.join(BACKUP_ROOT, timestamp());
  fs.mkdirSync(backupDir, { recursive: true });

  const summary = {};
  for (const collectionId of collectionIds) {
    const docs = await listCollectionDocs(db, collectionId);
    summary[collectionId] = docs.length;
    fs.writeFileSync(path.join(backupDir, `${collectionId}.json`), `${JSON.stringify(docs, null, 2)}\n`, "utf8");
  }

  fs.writeFileSync(path.join(backupDir, "_summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return { backupDir, summary };
}

async function deleteCollection(db, collectionId) {
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionId).limit(450).get();
    if (snapshot.empty) return deleted;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
  }
}

async function seedCollection(db, collectionId, records) {
  let written = 0;
  const BATCH_SIZE = 100;

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = db.batch();
    const batchRecords = records.slice(index, index + BATCH_SIZE);
    
    for (const record of batchRecords) {
      if (!record?.id) {
        throw new Error(`Record in ${collectionId} is missing id.`);
      }
      batch.set(db.collection(collectionId).doc(String(record.id)), record);
      written += 1;
    }
    
    await batch.commit();
    console.log(`  [寫入進度] ${collectionId}: 已寫入 ${written}/${records.length} 筆`);
    
    if (index + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return written;
}

async function main() {
  const compareMode = process.argv.includes("--compare") || process.argv.includes("--dry-run");
  const overwriteMode = process.argv.includes("--overwrite-from-local-json");
  const targetProd = process.argv.includes("--target") && process.argv[process.argv.indexOf("--target") + 1] === "production";

  if (!compareMode && !overwriteMode) {
    throw new Error("必須指定操作模式：使用 --compare 進行對比，或使用 --overwrite-from-local-json 進行覆寫。");
  }

  const data = readJson(DATA_PATH);
  const { db, projectId } = initDb();
  const onlineCollections = await listTopCollections(db);
  const localCounts = Object.fromEntries(TARGET_COLLECTIONS.map((collectionId) => [collectionId, getLocalRecords(data, collectionId).length]));

  if (compareMode) {
    console.log("=== 資料來源統計對比 ===");
    console.log(`Firestore 專案：[${projectId}]`);
    console.log("\n集合名稱 | 本地 JSON 筆數 | Firestore 線上筆數");
    console.log("------------------------------------------------");
    
    for (const col of TARGET_COLLECTIONS) {
      let onlineCount = 0;
      try {
        const snap = await db.collection(col).get();
        onlineCount = snap.docs.length;
      } catch (err) {
        onlineCount = "錯誤";
      }
      console.log(`${col.padEnd(20)} | ${(String(localCounts[col])).padStart(14)} | ${(String(onlineCount)).padStart(16)}`);
    }
    return;
  }

  // 寫入覆寫模式
  if (!targetProd) {
    throw new Error("執行覆寫初始化必須指定 '--target production'，否則拒絕執行。");
  }

  console.log(`\n=== 警告：即將執行正式 Firestore 初始化覆寫 [${projectId}] ===`);
  console.log("此操作將會清除 Firestore 上現有的所有資料，並用本地備援 JSON 初始化資料庫！");
  console.log("\n預計寫入之本地資料筆數：", JSON.stringify(localCounts, null, 2));

  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askConfirm = (question) => new Promise((resolve) => rl.question(question, resolve));

  const confirm1 = await askConfirm("\n[安全確認 1/3] 請輸入 'IMPORT_TO_FIRESTORE' 確認匯入：\n");
  if (confirm1.trim() !== "IMPORT_TO_FIRESTORE") {
    console.log("確認字串不符，已取消操作。");
    rl.close();
    process.exit(0);
  }

  const confirm2 = await askConfirm("\n[安全確認 2/3] 請輸入 'OVERWRITE_PRODUCTION_FIRESTORE' 確認覆寫正式資料庫：\n");
  if (confirm2.trim() !== "OVERWRITE_PRODUCTION_FIRESTORE") {
    console.log("確認字串不符，已取消操作。");
    rl.close();
    process.exit(0);
  }

  const confirm3 = await askConfirm("\n[安全確認 3/3] 請輸入 'I_UNDERSTAND_THIS_WILL_REPLACE_PRODUCTION_DATA' 確認您瞭解後果：\n");
  if (confirm3.trim() !== "I_UNDERSTAND_THIS_WILL_REPLACE_PRODUCTION_DATA") {
    console.log("確認字串不符，已取消操作。");
    rl.close();
    process.exit(0);
  }

  rl.close();

  // 開始自動備份
  console.log("\n[自動防護] 開始進行線上 Firestore 快照備份...");
  const { backupFirestoreSnapshot } = await import("./export-firestore-snapshot.mjs");
  const backupResult = await backupFirestoreSnapshot(db, "pre-overwrite-init");
  console.log(`[自動防護] 備份成功！存至：${backupResult.backupDir}`);

  // 開始清空並寫入
  console.log("\n[執行] 開始清空並覆寫正式 Firestore...");
  const deleted = {};
  const written = {};

  for (const collectionId of TARGET_COLLECTIONS) {
    console.log(`正在清空集合：${collectionId}...`);
    deleted[collectionId] = await deleteCollection(db, collectionId);
  }

  for (const collectionId of TARGET_COLLECTIONS) {
    console.log(`正在寫入集合：${collectionId}...`);
    written[collectionId] = await seedCollection(db, collectionId, getLocalRecords(data, collectionId));
  }

  console.log("\n=== 匯入初始化成功完成！ ===");
  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        backupDir: backupResult.backupDir,
        deleted,
        written,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
