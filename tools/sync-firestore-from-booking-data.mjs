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

  for (let index = 0; index < records.length; index += 450) {
    const batch = db.batch();
    for (const record of records.slice(index, index + 450)) {
      if (!record?.id) {
        throw new Error(`Record in ${collectionId} is missing id.`);
      }
      batch.set(db.collection(collectionId).doc(String(record.id)), record);
      written += 1;
    }
    await batch.commit();
  }

  return written;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (!dryRun && !apply) {
    throw new Error("Use --dry-run to inspect or --apply to backup, clear, and seed Firestore.");
  }

  const data = readJson(DATA_PATH);
  const { db, projectId } = initDb();
  const onlineCollections = await listTopCollections(db);
  const backupCollectionIds = Array.from(new Set([...onlineCollections, ...TARGET_COLLECTIONS])).sort();
  const localCounts = Object.fromEntries(TARGET_COLLECTIONS.map((collectionId) => [collectionId, getLocalRecords(data, collectionId).length]));

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", projectId, onlineCollections, localCounts }, null, 2));
    return;
  }

  const backup = await backupCollections(db, backupCollectionIds);
  const deleted = {};
  const written = {};

  for (const collectionId of TARGET_COLLECTIONS) {
    deleted[collectionId] = await deleteCollection(db, collectionId);
  }

  for (const collectionId of TARGET_COLLECTIONS) {
    written[collectionId] = await seedCollection(db, collectionId, getLocalRecords(data, collectionId));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "apply",
        projectId,
        backupDir: backup.backupDir,
        backedUp: backup.summary,
        deleted,
        written,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
