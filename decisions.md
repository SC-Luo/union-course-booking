---
title: 工會課程預約系統｜決策紀錄
type: decision-log
layer: project-memory
project: union-course-booking
category: decisions
tags:
  - decisions
  - project-memory
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 已確認的產品、技術與 AI 協作決策。
related:
  - AI_START_HERE.md
  - HANDOFF.md
  - tasks.md
  - specs/product-spec.md
  - specs/tech-context.md
---

# Decisions

## 產品決策

### 第一版學生不用登入

學生以「姓名 + 手機末三碼」作為預約、查詢與取消的身分判斷依據。

### 同一門課同一學生只能預約一個時段

重複預約判斷條件為同一 `course_id`、`student_name`、`phone_last_three`，且已有有效預約時不得再預約同課程其他時段。

### 預約截止時間

預設為課程時段日期前一天 18:00 後不能新增預約。未來可讓工作人員針對個別時段調整。

### 額滿課程仍在學生端顯示

已額滿課程不能預約，但學生端仍需顯示並標示「額滿」。

### 後台第一版使用共享帳號

第一版不做多人細權限，工作人員使用共享後台帳號管理。

### 單堂點名出席狀態與附加紀錄

單堂點名頁的主要出席狀態同一時間只能有一個：預約、未到、已到、遲到、請假。

遲到時間與請假時段是附加紀錄，可以同時存在。例如主要狀態可為「遲到」，同時保留「請假 12:00-14:30」附加紀錄。點「預約」或「未到」視為重設，會清除遲到與請假附加紀錄。

### 講師選單依課程專業過濾

課堂資料編輯視窗中的主要講師、助教／協同講師選單，應依課程專業項目過濾。符合條件包含講師 `specialties` 含課程專業關鍵字，或講師已綁定該課程的 `courseSeriesIds` / `courseOfferingIds`。舊資料缺欄位時不得報錯。

## 技術決策

### 資料來源採 Firestore + JSON 備援

正式資料來源可由 `BOOKING_DATA_SOURCE=firestore` 控制。Firebase Admin 憑證缺失或 Firestore 讀寫失敗時，資料層回落使用本機 JSON，避免本機開發完全中斷。

### 公開學生端使用窄讀取

公開首頁與課程頁應優先使用 `getCourseCatalog()`，避免下載或查詢完整預約與名冊資料。

### 暫時關閉 no-explicit-any

`@typescript-eslint/no-explicit-any` 目前暫時關閉。原因是資料層仍同時承接 Firestore、JSON 備援與舊資料格式，若一次硬開會讓 lint 被大量過渡型別雜訊阻塞。

限制：

- 這不是永久決策。
- 新增共享資料結構時仍應優先補型別。
- 未來要分批收斂資料層型別後再評估恢復。

## AI 協作決策

### repo 內固定 AI 開工入口

已接手本 repo 時，AI 優先讀 `AI_START_HERE.md`、`HANDOFF.md`、`tasks.md`、`decisions.md`、`context.md`、`GPT_CODEX_WORKFLOW.md`、`filemap.md` 與 `specs/`。

一般日常開工、跨專案整理或尚未指定本專案時，仍依使用者的 SecondBrain 開工交接流程。

### GPT 任務包交付格式

GPT 要交給 Codex 的內容，應使用 `GPT_CODEX_WORKFLOW.md` 的任務包格式，明確列出目標、背景、涉及檔案、產品規則、交付內容、驗證方式與文件更新建議。

### 個資與密鑰不可提交

真實名冊、預約個資、Firebase 私密金鑰、service account、token、`.env.local` 與 `firebase-admin-key.json` 內容不可提交 GitHub，也不可寫入 Markdown。

## 待決策

- 是否在正式上線前建立公開課程彙總資料或快取。
- 後台是否需要針對大量預約與名冊改為分頁查詢。
- 個別時段自訂預約截止時間的管理方式與優先順序。
- 根目錄 fix 腳本的保留策略。
