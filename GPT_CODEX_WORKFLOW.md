---
title: 工會課程預約系統｜GPT/Codex 協作流程
type: ai-collaboration-contract
layer: project-memory
project: union-course-booking
category: workflow
tags:
  - gpt-handoff
  - codex
  - workflow
created: 2026-05-28
updated: 2026-05-28
status: active
summary: 定義 GPT 如何整理需求與檔案，Codex 如何接手、套用、驗證與回報。
related:
  - AI_START_HERE.md
  - HANDOFF.md
  - tasks.md
  - filemap.md
---

# GPT/Codex 協作流程

## 目的

讓 GPT 可以快速掌握本專案並產出可交給 Codex 的任務包；讓 Codex 不需要重新猜上下文，可以直接讀 repo、套用修改、跑驗證、更新文件。

## GPT 任務包格式

GPT 要交給 Codex 的內容請固定使用以下格式：

```markdown
# Codex 任務包｜工會課程預約系統

## 目標
一句話說明要修什麼、完成後使用者會看到什麼改變。

## 背景
- 這次需求從哪裡來。
- 是否牽涉產品規則、資料結構、Firestore、部署或 UI。
- 若只是文件整理，也要說明文件目的。

## 涉及檔案
| 相對路徑 | 動作 | 說明 |
|---|---|---|
| src/... | 修改 / 新增 / 刪除 | 為什麼需要動 |

## 產品規則
- 不能改的規則。
- 有疑義的規則。
- 需要同步到 specs 或 decisions 的規則。

## 交付內容
貼 patch、完整檔案內容，或列出附件檔名。

若是附件，請使用不易混淆的檔名：
- src__app__admin__students__page.tsx.updated
- src__lib__booking-repository.ts.patch
- specs__product-spec.md.updated

## 驗證方式
- npm.cmd run lint
- npm.cmd run build
- 需要人工點的頁面或流程

## 文件更新建議
- HANDOFF.md 是否要更新
- tasks.md 是否要更新
- decisions.md 是否要更新
- specs/ 是否要更新
- CHANGELOG_AI.md 是否要更新
```

## Codex 接手流程

Codex 接到 GPT 任務包後：

1. 讀 `AI_START_HERE.md`、`HANDOFF.md`、`tasks.md`、`decisions.md`。
2. 讀本文件與 `filemap.md`，確認檔案位置。
3. 執行 `git status --short`，確認工作區已有變更。
4. 若任務包包含完整檔案，先比對現有檔案，不直接覆蓋未知改動。
5. 若任務包包含 patch，優先套用 patch，失敗時人工整合。
6. 完成後執行 `npm.cmd run lint` 與 `npm.cmd run build`。
7. 依影響更新 `HANDOFF.md`、`tasks.md`、`decisions.md`、`specs/`、`CHANGELOG_AI.md`。
8. 回報修改檔案、驗證結果與剩餘風險。

## 檔案命名規則

GPT 或使用者傳檔案給 Codex 時，請不要用 `page.tsx`、`actions.ts` 這種容易撞名的檔名。

建議把相對路徑用雙底線串起來：

```text
src__app__admin__students__page.tsx.updated
src__app__admin__actions.ts.patch
src__lib__types.ts.updated
specs__tech-context.md.updated
```

Codex 套用時再放回原路徑。

## 常見任務分包

### 小修

適合一個任務包：

- 單一 build error
- 單一 UI 顯示錯誤
- 單一型別不一致
- 單一文件補充

驗證至少跑 lint/build。

### 功能修補

建議任務包包含：

- 產品規則
- 涉及路由
- 涉及資料欄位
- 驗收步驟
- 需要更新的文件

### 大型重構

不要一次交付整個 repo。拆成：

1. 型別與資料結構
2. Server Actions / repository
3. 頁面 UI
4. 文件與驗收

每包都要能獨立跑 lint/build。

## 安全規則

GPT 和 Codex 都不能要求使用者貼出：

- `.env.local`
- `firebase-admin-key.json`
- Firebase private key
- service account JSON
- token
- 真實名冊或預約個資

如果需要確認環境，只能確認「是否存在」或「變數名稱」，不要顯示實際值。

## 完成回報格式

Codex 完成後請用短格式：

```markdown
已完成。

修改重點：
- ...

驗證：
- npm.cmd run lint：通過
- npm.cmd run build：通過

需要注意：
- ...
```
