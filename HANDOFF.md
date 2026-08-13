---
title: 工會課程預約系統｜HANDOFF
type: handoff
layer: project-memory
project: union-course-booking
category: handoff
tags:
  - handoff
  - project-memory
  - codex
created: 2026-05-27
updated: 2026-08-13
status: active
summary: 本 repo 的 AI 接手短摘要，記錄目前健康狀態、最新 UI 整理進度、下一步與風險。
related:
  - AI_START_HERE.md
  - GPT_CODEX_WORKFLOW.md
  - tasks.md
  - decisions.md
  - context.md
  - specs/tech-context.md
---

# HANDOFF

## 目前狀態

- 專案是 Next.js 工會課程預約系統。
- 學生端已可瀏覽課程、預約、查詢與截止前取消。
- 後台已可管理分類、課程主檔、年度課程、課堂日誌、名冊、預約名單、出席、取消與匯出。
- 資料來源可使用 Firestore，並保留本機 JSON 作為開發與異常備援。
- 2026-06-08 已完成一輪較大的 UI / UX 架構整理，開始把系統收斂成三角色入口：學員中心、授課工作台、秘書處後台。
- 2026-06-08 已實際重跑 `npm.cmd run lint` 與 `npm.cmd run build`，目前通過。

## 最近處理

- 2026-08-13 Firestore 讀取優化 Preview 線 Phase 1G 完成（**FINAL = PASS**）：
  - **Phase 1G**：`/admin/course-sessions` 課堂日誌總覽改為 narrow loader（`getAdminCourseSessionsPageData`），不再走 `getBookingData()`；只讀 static cached collections（categories / courses / courseSeries / courseOfferings / instructors）+ bounded booked reservations（`where(sessionId in 30 chunk && status == booked)`）；`students` / `studentCourseRecords` / `enrollments` / `attendanceRecords` 全部 0 讀。guard：`node tools/check-phase-1g-course-sessions.mjs`。
  - **真實 Vercel Preview runtime 驗證**（`/admin/course-sessions`，同一個 request）：query #1 `where(sessionId in 30 sessionIds && status == booked)` docs=0；query #2 `where(sessionId in 26 sessionIds && status == booked)` docs=0；`source: getAdminCourseSessionsPageData`、`route: /admin/course-sessions`。同一 request 內 `students=0`、`studentCourseRecords=0`、`enrollments=0`、`attendanceRecords=0`、`getBookingData=0`。
  - **56 sessions → 實測 2 個 bounded queries、returned docs = 0**。Before 約為 1400～1500+ reads / page load；After warm-cache Preview 為 2 bounded reservation queries。注意：不要把「2 queries」宣稱為精確等於 2 billable reads——實測是「2 個 bounded queries、0 returned docs」，估算式與實測證據分開看待。
  - **Phase 1G commit**：`7b931f9a797de65fc229df290f58fdef86f799b0`（`fix(firestore): narrow course sessions reads`），已 push 至 `origin/codex/phase-1g-course-sessions` 並安全 fast-forward `origin/firestore-diagnostics-preview`（無 force push、無碰 `main`、無部署 Production）。
- 2026-08-12 Firestore 讀取優化 Preview 線 Phase 1E / 1F 實作：
  - **Phase 1E（已整合進 preview）**：`/admin/students?mode=history` 學員歷程改為 narrow loader（`getStudentHistoryPageData`），以 `students.doc(studentId)` + `where(studentId == sid)` 查 enrollments / reservations / attendanceRecords / studentCourseRecords，並以 bounded `reservations.where(studentName == name).limit(50)` 補 legacy 資料（需通過完整姓名 + 末三碼 identity-safe 驗證）。guard：`node tools/check-phase-1e-student-history.mjs`。
  - **Phase 1F（已完成並通過 Preview 驗證）**：`/admin/students/[studentId]` 學員詳細頁改為 narrow loader（`getStudentProfilePageData`），不再走 `getBookingData()` 完整資料流；學生單筆讀取、enrollments / reservations narrow queries、metadata 用 `readDocumentsByIds` batch 讀 courseOfferings / courses，legacy reservations 統一 reuse Phase 1E 的 identity-safe helper（`fetchStudentReservationsIdentitySafe`），頁面輸出與原 UI 完全一致。guard：`node tools/check-phase-1f-student-profile.mjs`。
  - **靜態驗證已通過**：`node tools/check-phase-1e-student-history.mjs`、`node tools/check-phase-1f-student-profile.mjs`、`npm.cmd run lint`、`npx.cmd tsc --noEmit` 與 `npx.cmd next build --webpack` 均通過。`next build`（Turbopack 標準建置）因本 repo 的 `node_modules` 是 junction 指向外部目錄而失敗，屬環境問題（`BLOCKED_BY_PREEXISTING_NODE_MODULES_JUNCTION`），`--webpack` 可正常完成；production-like 建置待 Vercel Preview 驗證。
