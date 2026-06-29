import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// 1. 本地 JSON 統計
const jsonPath = path.resolve('data/booking-data.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

console.log('=== 本地 JSON 統計 ===');
console.log('categories:', data.categories?.length || 0);
console.log('courses:', data.courses?.length || 0);
console.log('sessions (sessions in courses):', data.courses?.flatMap(c => c.sessions || [])?.length || 0);
console.log('reservations:', data.reservations?.length || 0);
console.log('students:', data.students?.length || 0);
console.log('instructors:', data.instructors?.length || 0);
console.log('courseSeries:', data.courseSeries?.length || 0);
console.log('courseOfferings:', data.courseOfferings?.length || 0);
console.log('courseSessions:', data.courseSessions?.length || 0);
console.log('enrollments:', data.enrollments?.length || 0);

// 2. Firestore 統計
console.log('\n=== Firestore 統計 (連線中...) ===');

const keyPath = path.resolve('firebase-admin-key.json');
if (!fs.existsSync(keyPath)) {
  console.log('找不到 firebase-admin-key.json，無法進行 Firestore 統計。');
  process.exit(0);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function getCount(collectionName) {
  try {
    const snap = await db.collection(collectionName).get();
    return snap.docs.length;
  } catch (err) {
    console.error(`讀取 collection ${collectionName} 失敗:`, err.message);
    return '錯誤';
  }
}

const collections = [
  'categories',
  'courses',
  'sessions',
  'reservations',
  'students',
  'instructors',
  'courseSeries',
  'courseOfferings',
  'courseSessions',
  'enrollments'
];

for (const col of collections) {
  const count = await getCount(col);
  console.log(`${col}: ${count}`);
}

process.exit(0);
