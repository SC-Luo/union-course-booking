# Firebase / Firestore 公司帳號轉移盤點報告

## 1. 目前 project 狀態
- **Firebase project ID**：`my-teaching-tools-1126-f8fc9`
- **是否為 Google Cloud project**：是 (所有 Firebase 專案本質上都是 Google Cloud 專案)。
- **是否屬於 Google Cloud Organization**：待確認 (目前尚未透過 Google Cloud Console / IAM / Resource Manager 直接確認)。
- **目前 Billing 狀態**：推測為 Spark / 未綁 Billing，但需由 Firebase Console 或 Google Cloud Billing 頁面確認。

## 2. IAM 權限盤點
| 帳號類型 | 角色 | 備註 |
|---|---|---|
| 個人帳號 | Owner (擁有者) | 目前 Firebase CLI 已登入某個個人 Gmail，建議改由使用者本人確認 |
| 公司帳號 | 待確認 | 疑似已存在，因先前 Google Sheet 同步有切換到公司帳號；但是否為 Google Workspace、是否可管理 Google Cloud、是否有 Billing account，仍需使用者確認 |
| service account | Firebase Admin | 存在 Firebase Admin 服務帳號 (用於 Vercel 與本機讀寫，實際 email 不寫入文件) |

## 3. Vercel 環境變數盤點
只列變數名稱，不列值：
- `BOOKING_DATA_SOURCE`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## 4. 本機環境檔盤點
只列變數名稱，不列值：
- `.env.local` 是否存在：是
- `firebase-admin-key.json` 是否存在：是
- Firebase 相關變數名稱：
  - `BOOKING_DATA_SOURCE`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

## 5. Firestore 資料狀態
只列 collection 名稱與筆數，不列文件內容：
*(資料筆數依 `tools/check-firestore-schema.mjs` 唯讀統計結果)*

| Collection | 筆數 | 備註 |
|---|---:|---|
| categories | 10 | 類別主檔 |
| courses | 5 | 課程主檔 |
| sessions | 41 | 單堂課/時段 |
| students | 6 | 學員基本資料 |
| reservations | 0 | 預約紀錄 (為空) |
| enrollments | 0 | 註冊/報名資格 (為空) |
| attendanceRecords | 0 | 出席點名紀錄 (為空) |

## 6. 建議路線
- **建議採用**：**路線 A** (不搬資料，僅授權公司帳號並移轉帳單/管理責任)
- **原因**：
  相較於新建 project 搬資料，路線 A 風險最低，且不需要立即更換 Vercel env 或 Firebase service account，完全不會影響目前進行中的 `firestore-diagnostics-preview` 分支驗收。
- **風險**：
  若後續個人帳號需完全退出，應提早做好權限轉移接管，避免專案失去 Owner 權限。
- **結論**：
  目前建議先採用路線 A：保留現有 Firebase project，不搬資料，不換 project id，只先把公司 Google 帳號加入 Firebase / Google Cloud IAM，授予 Owner 或必要管理權限。待公司帳號確認能進 Firebase Console、Firestore、Google Cloud Billing 後，再決定是否把個人帳號降權。
  
  目前不建議走路線 B 新建公司 Firebase project，因為這會牽涉 Firestore 匯出匯入、service account 重建、Vercel env 替換、本機 env 替換與 Preview/Production 驗證，會把現在的 Firestore 診斷工作複雜化。

## 7. 目前不要做的事
- 不要 push main
- 不要 merge PR
- 不要部署 Production
- 不要匯入正式資料
- 不要刪除個人帳號權限
- 不要輸出任何金鑰或個資

---

## 8. 下一步手動操作清單
請依循以下步驟手動設定權限轉移：

1. 用個人帳號登入 Firebase Console。
2. 到 Project settings > Users and permissions。
3. 新增公司 Google 帳號。
4. 先給 Owner 或 Firebase Admin + Billing 相關權限。
5. 公司帳號登入確認能看到 project、Firestore、用量與設定。
6. 不要刪除個人帳號。
7. 不要更換 service account。
8. 不要更換 Vercel env。
9. 不要部署 Production。
