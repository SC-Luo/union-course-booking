---
title: 工會課程預約系統｜Tech Context
type: technical-context
layer: project-memory
project: union-course-booking
category: specs
tags:
  - tech-context
  - nextjs
  - firestore
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 技術架構、資料來源、重要路徑、驗證指令與開發注意事項。
related:
  - ../AI_START_HERE.md
  - ../GPT_CODEX_WORKFLOW.md
  - ../filemap.md
---

# Tech Context

## 技術架構

- Framework：Next.js App Router。
- 主要語言：TypeScript。
- 正式資料來源：Firebase / Firestore。
- 開發與異常備援：本機 JSON。
- 伺服器端 Firebase 初始化：`src/lib/firebase-admin.ts`。
- 主要資料存取層：`src/lib/booking-repository.ts`。

## 開發位置

- 本機專案：`C:\Users\User\codex-projects\union-course-booking`
- 開發網址：`http://127.0.0.1:3100`
- 雲端原始碼備份：`H:\我的雲端硬碟\2026codex\union-course-booking-source`

## 常用指令

PowerShell 中如果 `npm` 被執行政策擋住，使用 `npm.cmd`。

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3100
npm.cmd run lint
npm.cmd run build
```

截至 2026-05-28：

- `npm.cmd run lint` 通過，0 warning。
- `npm.cmd run build` 通過。

## 重要路徑

- `src/app/page.tsx`：學生端首頁。
- `src/app/courses/[courseId]/page.tsx`：課程詳情。
- `src/app/courses/[courseId]/book/[sessionId]/page.tsx`：預約表單。
- `src/app/booking/search/page.tsx`：預約查詢。
- `src/app/admin/page.tsx`：後台首頁。
- `src/app/admin/actions.ts`：後台 Server Actions。
- `src/app/admin/students/page.tsx`：學生與名冊管理。
- `src/app/admin/sessions/[sessionId]/reservations/page.tsx`：單堂預約與點名。
- `src/app/admin/sessions/[sessionId]/reservations/attendance-status-controls.tsx`：單堂點名五個狀態操作與遲到／請假浮動輸入。
- `src/app/admin/sessions/[sessionId]/reservations/reservation-note-autosave.tsx`：學員作業與備註自動儲存輸入。
- `src/app/admin/sessions/[sessionId]/reservations/session-info-modal-card.tsx`：課堂資料摘要旁的中央浮動編輯視窗。
- `src/app/admin/sessions/[sessionId]/reservations/session-journal-autosave.tsx`：課堂日誌與 TTQS 欄位自動儲存輸入。
- `src/lib/types.ts`：共用型別。
- `src/lib/course-utils.ts`：課程工具。
- `src/lib/data-store.ts`：本機 JSON 正規化與讀寫。
- `src/lib/booking-repository.ts`：Firestore / JSON 資料存取。
- `src/lib/firebase-admin.ts`：Firebase Admin 初始化。
- `data/booking-data.json`：本機 JSON 備援資料。

更多檔案位置請讀 `filemap.md`。

## Firestore 狀態

- Firebase 專案：`my-teaching-tools-1126-f8fc9`
- 已安裝 `firebase-admin`。
- Firestore 已有正式集合：`categories`、`courses`、`sessions`、`students`、`reservations`。
- 專案也有延伸集合：`courseSeries`、`courseOfferings`、`courseSessions`、`enrollments`、`attendanceRecords`、`entitlements`、`studentCourseRecords`、`instructors`、`importBatches`。
- 資料來源由 `BOOKING_DATA_SOURCE=firestore` 控制。
- Firestore 初始化或讀寫失敗時，資料層會回落使用本機 JSON。

## Firestore 開發注意

- 公開學生端頁面應優先使用 `getCourseCatalog()`，不要呼叫後台用的完整 `getBookingData()`。
- 學生查詢只能回傳符合完整姓名與手機末三碼的本人資料。
- 單堂點名更新 reservation 時，先以 Firestore document id 更新；若找不到，需用 `where("id", "==", reservationId)` 支援舊 reservation id，再回落 JSON 備援。
- 點名、作業與備註寫入應保留 Firestore 與 JSON fallback。
- 真實名冊與預約屬於個資，不可提交 GitHub。
- 不要把 Firebase 私密金鑰、service account、token 或 `.env.local` 內容寫入 Markdown。
- 本機直接執行 `firebase` 指令可能不可用；需要 Firebase CLI 時優先使用：

```powershell
npx.cmd -y firebase-tools@latest ...
```

## Lint / TypeScript 注意

- `@typescript-eslint/no-explicit-any` 目前暫時關閉。
- 原因：資料層正同時處理 Firestore、JSON 備援與舊資料格式。
- 新增穩定共享型別時仍應優先補在 `src/lib/types.ts`。
- 後續要分批收斂資料層型別，再評估恢復 `no-explicit-any`。

## 單堂點名資料欄位

- `Reservation.attendanceStatus`：主要出席狀態。
- `Reservation.lateTime`：遲到時間附加紀錄。
- `Reservation.leaveStartTime` / `Reservation.leaveEndTime` / `Reservation.leaveHours`：請假附加紀錄。
- `Reservation.homework`：單堂作業紀錄。
- `Reservation.note`：單堂備註。
- `CourseSession.teachingContent`、`teacherNote`、`assistantNote`、`adminNote`、`abnormalStatus`、`followUpNote`：課堂日誌與 TTQS 相關欄位。
- `Instructor.specialties`、`courseSeriesIds`、`courseOfferingIds`：課堂資料編輯視窗講師過濾依據。

## 同步策略

不要把 `node_modules` 放在 Google Drive 同步資料夾。雲端同步資料夾大量寫入小檔案時容易失敗。

同步到雲端：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-to-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

從雲端同步回本機：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-from-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```
