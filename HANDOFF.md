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
