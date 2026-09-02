# QA_PIL_001 — Internal Pilot 模組驗收

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | PIL |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 031 |
| Checkpoint | Internal Pilot |
| Dependencies | DEV_PIL_001 READY_FOR_QA, DEV_API_001 QA_PASSED, QA_DBM_001 QA_PASSED |
| Created／Updated | 2026-08-17／2026-08-20 |

## Objective

獨立驗證 Pilot RuntimeProfile、Temporary Session、allowlist/revoke、API Security、最小角色、CSV 邊界、Credential/Audit 與 Migration Boundary。

## Incoming Evidence

- DEV_PIL_001 targeted：46/46 pass；TypeScript、scoped ESLint、`build:local`、`git diff --check` 通過。
- QA_DBM_001 已以真實 PostgreSQL 完成第三次重驗並 `QA_PASSED`。
- 本票不得直接沿用開發組結論；上述內容只作為待獨立重驗的 incoming evidence。

## Acceptance Criteria

- [x] Pilot 禁止 demo auth、dev identity header 與 demo seed。
- [x] Secure／HttpOnly／SameSite Cookie、TTL、allowlist version revoke 通過。
- [x] Mutation 的 same-origin 與 JSON Content-Type boundary 通過。
- [x] Admin／Engineer Pilot matrix 與已批准 Decision Log 完全一致。
- [x] 每次 protected request 重新驗 active DB user、exact role mapping 與 Pilot site；變更後舊 session 立即 401。
- [x] Pilot site 是 repository 與 transaction 的強制 scope；已知跨站 ID 不可讀寫。
- [x] shared Customer（Pilot + 非 Pilot topology）不可由 Pilot rename、delete 或追加 topology；Pilot-only Customer 正常。
- [x] Safe export、full export gate、ZIP 固定五檔、ZIP import 拒絕通過。
- [x] Project／Zustand／Dexie／DOM／Audit／ZIP secret scan 通過。
- [x] 所有 protected API auth-first。
- [x] Real PostgreSQL Pilot scope 已以 integration fixture 驗證；Browser E2E 另屬 `QA_PIL_002`，本票未執行也未宣稱通過。

## QA Result — 2026-08-20

- 結果：`QA_FAILED`。
- 測試紀錄：`docs/dev測試紀錄/qa-pil-001-2026-08-20.md`。
- 新增 QA-only 測試：`tests/qa-pil-001-real-postgres.test.mjs`。
- Pilot 專屬矩陣結果：
  - Real PostgreSQL Pilot scope、shared Customer、Credential/Audit、role/site/disabled 變更與 cleanup：PASS。
  - Targeted Pilot/API/RBAC/DBM/Transfer suite：PASS，73/73。
  - TypeScript、scoped ESLint、`build:local`、artifact boundary、git diff check：PASS。
- Stop blocker：
  - Full test suite：`162 total / 160 pass / 2 fail / 0 skip`。
  - 失敗皆在 `tests/rbac-repository.integration.test.mjs`：
    1. `createTopology hides unknown, invisible customer and unassigned site scopes`：unassigned target site 回 `Permission denied`，預期 fail-closed hidden `Resource not found`。
    2. `credential reads are masked and writes are boss-only`：Sales 可讀 topology 時 credential write 回 `Resource not found`，預期 `Permission denied`。
- QA 未修改產品碼、OPS script、DB role/grant、migration 或 DEV 測試來配合通過。

## QA Re-test Result — 2026-08-20

- 結果：`QA_PASSED`。
- 測試紀錄：`docs/dev測試紀錄/qa-pil-001-2026-08-20.md` Re-test 段落。
- 原兩個 blocker 已重驗通過：
  1. unassigned target site `createTopology` 回 hidden `Resource not found` 類型錯誤。
  2. Sales 對可讀 topology credential write 回 `Permission denied`；不可讀／跨站仍 hidden `Resource not found`。
- Re-test 證據：
  - `tests/rbac-repository.integration.test.mjs` + `tests/rbac-precedence.integration.test.mjs`：PASS，9/9。
  - `tests/qa-pil-001-real-postgres.test.mjs`：PASS，1/1，Pilot site/shared Customer/credential/audit/TOCTOU/cleanup 未回歸。
  - Targeted Pilot/API/RBAC/DBM/Transfer/security matrix：PASS，82/82。
  - Serial full Node tests with `.env.local` DB env：PASS，164/164；未 skip real PostgreSQL integration。
  - TypeScript、scoped ESLint、`build:local`、artifact forbidden pattern scan、`git diff --check`：PASS。
  - `npm.cmd run lint` 仍因 Windows 缺 `bash` blocked，屬既有 npm script 環境問題；scoped ESLint 已通過。
- Browser critical flow：NOT RUN，另屬 `QA_PIL_002`；本票未啟動 browser/deploy。
- QA 未修改產品碼、DEV/RBAC tests、OPS script、DB role/grant、migration 或 `.env.local` 來配合通過。

## Independent QA Scope

- QA 可新增／修改本票 QA 測試、測試紀錄與 ticket 狀態；不得修改產品程式、OPS script、DB role/grant、migration 或 DEV 測試來配合通過。
- 真實 PostgreSQL fixture 必須可清理，並驗證 Pilot／非 Pilot site、Pilot-only／shared Customer、Admin／Engineer、停用／角色變更／站點撤銷。
- 所有 mutation 驗證零副作用；所有 error/leakage 檢查不得輸出 cookie、token、password、DSN、allowlist 或 credential 原文。
- `QA_PIL_002` 負責 Browser critical flow；本票不得用 source scan 取代它，也不得假稱 Browser E2E 已通過。
- Full export 預設 off；即使 flag=1 也必須同時為 Pilot admin 與 DB boss。Engineer 永遠不可使用。
- Synthetic Pilot 不得讀取或改動 Pilot site 外資料，也不得使用 production credential fixture。

## Stop Condition

任一 P0 fail、未批准產品語意或核心 real PostgreSQL integration skip，結果為 `QA_FAILED`；完整證據追加至測試紀錄，不覆寫既有歷史。Browser flow 另交 `QA_PIL_002`。
