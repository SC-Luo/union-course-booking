---
title: 工會課程預約系統｜AI Start Here
type: ai-entry
layer: project-memory
project: union-course-booking
category: handoff
tags:
  - ai-entry
  - codex
  - gpt-handoff
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 本 repo 的 AI 開工入口，定義讀取順序、GPT/Codex 分工、檔案交付格式與安全限制。
related:
  - HANDOFF.md
  - tasks.md
  - decisions.md
  - context.md
  - GPT_CODEX_WORKFLOW.md
  - filemap.md
  - specs/product-spec.md
  - specs/user-flow.md
  - specs/tech-context.md
---

# AI Start Here

## 一句話

這是「工會課程預約系統」：學生免登入用姓名與手機末三碼預約課程時段，工作人員用後台管理課程、名冊、預約、出席與統計。

## 先讀順序

已經開啟或接手本 repo 時，請依序讀：

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

不要一開始讀完整 `notes/`、`archive/`、secondbrain vault、完整聊天紀錄或大型備份資料。

## 目前健康狀態

截至 2026-05-28：

- `npm.cmd run lint` 通過，0 warning。
- `npm.cmd run build` 通過。
- 已清掉先前造成 build/lint 反覆失敗的型別與未使用程式碼殘留。
- `@typescript-eslint/no-explicit-any` 目前在 `eslint.config.mjs` 暫時關閉，因為資料層仍處於 Firestore / JSON / 舊資料格式混合期；未來要逐步補型別，不要一次硬開。

## 工作原則

- 先確認 `git status --short`，不要覆蓋使用者或其他 AI 已做的變更。
- 修改功能前先找現有模式，不要重寫整個頁面。
- 產品規則以 `specs/product-spec.md` 和 `decisions.md` 為準。
- 技術路徑、資料來源、Firestore 注意事項以 `specs/tech-context.md` 為準。
- 完成後至少跑：

```powershell
npm.cmd run lint
npm.cmd run build
```

## GPT / Codex 分工

GPT 適合做：

- 需求釐清
- 規格整理
- 任務拆解
- 驗收清單
- 產出給 Codex 的任務包

Codex 適合做：

- 實際讀 repo
- 套用檔案或 patch
- 修程式
- 跑 lint/build
- 更新 repo 內文件
- 回報檔案變更與風險

GPT 要交付給 Codex 時，請使用 `GPT_CODEX_WORKFLOW.md` 的「任務包格式」。

## 檔案交付規則

如果 GPT 要請使用者上傳或傳檔案給 Codex，必須明確列：

- 原始相對路徑
- 建議上傳檔名
- 是完整檔案、局部片段還是 patch
- 修改目的
- 需要 Codex 驗證的指令

不要只說「上傳 page.tsx」。要說：

```text
相對路徑：src/app/admin/students/page.tsx
建議檔名：src__app__admin__students__page.tsx.updated
用途：替換學生管理頁的資格狀態 UI
驗證：npm.cmd run lint && npm.cmd run build
```

## 禁止事項

- 不要讀取、貼上、提交 `.env.local`、`firebase-admin-key.json`、service account、token。
- 不要把真實名冊、預約個資或 Firebase 私密值寫入 Markdown。
- 不要把 `node_modules` 放進 Google Drive 同步資料夾。
- 不要把本 repo 的入口規則套用到所有日常工作。
- 不要把完整聊天紀錄貼進 `HANDOFF.md`。

## 開發後文件更新

完成任務後，檢查是否要更新：

- `HANDOFF.md`：目前狀態、下一步、風險改變時。
- `tasks.md`：任務完成、新增、阻塞時。
- `decisions.md`：新增產品或技術決策時。
- `context.md`：協作限制或背景改變時。
- `specs/`：產品規格、流程或技術架構改變時。
- `CHANGELOG_AI.md`：會影響後續 AI 接手、資料結構、部署或開發流程時。
