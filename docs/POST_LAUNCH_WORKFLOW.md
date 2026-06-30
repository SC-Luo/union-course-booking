# 正式上線後開發流程與資料庫保護機制 (POST_LAUNCH_WORKFLOW)

本文件定義系統正式上線後的日常開發流程、資料來源原則、安全操作鐵則、資料庫備份與 Schema Migration 升級規範，**所有開發團隊成員皆必須嚴格遵守。**

---

## 一、上線後資料來源原則

1. **正式站 Production**：
   - **資料來源**：正式 Cloud Firestore 專案 (`my-teaching-tools-1126-f8fc9`)。
   - **用途**：收集真實學員報名、真實預約流程與秘書處後台點名作業。
   - **限制**：**絕對不可被本地 JSON 覆蓋。**

2. **本地開發 Local**：
   - **用途**：修功能、改畫面、測試邏輯與 UI / UX 調優。
   - **限制**：**不應在日常開發中直接操作正式 Firestore。** 預設應使用本地去識別化的 JSON 備份檔，或連線至獨立的 Staging Firestore 專案。

3. **測試環境 Staging / Preview**：
   - **用途**：預覽部署、新功能整合測試與客戶對接展示。
   - **限制**：應連線至測試用 Firestore 專案（如：`union-course-booking-staging`），使用假姓名、假電話等去識別化資料。

---

## 二、上線後鐵則

1. **分支防護**：`main` 分支代表正式上線站，**絕對禁止**直接在 `main` 分支上進行未完成的功能開發或提交未驗證的代碼。
2. **單一資料來源**：正式 Firestore 是系統唯一正式資料來源。
3. **隔離上雲通道**：本地 JSON **絕對禁止**同步到正式 Firestore。
4. **禁止直連**：本地日常開發不應直接寫入正式 Firestore 專案。
5. **手動防誤觸**：所有對 Firestore 的覆蓋、匯入、清空等敏感工具，均**必須手動進行二/三層指令與字串確認**，絕對禁止包裝在 build、push 或 deploy 中自動執行。
6. **編譯驗證**：每次正式部署（Git Merge PR / Push）前，皆必須於本地執行並通過 `npm run lint` 與 `npm run build`。
7. **備份優先**：每次對資料庫進行結構變更或資料維護操作前，**皆必須先執行 backup 快照存檔**。
8. **個資防護**：真實學員姓名、手機、身分證字號、生日、地址與預約名單等個資，**絕對不可**進入 GitHub 代碼庫。

---

## 三、正確開發流程

修復功能或開發新需求時，請依循以下分支與 PR 流程：

1. **切出功能分支**：
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b feature/功能名稱
   npm.cmd run lint
   npm.cmd run build
   ```
2. **本地修功能與自測**：
   - 調整功能，並確認在 `npm run dev` 中運作正常。
3. **提交與推送分支**：
   ```powershell
   git status --short
   npm.cmd run lint
   npm.cmd run build
   git add .
   git commit -m "描述本次功能與修復點"
   git push origin feature/功能名稱
   ```
4. **發起 PR 與驗收**：
   - 在 GitHub 發起 Pull Request 將 `feature/功能名稱` 合併至 `main`。
   - 於 Vercel Preview Deploy 生成之預覽網址（連線至 Staging 測試庫）完成功能驗收。
   - 管理員審查 PR 後，合併至 `main` 以自動觸發 Vercel 生產部署上線。

---

## 四、本地環境設定與安全模式

日常開發時，本地 [`.env.local`](file:///C:/Users/User/codex-projects/union-course-booking/.env.local) 檔提供以下兩種開發設定：

### 安全模式 A：本地 JSON 開發 (推薦)
```text
BOOKING_DATA_SOURCE=json
```
- **用途**：改畫面、測流程、測去識別化假資料、離線開發。
- **限制**：不得將此模式下的本地 JSON 匯入 Production Firestore。

### 安全模式 B：連線測試 Firestore
```text
BOOKING_DATA_SOURCE=firestore
```
- **限制**：`FIREBASE_PROJECT_ID` 必須連到 **Staging 測試專案**，不應配置正式專案憑證。
- **風險警告**：**本地長期連線 Production Firestore 風險極高，任何日常開發的誤操作（如點名測試、測試預約）皆會直接寫入正式庫干擾運作，除非是緊急排查線上資料，否則不建議在日常開發中使用。**

---

## 五、正式資料庫操作指令規範

為了保證正式資料庫的安全，請區分以下工具指令的使用場景：

### 1. 安全診斷工具 (可日常使用)
- **統計對比** (`npm run firestore:compare`)：對比本地 JSON 與線上資料庫筆數。
- **手動備份** (`npm run firestore:backup`)：匯出當前 Firestore 資料至本機 `firestore-backups/` 快照。
- **資料總覽診斷** (`node tools/check-data-counts.mjs`)：於 CLI 快速印出實體總筆數（不暴露個資）。

### 2. 危險覆寫工具 (日常開發禁止使用)
- **正式初始化覆寫**：
  ```powershell
  npm run firestore:DANGER-OVERWRITE-PROD-DO-NOT-USE
  ```
  - **用途限制**：**只允許在正式上線初期的初始化，或面臨重大災難需要進行資料庫復原時使用。**
  - **日常警告**：日常開發中禁止執行此指令。
  - **安全防禦機制**：
    1. 必須帶有雙參數 `--target production` 與 `--overwrite-from-local-json`。
    2. 必須在終端依序輸入三層確認字串：
       - `IMPORT_TO_FIRESTORE`
       - `OVERWRITE_PRODUCTION_FIRESTORE`
       - `I_UNDERSTAND_THIS_WILL_REPLACE_PRODUCTION_DATA`
    3. 寫入前強制進行線上 Firestore 自動備份。若備份失敗則寫入自動終止。
    4. 寫入採每批 100 筆，並延遲 500ms 節流，防範配額衝高。

---

## 六、正式資料修改與 Migration 規則

正式上線後的資料修改，一律僅能來自於**學員前台預約、後台管理操作、或是經由嚴格審查的 Schema Migration 升級指令**，絕對禁止由本地 JSON 直接覆寫同步。

若未來因新需求需要調整 Firestore 的欄位或結構，請遵循以下 **Schema Migration 八大原則**：

1. **明確目的**：有明確的升級動機與欄位異動設計。
2. **向下相容**：程式讀取端必須設定 fallback 預設值，防範舊欄位缺失崩潰。
3. **有 dry-run 模式**：Migration Script 必須先具備只印出影響筆數而不寫入的比較功能。
4. **先執行備份**：執行前先呼叫快照備份工具。
5. **不輸出個資**：console 日誌中僅能顯示進度與筆數，不印出姓名與手機等隱私。
6. **不預設 overwrite**：新增欄位與漸進式更新為主，絕不隨便清空集合。
7. **三層手動確認**：必須在腳本中加入 CLI 確認字串防護。
8. **回報與驗收**：執行完畢後輸出精準的影響筆數日誌，並再次通過 `npm run lint` 與 `npm run build`。

*（註：未來若需進行 Schema 遷移，請新增獨立的獨立腳本放置於 `tools/migrations/` 下，不要直接改動 `sync-firestore-from-booking-data.mjs` 當成日常工具。）*
