import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getCredential() {
  if (fs.existsSync(KEY_PATH)) {
    const key = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
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

export async function backupFirestoreSnapshot(db, label = "manual") {
  const backupDirName = `${timestamp()}_${label}`;
  const backupDir = path.join(BACKUP_ROOT, backupDirName);
  fs.mkdirSync(backupDir, { recursive: true });

  const summary = {};
  
  for (const collectionId of TARGET_COLLECTIONS) {
    const snapshot = await db.collection(collectionId).get();
    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    summary[collectionId] = docs.length;
    fs.writeFileSync(
      path.join(backupDir, `${collectionId}.json`),
      `${JSON.stringify(docs, null, 2)}\n`,
      "utf8"
    );
  }

  fs.writeFileSync(
    path.join(backupDir, "_summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );

  return { backupDir, summary };
}

async function main() {
  console.log("正在連線並備份 Firestore 資料庫快照...");
  const { db, projectId } = initDb();
  console.log(`Firestore 專案：[${projectId}]`);
  
  const { backupDir, summary } = await backupFirestoreSnapshot(db, "manual");
  console.log(`\n備份成功！已存至：${backupDir}`);
  console.log("備份各集合筆數摘要：", JSON.stringify(summary, null, 2));
}

// 只有直接執行此檔時才跑 main
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename || "");
if (isDirectRun || process.argv.includes("--run-direct")) {
  main().catch((error) => {
    console.error("備份失敗：", error);
    process.exitCode = 1;
  });
}