- 2026-08-12 完成 Firestore 讀取優化 Preview 線 Phase 1A / 1C / 1D 串接：
  - **Authoritative preview branch**：`firestore-diagnostics-preview`
  - **目前 Preview branch HEAD**：`7b931f9a797de65fc229df290f58fdef86f799b0`（Phase 1G）
  - **已發布 Preview 測試網址**：`https://union-course-booking-ohdc6rtfo-sc-luos-projects.vercel.app`
  - **commit chain**：
    - Phase 1A：`65c057f2de624b13080a87a98c7aa2bad2ddcc1d`，`/admin` 首頁改為窄讀取，約 1471 reads 降到約 88 reads。
    - Phase 1C：`8ec3cf79eba7b976d8c902eb960e6db91ba643e0`，`/admin/sessions/[sessionId]/reservations` 改用單堂 narrow loader。
    - Phase 1D：`95261e21bba17f4f6c7214121c53fb38b9dcbb09`，`/admin/students` 學員名冊改為 bounded query architecture。
    - Phase 1E：`3b43920`（`fix(firestore): narrow single student history reads`）。
    - Phase 1F：`207e58c880ebebf427c0c3e679c8996e8703841f`（`fix(firestore): narrow single student profile reads`）。
    - Phase 1G：`7b931f9a797de65fc229df290f58fdef86f799b0`（`fix(firestore): narrow course sessions reads`）。
  - **Phase 1D 重點**：`/admin/students` default 不再 `students.get()` 全讀 1428 位學生；新增 `getStudentDirectoryPageData()`，支援 default pagination、exact search、class roster batch reads 與 count aggregation。
  - **Preview branch 已 fast-forward**：`origin/firestore-diagnostics-preview` 已從 Phase 1A fast-forward 到 Phase 1D，沒有 force push、沒有碰 `main`、沒有部署 Production。
  - **本輪驗證**：`npm.cmd run lint`、`npm.cmd run build`、`node tools/check-phase-1d-student-directory.mjs` 均通過；Vercel Preview deployment 狀態 Ready，HTTP 200。
