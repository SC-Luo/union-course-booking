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
