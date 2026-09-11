# QA_PIL_002 — Internal Pilot Browser Critical Flow 測試紀錄

- 日期：2026-08-20
- 測試組：QA
- 對應票：`QA_PIL_002`
- 結果：`QA_PASSED`（保留首輪 `QA_FAILED` 歷史）

## 測試範圍

依 `QA_PIL_002` 票面執行真實 Browser critical flow。測試使用 loopback Pilot preview server、QA-only PostgreSQL synthetic fixture、Playwright Chromium；未修改產品碼、migration、DB role、`.env.local` 或 Import／Export domain contract 來配合通過。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 驗證 Internal Pilot 可供 allowlisted Engineer 使用 synthetic data 完成 browser 工作流，同時不得暴露 Demo identity／dev header／production credential |
| Historical Sources | `REQUIREMENT-BASELINE.md`、`RULES.md`、`DECISION-LOG.md`、`DESIGN-DEVELOPMENT-MAP.md`、`DSG_PIL_001.md`、`DEV_PIL_001.md`、`QA_PIL_001.md`、`QA_PIL_002.md` |
| Approved Decisions | `PM_GOV_001-D20`、`PM_GOV_001-D21`、Internal Pilot 僅允許 pilot-session，Pilot profile 不得啟用 demo auth/dev identity/demo seed |
| Change Type | `CORRECT` + `VERIFY`；修正 Pilot session identity 顯示／reload restore，另補 QA-only browser assertion、selector scope 與 summary 落檔 |
| Affected Layers | `app/page.tsx` Pilot session UI boundary、QA browser flow、測試紀錄 |
| Preserved Invariants | 不改產品碼、不放寬 cookie、不使用 localStorage/sessionStorage 偽造身分、不輸出 cookie value/token/DSN/password/credential secret、fixture cleanup 必須為 0 |
| Conflict Check | `QA_PIL_001` 的 API/RBAC/DB scope 已通過；首輪 Browser UI 身分邊界不符合 Pilot 安全語意，修復後重驗通過 |
| Regression Map | RuntimePolicy、Pilot login、protected API unauth 401、cookie/security headers、workspace identity display、reload session restore、Import/Export、logout/tamper/revoke、fixture cleanup |
| Rollback／No-path | QA fixture 使用 `qa_pil_002_*` 前綴並在 finally cleanup；若重驗再次失敗保留第一個阻擋點並回 DEV/PM |

## 指令結果

| 指令 | 結果 |
|---|---|
| `npm.cmd run db:local:start` | PASS，PostgreSQL 已在 `127.0.0.1:5432` 啟動 |
| `npm.cmd run db:verify` | PASS，schema ready，required/current `0004` |
| `node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-002-browser-flow.mjs` | 首輪 FAIL；修復後 PASS |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS |
| `node_modules\.bin\eslint.cmd app\page.tsx tests\qa-pil-002-browser-flow.mjs` | PASS |
| `git diff --check -- app\page.tsx tests\qa-pil-002-browser-flow.mjs docs\engineerticket\active\QA_PIL_002.md docs\engineerticket\TICKET-REGISTER.md docs\dev測試紀錄\README.md docs\dev測試紀錄\qa-pil-002-browser-2026-08-20.md docs\dev測試紀錄\qa-pil-002-browser-summary.json` | PASS，僅 CRLF 提醒 |

## 已驗證項目

| 項目 | 結果 | 證據 |
|---|---|---|
| RuntimePolicy Pilot profile | PASS | `profile=pilot`、`authMode=pilot`、`demoAuth=false`、`devIdentityOverride=false`、`demoSeed=false`、`pilotAuth=true` |
| Build local artifact | PASS | QA script 內部執行 `scripts/build-local.mjs` 成功；僅既有 chunk size／route classification warning |
| Preview server | PASS | 啟動於 `http://127.0.0.1:4392/`，測試結束後關閉 |
| 未登入 protected API | PASS | `/api/topology?bad=%7B` 回 401，且 response 通過 safe text scan |
| Engineer Pilot login API | PASS | `/api/pilot/session` 回 200 |
| Cookie attributes | PASS | `__Host-nettopo-pilot-session`、`Path=/`、`Max-Age=21600`、`HttpOnly`、`Secure`、`SameSite=Strict` |
| Login response headers | PASS | `Cache-Control: no-store`、CSP、nosniff、Referrer-Policy、Permissions-Policy |
| Browser workspace identity | PASS | 修復後登入者卡片使用 Pilot-bound DB user，不再顯示 `本機 Demo`／`DEV-DEMO` |
| Engineer create synthetic Customer／Topology | PASS | POST `/api/topology` 200；Pilot site scope only |
| Credential／Audit policy | PASS | Engineer masked credential read 200；credential write 403；audit read 403 |
| TXT／MD／CSV preview | PASS | TXT preview cancel no DB write；MD preview shown；CSV apply 3 devices／2 links／1 group |
| Reload persistence | PASS | Reload 後 Pilot session restore 通過，CSV imported topology 與 QA Router persisted |
| Safe CSV ZIP | PASS | 固定五檔；secret scan pass；formula neutralized；safe IP redaction pass |
| Logout／tamper／allowlist revoke | PASS | 全部 protected topology request 回 401 |
| Full export gate | PASS | Pilot 預設 off；flag on 時 Admin enabled；Engineer disabled |
| Dexie / Project secret boundary | PASS | Dexie 不存在或未含 QA plaintext；DOM/ZIP safe scan pass |
| QA-only DB fixture cleanup | PASS | `sites=0`、`users=0`、`customers=0`、`topologies=0`、`credentials=0`、`audit_logs=0` |

## 第一個阻擋點

### P0-F1 — Pilot workspace 顯示 Demo identity

