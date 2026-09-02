# DEV_PIL_001 — Internal Pilot Profile、Temporary Session 與 OWASP 邊界收斂

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | PIL |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 030 |
| Checkpoint | Internal Pilot |
| Dependencies | DSG_PIL_001 DONE, DEV_API_001 QA_PASSED, QA_DBM_001 QA_PASSED |
| Created／Updated | 2026-08-20 |

## Objective

把工作樹中的 Pilot 候選實作收斂成可獨立驗收的 Internal Pilot 安全邊界：明確 profile、Temporary Session、allowlist + DB subject binding、auth-first protected API、Pilot role/site 限制與安全回應。

此票不追求 production identity；目標是在使用者指定的輕量內網 Pilot 範圍內，避免「知道 allowlist email 就取得錯誤 DB 權限」與 protected mutation 旁路。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 先在內網讓內部工程師快速測試，但保留 OWASP 最小硬邊界，避免為快而留下可延伸到 production 的漏洞 |
| Historical Sources | DSG_PIL_001 設計輸出、Pilot/OWASP 開發計畫、DEV_AUTH_001、DEV_API_001、QA_DBM_001、現有 pilot candidate/tests |
| Approved Decisions | `D03`、`D04`、`D05`、`D06`、`D07`、`D11`、`D12`、`D13`、`D20`、`D21` |
| Change Type | `CORRECT + EXTEND`：保留候選架構，補 DB subject binding、auth-first、safe error 與可執行測試 seam |
| Affected Layers | Runtime policy、Pilot session/identity/policy、protected API、repository Pilot context、Pilot UI、tests/docs |
| Preserved Invariants | Demo/dev gate 不進 Pilot；Runtime 不 migrate；Customer 正式 mutation Boss-only；synthetic-only；credential secret 不進 client state/export |
| Conflict Check | 候選 login 只驗 allowlist；pilotRole 未綁 DB role/site；Topology/Credential POST 目前 mutation check 早於 auth；full flag 未做 admin intersection |
| Regression Map | Development gate、Audit API auth-first、DBM、RBAC、credentials、transfer safe/full、headers、build/type/lint |
| Rollback／No-path | 若需 schema/migration/OIDC/正式 RBAC 才能完成，停下拆票；不得以放寬 Pilot 權限或關閉 Secure cookie 解決 |

## Contract A — Startup Policy

- `NETTOPO_RUNTIME_PROFILE=pilot` + `NETTOPO_AUTH_MODE=pilot` 才可啟用 Temporary Pilot Session。
- 必填：
  - `NETTOPO_PILOT_SESSION_SECRET`，至少 32 chars，不能是 tracked placeholder。
  - `NETTOPO_PILOT_USERS`，strict parse，email 唯一，role 僅 `admin|engineer`，version 必填且非空。
  - `NETTOPO_PILOT_SITE_ID`，必填且非空；不得默認到未確認 site。
- Pilot 啟動時 demo auth、dev identity header、demo seed 任一開啟必須 fail closed。
- allowlist 空值、格式錯誤、重複 email、未知 role、空 version 必須 fail startup validation，不能靜默丟棄。
- `NETTOPO_PILOT_ALLOW_FULL_EXPORT` 預設 0；flag 本身不能給 Engineer 完整匯出。

## Contract B — Temporary Session

### Login precedence

```text
runtime policy enabled
→ same-origin + application/json
→ body schema / normalized email
→ generic allowlist lookup
→ active DB user lookup
→ exact subject binding
→ issue cookie
```

Exact subject binding：

| Pilot role | 必須對應 DB role | Site |
|---|---|---|
| `admin` | `boss` | 必須明確 assigned Pilot site |
| `engineer` | `engineer` | 必須明確 assigned Pilot site |

- unknown email、inactive/missing DB user、role mismatch、missing site assignment 都回相同 generic `401 AUTHENTICATION_REQUIRED`，不發 cookie，不可枚舉差異。
- DB unavailable/schema not ready 回 typed safe `503`，不回 DB/SQL/stack。
- 成功 response 只回 email、pilotRole、TTL；session token 只進 cookie。
- Cookie：`__Host-`、Secure、HttpOnly、SameSite Strict、Path `/`、6h TTL。
- 每次 request 重驗 signature、exp、allowlist email/role/version；版本或角色改變立即撤銷。
- Logout same-origin JSON，清除同名 cookie；response no-store。
- handler 必須有 dependency seam，可證明失敗路徑不發 cookie且不碰非必要 repository。

