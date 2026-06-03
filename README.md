---
title: 工會課程預約系統｜README
type: project-index
layer: project-memory
project: union-course-booking
category: overview
tags:
  - project-index
  - union-course-booking
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 工會課程預約系統的人類入口與 AI 文件導覽。
related:
  - AI_START_HERE.md
  - GPT_CODEX_WORKFLOW.md
  - HANDOFF.md
  - tasks.md
---

# 工會課程預約系統

工會課程時段預約與出席管理系統。第一版目標是讓學生不用登入即可用「姓名 + 手機末三碼」預約課程時段，工作人員可在後台管理課程、分類、時段、預約名單、出席與統計。

## AI 開工入口

本專案的 AI 協作入口是 `AI_START_HERE.md`。GPT / Codex / Opencode 已經開啟或接手本 repo 時，請先依下列順序讀取 repo 內文件。

一般日常開工、跨專案整理或尚未指定本專案時，仍依使用者的 SecondBrain 開工交接流程為準；不要把本 repo 的入口規則套用到所有工作。

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

文件用途：
- `AI_START_HERE.md`：AI 每次開工入口。
- `HANDOFF.md`：目前狀態摘要。
- `tasks.md`：任務清單。
- `decisions.md`：已確認決策。
- `context.md`：專案背景。
- `GPT_CODEX_WORKFLOW.md`：GPT 任務包與 Codex 接手格式。
- `filemap.md`：快速檔案地圖。
- `specs/`：正式規格資料夾。
- `CHANGELOG_AI.md`：AI 協作造成的重要變更。

檔案提供與產出格式請以 `AI_START_HERE.md` 的「檔案路徑與輸出規格」為準。

注意：在本專案 repo 內工作時，`notes/` 是背景筆記，`archive/docs-legacy/` 是舊版文件；除非任務明確需要查舊資料，否則不要優先讀取。不要把完整聊天紀錄、Firebase 私密金鑰或 `.env.local` 內容寫入 Markdown 文件。

## 目前狀態

目前是 Next.js 預約系統，正式資料來源已可使用 Firebase / Firestore，並保留本機 JSON 作為開發與配額異常時的備援。

已建立功能：
- 學生端課程列表、課程詳情、預約表單與預約成功頁。
- 學生端依姓名與手機末三碼查詢預約，並可於截止前取消。
- 後台登入、首頁、分類、課程、時段、名冊、預約名單、出席狀態與統計。
- CSV / XLSX 匯出。
- Firestore 資料來源與本機 JSON 備援。

## Firebase 狀態

- Firebase 專案 ID：`my-teaching-tools-1126-f8fc9`。
- 專案已安裝 `firebase-admin`。
- 伺服器端透過 `src/lib/firebase-admin.ts` 初始化。
- Firestore 已有 `categories`、`courses`、`sessions`、`students`、`reservations` 集合。
- 資料來源由 `BOOKING_DATA_SOURCE=firestore` 控制。
- 若沒有 Firebase Admin 憑證或 Firestore 讀寫失敗，資料層會回落使用本機 JSON。
- 本機直接執行 `firebase` 指令可能不可用；需要 Firebase CLI 時優先使用 `npx.cmd -y firebase-tools@latest ...`。

啟用 Firestore 資料來源需要 `.env.local`，但不要把實際私密值寫入 Markdown 或提交 GitHub。

## 開發指令

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
npm run lint
npm run build
```

開發網址：

```text
http://127.0.0.1:3100
```

PowerShell 中如果 `npm` 被執行政策擋住，使用 `npm.cmd`。

## 雲端同步

本機資料夾負責開發與安裝依賴，雲端資料夾只保存原始碼備份，不同步 `node_modules`、`.next`、`.git`、`.env`。

同步到雲端：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-to-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

從雲端同步回本機：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-from-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

## 下一步

下一步請以 `tasks.md` 為準。目前主要方向是把大型工作區變更拆成可審查任務包、核對名冊資料、完成 Vercel GitHub integration、自動部署與正式驗收清單補齊。
