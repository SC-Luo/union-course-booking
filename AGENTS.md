# AGENTS.md

## AI 開工入口適用範圍

本專案已建立 repo 內固定 AI 開工入口。這套入口只適用於已經開啟或接手「工會課程預約系統」這個 repo 的情境。一般日常開工、跨專案整理或尚未指定本專案時，仍依使用者的 SecondBrain 開工交接流程為準。

未來 GPT / Codex / Opencode 接手本 repo 時，優先依下列順序讀取 repo 文件：

1. `AI_START_HERE.md`
2. `HANDOFF.md`
3. `tasks.md`
4. `decisions.md`
5. `context.md`
6. `GPT_CODEX_WORKFLOW.md`
7. `filemap.md`
8. `specs/product-spec.md`
9. `specs/user-flow.md`
10. `specs/tech-context.md`

`notes/` 是背景筆記，`archive/docs-legacy/` 是舊版文件；除非明確需要查舊資料，否則不要優先讀取。在本 repo 內工作時不要預設讀取完整 secondbrain vault；只有 repo 文件不足、任務明確需要或使用者要求時才回查。不要把完整聊天紀錄或 Firebase 私密金鑰寫入 Markdown 文件。

需要使用者提供檔案、或需要輸出檔案/程式碼給使用者時，請遵守 `AI_START_HERE.md` 與 `GPT_CODEX_WORKFLOW.md` 的檔案交付格式。

下方 secondbrain 路徑保留為舊背景來源；若和 repo 內入口文件衝突，先以 repo 內 `AI_START_HERE.md`、`HANDOFF.md`、`tasks.md`、`decisions.md`、`context.md` 與 `specs/` 為準，並回報需要同步哪份文件。

## 專案摘要

這是「工會課程預約系統」的程式專案。

第一版目標：

- 學生不用登入
- 學生用「姓名 + 手機末三碼」預約課程時段
- 同一門課程，同一位學生只能預約一個時段
- 課程前一天 18:00 後不能新增預約
- 已額滿課程仍在學生端顯示，但標示「額滿」且不能預約
- 工作人員使用共享後台帳號管理課程、分類、時段、名單、出席與統計

## 重要上下文來源

接手本 repo 時先讀 repo 內 `AI_START_HERE.md` 與 `HANDOFF.md`，避免一開始載入完整長文件。一般開工仍依 SecondBrain 開工交接流程為準。

舊版 secondbrain 短版接續摘要保留為背景來源，只有 repo 內文件不足或使用者明確要求時才讀：

`H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\docs\session-handoff.md`

產品規格以 repo 內 `specs/` 為準。下列 Obsidian 筆記保留為舊背景來源，只有需要查舊資料時才讀：

`H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\specs\工會課程預約系統.md`

開發踩坑與流程改進記錄：

`H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\notes\踩坑過程.md`

修改功能前，先確認該文件中的：

- 已確認規則
- 畫面規劃
- 第一版開發任務拆解
- 驗收清單

但不要在每次開工時全文讀取規格、踩坑紀錄或決策紀錄。只有本次任務牽涉特定產品規則、環境問題或重大架構判斷時，才讀相關段落。

如果程式需求和產品規格衝突，先以 repo 內產品規格為準，並回報需要同步調整哪一份文件。

如果開發中遇到可重複避免的問題，請把「現象、判斷、解法、後續改進」寫入踩坑記錄。

收工時優先更新 `HANDOFF.md` 的短摘要；任務變化更新 `tasks.md`，重大決策更新 `decisions.md`，規格變化更新 `specs/`，會影響後續 AI 接手的重要變更更新 `CHANGELOG_AI.md`。只有可重複避免的坑才寫入 `notes/踩坑過程.md`。

## 專案位置與環境

實際開發資料夾：

`C:\Users\User\codex-projects\union-course-booking`

雲端原始碼備份資料夾：

`H:\我的雲端硬碟\2026codex\union-course-booking-source`

不要把 `node_modules` 放在 Google Drive 同步資料夾。雲端同步資料夾大量寫入小檔案時容易失敗。

如果使用者希望雲端統一管理，優先採用「雲端保存規格與原始碼、不保存依賴」的策略，不要在同步資料夾內安裝 `node_modules`。

同步到雲端：

```bash
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-to-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

從雲端同步回本機：

```bash
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-from-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