- 重現指令：`node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-002-browser-flow.mjs`
- 失敗訊息：`Pilot workspace must not display demo identity`
- 實際結果：Engineer 使用 Pilot allowlist 登入後，畫面已有 `INTERNAL PILOT · synthetic test data only · do not enter production credentials` banner，但右下登入者卡片仍顯示 `本機 Demo` 與 `DEV-DEMO`。
- 預期結果：Pilot workspace 應顯示 server-side Pilot session / DB user 綁定後的 Engineer 身分；不得顯示 Demo identity 或 dev identity selector。
- 風險：Browser 使用者會在 Pilot profile 看到 Demo 身分，違反 Internal Pilot 不暴露 Demo identity／dev auth 的安全邊界，也讓後續 Browser flow 無法證明「Engineer 與 Admin 分開登入驗證」。
- 證據截圖：`docs/dev測試紀錄/screenshots/qa-pil-002-engineer-login.png`
- 失敗摘要：`docs/dev測試紀錄/qa-pil-002-browser-summary.json`
- 修復：`app/page.tsx` 不再由 `LoginGate` 硬顯示 `DEMO_LOGIN_PROFILE`；登入者卡片改由 `TopologyApp` 使用 server dataset 的 `currentUser` 顯示。`LoginGate` reload restore 也改為先檢查 `/api/session`，再 fallback `/api/dev/session`，避免 Pilot cookie reload 後被誤判未登入。
- 重驗：`node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-002-browser-flow.mjs` 已 PASS。

## 修復後完成的 Required Flow

- 建立 synthetic Customer／Topology：PASS。
- TXT／MD／CSV drop preview、Cancel no-write、Apply：PASS。
- Canvas edit + reload persistence：PASS。
- Safe CSV ZIP 五檔與 secret/formula scan：PASS。
- Admin/Engineer full export gate：PASS。
- Logout 後舊 cookie protected API 失效：PASS。
- Tampered cookie 與 allowlist version revoke：PASS。

## QA 處置

`QA_PIL_002` 標記為 `QA_PASSED`。本票不啟動 `QA_IMP_001`、Release、checkpoint commit 或 deploy；Release gate 仍依 `PM_REL_001` 與後續 Import／Export Browser E2E 決策處理。

## 2026-08-24 Quick Re-test — Pilot Session Identity Display

- 測試原因：開發組修復 Pilot workspace 右下登入者卡片，不再以 Demo identity 顯示；QA 依 `[QA_PIL_002][QA_RETEST_REQUEST]` 做獨立快速重驗。
- 測試範圍：重跑 `tests\qa-pil-002-browser-flow.mjs`；重點確認 Pilot Engineer 登入與 reload 後不得顯示 `本機 Demo`／`DEV-DEMO`，並回歸 logout、tampered cookie、allowlist version revoke、fixture cleanup 與敏感輸出。
- 第一輪環境狀態：`node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-002-browser-flow.mjs` 在 build 後因 PostgreSQL 未啟動而停止，訊息為 `connect ECONNREFUSED 127.0.0.1:5432`；此為本機測試前置環境，尚未進入 browser 驗收。
- 環境處置：`npm.cmd run db:local:status` 顯示 PostgreSQL initialized but stopped；QA 執行既有 `npm.cmd run db:local:start`，未 fresh-init、未 reset、未修改 DB role/grant/migration/OPS script。

| 指令／檢查 | 結果 | 摘要 |
|---|---|---|
| `rg "DEMO_LOGIN_PROFILE|session-profile|restoreSession|/api/session|currentUser" app/page.tsx tests/qa-pil-002-browser-flow.mjs` | PASS | `app/page.tsx` 無 `DEMO_LOGIN_PROFILE`；`session-profile` 由 `ready && currentUser` 顯示 |
| `node --check tests\qa-pil-002-browser-flow.mjs` | PASS | QA browser script 語法通過 |
| `node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-002-browser-flow.mjs` | PASS | Browser flow、Pilot identity、Import/Export、logout/tamper/revoke、cleanup 全部通過 |

### Quick Re-test Evidence

| 項目 | 結果 |
|---|---|
| Strict Pilot profile | PASS：`profile=pilot`、`authMode=pilot`、demo/dev gates 關閉、full export 預設關閉 |
| Pilot Engineer identity display | PASS：登入與 reload 後 workspace 登入者卡片顯示 Pilot DB user；未顯示 `本機 Demo` 或 `DEV-DEMO` |
| Protected API unauth | PASS：未登入 `/api/topology` 回 401 |
| Logout old session | PASS：logout 後 `/api/topology` 回 401 |
| Tampered cookie | PASS：tampered session 對 `/api/topology` 回 401 |
| Allowlist version revoke | PASS：version 變更後舊 session 對 `/api/topology` 回 401 |
| Cookie attributes | PASS：只記錄 attributes，`__Host-nettopo-pilot-session`、`Path=/`、`Max-Age=21600`、`HttpOnly`、`Secure`、`SameSite=Strict` |
| Network headers | PASS：login、create customer/topology、CSV apply、logout 均有 `Cache-Control: no-store` 與 security headers |
| QA-only fixture cleanup | PASS：`sites=0`、`users=0`、`customers=0`、`topologies=0`、`credentials=0`、`audit_logs=0` |
| Sensitive output scan | PASS：測試輸出與 summary 未包含 active password、完整 DSN、cookie value 或 credential plaintext；僅 source/test log 中存在政策字樣或 CSV fixture 欄位名稱 |

### Quick Re-test Result

`QA_PIL_002` 維持 `QA_PASSED`。本次快速重驗未發現需要 DEV 再修的 blocker；不啟動 `QA_IMP_001`、Release、commit 或 deploy。