- 2026-07-06 建立 Firestore 診斷與 schema 檢查工具：
  - **診斷模式**：支援 `STRICT_FIRESTORE=true` 變數以在開發中停用 JSON 備援，便於線上除錯。
  - **Schema 檢查工具**：新增 [`tools/check-firestore-schema.mjs`](file:///c:/Users/User/codex-projects/union-course-booking/tools/check-firestore-schema.mjs) 只讀欄位統計工具。
  - **全流程驗收腳本**：新增具有防呆前綴與環境限制的 [`tools/verify-env-and-ops.mjs`](file:///c:/Users/User/codex-projects/union-course-booking/tools/verify-env-and-ops.mjs) 測試腳本，供手動/自動驗收。
  - **點名名冊寫入**：將 `addStudentToSessionRoster` 改為支援寫入 Firestore 且過濾 `undefined` 欄位。
- 2026-06-30 正式上線安全防禦與開發流建立：撰寫了 [`docs/POST_LAUNCH_WORKFLOW.md`](file:///C:/Users/User/codex-projects/union-course-booking/docs/POST_LAUNCH_WORKFLOW.md)。重寫同步腳本，加入三層確認鎖、強制生產資料庫快照備份、以及 100 筆分批節流限速。執行 git cached 移除了 `data/booking-data.json` 追蹤防範個資洩漏，並建立去識別化範本檔案。
- 2026-06-29 將前台學員預約與預約查詢改回「姓名 + 身分證後三碼」：修改了 [`booking-form.tsx`](file:///C:/Users/User/codex-projects/union-course-booking/src/components/booking-form.tsx)、[`search/page.tsx`](file:///C:/Users/User/codex-projects/union-course-booking/src/app/booking/search/page.tsx)、[`actions.ts`](file:///C:/Users/User/codex-projects/union-course-booking/src/app/actions.ts) 與 [`booking-repository.ts`](file:///C:/Users/User/codex-projects/union-course-booking/src/lib/booking-repository.ts)。預約資格過濾及查詢均強制同時比對姓名與後三碼，以防止同名同姓誤判。同時更新前台 `localStorage` 記憶與頁面提示。
- 2026-06-29 實現學員前台使用者記憶機制：在新生資料填寫成功（`/new-student/success`）或預約成功時，在 client-side 將姓名儲存至 `localStorage` 的 `union_booking_student_profile`。當進入 `/booking/search` 且 URL 中沒有 query 時，自動導向並執行預約查詢；查詢頁面頂部支援「改用其他姓名查詢」按鈕以清除記憶。
- 2026-06-29 執行上線前安全與穩定性排查修正：
  - **全域後台防護**：新增 `src/middleware.ts` 全域 Middleware 保護後台頁面（排除登入頁），並支援成功登入後原路徑跳轉。
  - **禁止 JSON Fallback**：正式生產環境（Production 且啟用 Firestore）下，若連線初始化或讀寫失敗直接 throw Error，禁止默默回落 JSON。
  - **表單安全**：新生自填入口表單加入隱私個資 checkbox 同意驗證，並使用 hidden honeypot 過濾機器人提交。
  - **講師入口通行碼**：講師入口加入 `TEACHING_ACCESS_CODE` 授課通行碼防護，並在點名與日誌 actions / URLs 鏈接中完整轉發 `code` 參數。
  - **環境變數排查**：新增 `tools/check-production-readiness.mjs` 排查正式環境變數。
  - **上線檢查清單**：新增 `docs/LAUNCH_CHECKLIST.md` 作為上線前人工與功能驗收的 12 項指南。
- 2026-06-29 簡化學生端首頁 `/` 版面，移除重複大型 Hero 區塊。將原「預約提醒」改為緊湊小提醒條移至課表上方，使整體課程分類與課表比原本更靠上，方便學員即時查閱課程。
- 2026-06-29 建立身份入口總頁 `/portal` 作為一站式身分分流。學生端首頁最上方調整新增三大分流卡片（我要預約、我要查詢、我是第一次填資料），優化導流。後台首頁快速入口常用功能中新增「待確認新生」快捷卡片，包含其說明與直連連結。
- 2026-06-29 調整公開新生自填入口 `/new-student` 欄位與邏輯：身分證改收完整「身分證字號 *」且生日改為必填，移除「LINE ID」。Server Action 改為驗證這四項必填，並由身分證字號自動截取最後三碼寫入為 `idNumberLast3`，且不寫入 `lineId`；防重複比對改用完整身分證字號比對。
- 2026-06-29 新增公開新生自填基本資料入口 `/new-student` 及其送出成功頁 `/new-student/success`。送出後自動進入學員資料庫（預設標記為 `isActive: true` 與 `needsReview: true`），來源標記為 `"新生自填入口"`。此入口僅收集「身分證末三碼」，並內建精準與模糊防重複比對與合併更新邏輯，不要求使用者登入。
- 2026-06-29 修復了後台「名冊資料 > 講師名冊」的無效導向問題，正式將 `instructors` 加入 `MODES` 清單，並修正 `RosterFlowNav` 導覽連結與型別。
- 2026-06-29 將 Google Sheet 同步目標切換至新的公司帳號版本，更新了 `.env.local` 裡面的 Webhook Web App URL，以及 `Code.gs` 中預設的 Spreadsheet ID，並以註解形式保留備份。

- 2026-06-08 學員端入口整理已由使用者確認 OK：首頁改為「學員中心」，不再顯示授課工作台與秘書處後台入口，主視覺與近期課程區塊的多餘說明文字已清理。
- 2026-06-08 年度課程頁 `/admin/course-offerings` 已改為 Modal 操作模式：移除大型新增班級區塊，新增年度班級改為右上角按鈕開 Modal，卡片編輯改收斂到「管理」Modal。
- 2026-06-08 年度課程頁篩選改為兩階段：先依課程類別，再依課程狀態（全部 / 日常管理 / 開放報名 / 停止報名 / 草稿 / 已封存）。
- 2026-06-08 年度課程管理流程新增「課程狀態控制台」概念，將草稿、開放報名、停止報名、已封存集中到同一個儲存流程處理。
- 2026-06-08 課堂日誌總覽 `/admin/course-sessions` 已改為排除已封存年度課程：封存課程不應再出現在年度課程選擇器、課程卡片與排課流程。
- 2026-06-08 共用 `SessionInfoModalCard` 已補齊 `triggerLabel`、`eyebrow`、`closeLabel`、`triggerClassName`、`panelClassName`，並修正 `panelClassName` 不應覆蓋白底、圓角、padding、shadow 等基礎樣式。
- 2026-06-08 講師授課工作台 `/teaching` 與單堂頁 `/teaching/sessions/[sessionId]` 已開始收斂為講師 / 助教入口，單堂頁改為摘要 / 點名 / 紀錄三區與 Modal 操作，但仍待人工驗收。

- 2026-06-05 已完成單堂課課堂狀態管理文件化與程式核對：後台單堂課可切換 `正常上課 / 停課 / 補課 / 調課 / 已取消`，前台月曆與課程詳情頁改用學員語言顯示 `可預約 / 報名截止 / 已額滿 / 已取消 / 本堂停課 / 補課 / 已調課 / 未開放或暫不開放`。
- 2026-06-05 後台課堂狀態按鈕已採點選即儲存；「編輯課堂資料」視窗只保留日期、時間、單元、地點與講師欄位，不再重複放課堂狀態。
- 2026-06-05 規則確認：`已取消 / 停課 / 調課` 不可預約；`補課` 仍依名額與截止時間判斷是否可預約。
- 2026-05-28 本輪 Codex 已重新檢查單堂點名工作台實作，確認 `updateReservationAttendance()` 含 Firestore legacy reservation id fallback，並已重跑 `npm.cmd run lint`、`npm.cmd run build` 通過；dev server 已啟動於 `http://127.0.0.1:3100`。
- 2026-05-28 單堂點名工作台完成版面與功能整理：課堂資料改為摘要卡加中央編輯視窗，點名表格整理為「學員｜狀態列｜出席狀況｜作業｜備註」。
- 點名狀態更新已支援中文 `sessionId` 的安全路徑處理，並在 Firestore reservation 文件 id 與資料內 `id` 不一致時用 legacy id 查詢後更新。
- 出席規則調整為「主要狀態只能一個」，遲到時間與請假時段作為附加紀錄；點「預約」或「未到」會清除附加紀錄。
- 作業、備註與課堂日誌改為自動儲存，支援中文輸入法 composition，停止輸入約 0.9 秒或失焦時儲存。
- 課堂資料編輯視窗的講師選單會依課程專業、`courseSeriesIds` 或 `courseOfferingIds` 過濾，無符合講師時提示到名冊資料／講師名冊補資料。
- 修正 `CourseStatus` 與 `locked` 狀態不一致造成的 build error。
- 補齊 `late` 出席狀態的徽章文字與樣式。
- 清理大量未使用函式、變數、import 與舊元件殘留。
- `eslint.config.mjs` 暫時關閉 `@typescript-eslint/no-explicit-any`，避免 Firestore / JSON / 舊資料混合期被雜訊阻塞；後續再分批補型別。
- 新增 `GPT_CODEX_WORKFLOW.md`，作為 GPT 交付任務包與 Codex 接手的固定格式。

## 重要路徑

- AI 開工入口：`AI_START_HERE.md`
- GPT/Codex 協作：`GPT_CODEX_WORKFLOW.md`
- 檔案地圖：`filemap.md`
- 任務清單：`tasks.md`
- 決策紀錄：`decisions.md`
- 專案背景：`context.md`
- 正式規格：`specs/`
- 本機專案：`C:\Users\User\codex-projects\union-course-booking`
- 開發網址：`http://127.0.0.1:3100`

## 下一步

1. 先做 Preview Verification：打開 `https://union-course-booking-ohdc6rtfo-sc-luos-projects.vercel.app`，登入後台並測 `/admin/students`：
   - default 進入名冊不應隨學生總數線性讀取，預期只讀 count aggregation + 約 30 筆 student docs。
   - `?q=...` 搜尋應走 exact query，不應 full-read students。
   - `?mode=class` 班級名冊應先查 enrollments，再 batch get 對應 students。
   - `pageCursor` 下一頁應使用 cursor pagination，不使用 offset。
2. 用 `BOOKING_FIRESTORE_READ_DEBUG=true` 的 Preview/測試環境觀察 Firestore diagnostics log；不要用 Production 反覆測。
3. 若 Preview 驗收通過，再決定是否把 `firestore-diagnostics-preview` 合併進正式流程；不要直接碰 `main` 或 Production。
4. 下一個 hot path 候選（Phase 1E / 1F / 1G 已處理 `mode=history`、`[studentId]`、`/admin/course-sessions`）：目前進行 Phase 1H `mode=eligibility`（Readiness Audit），之後為 `/admin/students?mode=instructors` 與部分 server actions。
5. 核對 9 筆 `needsReview` 名冊資料。
6. 完成 Vercel GitHub integration 自動部署；目前本次 Preview 是用 Vercel CLI 手動建立。

## 風險與注意

- 接手本輪 Firestore optimization 時，優先從 `firestore-diagnostics-preview` 或 `codex/phase-1d-student-directory` 讀，不要用原始 dirty workspace 當 source of truth。
- Phase 1D 僅處理 `/admin/students` default/search/class/pagination；Phase 1E 處理 `mode=history`，Phase 1F 處理 `[studentId]` 詳細頁，Phase 1G 處理 `/admin/course-sessions`；eligibility（Phase 1H 進行中）、instructor mode 仍未處理。
- Phase 1D 搜尋語意有刻意收斂：Firestore native 不支援 contains search，因此姓名/電話/會員編號/身分末碼走 exact match，不下載全體學生做 fuzzy filter。
- `tools/check-phase-1d-student-directory.mjs` 是 Phase 1D scoped guard，用來防止 `/admin/students` 回歸到 `students.get()` 或 `getBookingData()`。
- 目前 Firestore 內的學員資料均為模擬/測試資料，已直接實作新版學員完整度規則；正式上線生產環境前，必須清理所有測試資料並重新確認正式資料導入流程。
- 工作區仍有大量未提交變更與未追蹤檔案；接手前務必先看 `git status --short`。
- 目前 `data/booking-data.json` 有在地資料變更；暫時不要假設這是可直接提交的測試資料。
- 目前仍有未追蹤暫存檔：`src/app/src__app__page.current.tsx.tsx`、`src/app/teaching/sessions/[sessionId]/src__app__teaching__sessions__[sessionId]__page.current.tsx`。提交前先判斷是否刪除或移出。
- 本次交接提到的 `src__app__admin__course-offerings__page.v7_1.fixed.tsx` 不在 repo 內；目前應以實際的 `src/app/admin/course-offerings/page.tsx` 為準，不要再回頭找缺失的暫存覆蓋檔。
- `firebase-admin-key.json`、`.env.local`、真實名冊與預約資料屬於敏感資料，不可提交或寫入 Markdown。
- 根目錄的 fix 腳本是救急產物，不應成為長期開發流程；後續應以任務包、patch、lint/build 驗證取代。
- `@typescript-eslint/no-explicit-any` 目前是暫時放寬，後續要逐步補上資料層型別。

## 開發後必跑

```powershell
npm.cmd run lint
npm.cmd run build
```

## 文件更新規則

功能、資料結構、流程、部署或 AI 接手方式改變時，檢查並更新：

- `HANDOFF.md`
- `tasks.md`
- `decisions.md`
- `context.md`
- `specs/product-spec.md`
- `specs/user-flow.md`
- `specs/tech-context.md`
- `CHANGELOG_AI.md`
## 2026-06-11

- 已新增 `specs/system-architecture.md`，可優先用來理解系統組成、前端 / 後端分工、資料流、Firestore 串接、JSON fallback 與批次同步方式。
