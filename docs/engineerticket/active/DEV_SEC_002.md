# DEV_SEC_002 — Import／Export Secret Boundary Hardening

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | SEC |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 049 |
| Checkpoint | Transfer Security Correction |
| Dependencies | DSG_IMP_002 approved；DEV_IMP_002／DEV_EXP_002 READY_FOR_QA |
| Created／Updated | 2026-08-26 |

## Objective

在 Import／Export contract 固定後，補齊 developer-side defense-in-depth 與 regression，證明 masked credential 只存在於短生命週期 Preview，任何 plaintext、ciphertext 或 session secret 不會跨越核准邊界。

## Minimum Scope

- 匯入 Apply 前再次 strip credential-like fields；masked credential 不進 Project／Zustand／Dexie project／PostgreSQL topology data。
- Export 前 defense-in-depth sanitize；Safe／Full 均不得輸出 raw username/password/secret、ciphertext、nonce、cookie/token/DSN。
- DOM／console／network／Audit／JSON／CSV／ZIP 的安全錯誤與 sentinel developer regression。
- 不把 QA 獨立 secret scan 改為 DEV 自證；完整 Browser／DB／Dexie acceptance 仍由 `QA_IMP_001` 同票 re-test 執行。

## Release Evidence

完成 allowed-surface sentinel tests、targeted regression、tsc、scoped lint、build:local；完成後只可標 `READY_FOR_QA`。

## Development Evidence — 2026-08-26

- `materializeImportBundle()` 在 Apply 前重新 canonicalize `plan.project`，即使 forged canApply plan 也會 strip credential-like device fields。
- 新增 `tests/dev-sec-002-secret-boundary.test.mjs`，覆蓋 JSON／CSV／ZIP raw secret sentinel、masked credential preview-only、forged plan Apply strip、legacy username/password masked preview。
- 驗證：targeted transfer/security tests PASS，41/41；`tsc --noEmit` PASS；scoped ESLint PASS；`build:local` PASS；full Node tests 178 pass／9 skip／2 fail（兩個 fail 為真 PostgreSQL QA fixture 缺 `DATABASE_URL`，非本票）。
