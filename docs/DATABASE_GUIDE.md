# 資料庫管理與本地開發分流指南 (DATABASE_GUIDE)

本專案同時支援 **Cloud Firestore (生產/測試)** 與 **本地 JSON 備援開發** 雙模運作。

---

## 核心原則

1. **正式線上資料** 統一存放於 Google Cloud Firestore 正式專案。
2. **本地開發資料**：
   - 建議開發與測試時，亦使用 Firestore (可使用個人沙盒 / staging 專案)，以保證欄位一致。
   - 也可在本地 `.env.local` 將 `BOOKING_DATA_SOURCE` 設為 `json` 以使用本地備份 JSON 進行離線調試。
3. **資料流單向隔離**：
   - 本地 JSON 內容**絕對禁止**在日常開發、build、push、或 deploy 中自動上傳至正式環境資料庫。
   - 本地 JSON 初始化或覆寫正式 Firestore 是**一次性操作**，覆寫機制具有三層防護鎖，防止日後開發誤觸。

---

## 資料庫工具指令說明

本專案配置了三項安全輔助指令 (封裝於 `package.json` scripts)：

### 1. 比對本地與線上筆數 (`npm run firestore:compare`)
比對本地 `data/booking-data.json` 與線上 Firestore 各集合的資料筆數。**此操作為唯讀 (dry-run)，不需任何權限與字串，可隨時執行。**
```powershell
npm run firestore:compare
```

### 2. 備份 Firestore 快照 (`npm run firestore:backup`)
隨時抓取目前線上 Firestore 中的所有集合並下載儲存至本機 `firestore-backups/` 目錄。**此操作為唯讀，備份進程不會輸出任何敏感個資在 console 中。**
```powershell
npm run firestore:backup
```

### 3. 正式初始化覆寫 (`npm run firestore:init-from-local`)
用本地 `data/booking-data.json` 資料**覆寫且初始化**線上正式的 Firestore。
> [!CAUTION]
> **此指令為破壞性寫入，會清空正式資料庫中 categories, courses, sessions, reservations, students, enrollments 等所有主要集合！**

為防止誤用，此指令配置了三層安全確認與自動備份：
1. **多重參數校驗**：指令必須同時帶有 `--target production` 與 `--overwrite-from-local-json` 參數否則自動終止。
2. **三層確認字串**：使用者必須依次輸入：
   - 第一層：`IMPORT_TO_FIRESTORE`
   - 第二層：`OVERWRITE_PRODUCTION_FIRESTORE`
   - 第三層：`I_UNDERSTAND_THIS_WILL_REPLACE_PRODUCTION_DATA`
3. **強制備份**：寫入前會自動呼叫備份工具，先對目前 Firestore 做快照存檔至 `firestore-backups/` 下，若備份失敗則停止寫入。
4. **分批節流寫入**：寫入採每批 100 筆分批寫入，各批次間延遲 500ms 節流，防範寫入崩潰或配額暴增。
```powershell
npm run firestore:init-from-local
```

---

## 未來測試資料開發

若未來需要進行大型結構調整或灌入大量測試學員資料：
- **嚴禁將測試資料直接同步至 Production Firestore**。
- 建議設定獨立的 Firebase Staging 專案，於 `.env.local` 切換 `FIREBASE_PROJECT_ID` 進行連線測試。
- 或是設定 `BOOKING_DATA_SOURCE=json`，在本地備份 JSON 中玩耍，且不要提交該 JSON 檔。
