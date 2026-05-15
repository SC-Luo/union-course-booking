import fs from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const key = JSON.parse(fs.readFileSync("firebase-admin-key.json", "utf8"));
const data = JSON.parse(fs.readFileSync("data/beauty-june-2026.json", "utf8"));

if (!getApps().length) {
  initializeApp({ credential: cert(key), projectId: key.project_id });
}

const db = getFirestore();
const batch = db.batch();
const source = "掃描的文件 4.pdf / 2026-06 課表截圖";

function buildDeadline(date) {
  const cutoff = new Date(`${date}T18:00:00+08:00`);
  cutoff.setDate(cutoff.getDate() - 1);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")} 18:00`;
}

batch.set(db.collection("courses").doc(data.course.id), data.course, { merge: true });

for (const [id, date, startTime, endTime, topic, capacity, isActive] of data.sessions) {
  batch.set(
    db.collection("sessions").doc(id),
    {
      courseId: data.course.id,
      date,
      startTime,
      endTime,
      location: data.course.defaultLocation,
      capacity,
      bookedCount: 0,
      bookingDeadline: buildDeadline(date),
      isActive,
      topic,
      source,
    },
    { merge: true },
  );
}

for (const [seatNumber, name, examGroup, needsReview] of data.students) {
  batch.set(
    db.collection("students").doc(`beauty-june-${seatNumber}`),
    {
      examGroup,
      classId: data.course.id,
      seatNumber,
      name,
      source,
      needsReview,
      note: needsReview ? "掃描辨識不確定，需人工確認姓名或座號。" : "",
    },
    { merge: true },
  );
}

await batch.commit();

console.log(
  JSON.stringify({
    ok: true,
    course: data.course.id,
    sessions: data.sessions.length,
    students: data.students.length,
  }),
);
