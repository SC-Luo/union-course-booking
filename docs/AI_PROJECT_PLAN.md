# AI Project Plan

本文件用來讓後續 AI 接手時快速理解「已做什麼、沒做什麼、怎麼驗收、怎麼追溯」。不要把完整聊天紀錄、Firebase 私密金鑰、真實名冊或預約個資貼進本文件。

## 專案定位

- Production APP 顯示名稱：`課程管理系統`
- 組織名稱：`台南市美髮及美容美體業產業工會`
- 目前系統用途：課程建置、課程預約、名冊管理、出席點名、統計匯出。
- Production 部署：`main` 分支與 Vercel production。正式網址為 `https://union-course-booking.vercel.app`。

## 品牌資產

| 資產 | Repo 位置 | 原始來源 | SHA-256 |
|---|---|---|---|
| 完整 logo | `public/brand/union-logo-full.png` | `\\192.168.1.110\單位共用文件區\02_設計相關\00_LOGO&章\產工.png` | `7065C3F42C67556BDD74C1D2AAE36A443A4DDC3083406B682630B64D5E37E4A8` |
| 圖標 logo | `public/brand/union-logo-mark.png` | `\\192.168.1.110\單位共用文件區\02_設計相關\00_LOGO&章\產工LOGO.png` | `7F180B74A4D656C7E1DC435134FB7D19E9604900E2E389161C20DA7C746B25C6` |

品牌設定集中在 `src/lib/brand.ts`。後續 AI 要更改 APP 名稱、工會名稱、metadata、favicon 或 logo 路徑時，優先從這裡改，不要在頁面內分散硬寫。

## 2026-08-05 已完成

- 將全站 metadata title 從單純 `課程管理系統` 改為 `台南市美髮及美容美體業產業工會｜課程管理系統`。
- 將 metadata description 統一為 `課程建置、預約、名冊與出席管理系統`。
- 新增 `src/lib/brand.ts` 作為品牌單一來源。
- 新增 `public/brand/union-logo-full.png` 與 `public/brand/union-logo-mark.png`，並納入 Git。
- 學員端外殼 `StudentShell` 顯示 logo 與 `課程管理系統`。
- 後台外殼 `AdminShell` 桌機側欄與手機 header 顯示 logo 與 `課程管理系統`。
- 後台登入頁顯示完整 logo 與 `課程管理系統`。
- 更新本文件、`HANDOFF.md`、`CHANGELOG_AI.md`、`tasks.md`、`filemap.md` 與 `notes/踩坑過程.md`，讓事件可追溯。

## 2026-08-05 沒做

- 沒有改 Firestore schema、正式資料、名冊、預約資料或任何資料庫 migration。
- 沒有更改課程預約規則、截止規則、重複預約規則或登入權限規則。
- 沒有重設 Vercel 環境變數。
- 沒有把 `.env.local`、Firebase key、真實個資或備份資料納入 Git。
- 沒有把原本 `firestore-diagnostics-preview` 工作區中未提交的大量變更混入 production。

## Production 發布標準流程

1. 確認目前分支與工作區：
   ```powershell
   git status --short --branch
   ```
2. 若本機工作區有與本次無關的未提交變更，建立乾淨 worktree 或先和使用者確認，不要直接在髒工作區部署。
3. 對 production 最小改動時，以 `main` 最新狀態為基底。
4. 執行驗證：
   ```powershell
   npm.cmd run lint
   npm.cmd run build
   ```
5. commit 訊息要描述使用者可理解的變更。
6. 推送 `main` 或建立 PR 合併至 `main`。
7. 透過 Vercel 確認 production deployment ready。
8. 以正式網址驗證使用者可見結果，例如頁面 title、首頁畫面、後台登入頁。

## 追溯格式

重大事件請記錄在三個地方：

- `CHANGELOG_AI.md`：影響後續 AI 接手、產品方向、部署流程或技術架構的摘要。
- `HANDOFF.md`：最新狀態、最近處理、下一步、風險。
- `tasks.md`：完成項、待確認項、阻塞項。

可重複避免的錯誤請記錄在 `notes/踩坑過程.md`，格式固定為：

```text
日期：
現象：
判斷：
解法：
後續改進：
```

## 後續 AI 接手規則

- 先讀 `AI_START_HERE.md`，再讀 `HANDOFF.md`、`tasks.md` 與本文件。
- 修改品牌時，必須確認 `public/brand` 的資產有被 Git 追蹤。
- Production 部署前，必須用 `git diff --stat` 確認不會把 unrelated changes 一起部署。
- 如果發現某功能「之前做過但 production 沒有」，先查它是否只存在於未提交工作區或非 main 分支。
- 視覺變更必須用瀏覽器或 Playwright 實際打開頁面驗證，不可只依賴 build 成功。
