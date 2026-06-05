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
updated: 2026-06-05
status: active
summary: 本 repo 的 AI 接手短摘要，記錄目前健康狀態、下一步與風險。
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
- 2026-06-05 已補齊單堂課課堂狀態管理與前台學員狀態顯示，並再次確認可由下一位 AI 直接接手。

## 最近處理

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

1. 規劃「批次課堂管理」：可依年度課程篩選課堂、勾選多堂後批次停課 / 已取消 / 改日期 / 重排課。
2. 核對 9 筆 `needsReview` 名冊資料。
3. 完成 Vercel GitHub integration 與部署驗收。
4. 補正式驗收清單，涵蓋手機端學生預約、查詢、取消與後台名單操作。
5. 視 Firestore 讀取用量決定是否加首頁快取、公開課程彙總資料或後台分頁查詢。

## 風險與注意

- 工作區仍有大量未提交變更與未追蹤檔案；接手前務必先看 `git status --short`。
- 目前 `data/booking-data.json` 有在地資料變更，另有一個未追蹤暫存檔 `src/app/admin/course-sessions/src__app__admin__course-sessions__page.tsx`；若要整理提交，先判斷是否屬於正式程式碼。
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
