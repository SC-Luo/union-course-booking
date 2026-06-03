---
title: 工會課程預約系統｜Product Spec
type: product-spec
layer: project-memory
project: union-course-booking
category: specs
tags:
  - product-spec
  - booking
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 第一版產品目標、預約規則、狀態值與暫不處理範圍。
related:
  - ../AI_START_HERE.md
  - ../decisions.md
  - user-flow.md
  - tech-context.md
---

# Product Spec

## 用途
`specs/product-spec.md` 是正式產品規格入口。若產品規則改變，需同步更新本文件，並視情況更新 `decisions.md`、`tasks.md` 與 `CHANGELOG_AI.md`。

## 第一版目標
- 學生不用登入。
- 學生用「姓名 + 手機末三碼」預約課程時段。
- 同一門課程，同一位學生只能預約一個時段。
- 課程前一天 18:00 後不能新增預約。
- 已額滿課程仍在學生端顯示，但標示「額滿」且不能預約。
- 工作人員使用共享後台帳號管理課程、分類、時段、名單、出席與統計。

## 學生身份判斷
- `student_name`
- `phone_last_three`

## 重複預約規則
同一學生如果已經有同一門課程的有效預約，不能再預約該課程其他時段。

判斷條件：
- 同一 `course_id`
- 同一 `student_name`
- 同一 `phone_last_three`
- 預約狀態為有效預約

## 預約截止規則
- 預設為課程時段日期前一天 18:00。
- 截止後不能新增預約。
- 未來可讓工作人員針對個別時段調整。

## 額滿規則
- 已額滿課程仍在學生端顯示。
- 已額滿時段或課程需標示「額滿」。
- 額滿後不能預約。

## 狀態值
出席狀態：
- `pending`
- `unchecked`
- `attended`
- `absent`
- `late`
- `leave`

預約狀態：
- `booked`
- `cancelled`

## 單堂點名規則
- 後台單堂點名頁的主要出席狀態同一時間只能有一個：預約、未到、已到、遲到、請假。
- 遲到時間與請假時段是出席附加紀錄，可以同時存在。
- 點「遲到」需記錄到課時間。
- 點「請假」需記錄請假開始與結束時間。
- 點「預約」或「未到」視為重設，需清除遲到時間與請假時段。
- 出席狀況欄只顯示附加紀錄，例如 `遲到 10:30`、`請假 12:00-14:30`；沒有附加紀錄時可留空。
- 作業、備註與課堂日誌採自動儲存，應支援中文輸入法。

## 講師選單規則
- 課堂資料編輯視窗的主要講師、助教／協同講師選單需依課程專業過濾。
- 講師 `specialties` 含課程專業關鍵字時可選，例如美容課程只顯示美容專業講師。
- 講師若已綁定該課程的 `courseSeriesIds` 或 `courseOfferingIds`，也視為可選。
- 沒有符合講師時，畫面需提示到名冊資料／講師名冊補齊講師專業項目。

## 第一版不做
- 學生登入
- 候補
- 通知
- 線上付款
- 列印簽到表
- 報名資格檢查
- 後台多人細權限