## Contract C — Protected API / Effective Authorization

- Topology、Credentials 與其他 protected mutation 順序固定：

```text
requireRequestIdentity
→ assert same-origin/JSON
→ body/query validation
→ repository authorization/resource lookup
→ mutation/query
```

- unauthenticated + malformed/cross-origin request 以 `401` 優先，repository zero-call。
- Pilot role 不得提升 DB RBAC；subject binding 不相符時 session不能建立。
- Pilot Engineer：
  - 可在明確 Pilot site 建立 synthetic Customer + default topology（`D05`）。
  - 其他 topology 操作仍須 DB Engineer owner/creator + site 規則。
  - 不可 rename/delete/duplicate Customer。
  - Credential metadata/read/write 一律 deny，且不得回原始錯誤或 metadata。
  - Audit read deny。
- Pilot Admin：僅在 dedicated synthetic Pilot DB 使用，仍由 DB Boss repository policy 決定；不得把此語意帶到 production。
- Customer/Topology mutation 必須在 transaction 內重新載入 active user/resource/site，防 TOCTOU。
- Pilot createCustomer 必須強制 `synthetic=true`、site=`NETTOPO_PILOT_SITE_ID`；client 傳其他 site 必須拒絕，不能 fallback。

## Contract D — Full Export / UI

- Pilot banner 固定顯示：`INTERNAL PILOT — synthetic test data only. Do not enter production credentials.`
- Development identity selector/banner 在 Pilot 不顯示。
- Full export：
  - flag 缺失/0：所有 Pilot role disabled。
  - flag=1：只有 authenticated Pilot admin 且 DB user role=Boss 可使用；Engineer仍 disabled。
- Safe export、五檔 bundle、Import/Preview 細節不在本票改寫；只守 gate，不把 `DEV_IMP_001/DEV_EXP_001` 混入。

## Contract E — Safe Error / Headers

- 本票涉及的 API 所有 success/error response 都使用 no-store + security headers。
- typed status：401 unauthenticated/subject mismatch；403 authenticated forbidden；400 invalid request；404 hidden resource/feature disabled；503 DB/schema；500 unknown safe error。
- 禁止回傳 raw exception、stack、SQL、DSN、cookie/token、session secret、credential、checksum manifest、allowlist原始內容。
- unsupported topology action 也必須帶 no-store/security headers。
- Health/schema/runtime-capabilities 只回 safe summary且 no-store。

## Allowed Files

- `app/lib/server/runtime-policy.ts`
- `app/lib/server/pilot-session.ts`
- `app/lib/server/pilot-policy.ts`
- `app/lib/server/request-identity.ts`
- `app/lib/server/http-security.ts`
- `app/api/pilot/session/route.ts`
- `app/api/topology/route.ts`
- `app/api/credentials/route.ts`
- `app/api/session/route.ts`
- `app/api/runtime-capabilities/route.ts`
- `app/api/health/**/route.ts`（僅 safe headers/body）
- `db/topology-postgres.ts`（僅 Pilot subject lookup、createCustomer/site context、transaction revalidation hunk）
- `app/page.tsx`、`app/globals.css`（僅 Pilot login/banner/full-export gate）
- `tests/pilot-*.test.mjs`、`tests/request-identity.test.mjs`、`tests/runtime-policy.test.mjs` 及必要 Pilot handler tests
- `.env.example`、README 與本票開發紀錄（只用 placeholder）

## Forbidden / Stop Conditions

- 不新增 schema/migration/package dependency。
- 不實作 Entra/Keycloak/OIDC/MFA/account-management UI。
- 不重做完整 Customer/Topology RBAC、不改正式跨站語意。
- 不實作 reverse proxy/rate-limit/HTTPS/deployment；只在文件保留 `OPS_PIL_001` gate。
- 不把 Pilot allowlist 當成 DB role override。
- 不以移除 Secure/HttpOnly/SameSite 或允許 dev header 讓本機測試通過。
- 不修改 Import/Export domain contract、ZIP parser 或 credential persistence。
- 若需要 persistent session store、DB migration 或正式 user provisioning schema，改 `BLOCKED` 回 PM。

