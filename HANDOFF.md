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
updated: 2026-06-08
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

1. 先驗收授課工作台 `/teaching` 與 `/teaching/sessions/[sessionId]`：確認桌機入口、手機版摘要 / 點名 / 紀錄分頁、課堂設定 Modal、課堂紀錄 Modal 與點名流程是否順。
2. 驗收秘書處後台 `/admin`：確認首頁定位是否像行政中控台，並檢查左側導覽與角色切換是否還需要重新分組。
3. 回頭驗收年度課程頁 `/admin/course-offerings`：確認課程類別 + 狀態兩階段篩選、管理 Modal、狀態切換、封存與恢復流程是否符合工作流程。
4. 驗收課堂日誌總覽 `/admin/course-sessions`：確認已封存課程不再進入排課流程，日常管理課程仍可正常新增與排課。
5. 核對 9 筆 `needsReview` 名冊資料。
6. 完成 Vercel GitHub integration 與部署驗收。

## 風險與注意

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
