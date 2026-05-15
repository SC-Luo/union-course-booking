# AGENTS.md

## 專案摘要

這是「工會課程預約系統」的程式專案。

第一版目標：

- 學生不用登入
- 學生用「姓名 + 手機末三碼」預約課程時段
- 同一門課程，同一位學生只能預約一個時段
- 課程前一天 18:00 後不能新增預約
- 已額滿課程仍在學生端顯示，但標示「額滿」且不能預約
- 工作人員使用共享後台帳號管理課程、分類、時段、名單、出席與統計

## 重要上下文來源

產品規格以 Obsidian 筆記為準：

`H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\specs\工會課程預約系統.md`

開發踩坑與流程改進記錄：

`H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\notes\踩坑過程.md`

修改功能前，先確認該文件中的：

- 已確認規則
- 畫面規劃
- 第一版開發任務拆解
- 驗收清單

如果程式需求和產品規格衝突，先以產品規格為準，並回報需要同步調整哪一份文件。

如果開發中遇到可重複避免的問題，請把「現象、判斷、解法、後續改進」寫入踩坑記錄。

## 專案位置與環境

實際開發資料夾：

`C:\Users\User\codex-projects\union-course-booking`

雲端原始碼備份資料夾：

`H:\我的雲端硬碟\2026codex\union-course-booking-source`

不要把 `node_modules` 放在 Google Drive 同步資料夾。雲端同步資料夾大量寫入小檔案時容易失敗。

如果使用者希望雲端統一管理，優先採用「雲端保存規格與原始碼、不保存依賴」的策略，不要在同步資料夾內安裝 `node_modules`。

同步到雲端：

```bash
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-to-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

從雲端同步回本機：

```bash
powershell -ExecutionPolicy Bypass -File "C:\Users\User\codex-projects\union-course-booking\tools\sync-from-cloud.ps1" -CloudPath "H:\我的雲端硬碟\2026codex\union-course-booking-source"
```

開發網址：

`http://127.0.0.1:3100`

常用指令：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
npm run lint
npm run build
```

在 PowerShell 中如果 `npm` 被執行政策擋住，使用 `npm.cmd`。

## 目前技術狀態

目前是 Next.js MVP，使用本機 JSON 檔保存課程、時段與預約資料。學生端可以完成預約送出，後台與查詢頁會讀同一份資料。

目前資料位置：

- `data/booking-data.json`
- `src/lib/types.ts`
- `src/lib/course-utils.ts`
- `src/lib/data-store.ts`
- `src/app/actions.ts`

目前已建立主要頁面：

- `/`：學生端課程列表
- `/courses/[courseId]`：課程詳情
- `/courses/[courseId]/book/[sessionId]`：預約表單
- `/booking/success`：預約成功
- `/booking/search`：查詢預約
- `/admin/login`：後台登入
- `/admin`：後台首頁
- `/admin/courses`：課程管理
- `/admin/categories`：分類管理
- `/admin/courses/[courseId]/sessions`：時段管理
- `/admin/sessions/[sessionId]/reservations`：預約名單
- `/admin/stats`：統計頁

## 開發原則

- 優先完成可用流程，再做細節美化。
- 產品規則不要擅自改動；需要改時同步更新規格文件。
- 學生端以手機使用為優先。
- 後台以桌機表格與快速操作為優先。
- 歷史資料要保留，但不要干擾學生端主要畫面。
- 額滿課程不要從學生端消失，要顯示「額滿」。
- 第一版不做學生登入、候補、通知、線上付款、列印簽到表、報名資格檢查。
- 第一版後台先用共享帳號，不做多人細權限。

## 資料規則

學生身份判斷：

- `student_name`
- `phone_last_three`

重複預約規則：

- 同一 `course_id`
- 同一 `student_name`
- 同一 `phone_last_three`
- 已有有效預約時，不能再預約同課程其他時段

預約截止規則：

- 預設為課程時段日期前一天 18:00
- 未來可讓工作人員針對個別時段調整

出席狀態：

- `pending`
- `attended`
- `absent`

預約狀態：

- `booked`
- `cancelled`

## 建議下一步

下一個主要階段是把本機 JSON MVP 換成正式資料流程：

1. 建立資料庫方案
2. 建立資料表與 migration
3. 建立課程分類 CRUD
4. 建立課程 CRUD
5. 建立時段 CRUD
6. 將預約 server action 改接正式資料庫
7. 將查詢預約改接正式資料庫
8. 建立後台登入驗證
9. 建立 Excel 匯出

每完成一個階段，請執行：

```bash
npm run lint
npm run build
```