開發網址：

`http://127.0.0.1:3100`

常用指令：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
npm run lint
npm run build
```

在 PowerShell 中如果 `npm` 被執行政策擋住，使用 `npm.cmd`。

## 目前技術狀態

目前是 Next.js 預約系統，正式資料來源已可用 Firestore，並保留本機 JSON 作為開發與配額異常時的備援。學生端可以完成預約、查詢與截止前取消；後台可管理分類、課程、時段、名冊、預約名單、出席狀態、取消與 CSV 匯出。

目前資料位置：

- `data/booking-data.json`
- `src/lib/types.ts`
- `src/lib/course-utils.ts`
- `src/lib/data-store.ts`
- `src/app/actions.ts`

## Firebase 狀態

應用程式資料讀寫已改接 Firebase / Firestore。正式資料來源由環境變數 `BOOKING_DATA_SOURCE=firestore` 控制；若沒有 Firebase Admin 憑證或 Firestore 讀寫失敗，資料層會回落使用本機 JSON，避免本機開發完全中斷。

已知狀態：

- Firebase 專案為 `my-teaching-tools-1126-f8fc9`。
- 專案已安裝 `firebase-admin`，伺服器端透過 `src/lib/firebase-admin.ts` 初始化。
- Firestore 已有正式 `categories`、`courses`、`sessions`、`students`、`reservations` 集合。
- 真實名冊與預約屬於個資，不可提交 GitHub。
- Firebase Spark 方案曾接近 Firestore 讀取上限；公開學生端頁面已改用窄讀取，避免首頁與課程頁讀完整預約與名冊。
- 本機直接執行 `firebase` 指令可能不可用；需要 Firebase CLI 時優先使用 `npx.cmd -y firebase-tools@latest ...`。

啟用 Firestore 資料來源需要 `.env.local`：

```text
BOOKING_DATA_SOURCE=firestore
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

資料存取優先使用伺服器端，避免學生端下載或查到完整預約名單。學生查詢只能回傳符合「完整姓名 + 手機末三碼」的本人資料。公開課程頁應優先使用 `getCourseCatalog()`，不要呼叫後台用的完整 `getBookingData()`。

目前已建立主要頁面：

- `/`：學生端課程列表
- `/courses/[courseId]`：課程詳情
- `/courses/[courseId]/book/[sessionId]`：預約表單
- `/booking/success`：預約成功
- `/booking/search`：查詢預約
- `/admin/login`：後台登入
- `/admin`：後台首頁
- `/admin/courses`：課程管理
- `/admin/categories`：分類管理
- `/admin/courses/[courseId]/sessions`：時段管理
- `/admin/sessions/[sessionId]/reservations`：預約名單
- `/admin/stats`：統計頁

## 開發原則

- 優先完成可用流程，再做細節美化。
- 產品規則不要擅自改動；需要改時同步更新規格文件。
- 學生端以手機使用為優先。
- 後台以桌機表格與快速操作為優先。
- 歷史資料要保留，但不要干擾學生端主要畫面。
- 額滿課程不要從學生端消失，要顯示「額滿」。
- 第一版不做學生登入、候補、通知、線上付款、列印簽到表、報名資格檢查。
- 第一版後台先用共享帳號，不做多人細權限。

## 資料規則

學生身份判斷：

- `student_name`
- `phone_last_three`

重複預約規則：

- 同一 `course_id`
- 同一 `student_name`
- 同一 `phone_last_three`
- 已有有效預約時，不能再預約同課程其他時段

預約截止規則：

- 預設為課程時段日期前一天 18:00
- 未來可讓工作人員針對個別時段調整

出席狀態：

- `pending`
- `attended`
- `absent`

預約狀態：

- `booked`
- `cancelled`

## 建議下一步

下一個主要階段是正式發布前的穩定化：

1. 觀察 Firestore 讀取用量是否因窄讀取回落。
2. 完成 Vercel GitHub integration 自動部署。
3. 核對 9 筆 `needsReview` 名冊資料。
4. 補正式驗收清單，尤其是手機端學生預約、查詢、取消與後台名單操作。
5. 視用量決定是否加首頁快取、公開課程彙總資料或後台分頁查詢。

每完成一個階段，請執行：

```bash
npm run lint
npm run build
```
