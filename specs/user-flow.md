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
updated: 2026-06-05
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
4. 學生輸入姓名與身分證後三碼完成預約。
5. 系統檢查同課程是否已有有效預約。
6. 預約成功後進入 `/booking/success`。
7. 學生可到 `/booking/search` 用姓名與身分證後三碼查詢自己的預約。
8. 學生可在截止前取消自己的預約。
9. 新生可進入 `/new-student` 填寫基本資料自填表單。
10. 新生自填完成後，跳轉至成功頁 `/new-student/success`。
11. 各身分人員可經由總入口 `/portal` 快速分流至對應的預約、查詢、新生自填、授課工作台或行政後台。

## 學生端顯示與週期預約限制規則
- **額滿課程仍顯示**，但不可預約。
- **截止後不可新增預約**。
- **特殊狀態課堂**：已取消、本堂停課、已調課的課堂仍可顯示，但不可預約。
- **補課課堂**：顯示為「補課」，若未額滿且未過截止時間仍可預約。
- **前台狀態採學員語言**：`可預約 / 報名截止 / 已額滿 / 已取消 / 本堂停課 / 補課 / 已調課 / 未開放或暫不開放`。
- **學生查詢隱私隔離**：學生查詢只能回傳符合完整姓名與身分證後三碼的本人資料，公開頁不暴露完整預約名單或名冊。
- **週期預約流程與狀態顯示細則**：
  1. **週期內單堂預約**：當學員已預約當週某一天（例如預約了 8/3 週一的課堂），則當週其他天課堂（如 8/2 週日、8/4 週二）會偵測到衝突，在前台詳情頁中會直接將「預約這堂」按鈕置灰，並顯示為 `「本週已預約 8/3」`，防止學員點選及重複送出。
  2. **跨週期預約**：當週（8/2 ~ 8/8 區間）預約滿額後，學員仍可以自由點入下一個週三（8/9 ~ 8/15 區間）的課堂詳情頁，系統會判斷這屬於下一個 `bookingCycleKey`，因此會正常將按鈕顯示為 `「預約這堂」` 供學員進行下週課堂的預約。
  3. **取消後重新預約**：學員若需要變更當週時段，必須先至 `/booking/search` 查詢本人的有效預約，並於截止時間前點擊「取消這筆預約」。取消後（status 變更為 `cancelled`），當週其他課堂的按鈕即恢復為綠色 `「可預約」`，此時可重新挑選當週其他時段。

## 後台流程
1. 工作人員進入 `/admin/login` 登入。
2. 登入後進入 `/admin` 查看後台首頁。
3. 工作人員可管理分類、課程、課程主檔、梯次、時段與報名鎖定。
4. 工作人員可管理學生名冊與核對資料。
5. 工作人員可查看單一時段預約名單。
6. 工作人員可取消預約、標記出席狀態、匯出 CSV / XLSX。
7. 工作人員可查看統計頁與每週報名資料。
8. 工作人員可至後台學員名冊中的「待確認」篩選核對並審核自填的新生資料。

## 後台單堂點名流程
1. 工作人員進入 `/admin/sessions/[sessionId]/reservations` 查看單堂點名工作台。
2. 頁面上方顯示課堂摘要，包含日期、時間、單元、地點、講師、助教、課堂狀態、點名狀態與 TTQS 狀態。
3. 課堂狀態可直接在摘要區點選 `正常上課 / 停課 / 補課 / 調課 / 已取消` 並即時儲存。
4. 點「編輯課堂資料」會開啟中央浮動視窗，可調整日期、時間、單元、地點、主要講師與助教／協同講師。
5. 編輯視窗不再重複放課堂狀態區塊。
6. 點名表格以「學員｜狀態列｜出席狀況｜作業｜備註」呈現。
7. 狀態列只提供預約、未到、已到、遲到、請假五個操作。
8. 點「遲到」選擇到課時間；點「請假」選擇請假起訖時間。
9. 出席狀況欄只顯示遲到時間與請假時段等附加紀錄。
10. 作業、備註與課堂日誌輸入後會自動儲存；中文輸入法 composition 未完成時不應觸發儲存。
11. 課堂日誌與 TTQS 區塊預設收合，展開後才顯示完整輸入區。

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
- `/portal`
- `/new-student`
- `/new-student/success`
