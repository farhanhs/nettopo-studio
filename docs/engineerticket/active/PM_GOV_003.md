# PM_GOV_003 — Local Log Hygiene Root-cause Review

| 欄位 | 值 |
|---|---|
| Group | PM |
| Feature | GOV |
| Priority | P0 |
| Status | READY |
| Planned Order | 024 |
| Checkpoint | Governance |
| Dependencies | QA_DBM_001 second QA_FAILED |
| Created／Updated | 2026-08-20 |

## Objective

在 `QA_DBM_001` 因同一 local log hygiene 問題第二次返回後，先確認真正風險，再校正 acceptance，避免第三輪繼續以局部 log 清除掩蓋測試語意錯誤。

## Root Cause

- 第一層真問題：active Migration password 等於 tracked default。`OPS_SEC_001` 已輪替並清除 fallback。
- 第二次 QA：active secret、完整 DSN、舊 credential、tracked fallback 全部已通過。
- 剩餘 assertion 只要 log 出現 `CREATE/ALTER ROLE ... PASSWORD` 關鍵字就失敗，不檢查 operand 是否已遮蔽。
- PM 使用只輸出 count／boolean 的安全分類確認：3 個命中 operand 均為精確 `[REDACTED_TOKEN]`，沒有 active secret 或完整 DSN。

因此第二次失敗是 acceptance false positive，不是新的 credential leakage。

## Approved Decision

`PM_GOV_001-D19`：local log 採 value-based redaction gate。

## Correct Contract

- 必須失敗：
  - active runtime/migration password。
  - 完整 DSN。
  - 仍可登入的舊 credential。
  - role-password statement 中無法解析、未遮蔽或非核准 marker 的 operand。
- 可以保留：
  - 不含 secret 的時間、錯誤碼與操作骨架。
  - password operand 精確為 `[REDACTED_TOKEN]` 的 role-password statement。
- 禁止為了通過測試而刪除、截斷或改寫歷史 log。

## QA Handoff

測試組可修改 `tests/qa-dbm-001-real-postgres.test.mjs` 的 keyword-only assertion，改為逐一解析 role-password operand 並要求精確 marker。修改後須重跑整套 `QA_DBM_001`，保留前兩次失敗紀錄，只能在全矩陣通過後標 `QA_PASSED`。

## Done Condition

此治理決議已立即生效；待乾淨 checkpoint 後本票才可由 `READY` 改為 `DONE`。
