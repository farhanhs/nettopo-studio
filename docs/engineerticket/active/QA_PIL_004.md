# QA_PIL_004 — 新增拓樸站點資料與未指定站點 UAT

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | PIL |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 035 |
| Checkpoint | Functional UAT |
| Owner | 測試組 |
| Created | 2026-08-31 |
| Updated | 2026-09-04 |

## Objective

以 QC／QA-only synthetic database fixture 重驗新增拓樸流程，確保測試時能準備必要站點資料，並確認站點欄位空白時可安全顯示與保存為「未指定」，不再阻擋新增拓樸頁面。

## Approved Decisions

- `PM_GOV_001-D03/D04`：Internal Pilot 使用 synthetic data。
- `PM_GOV_001-D05`：Pilot Engineer 可建立 synthetic Customer／Topology。
- `PM_GOV_001-D11/D12/D13`：依追溯基線與架構邊界驗證。
- `PM_GOV_001-D25`：優先驗證工程師實務工作流。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | QC 測試時應先建立模擬資料庫資料；新增拓樸不應因站點下拉無選項而無法完成 |
| Historical Sources | `QA_PIL_003`、`QA_PIL_001/002` real DB fixture、`QA_IMP_001` Browser fixture、2026-08-31 使用者截圖 |
| Change Type | `EXTEND`：新增 UAT 覆蓋情境與 fixture，不改產品語意 |
| Affected Layers | QA fixture、Browser UAT、PostgreSQL cleanup、新增拓樸 modal |
| Preserved Invariants | synthetic-only；QA 不修改產品程式；Pilot site scope 不放寬；fixture cleanup=0 |
| Conflict Check | 若產品尚未修正空站點 fallback，本票應記錄 QA_FAILED 並指向 `DEV_PIL_002`，不得由 QA 繞過 UI |
| Regression Map | create customer/topology、empty sites、seeded sites、Pilot engineer scope、reload persistence、cleanup |
| Rollback／No-path | 測試資料以 prefix 建立並 finally cleanup；遇 blocker 停止並保留截圖與 network/DB evidence |

## Test Scope

### Fixture Setup

QC／QA 測試啟動前必須建立 synthetic fixture：

- Pilot site。
- Pilot engineer／admin users。
- `user_sites` binding。
- 至少一個 synthetic customer。
- 可選：一個有 site 的 baseline topology。

另需覆蓋空站點清單情境：

- Browser/local demo 或受控 test fixture 中 `availableSites=[]`。
- 新增拓樸 modal 必須仍能完成 submit。

### Browser Flow

1. 啟動 loopback app，不開放 LAN/Internet。
2. 使用 synthetic demo／Pilot identity 登入。
3. 開啟新增拓樸 modal。
4. 驗證有站點 fixture 時，下拉選單有可選站點。
5. 驗證空站點 fixture 時，欄位顯示「未指定」並可 submit。
6. 建立拓樸後 reload，確認 active topology 與顯示文字仍為「未指定站點」或正確站點。
7. 確認 Engineer 不可跨站建立不可見拓樸。
8. 清理 fixture，確認 sites/users/customers/topologies/credentials/audit_logs 殘留為 0。

## Out of Scope

- QA 不修改 `app/`、`db/`、`scripts/` 或 migration。
- 不測正式 OIDC。
- 不使用正式客戶資料或真實 credential。
- 不把空白站點行為擴張為 Pilot／production 權限放寬。

## Acceptance Criteria

- [x] QA fixture 會建立完整 synthetic site/user/customer/topology 前置資料。
- [x] 空站點清單時新增拓樸可完成，顯示為「未指定站點」。
- [x] 有站點清單時新增拓樸可選站點並正確保存。
- [x] Pilot site scope 與 Engineer 權限未退步。
- [x] Browser 截圖、network/API result、DB snapshot 均有證據。
- [x] finally cleanup 後 QA fixture 殘留計數為 0。

## Dependencies

- `DEV_PIL_002 READY_FOR_QA` for the product fix.
- `QA_PIL_003` evidence for original UAT context.

## Handoff

待 `DEV_PIL_002` 完成後，同票執行 Browser re-test。若仍被表單阻擋，標 `QA_FAILED` 並回 PM。

## QA Execution — 2026-09-04

Result：`QA_PASSED`

Evidence：

- `docs/dev測試紀錄/qa-pil-004-topology-site-2026-09-04.md`
- `docs/dev測試紀錄/qa-pil-004-topology-site-summary.json`
- `docs/dev測試紀錄/screenshots/qa-pil-004-local-empty-initial.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-unspecified-modal.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-created-unspecified-topology.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-device-persist-before-reload.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-reload-persisted-unspecified.png`

Commands：

- `node --check tests\qa-pil-004-topology-site-uat.mjs`：PASS
- `node --test tests\dev-pil-002-topology-site.test.mjs tests\pilot-checkpoint.test.mjs`：PASS，14/14
- `node tests\qa-pil-004-topology-site-uat.mjs`：PASS
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS
- `node_modules\.bin\eslint.cmd app\page.tsx app\lib\topology-store.ts tests\dev-pil-002-topology-site.test.mjs tests\qa-pil-004-topology-site-uat.mjs`：PASS
- `git diff --check`：PASS，僅既有 CRLF warning

Notes：

- Browser-local empty-site UAT uses an ephemeral Playwright context and validates IndexedDB snapshot; no persistent QA DB fixture is created in that local-mode flow.
- Pilot/PostgreSQL fixture evidence is taken from a supporting `QA_PIL_003` UAT rerun: the relevant site/user/customer/topology, Pilot scope, import/canvas/reload, and cleanup=0 checks completed before that supporting script stopped at an existing export modal close selector timeout. This selector issue is not a `DEV_PIL_002` regression.
