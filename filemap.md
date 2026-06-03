---
title: 工會課程預約系統｜File Map
type: file-map
layer: project-memory
project: union-course-booking
category: reference
tags:
  - file-map
  - codex
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 給 GPT/Codex 快速定位檔案用的精簡地圖，不列完整 node_modules、建置產物或私密內容。
related:
  - AI_START_HERE.md
  - GPT_CODEX_WORKFLOW.md
  - specs/tech-context.md
---

# File Map

## 根目錄入口

| 檔案 | 用途 |
|---|---|
| `AI_START_HERE.md` | AI 開工入口 |
| `HANDOFF.md` | 目前狀態摘要 |
| `tasks.md` | 任務清單 |
| `decisions.md` | 已確認決策 |
| `context.md` | 專案背景與協作限制 |
| `GPT_CODEX_WORKFLOW.md` | GPT 任務包與 Codex 接手格式 |
| `CHANGELOG_AI.md` | 影響 AI 接手的重要變更 |
| `README.md` | 人類入口 |
| `AGENTS.md` | Codex / agent 指令 |

## 不要讀取或提交內容

| 路徑 | 說明 |
|---|---|
| `.env.local` | 環境變數與 Firebase 憑證，機敏 |
| `firebase-admin-key.json` | Firebase Admin SDK 金鑰，機敏 |
| `firestore-backups/` | Firestore 備份，可能含個資 |
| `.next/` | Next.js 建置產物 |
| `.vercel/` | Vercel 本機設定 |
| `node_modules/` | 依賴套件 |

以上路徑不應貼進 GPT、Markdown 或 GitHub。

## 學生端頁面

| 路徑 | 用途 |
|---|---|
| `src/app/page.tsx` | 課程列表首頁 |
| `src/app/courses/[courseId]/page.tsx` | 課程詳情與時段列表 |
| `src/app/courses/[courseId]/book/[sessionId]/page.tsx` | 預約表單 |
| `src/app/booking/success/page.tsx` | 預約成功 |
| `src/app/booking/search/page.tsx` | 查詢與取消預約 |
| `src/app/actions.ts` | 學生端 Server Actions |

## 後台頁面

| 路徑 | 用途 |
|---|---|
| `src/app/admin/page.tsx` | 後台首頁 |
| `src/app/admin/actions.ts` | 後台 Server Actions |
| `src/app/admin/login/page.tsx` | 後台登入 |
| `src/app/admin/course-categories/page.tsx` | 課程分類 |
| `src/app/admin/course-masters/page.tsx` | 課程主檔 |
| `src/app/admin/course-offerings/page.tsx` | 年度課程 |
| `src/app/admin/course-sessions/page.tsx` | 課堂日誌總覽 |
| `src/app/admin/courses/page.tsx` | 課程管理整合入口 |
| `src/app/admin/courses/[courseId]/page.tsx` | 單一課程工作區 |
| `src/app/admin/courses/[courseId]/sessions/page.tsx` | 單一課程課堂管理 |
| `src/app/admin/sessions/[sessionId]/reservations/page.tsx` | 單堂預約名單與點名 |
| `src/app/admin/students/page.tsx` | 學生、名冊、資格管理 |
| `src/app/admin/students/[studentId]/page.tsx` | 學生詳情 |
| `src/app/admin/stats/page.tsx` | 統計 |
| `src/app/admin/exports/` | 匯出 |

## 共用元件

| 路徑 | 用途 |
|---|---|
| `src/components/page-shell.tsx` | 學生端與後台頁面外殼 |
| `src/components/status-badge.tsx` | 狀態徽章 |
| `src/components/booking-form.tsx` | 預約表單 |
| `src/components/search-form.tsx` | 查詢表單 |
| `src/components/course-view-switcher.tsx` | 課程檢視切換 |
| `src/components/course-full-calendar.tsx` | 桌機課程月曆 |
| `src/components/mobile-course-calendar.tsx` | 手機課程月曆 |

## 資料層與型別

| 路徑 | 用途 |
|---|---|
| `src/lib/types.ts` | 共用型別 |
| `src/lib/booking-repository.ts` | Firestore / JSON 資料存取 |
| `src/lib/data-store.ts` | 本機 JSON 正規化與讀寫 |
| `src/lib/firebase-admin.ts` | Firebase Admin 初始化 |
| `src/lib/course-utils.ts` | 課程工具函式 |
| `src/lib/course-coding.ts` | 課程編碼與分類 |
| `src/lib/member-excel-importer.ts` | 會員 Excel 匯入 |
| `src/lib/sheet-export.ts` | CSV 匯出 |
| `src/lib/sheet-export-xlsx.ts` | XLSX 匯出 |

## 資料與工具

| 路徑 | 用途 |
|---|---|
| `data/booking-data.json` | 本機 JSON 備援資料，可能含真實資料 |
| `tools/sync-to-cloud.ps1` | 同步原始碼到雲端備份 |
| `tools/sync-from-cloud.ps1` | 從雲端備份同步回本機 |
| `tools/sync-firestore-from-booking-data.mjs` | 從 JSON 同步 Firestore |
| `tools/import-beauty-june.mjs` | 匯入指定名冊資料 |

## 規格文件

| 路徑 | 用途 |
|---|---|
| `specs/product-spec.md` | 產品規格 |
| `specs/user-flow.md` | 使用者流程 |
| `specs/tech-context.md` | 技術脈絡 |
