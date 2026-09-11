# DEV_SEC_001 — Credential 與 Transfer Secret Boundary

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | SEC |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 039 |
| Checkpoint | Transfer Security |
| Created／Updated | 2026-08-10／2026-08-25 |

## Objective

確保 plaintext username／password／secret 不進入 Project、Zustand、Dexie、DOM、Audit、一般匯出或 topology API payload；masked credential 僅作安全預覽／匯出。

## Traceability

- Approved：`PM_GOV_001-D04`、`D11`、`D12`、`D22`。
- Sources：CSV Bundle v2 handoff／acceptance、`DSG_SEC_001`、QA_PIL_002。
- Change：`CORRECT`；保留 server credential API，移除 Project／client persistence secret。

## Contract

- `Device`／`Project` 不含 credential 欄位；legacy input 在 state/persistence 前 strip + validate。
- local mode 收到 raw credential 必須明確拒絕，不得 silent save。
- server mode raw secret 只可送 credentials API；topology Project payload不得包含。
- `usernameMasked` 必須是遮蔽格式；`secretMasked` 固定 `********`。
- `credentials.masked.csv` 匯入只預覽，不呼叫 credential write API。
- JSON／CSV／ZIP export 前再次 defense-in-depth strip。

## Required QA Evidence

- 真 Dexie legacy record 清洗與回寫。
- 真 server network request 分流。
- Project／Zustand／Dexie／DOM／console／network／DB／Audit／ZIP sentinel scan。
- Engineer 無 masked-read 權限時，credentials file header-only 且 UI 顯示摘要。

## Stop Condition

任何 plaintext sentinel 命中即 P0 `QA_FAILED`，不得由 QA 修改產品碼通過。