## Required Tests

### Behavior—not source order only

- runtime startup invalid matrix：demo/dev/seed、missing secret/site/users、invalid/duplicate allowlist。
- login handler：unknown/unprovisioned/disabled/role mismatch/site mismatch generic 401 + no cookie；DB unavailable 503；valid subject cookie attributes/body。
- session tamper/expiry/version/role revocation。
- auth-first protected mutations：unauth malformed/cross-origin → 401 + repository zero-call；authenticated cross-origin/content-type → safe 400/403。
- Engineer/Admin exact mapping與 Customer/Topology/Credential/Audit matrix。
- Pilot Engineer createCustomer 強制 Pilot site + synthetic，其他 site/body bypass拒絕；transaction revalidation。
- full export flag × Pilot role × DB role matrix。
- all affected responses headers/leakage scan。
- existing DEV_AUTH/API/DBM/RBAC/SEC/Transfer regressions、TypeScript、scoped ESLint、build:local。

## Handoff

完成後建立 `docs/dev開發紀錄/2026-08-20-dev-pil-001.md`，附 pass/fail/skip、候選碼保留/修正清單與未完成風險；狀態只能改 `READY_FOR_QA` 或 `BLOCKED`，停止交 PM，不自行啟動 QA/Browser/Deploy。

## Development Result

- 2026-08-20：DEV_PIL_001 完成 P0 收斂並進入 `READY_FOR_QA`。
- 保留既有 pilot profile／HMAC cookie／allowlist version revoke／banner 架構。
- 補強 startup strict：Pilot site、session secret、allowlist users 必填；allowlist invalid、duplicate email、unknown role、empty version fail closed；Pilot 禁 demo/dev header/demo seed。
- Pilot login 發 cookie 前新增 active DB user + DB role + explicit Pilot site binding：
  - Pilot admin 必須對應 DB `boss` 且 assigned Pilot site。
  - Pilot engineer 必須對應 DB `engineer` 且 assigned Pilot site。
  - unknown／missing／disabled／role mismatch／site mismatch 都回 generic 401，不發 cookie。
- Protected mutation 已調整為 identity/auth first → same-origin/JSON → validation → repository。
- Pilot Engineer synthetic Customer 例外收斂為 DB engineer + Pilot site + synthetic context；不放寬正式 Customer mutation。
- Pilot full export flag 仍預設 off；flag=1 時 UI 仍要求 current DB user role 為 `boss`，Engineer disabled。
- `app/api/pilot/session/route.ts` 新增可執行 handler seam 與 typed safe error mapping。

## Verification Evidence

- `node --test tests\pilot-session-handler.test.mjs tests\pilot-checkpoint.test.mjs tests\pilot-internal-boundary.test.mjs tests\runtime-policy.test.mjs tests\request-identity.test.mjs tests\api-auth-order.test.mjs`：PASS，31/31。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- Scoped ESLint：PASS。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- `node --test tests\*.test.mjs`：BLOCKED by environment，155/156 pass-equivalent with 1 fail from `QA_DBM_001 real PostgreSQL...` requiring `DATABASE_URL` in current shell；DEV_PIL_001 targeted tests pass。
- `npm.cmd run lint`：BLOCKED，Windows 環境找不到 `bash`；本票 scoped ESLint pass。
- `git diff --check`：PASS，僅 CRLF 提醒。

## Remaining Risk

- 本票未啟動 QA／Browser／Deploy，依 PM 指示停在 `READY_FOR_QA`。
- `QA_PIL_001` 仍需獨立驗證 Pilot 模組完整矩陣。
- `QA_PIL_002` 仍需在可運行 Pilot 環境執行 Browser critical flow。
- Full Node tests 在目前 shell 缺 `DATABASE_URL` 時會觸發 QA_DBM_001 真 DB 測試失敗；QA_DBM_001 據 PM 回報已於具備 DB env 的測試組環境 `QA_PASSED`。

## PM Scope Check Return

