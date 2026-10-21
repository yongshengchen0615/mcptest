# 預約系統 MVP — 模擬 PRD v1

> SIMULATION ONLY。此文件僅供 Project #7 工作流程演練，不描述已上線產品。

## 商業目標與界線
會員能查看可預約時段、進行一次有效預約、查看自己的預約。成功與否以資料庫交易結果為準。
不包含付款、簡訊、正式 Google OAuth/Calendar、管理員排班、正式服務發布。

## User stories 與驗收範例

| Story | 正向驗收 | 反向驗收 A | 反向驗收 B | 對應 Issue |
|---|---|---|---|---|
| US-01 登入 | 有效身分成功登入並返回會員頁 | 匿名送預約回 401 | 過期 Token 回 401 且可重新登入 | #10 |
| US-02 可預約時段 | 合法日期回傳未額滿、未逾期時段 | 無時段時回傳空陣列及空狀態 UI | 不合法日期回 400，不存在服務回 404 | #11 |
| US-03 建立預約 | 合法空位經 DB transaction 建立單筆預約 | 同一時段併發預約另一筆回 409 | 同一 Idempotency-Key 重送不重建資料 | #12 |
| US-04 查看預約 | 會員僅能取得本人預約清單 | 匿名回 401 | 跨會員查詢回 403 或不提供目標資料 | #13 |

## NFR
- 安全：Supabase RLS 僅開放必要範圍；service_role key 不得出現在 Browser／Git。
- 效能：模擬 p95 查詢目標低於 500ms（規劃值，尚未量測）。
- 響應式：375 / 768 / 1440 px。
- 可靠性：預約交易、冪等性與 unique constraint；API 失敗不可顯示假成功。
- 可觀測性：requestId、匿名化錯誤碼、避免記錄 Token 或個資。

## 需求追溯表
| 階段 | Issue | 預期測試 |
|---|---|---|
| 設計／API | #8 | 契約與錯誤碼查核 |
| Auth | #10 | 401/403、RLS negative |
| 查詢時段 | #11 | Empty/Boundary/timezone |
| 預約交易 | #12 | Concurrency/idempotency/rollback |
| 前端 | #13 | Playwright flow/mobile/offline |
| QA | #15, #16 | Unit/Integration/E2E/Security |
| Staging/Release | #19, #20 | Smoke/rollback simulation |

## 定義完成
文件至少列出正向及兩個反向案例、非功能性需求、範圍排除、工程與測試任務對應；不表示已完成產品實作。

## 模擬審查紀錄
- 2026-10-21：依既有 Epic #5 與任務 #6–#21 整理第一版。
- 需真正開發時：由產品負責人補上容量、營業時間、取消政策、SLA 等實際規則。
