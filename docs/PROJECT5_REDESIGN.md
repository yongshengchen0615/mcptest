# Project #5 — Projects V2 開發管理中心

目標：[Project #5](https://github.com/users/yongshengchen0615/projects/5/views/1)。採「增量重設計」：保留現有卡片、Status 欄位與原始 Views，不刪除、不重新命名、不變更既有欄位值。

## 新增欄位

| 欄位 | 類型 | 建議選項 / 用途 |
|---|---|---|
| Priority | Single select | P0 Critical / P1 High / P2 Normal / P3 Low |
| Work Type | Single select | Feature / Bug / Refactor / Security / Testing / DevOps / Documentation |
| Area | Single select | Frontend / Backend / API / Database / Infrastructure / UX / QA |
| Phase | Single select | Discovery / Planning / Development / Review / Testing / Release / Monitoring |
| Risk | Single select | Low / Medium / High / Blocked |
| Environment | Single select | Development / Staging / Production |
| Start Date | Date | 計畫開始 |
| Target Date | Date | 交付截止 |
| Estimate (days) | Number | 預估工期 |
| Release | Text | 目標版本 |

只建立 Project 中不存在的欄位。如同名欄位類型衝突，整個工作流程在寫入之前拒絕執行。同名欄位的舊 Single Select 選項保留原 ID 與選項，不覆寫。

## 新增 Views

- **01 | 開發看板** — Board：手動以現有 Status 分組，依 Priority 排序
- **02 | 工作清單** — Table：顯示 Priority、Work Type、Area、Phase、Target Date、Assignees
- **03 | Roadmap** — Roadmap：設定 Start Date 與 Target Date 為時間軸欄位
- **04 | QA 驗收** — Table：手動篩選 Phase=Testing、Release、Risk
- **05 | 風險追蹤** — Table：手動篩選 Risk=High 或 Blocked

GitHub GraphQL 建立 View 支援配置可見欄位，但現階段 API 無法保證完整實現所有 UI 的分組、排序、路線圖日期欄位設定。**新增 View 後請在網頁介面完成這些最後的設定並儲存視圖**。既有 view #1 完全保留。

## 工作流

Backlog → Ready → In Progress → Code Review → QA → Ready to Deploy → Monitoring → Done。GitHub 內建 Status 可能只有 Todo/In Progress/Done，本次不自動修改原有 Status 選項；細階段以 Phase 欄位表示，避免破壞既有卡片的分類值。

### 任務卡片定義

每張卡片包含：目標、範圍、驗收條件、測試案例、回滾方案、相依任務、負責人、Priority、Risk、Start Date、Target Date。

Definition of Ready：需求明確、驗收條件可測量、估時與依賴已完成。Definition of Done：功能測試、回歸測試、程式碼審查、CI 通過、部署驗證完成；需要時附回滾方案。

## 自動化安裝與驗證

控制儲存庫：[`mcptest`](https://github.com/yongshengchen0615/mcptest)。

- Read-only inventory：在此 repo 由 Owner 建立 Issue，內文包含 `<!-- project5-inventory:v1 -->`。工作流程只讀取 Project #5，公開 Actions 日誌不輸出私有 Project 詳細內容。
- Apply：由 Owner 在此 repo 建立 Issue，內文包含 **恰好一次** `<!-- project5-redesign:apply:v1 -->`。觸發 `Project 5 Non-destructive Redesign`。
- Actions Secret：`PROJECTS_V2_TOKEN`，必須具有可操作該個人 Project 的 classic PAT `project` scope。不要將 Token 寫入 Issue。
- 單元測試：`node --test .github/scripts/project5-plan.test.mjs`。
- 驗收：在 Actions 日誌找到 `PROJECT5_RESULT` 與 `verified:true`，再於 GitHub Project #5 檢查所有新增欄位／視圖。單靠 Issue 已建立不代表部署成功。

## 安全與限制

- 無刪除、歸檔、Visibility 變更、批次更新舊卡片、移除既有欄位的操作。
- 若專案屬於私人內容，公開 repo 的 Actions 日誌僅揭露欄位／視圖／卡片數量，不揭露名稱及卡片詳細資料。
- 具有修改權限的 token 仍然是高價值憑證，應縮小 GitHub Actions 可觸發權限並定期輪替。
- 再次執行不應產生同名欄位與同名視圖；遇上已有同名但不相容配置時拒絕改寫。
- 建立 View 與新增欄位不是原子交易；如果中途遇到 API 限制，可以修正後重跑，已建立的項目會跳過。
