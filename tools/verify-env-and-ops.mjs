// 本腳本只讀取環境變數，不得輸出 credential、private key、service account 或任何真實個資。
import { getAdminDb } from "../src/lib/firebase-admin.ts";
import {
  getCourseCatalog,
  getBookingData,
  createReservation,
  findReservationsByStudent,
  cancelReservation,
  addStudentToSessionRoster,
  updateReservationAttendance,
  getDataSourceStatus
} from "../src/lib/booking-repository.ts";

async function main() {
  console.log("=== Firestore-only 手動驗收與流程驗證 ===");
  console.log("⚠️ 警告：此腳本將在 Firestore 中建立並清理測試用的 Mock 資料。");

  // 0. 防呆變數驗證
  if (process.env.ALLOW_FIRESTORE_MUTATION_TEST !== "true") {
    console.error("❌ 錯誤：未設定 ALLOW_FIRESTORE_MUTATION_TEST=true，禁止執行寫入測試！");
    process.exit(1);
  }
  if (process.env.STRICT_FIRESTORE !== "true") {
    console.error("❌ 錯誤：未設定 STRICT_FIRESTORE=true，此測試要求啟用嚴格模式！");
    process.exit(1);
  }
  if (process.env.BOOKING_DATA_SOURCE !== "firestore") {
    console.error("❌ 錯誤：未設定 BOOKING_DATA_SOURCE=firestore，此測試必須使用 Firestore 連線！");
    process.exit(1);
  }

  // 1. 檢查資料來源狀態
  const status = await getDataSourceStatus();
  console.log("資料來源狀態:", JSON.stringify(status, null, 2));

  if (!status.usingFirestore) {
    console.error("❌ 驗收失敗：當前未啟用 Firestore 或發生了 fallback 到 JSON！");
    process.exit(1);
  }
  console.log("✅ 成功啟用 Firestore-only 診斷模式");

  const db = getAdminDb();
  if (!db) {
    console.error("❌ 無法獲取 Firestore Admin DB");
    process.exit(1);
  }

  // 定義安全測試 ID (均使用 __verify__ 前綴)
  const catId = "__verify__cat";
  const courseId = "__verify__course";
  const sessionId = "__verify__session_1";
  const sessionId2 = "__verify__session_2";
  const studentId = "__verify__student";
  const enrollmentId = "__verify__enrollment";
  const testStudentName = "__verify__測試學員";
  const testPhoneLastThree = "999";
  const testIdNumberLast3 = "999";

  console.log("\n[準備] 寫入測試用 Mock 資料到 Firestore...");
  
  const batch = db.batch();
  batch.set(db.collection("categories").doc(catId), {
    id: catId,
    name: "測試分類",
    sortOrder: 999,
    isActive: true
  });
  batch.set(db.collection("courses").doc(courseId), {
    id: courseId,
    title: "測試課程",
    categoryId: catId,
    isActive: true,
    courseMode: "booking_flexible",
    rosterType: "booking",
    bookingOpen: true,
    status: "open",
    sessions: [] // legacy embedded sessions empty
  });
  batch.set(db.collection("sessions").doc(sessionId), {
    id: sessionId,
    courseId: courseId,
    offeringId: courseId,
    seriesId: `series-${courseId}`,
    categoryId: catId,
    date: "2026-12-31",
    startTime: "10:00",
    endTime: "12:00",
    capacity: 10,
    bookedCount: 0,
    isActive: true,
    status: "scheduled"
  });
  batch.set(db.collection("sessions").doc(sessionId2), {
    id: sessionId2,
    courseId: courseId,
    offeringId: courseId,
    seriesId: `series-${courseId}`,
    categoryId: catId,
    date: "2026-12-30",
    startTime: "14:00",
    endTime: "16:00",
    capacity: 10,
    bookedCount: 0,
    isActive: true,
    status: "scheduled"
  });
  batch.set(db.collection("students").doc(studentId), {
    id: studentId,
    name: testStudentName,
    phone: "0999999999",
    idNumberLast3: testIdNumberLast3,
    isActive: true,
    needsReview: false
  });
  batch.set(db.collection("enrollments").doc(enrollmentId), {
    id: enrollmentId,
    studentId: studentId,
    offeringId: courseId,
    courseOfferingId: courseId,
    courseId: courseId,
    seriesId: `series-${courseId}`,
    enrollmentType: "booking_access",
    status: "active"
  });

  await batch.commit();
  console.log("Mock 資料寫入成功。");

  const createdReservationIds = new Set();
  let cleanupList = [
    ["categories", catId],
    ["courses", courseId],
    ["sessions", sessionId],
    ["sessions", sessionId2],
    ["students", studentId],
    ["enrollments", enrollmentId]
  ];

  try {
    // 2. 測試學生端首頁 (流程 1) & 課程詳情 (流程 2) & 預約頁 (流程 3)
    console.log("\n[流程 1] 學生端首頁...");
    const catalog = await getCourseCatalog();
    console.log(`首頁讀取成功: categories 筆數 = ${catalog.categories.length}, courses 筆數 = ${catalog.courses.length}`);

    const foundCourse = catalog.courses.find((c) => c.id === courseId);
    if (!foundCourse) {
      throw new Error("❌ 未在 catalog 中找到測試課程！");
    }
    console.log(`✅ [流程 2] 課程詳情讀取成功, 課程 ID = ${foundCourse.id}`);
    
    const foundSession = foundCourse.sessions?.find((s) => s.id === sessionId);
    if (!foundSession) {
      throw new Error("❌ 未在測試課程中找到第一個時段！");
    }
    console.log(`✅ [流程 3] 預約時段讀取成功, 時段 ID = ${foundSession.id}`);

    // 3. 測試建立一筆測試預約 (流程 4)
    console.log("\n[流程 4] 建立一筆測試預約...");
    const reserveRes = await createReservation({
      courseId: courseId,
      sessionId: sessionId,
      studentName: testStudentName,
      phoneLastThree: testPhoneLastThree,
      idNumberLast3: testIdNumberLast3,
      reservationType: "front_booking",
      source: "online",
    });

    console.log("預約結果:", JSON.stringify(reserveRes, null, 2));
    if (!reserveRes.ok) {
      throw new Error("❌ 預約失敗！");
    }

    const reservationId = reserveRes.reservation.id;
    console.log(`✅ 預約成功, 預約 ID = ${reservationId}`);
    createdReservationIds.add(reservationId);
    cleanupList.push(["reservations", reservationId]);

    // 4. 測試查詢該測試預約 (流程 5)
    console.log("\n[流程 5] 查詢測試預約...");
    const searchRes = await findReservationsByStudent(testStudentName, testIdNumberLast3);
    console.log(`查詢成功，找到預約筆數: ${searchRes.length}`);
    const foundRes = searchRes.find((r) => r.id === reservationId);
    if (!foundRes) {
      throw new Error("❌ 查詢結果中未找到剛剛建立的預約！");
    }
    console.log(`✅ 查詢成功, 預約狀態 = ${foundRes.status}, 出席狀態 = ${foundRes.attendanceStatus}`);

    // 5. 測試後台名冊 (流程 7)
    console.log("\n[流程 7] 後台名冊與資料讀取...");
    const adminData = await getBookingData();
    console.log(`後台資料讀取成功: categories 筆數 = ${adminData.categories.length}, students 筆數 = ${adminData.students.length}`);

    // 6. 測試後台點名頁加入學員 (流程 9)
    console.log("\n[流程 9] 後台點名頁加入學員...");
    console.log(`嘗試將學員 ${testStudentName} (ID: ${studentId}) 加入第二個時段 ${sessionId2}...`);
    const rosterRes = await addStudentToSessionRoster(studentId, courseId, sessionId2);
    console.log("加入結果:", JSON.stringify(rosterRes, null, 2));
    if (!rosterRes.ok) {
      throw new Error(`❌ 後台加入學員失敗: ${rosterRes.reason}`);
    }
    console.log("✅ 後台加入學員成功！");
    createdReservationIds.add(rosterRes.reservation.id);
    cleanupList.push(["reservations", rosterRes.reservation.id]);

    // 7. 測試後台更新出席狀態 (流程 10)
    console.log("\n[流程 10] 後台更新出席狀態...");
    await updateReservationAttendance(reservationId, "attended");
    console.log("出席狀態更新為: attended");

    // 再查一次確認狀態
    const searchRes2 = await findReservationsByStudent(testStudentName, testIdNumberLast3);
    const foundRes2 = searchRes2.find((r) => r.id === reservationId);
    console.log(`✅ 驗證出席狀態: ${foundRes2?.attendanceStatus} (應為 attended)`);

    // 8. 測試取消該測試預約 (流程 6)
    console.log("\n[流程 6] 取消該測試預約...");
    const cancelRes = await cancelReservation(reservationId, testStudentName, testIdNumberLast3);
    console.log("取消結果:", JSON.stringify(cancelRes, null, 2));
    if (!cancelRes.ok) {
      throw new Error("❌ 取消預約失敗！");
    }
    console.log("✅ 預約取消成功");

    console.log("\n=== 驗收測試全部通過 ===");
  } catch (testError) {
    console.error("❌ 測試過程中出錯:", testError);
  } finally {
    console.log("\n[清理] 開始刪除測試產生的 Mock 資料...");
    const deleteBatch = db.batch();
    for (const [col, docId] of cleanupList) {
      const isTestPrefix = docId.startsWith("__verify__") || docId.startsWith("manual-__verify__");
      const isCreatedReservation = col === "reservations" && createdReservationIds.has(docId);
      
      if (isTestPrefix || isCreatedReservation) {
        deleteBatch.delete(db.collection(col).doc(docId));
      } else {
        console.warn(`[防呆] 跳過刪除非測試標記之文件: ${col}/${docId}`);
      }
    }
    await deleteBatch.commit();
    console.log("✅ 測試資料清理完成。");
  }
}

main().catch((err) => {
  console.error("❌ 測試發生異常:", err);
  process.exit(1);
});
