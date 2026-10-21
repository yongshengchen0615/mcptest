# Project #7 — 對話控制中心 v1

## 目的與安全界線

使用 GitHub 連接器在 `yongshengchen0615/test1111` 建立一張指令 Issue，再透過 GitHub Actions + 授權的 `PROJECTS_V2_TOKEN` 控制使用者自己的 Project #7。這條路線不需要在聊天中提供 Token。

**重要：目前 test1111 是公開 Repository。** 查詢私人看板內容在此環境只輸出筆數或項目 ID，不在公開 Actions 日誌輸出卡片標題、描述與欄位值；若需要完整查詢與 AI 分析，先將控制儲存庫改成 Private，再核對 Secret 權限與可見性。不要把敏感資訊放進公開指令 Issue。

### 架構

ChatGPT 對話 -> GitHub Connector -> 控制 Issue (JSON) -> GitHub Actions -> 嚴格驗證 -> GitHub CLI -> Project #7 -> 寫入後讀回 -> Actions 執行紀錄 -> ChatGPT 取得結果

現有 `project7-sync.yml` 保留，專門負責同步一般任務卡片。新的 `project7-command.yml` 僅處理控制指令，不會自行把控制 Issue 加入 Project。

## 指令 Issue 的格式

建議一張指令執行一次。每張控制 Issue 需由 `yongshengchen0615` 建立及編輯，且必須包含 marker 與**恰好一段 JSON code fence**。

````md
<!-- project7-control:v1 -->

```json
{"version":1,"op":"inspect"}
```
````

將 JSON 改成下列其中一個操作。通過 GitHub Actions 後，查看執行紀錄的 `PROJECT7_RESULT`；公開 Repository 不顯示私人看板的詳細內容。

## 已實作的指令

| op | 範例核心參數 | 操作 | 風險 |
|---|---|---|---|
| `inspect` | 無 | Project 欄位與卡片概況；公開環境僅回傳數量 | 低 |
| `get_item` | `issue_url` | 查詢某張已加入看板的 Issue Item | 低 |
| `add_item` | `issue_url` | 加入看板；已存在則不重複新增 | 低 |
| `set_field` | `issue_url`,`field`,`value` | 動態寫入有效的 Single-select、文字、數字、日期、Iteration（Iteration 需有 ID）並讀回 | 中 |
| `clear_field` | `issue_url`,`field` | 清除指定欄位並讀回 | 中 |
| `create_field` | `field`,`field_type`,`options`,`confirm` | 新增 TEXT / NUMBER / DATE / SINGLE_SELECT 欄位 | 高，預設停用 |
| `archive_item` | `issue_url`,`confirm` | 歸檔指定項目 | 高，預設停用 |
| `edit_project` | `title` 或 `description`,`confirm` | 修改 Project 標題／描述 | 高，預設停用 |

範例：將測試卡設為 Todo：

```json
{"version":1,"op":"set_field","issue_url":"https://github.com/yongshengchen0615/test1111/issues/1","field":"Status","value":"Todo"}
```

範例：新增 Priority 欄位（需額外安全核准）：

```json
{"version":1,"op":"create_field","field":"Priority","field_type":"SINGLE_SELECT","options":["Low","Medium","High"],"confirm":"CREATE_FIELD:Priority"}
```

## 強制限制

- 僅控制使用者 `yongshengchen0615` 的 Project #7；不能透過 JSON 改目標 Project。
- 僅接受來自 `test1111` 的 Issue URL；避免誤改會員系統或其他正式儲存庫。
- 程式透過 execFileSync 參數陣列執行固定 GitHub CLI 子命令，絕不執行傳入的 Shell、GraphQL、任意網路 URL。
- 類型、日期、選項皆依 GitHub 已有欄位校驗；未知欄位與選項均拒絕。
- 每次修改重新讀取 Project 比對；無法證實不能報成功。
- `create_field` 需 Repository Actions Variable `PROJECT7_ENABLE_SCHEMA=true`，`archive_item` 需 `PROJECT7_ENABLE_ARCHIVE=true`，`edit_project` 需 `PROJECT7_ENABLE_SETTINGS=true`，**預設三者全部關閉**。此處的 opt-in 是系統安全開關，不代表無需人工確認高風險命令。
- 大量刪除、刪整個 Project、刪欄位、改 Visibility、跨儲存庫轉入、複製/刪除 Views 沒有經此自動 Workflow 暴露。這些須獨立審核工作流程，不能因要求「全部」就授予無限制 API。
- 任何透過 Issues 文字觸發的寫入都是直接改 GitHub 真實 Project，請先對測試 Item 操作；大量變更先做 dry-run。
- 預設欄位選項以真實 Project 為準；Project #7 目前沒有 `Priority`，必須先經核准建立。

## 測試

```bash
node --test .github/scripts/project7-core.test.mjs .github/scripts/project7-control.test.mjs
```

PR 自動執行相同測試，完全不使用 Project Token；部署後再以 owner 建立 `inspect` 指令 Issue，讀回動作結果，最後用測試 Issue #1 執行一次 `set_field` Status=Todo，確認沒有新增重複 Item。

## 未完成的第二階段

- 遠端受保護 MCP（OAuth 或 per-user 登入、最小權限、完整讀取結果直接返回 ChatGPT）
- Views 建立/排序/修改/刪除（GitHub GraphQL 部分有對應 mutations；需驗證具體 schema 與權限）
- 独立安全的批次預覽/核准/執行/回滾佇列、操作紀錄和同步任務狀態
- 改進 draft issues 建立的冪等性與 Iteration 配置
- 跨 Repository / 多 Project 的明確 allowlist
- 使用者、團隊權限，依賴關係與 Roadmap 多來源資料整合

詳細 GitHub 官方 CLI 指令：https://cli.github.com/manual/gh_project

