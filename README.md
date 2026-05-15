# 工會課程預約系統

工會課程時段預約與出席管理系統。第一版目標是讓學生不用登入即可用「姓名 + 手機末三碼」預約課程時段，工作人員可在後台管理課程、分類、時段、預約名單與統計。

## 目前狀態

目前是可本機試用的 MVP，使用 `data/booking-data.json` 保存課程、時段與預約資料。學生端可以送出預約，系統會更新名額，查詢頁與後台會讀取同一份資料。

AI Agent 開發規則請看：

- `AGENTS.md`

產品規格與規則來源：

- `H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\specs\工會課程預約系統.md`

開發踩坑與流程改進：

- `H:\我的雲端硬碟\secondbrain\10-專案\工會課程預約系統開發\notes\踩坑過程.md`

雲端原始碼備份：

- `H:\我的雲端硬碟\2026codex\union-course-booking-source`

已建立功能：

- 學生端課程列表
- 學生端課程詳情
- 學生端預約表單送出
- 學生端預約成功
- 學生端依姓名與手機末三碼查詢預約
- 後台登入
- 後台首頁
- 後台課程管理
- 後台分類管理
- 後台時段管理
- 後台預約名單
- 後台統計

## MVP 資料

目前資料存在：

```text
data/booking-data.json
```

這是第一版本機可用資料檔，方便快速驗證流程。正式上線前仍需替換成真正資料庫，並避免把真實個資提交到公開或共享 repo。

## Firebase 狀態

目前程式尚未連接 Firebase / Firestore。現有狀態是：

- 專案內已有 `.firebaserc`、`firebase.json`、`firestore.rules`。
- Firebase 專案 ID：`my-teaching-tools-1126-f8fc9`。
- 已用 `npx.cmd -y firebase-tools@latest deploy --only firestore:rules` 成功部署 Firestore rules。
- 這個 Next.js 程式專案尚未安裝 Firebase SDK。
- 程式目前沒有 Firebase 初始化檔，也沒有 Firestore 讀寫邏輯。
- 本機直接執行 `firebase` 指令不可用；依教學檔使用 `npx.cmd -y firebase-tools@latest ...`。
- Codex Firebase MCP 已寫入 `C:\Users\User\.codex\config.toml`，需要重啟 Codex Desktop 後才會載入工具。

下一階段若要改用 Firebase，建議使用 Firestore 保存 `categories`、`courses`、`sessions`、`reservations`，並用 server-side 寫入避免學生端直接看到完整名單。

程式資料來源由 `BOOKING_DATA_SOURCE` 控制：

- `json`：使用本機 `data/booking-data.json`，適合目前 MVP 測試。
- `firestore`：使用 Firestore，但需要先設定 Firebase Admin 憑證。

目前已把無個資的 `categories`、`courses`、`sessions` 種到 Firestore；`reservations` 尚未搬入 Firestore，避免在沒有後台登入與管理員憑證前處理真實個資。

## 開發指令

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

目前本機開發建議使用：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

開啟：

```text
http://127.0.0.1:3100
```

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

- 建立真正的新增、編輯、停用功能
- 建立後台登入驗證
- 建立 Excel 匯出
- 接正式資料庫
- 接 Firebase / Firestore，取代本機 JSON MVP
- 建立 Firebase Admin 憑證，將 `BOOKING_DATA_SOURCE` 切到 `firestore`
