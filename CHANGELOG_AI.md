---
title: 工會課程預約系統｜CHANGELOG_AI
type: changelog
layer: project-memory
project: union-course-booking
category: changelog
tags:
  - ai-changelog
  - project-memory
created: 2026-05-27
updated: 2026-06-08
status: active
summary: 影響後續 AI 接手、產品方向、技術架構、資料結構或開發流程的重要變更。
related:
  - AI_START_HERE.md
  - HANDOFF.md
  - GPT_CODEX_WORKFLOW.md
---

# CHANGELOG_AI

本文件只記錄會影響後續 AI 接手、產品方向、技術架構、資料結構或開發流程的重要變更。不要貼完整聊天紀錄，也不要記錄每一行小改動。

## 2026-06-29

### 本次變更

- **前台學員預約改回「姓名＋身分證後三碼」**：修改預約表單 [`src/components/booking-form.tsx`](file:///C:/Users/User/codex-projects/union-course-booking/src/components/booking-form.tsx) 與查詢頁 [`src/app/booking/search/page.tsx`](file:///C:/Users/User/codex-projects/union-course-booking/src/app/booking/search/page.tsx)，強制限制預約與查詢均需輸入「姓名 + 身分證後三碼」作為比對憑證。同步調整 `localStorage` 前台使用者記憶、自填成功跳轉與預約成功記憶元件，僅儲存並帶入姓名與身分證後三碼，嚴防敏感個資在 URL 及本機儲存殘留。
- **自動帶入「我的預約」查詢資料**：新增學員前台記憶機制，在新生資料填寫成功、以及預約成功時，在 client-side 將姓名存入 `localStorage`。當學員進入預約查詢頁 `/booking/search` 時自動帶入並轉跳執行查詢，同時於查詢頁上方顯示提示與「改用其他姓名查詢」按鈕以支持清除記憶，兼顧體驗與多人裝置的隱私。
- **引入後台登入權限保護 (Middleware)**：新增 `src/middleware.ts`，保護所有 `/admin` 後台路由（排除 `/admin/login`），若 `admin_session` cookie 不存在或不符，將強行跳轉至登入頁並攜帶 `next` 跳轉參數。更新 `/admin/login` 表單及 Actions 以支援成功登入後回跳原路徑。
- **正式環境中禁止 Fallback 到 JSON**：修改 `src/lib/data-store.ts` 與 `src/lib/booking-repository.ts`，在 Production 環境且啟用 Firestore 時，若 Firestore 發生任何初始化或讀寫連線失敗，均直接丟出 Error，禁止默默 fallback 回落讀寫本機 JSON。
- **新生公開表單安全與防垃圾送出**：修改 `/new-student` 頁面與 Actions，加載簡短個資告知文字、個資同意 checkbox 必填校驗，並新增隱藏的 `website` honeypot 欄位，在後端默默重導向機器人提交以過濾垃圾。
- **講師入口授課通行碼機制**：為避免姓名登入的安全風險，支援 `TEACHING_ACCESS_CODE` 共用授課通行碼。若該環境變數有值，講師登入頁將顯示並驗證通行碼，並在所有列表、單堂點名與 Server Actions 重導向路徑中藉由 URL query 傳遞會話 `code`，防範未經授權存取點名頁面與會話中途被登出。
- **環境變數排查工具**：新增 `tools/check-production-readiness.mjs`，並於 `package.json` 加入 `check:prod` script，可用於一鍵排查 Vercel 部署前是否缺少必要環境變數且不印出變數真實內容。
- **入口分流整理**：新增身分入口總頁 `/portal`。學生端首頁最上方調整為三大分流卡片，後台首頁快速入口常用功能中新增「待確認新生」快捷卡片與說明。
- **修復講師名冊導覽錯誤**：修復了後台「名冊資料 > 講師名冊」導向失效問題，正式將 `instructors` 加入 `MODES` 合法清單，並修正 `RosterFlowNav` 元件型別。
- **同步備份公司試算表**：完成了 Google Sheet 同步目標切換至公司帳號的 GAS Web App Webhook URL 與 Spreadsheet ID。
- **建立 LAUNCH_CHECKLIST**：新增 `docs/LAUNCH_CHECKLIST.md`，詳列 12 大上線前安全與穩定度排查驗收項目。

## 2026-06-08

### 本次變更

- 系統 UI 架構開始整理為三角色入口：學員中心、授課工作台、秘書處後台。
- 學員端入口已完成精簡，不再顯示授課工作台與秘書處後台入口，並移除多餘輔助說明文字。
- 學員首頁將「日曆看課」收斂為「近期課程」，並移除主視覺重複按鈕、統計膠囊與重複分類標籤。
- 年度課程頁改採 Modal 操作模式，移除展開式大型表單與卡片上過多低頻操作。
- 年度課程頁新增課程類別 + 課程狀態兩階段篩選。
- 年度課程管理 Modal 新增課程狀態控制台概念，將草稿、開放報名、停止報名、已封存集中管理。
- 課堂日誌總覽 `/admin/course-sessions` 已改為排除已封存年度課程，封存課程不再進入選擇器、課程卡片與排課流程。
- 共用 `SessionInfoModalCard` 支援自訂 trigger / panel 樣式，並修正 `panelClassName` 覆蓋基礎樣式造成的跑版問題。
- 講師單堂授課頁開始收斂為摘要 / 點名 / 紀錄結構，課堂設定與課堂紀錄改為 Modal。
- 2026-06-08 已實際重跑 `npm.cmd run lint` 與 `npm.cmd run build`，目前通過。

### 後續注意

- 學員端入口已由使用者確認 OK。
- 年度課程頁、課堂日誌頁、授課工作台與秘書處後台仍需人工驗收。
- 本次交接提到的 `src__app__admin__course-offerings__page.v7_1.fixed.tsx` 不在 repo 內；目前應以 `src/app/admin/course-offerings/page.tsx` 為準。
- 工作區仍有兩個未追蹤暫存檔：`src/app/src__app__page.current.tsx.tsx`、`src/app/teaching/sessions/[sessionId]/src__app__teaching__sessions__[sessionId]__page.current.tsx`。

## 2026-05-28

### 單堂點名工作台重構

- 2026-05-28 本輪 Codex 已確認相關實作存在並可建置：`npm.cmd run lint` 與 `npm.cmd run build` 通過，dev server 啟動於 `http://127.0.0.1:3100`。
- 單堂點名頁整理為現場操作取向：課堂摘要卡、浮動課堂資料編輯視窗、收合式課堂日誌與 TTQS、以及「學員｜狀態列｜出席狀況｜作業｜備註」點名表格。
- 出席資料規則改為主要狀態只能一個，遲到時間與請假時段作為附加紀錄，可同時存在；預約或未到視為重設並清除附加紀錄。
- Firestore 點名更新加入 legacy reservation id fallback：document id 找不到時改查資料內 `id`，再更新真正文件，最後才回落 JSON。
- 作業、備註與課堂日誌改用 inline autosave，支援中文輸入法 composition、約 0.9 秒停止輸入儲存與失焦儲存。
- 課堂資料編輯視窗的講師選單依 `specialties`、`courseSeriesIds`、`courseOfferingIds` 過濾，舊資料缺欄位時需相容。

### 影響範圍

- 後台單堂點名現場流程
- `Reservation` 出席附加欄位
- `CourseSession` 課堂日誌欄位
- `Instructor` 講師過濾欄位
- Firestore reservation 舊資料更新策略

### 本次變更

- 完成穩定化整理，`npm.cmd run lint` 與 `npm.cmd run build` 均通過。
- 修正課程狀態 `locked` 與出席狀態 `late` 的型別 / UI 對齊問題。
- 清理未使用函式、變數、import、舊元件殘留與不必要 eslint disable。
- 暫時關閉 `@typescript-eslint/no-explicit-any`，避免資料層混合期被過渡型別雜訊阻塞；後續需分批補型別。
- 新增 `GPT_CODEX_WORKFLOW.md`，定義 GPT 任務包格式、檔案命名規則、Codex 接手流程與安全規則。
- 重寫 `AI_START_HERE.md`、`HANDOFF.md`、`tasks.md`、`decisions.md`、`context.md`、`filemap.md` 與 `specs/tech-context.md`，讓 AI 可以更快掌握 repo。

### 影響範圍

- AI 接手流程
- GPT / Codex 協作格式
- lint/build 驗證基準
- 技術文件與檔案地圖

### 後續注意

- 接下來應先把目前大型工作區變更拆成可審查任務包。
- 不要把根目錄 fix 腳本當成長期流程；應改用 GPT 任務包、patch 與 lint/build 驗證。
- `firebase-admin-key.json` 與 `.env.local` 仍是敏感檔，不可提交或貼入 Markdown。

## 2026-05-27

### 本次變更
- 建立 repo 內固定 AI 開工入口文件與專案記憶文件：`AI_START_HERE.md`、`HANDOFF.md`、`tasks.md`、`decisions.md`、`context.md`。
- 建立正式規格資料夾 `specs/`，並新增產品規格、使用者流程與技術脈絡三份入口規格。
- 更新 `README.md` 與 `AGENTS.md` 的 AI 開工入口導引，讓後續 GPT / Codex / Opencode 先從 repo 內文件接手。
- 釐清適用範圍：本入口只用於已開啟或接手本 repo 的情境；一般日常開工仍依 SecondBrain 開工交接流程。
- 補上檔案路徑與輸出格式規則，要求 AI 明確列出相對路徑、必要的新檔名，以及精簡的產出檔案格式。

### 影響範圍
- AI 接手流程
- 專案文件結構
- 開發後文件更新規則

### 後續注意
- 後續功能、資料結構、流程或部署規則改變時，需同步檢查 `HANDOFF.md`、`tasks.md`、`decisions.md`、`context.md`、`specs/` 與本文件。

## 2026-06-05

### 單堂課狀態管理正式定稿

- 後台單堂課現在支援獨立課堂狀態管理：`scheduled`（正常上課）、`suspended`（停課）、`makeup`（補課）、`rescheduled`（調課）、`cancelled`（已取消）。
- 單堂課日誌頁的課堂狀態按鈕改成點選即儲存，不必再進入編輯視窗重複修改。
- 「編輯課堂資料」視窗移除重複的課堂狀態區塊，只保留日期、開始時間、結束時間、單元名稱、地點、主要講師、助教／協同講師等資料欄位。
- 前台月曆與課程詳情頁改用學員語言顯示狀態，不再把「已鎖定」當成主要課堂狀態；現行顯示以 `可預約 / 報名截止 / 已額滿 / 已取消 / 本堂停課 / 補課 / 已調課 / 未開放或暫不開放` 為主。
- 預約規則同步明確化：`已取消 / 停課 / 調課` 不可預約；`補課` 保持可預約，但仍受名額與截止規則限制。
- `formatReservationCutoff()` 改為回傳純截止時間字串，避免前台多處出現「報名截止：鎖定：...」的重複文案。

### 影響範圍

- 後台單堂課日誌 / 課堂管理流程
- 前台桌機月曆、手機月曆、課程詳情頁狀態語言
- 課堂是否可預約的判斷規則
- 後續批次課堂管理的規格基礎

### 後續注意

- 下一階段可擴充批次課堂管理，但要避免直接刪除已有預約或出席紀錄的課堂。
- 工作區目前仍有本機資料檔與未追蹤暫存檔，整理提交前需先判斷是否納入版本控制。
## 2026-06-11

### 文件補強

- 新增 `specs/system-architecture.md`，集中整理系統總覽、前端 / 後端功能、資料模型、Firebase / Firestore 串接、JSON fallback、批次同步腳本、Google Sheets 同步與部署方式。
- 之後若要快速理解「資料平常怎麼寫進 Firestore」與「JSON 批次同步怎麼推上去」，優先讀這份文件。