- 2026-08-20：PM 範圍檢查退回補強，DEV_PIL_001 改回 `IN_PROGRESS`。
- P0 缺口：
  - Pilot binding 不可只在 login 成立；protected API 每次 request 必須重新驗 active DB user、role mapping 與 Pilot site。
  - Pilot site 必須是強制 scope；Boss/Pilot admin 也不可讀 Pilot site 外資料。
  - topology／credentials／session fallback error 不得回 raw Error.message。

## PM Scope Check Fix Result

- 2026-08-20：PM 退回 P0 契約缺口已完成補強，DEV_PIL_001 回到 `READY_FOR_QA`。
- 新增集中式 async helper `requirePilotBoundRequestIdentity()`：
  - 非 pilot identity 直接沿用既有 dev-session 行為，不載入 DB subject。
  - pilot-session 每次 protected request 都重新載入 active DB user。
  - 重新驗證 pilot role ↔ DB role mapping 與 explicit Pilot site。
  - missing／disabled／role changed／site revoked 統一 401 `AUTHENTICATION_REQUIRED`。
- `/api/session`、`/api/topology` GET/POST、`/api/credentials` GET/POST、`/api/audit-logs` 已改用 bound helper，業務 query/body parsing 前先驗證 Pilot DB subject。
- Repository Pilot site 強制 scope：
  - `readTopologyDataset(..., "pilot-session")` 只回 Pilot site、該站 Customer／Topology。
  - createCustomer/createTopology/save/rename/duplicate/delete 於 repository 層檢查 Pilot site，跨站 ID fail closed。
  - credential read/write/delete 只允許 Pilot site resource。
  - audit read 於 Pilot context 只回 `site_id = NETTOPO_PILOT_SITE_ID`。
- topology／credentials／session fallback error 改為 typed/generic safe response，不回 raw exception/input。
- 新增 `tests/pilot-request-boundary.test.mjs`，驗證 login 後 DB role/site/active 狀態改動時下一個 protected request 401，且 business repository 0 call。

## PM Scope Check Verification Evidence

- `node --test tests\pilot-request-boundary.test.mjs tests\pilot-session-handler.test.mjs tests\pilot-checkpoint.test.mjs tests\pilot-internal-boundary.test.mjs tests\runtime-policy.test.mjs tests\request-identity.test.mjs tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs`：PASS，43/43。

## PM Second Scope Check Return

- 2026-08-20：PM 第二次 P0 scope check 退回補強，DEV_PIL_001 改回 `IN_PROGRESS`。
- P0 缺口：
  - Customer row 為 global；Pilot context 的 rename/delete/createTopology 不得只驗 exists(pilot topology)，必須禁止 shared customer 影響 non-Pilot site。
  - Repository transaction 內必須重新驗 server-side Pilot principal ↔ active DB role/site binding，避免 route auth 與 transaction 間 TOCTOU。

## PM Second Scope Check Fix Result

- 2026-08-20：第二次 P0 契約缺口已完成補強，DEV_PIL_001 回到 `READY_FOR_QA`。
- Pilot global Customer 副作用收斂：
  - 新增 `customerIsPilotOnly()`／`assertPilotOnlyCustomer()`，Pilot context 必須同時符合 `exists(pilot topology)` 與 `not exists(non-pilot topology)`。
  - Pilot `renameCustomer`／`deleteCustomer` 只允許 Pilot-only synthetic Customer；shared Customer 對外 fail closed 404。
  - Pilot `createTopology` 只允許掛到 Pilot-only Customer，不允許把 Pilot topology 掛到既有跨站 Customer。
  - Pilot `duplicateCustomer` 僅複製 Pilot site subset，產出的新 Customer 後續仍受 Pilot-only mutation guard 保護。
- Transaction TOCTOU 收斂：
  - `RepositoryContext` 增加 server-side `pilotPrincipal`，由 route 從 `identity.pilot` 傳入，不接受 client body role/site/principal。
  - `readTopologyDataset`、topology actions、credentials、audit 都傳遞完整 Pilot context。
  - 所有 Pilot read/write 入口與 mutation transaction 內，active DB user 載入後重新執行 `assertPilotRepositorySubject()`。
  - role changed、site revoked、disabled/missing 等 mismatch 於 repository 層 fail closed 為 `Authentication required.`，route 映 generic 401，mutation zero side effect。
