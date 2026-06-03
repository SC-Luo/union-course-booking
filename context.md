---
title: 工會課程預約系統｜Context
type: project-context
layer: project-memory
project: union-course-booking
category: context
tags:
  - context
  - project-memory
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 專案背景、使用情境、協作限制與 AI 接手邊界。
related:
  - AI_START_HERE.md
  - HANDOFF.md
  - GPT_CODEX_WORKFLOW.md
  - specs/product-spec.md
  - specs/user-flow.md
---

# Context

## 專案背景

本專案是「工會課程預約系統」。目標是讓學生可以用手機快速預約工會課程時段，並讓工作人員在後台管理課程、分類、時段、名冊、預約、出席與統計。

## 主要使用者

- 學生：免登入，用姓名與手機末三碼預約、查詢、取消。
- 工會工作人員：用共享後台帳號管理課程、名冊、預約、出席與匯出。
- GPT：協助整理需求、規格、驗收與 Codex 任務包。
- Codex：讀 repo、修改程式、跑驗證、更新文件。

## 使用情境

- 學生用手機查看課程列表與課程詳情。
- 學生選擇未額滿、未截止的時段完成預約。
- 學生查詢自己的預約，並在截止前取消。
- 工作人員建立課程主檔、年度課程、課堂日誌。
- 工作人員管理名冊、預約名單、出席狀態、取消與匯出。

## 協作限制

- 學生端以手機使用為優先。
- 後台以桌機表格與快速操作為優先。
- 歷史資料要保留，但不要干擾學生端主要畫面。
- 第一版不做學生登入、候補、通知、線上付款、列印簽到表。
- 第一版後台先用共享帳號，不做多人細權限。
- 不要把完整聊天紀錄塞進專案文件。
- 不要把本專案文件混入 secondbrain 全域規則。
- 在本 repo 內工作時，不要預設讀取完整 secondbrain vault。

## AI 接手邊界

AI 只需要先讀 repo 內短入口文件。除非任務明確需要，不要讀：

- 完整 `notes/`
- 完整 `archive/`
- 完整 secondbrain vault
- 完整聊天紀錄
- Firestore 備份全量資料
- 真實金鑰或 `.env.local`

## 檔案安全

- `.env.local`、`firebase-admin-key.json`、service account、token 不可讀取內容、不可貼出、不可提交。
- 真實名冊與預約資料屬於個資，不可提交 GitHub。
- `data/booking-data.json` 是本機 JSON 備援資料，修改前要先理解是否含真實資料。

## 開發偏好

- 小步修改。
- 先跑 lint/build，避免只靠猜。
- 能用 patch 就不要整檔覆蓋。
- 任務完成後更新 `HANDOFF.md` 和 `tasks.md`。
- 若 GPT 提供檔案，先依 `GPT_CODEX_WORKFLOW.md` 判斷如何套用。
