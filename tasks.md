---
title: 工會課程預約系統｜Tasks
type: task-list
layer: project-memory
project: union-course-booking
category: tasks
tags:
  - tasks
  - project-memory
created: 2026-05-27
updated: 2026-06-05
status: active
summary: 目前任務、已完成事項、待確認事項與不處理範圍。
related:
  - AI_START_HERE.md
  - HANDOFF.md
  - GPT_CODEX_WORKFLOW.md
  - decisions.md
---

# Tasks

## 下一步

- [ ] 規劃批次課堂管理：依年度課程篩選課堂、勾選多堂、批次停課 / 已取消 / 改日期 / 重新排課。
- [ ] 將目前大型工作區變更分成可審查任務包：文件、資料、後台頁面、學生資格/名冊、清理腳本。
- [ ] 核對 9 筆 `needsReview` 名冊資料。
- [ ] 完成 Vercel GitHub integration 自動部署。
- [ ] 補正式驗收清單，涵蓋手機端學生預約、查詢、取消與後台名單操作。
- [ ] 觀察 Firestore 讀取用量是否因公開頁窄讀取而回落。
- [ ] 視用量決定是否加首頁快取、公開課程彙總資料或後台分頁查詢。
- [ ] 分批補資料層型別，未來再評估是否恢復 `@typescript-eslint/no-explicit-any`。

## 已完成

- [x] 2026-05-28 本輪 Codex 驗證單堂點名工作台實作，並確認 `npm.cmd run lint`、`npm.cmd run build` 通過。
- [x] 學生端課程列表與課程詳情。
- [x] 學生免登入預約流程。
- [x] 學生預約查詢與截止前取消。
- [x] 後台登入與管理入口。
- [x] 後台分類、課程、時段、名冊、預約名單、出席狀態與統計。
- [x] CSV / XLSX 匯出。
- [x] Firestore 資料來源與本機 JSON 備援。
- [x] 公開學生端改用窄讀取，降低 Firestore 讀取量。
- [x] 建立 AI 開工入口文件與 `specs/` 正式規格入口。
- [x] 2026-05-28 穩定化：`npm.cmd run lint` 與 `npm.cmd run build` 通過。
- [x] 2026-06-05 單堂課課堂狀態管理完成文件化，並核對前台月曆與課程詳情頁已改為學員語言狀態。
- [x] 建立 `GPT_CODEX_WORKFLOW.md`，讓 GPT 可以用固定格式交付 Codex 任務包。
- [x] 單堂點名頁版面優化為摘要卡、狀態列、出席狀況、作業與備註欄。
- [x] 遲到時間與請假時段改為出席附加紀錄，可在同一學生身上同時保留。
- [x] 作業、備註與課堂日誌新增自動儲存，不再依賴每格獨立儲存按鈕。
- [x] 講師選單依課程專業、課程系列或年度課程綁定過濾。
- [x] 單堂課課堂狀態支援 `正常上課 / 停課 / 補課 / 調課 / 已取消`。
- [x] 後台課堂狀態按鈕改為點選即儲存，編輯課堂資料視窗移除重複狀態區塊。
- [x] 前台狀態改用學員語言：`可預約 / 報名截止 / 已額滿 / 已取消 / 本堂停課 / 補課 / 已調課 / 未開放或暫不開放`。
- [x] 已取消、停課、調課不可預約；補課依名額與截止規則判斷是否可預約。

## 待確認

- [ ] 9 筆 `needsReview` 名冊資料的正確處理方式。
- [ ] 正式上線前是否需要首頁快取或公開課程彙總資料。
- [ ] 後台資料量增加後是否需要分頁查詢。
- [ ] Vercel 自動部署完成後的正式驗收流程。
- [ ] 根目錄的 fix 腳本是否保留、移到 `tools/`、或完成後刪除。
- [ ] `src/app/admin/sessions/[sessionId]/reservations/` 內仍有拼錯或匯出用暫存檔殘留，需在拆包時確認是否刪除。
- [ ] 批次課堂管理是否需要避開已有預約或出席紀錄的課堂，或改為只能做狀態型操作。

## 阻塞事項

- 目前沒有已知完全阻塞開發的事項。

## 不處理

- 不讀完整 secondbrain vault。
- 不把聊天紀錄貼進專案文件。
- 不提交 `.env.local`、`firebase-admin-key.json` 或真實個資。
- 不在 Google Drive 同步資料夾安裝 `node_modules`。