- 新增 `tests/pilot-repository-scope.test.mjs`，以可執行 seam 驗證 transaction 寫入前重新驗 DB binding 與 Pilot-only Customer scope。

## PM Second Scope Check Verification Evidence

- `node --test tests\pilot-request-boundary.test.mjs tests\pilot-session-handler.test.mjs tests\pilot-checkpoint.test.mjs tests\pilot-internal-boundary.test.mjs tests\pilot-repository-scope.test.mjs tests\runtime-policy.test.mjs tests\request-identity.test.mjs tests\api-auth-order.test.mjs tests\audit-api-handler.test.mjs`：PASS，46/46。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- Scoped ESLint：PASS，0 errors。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- `node --test tests\*.test.mjs`：目前 shell 缺 `DATABASE_URL`，僅 `QA_DBM_001 real PostgreSQL...` 失敗；161 total／153 pass／7 skip／1 DB env fail。
- `git diff --check`：PASS，僅 CRLF 提醒。

## QA_PIL_001 Return — Minimal RBAC Semantic Fix

- 2026-08-20：QA_PIL_001 退回，DEV_PIL_001 同票修復兩個 full-suite RBAC repository regression，完成後回到 `READY_FOR_QA`。
- 修復 `createTopology` hidden-resource precedence：
  - non-Pilot／Pilot 都先驗 target site/customer 存在與 caller 對 customer+site scope 的可見性。
  - missing customer、invisible customer、unassigned/invisible site 均 fail closed `Resource not found.`。
  - create permission 判斷延後到 scope 可見性之後；transaction 內同樣先 re-check active user/resource/scope，再判斷 create permission。
  - Pilot principal mismatch 仍優先 generic 401；Boss-only Customer mutation、Pilot-only Customer、Pilot site 與 Engineer owner/site 規則不放寬。
- 修復 Credential read-vs-write 語意：
  - topology missing、caller 不可讀、Pilot 跨站仍為 `Resource not found.`。
  - topology 可讀但 caller 不可寫 topology 或缺 `credential.write` 時回 `Permission denied.`。
  - transaction 內同樣先 re-check readable，再判斷 writable/permission。
  - Pilot Engineer route/repository deny、Admin 只限 Pilot site、masked read/secret boundary 不放寬。
- 新增 `tests/rbac-precedence.integration.test.mjs`，覆蓋可讀不可寫=403、不可讀/跨站=404、unassigned createTopology=404。

## QA_PIL_001 Return Verification Evidence

- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\rbac-repository.integration.test.mjs`：PASS，7/7，fixture cleanup 完成。
- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\rbac-precedence.integration.test.mjs`：PASS，2/2。
- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\qa-pil-001-real-postgres.test.mjs`：PASS，1/1。
- DEV_PIL targeted + API auth-order + RBAC transaction guards + credential/transfer/secret regression：PASS，69/69。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- Scoped ESLint：PASS，0 errors。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- `node --env-file-if-exists=.env.local --env-file-if-exists=.env --test tests\*.test.mjs`：PASS，164/164。
- `git diff --check`：PASS，僅 CRLF 提醒。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- Scoped ESLint：PASS，0 errors／0 warnings。
- `npm.cmd run build:local`：PASS，僅既有 chunk size／route classification warning。
- `node --test tests\*.test.mjs`：目前 shell 缺 `DATABASE_URL`，`QA_DBM_001 real PostgreSQL...` env gate 失敗；其餘 150 pass／7 skip。此 blocker 不屬 DEV_PIL_001，且 PM 交接表示 QA_DBM_001 已於測試組具 DB env 環境 `QA_PASSED`。
- `npm.cmd run lint`：仍因 Windows 找不到 `bash` blocked；本票 scoped ESLint pass。

## PM Second Scope Check Return

- 2026-08-20：PM 第二次 P0 scope check 退回，DEV_PIL_001 改回 `IN_PROGRESS`。
- P0 缺口：
  - Pilot context 的 global Customer rename/delete/createTopology 必須只允許 Pilot-only synthetic customer；shared customer 關聯任一 non-Pilot topology 必須 fail closed。
  - Repository transaction 內必須用 server-side pilot principal 重新驗 active txUser 的 exact role mapping 與 Pilot site，避免 route helper 與 transaction 之間 TOCTOU。
