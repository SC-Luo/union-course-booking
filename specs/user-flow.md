---
title: 工會課程預約系統｜User Flow
type: user-flow
layer: project-memory
project: union-course-booking
category: specs
tags:
  - user-flow
  - booking
created: 2026-05-27
updated: 2026-05-28
status: active
summary: 學生端與後台主要流程、顯示規則與路由入口。
related:
  - ../AI_START_HERE.md
  - product-spec.md
  - tech-context.md
---

# User Flow

## 用途
`specs/user-flow.md` 是正式使用者流程入口。若學生或後台流程改變，需同步更新本文件。

## 學生端流程
1. 學生進入 `/` 查看課程列表。
2. 學生進入 `/courses/[courseId]` 查看課程詳情與可預約時段。
3. 若時段未額滿且未截止，學生進入 `/courses/[courseId]/book/[sessionId]`。
4. 學生輸入姓名與手機末三碼完成預約。
5. 系統檢查同課程是否已有有效預約。
6. 預約成功後進入 `/booking/success`。
7. 學生可到 `/booking/search` 用姓名與手機末三碼查詢自己的預約。
8. 學生可在截止前取消自己的預約。

## 學生端顯示規則
- 額滿課程仍顯示，但不可預約。
- 截止後不可新增預約。
- 學生查詢只能回傳符合完整姓名與手機末三碼的本人資料。
- 公開頁不應暴露完整預約名單或名冊資料。

## 後台流程
1. 工作人員進入 `/admin/login` 登入。
2. 登入後進入 `/admin` 查看後台首頁。
3. 工作人員可管理分類、課程、課程主檔、梯次、時段與報名鎖定。
4. 工作人員可管理學生名冊與核對資料。
5. 工作人員可查看單一時段預約名單。
6. 工作人員可取消預約、標記出席狀態、匯出 CSV / XLSX。
7. 工作人員可查看統計頁與每週報名資料。

## 後台單堂點名流程
1. 工作人員進入 `/admin/sessions/[sessionId]/reservations` 查看單堂點名工作台。
2. 頁面上方顯示課堂摘要，包含日期、時間、單元、地點、講師、助教、課堂狀態、點名狀態與 TTQS 狀態。
3. 點「編輯課堂資料」會開啟中央浮動視窗，可調整日期、時間、單元、地點、主要講師與助教／協同講師。
4. 點名表格以「學員｜狀態列｜出席狀況｜作業｜備註」呈現。
5. 狀態列只提供預約、未到、已到、遲到、請假五個操作。
6. 點「遲到」選擇到課時間；點「請假」選擇請假起訖時間。
7. 出席狀況欄只顯示遲到時間與請假時段等附加紀錄。
8. 作業、備註與課堂日誌輸入後會自動儲存；中文輸入法 composition 未完成時不應觸發儲存。
9. 課堂日誌與 TTQS 區塊預設收合，展開後才顯示完整輸入區。

## 主要路由
- `/`
- `/courses/[courseId]`
- `/courses/[courseId]/book/[sessionId]`
- `/booking/success`
- `/booking/search`
- `/admin/login`
- `/admin`
- `/admin/courses`
- `/admin/categories`
- `/admin/course-categories`
- `/admin/course-masters`
- `/admin/course-offerings`
- `/admin/course-sessions`
- `/admin/booking-locks`
- `/admin/full-classes`
- `/admin/weekly-bookings`
- `/admin/todos`
- `/admin/students`
- `/admin/sessions/[sessionId]/reservations`
- `/admin/stats`
- `/admin/exports`
