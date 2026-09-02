# PM_REL_001 — Internal Pilot Freeze Manifest（PM Draft）

> 狀態：非權威設計輸出。此文件是 `DSG_REL_001` 的設計輸入，須經設計組正式審查並由使用者／PM核准後才可用於 DEV_REL_001。

- Freeze date：2026-08-30
- Base commit：`cbce10bba027d246ef78e92a1e2f01660da55e1f`
- Freeze proposal：`PM_GOV_001-D24 WAITING_APPROVAL`
- Product profile：Internal Pilot、synthetic data、trusted intranet／VPN + HTTPS
- Release status：設計審查中；checkpoint 尚未建立；deploy 尚未授權

## 1. Approved capability set

| Capability | Primary Tickets | Independent acceptance |
|---|---|---|
| Governance／architecture／ticket traceability | PM_GOV_001–004, DSG_ARC_001 | PM approved；待 checkpoint 後 DONE |
| Development gate／Demo isolation | DEV_AUTH_001 | QA_PIL_002／development-gate tests |
| Migration／Runtime DB boundary與 local role hardening | DEV_DBM_001, OPS_DBM_001/002, OPS_SEC_001 | QA_DBM_001 QA_PASSED |
| Credential separation／masked boundary | DEV_SEC_001, DEV_SEC_002 | QA_PIL_001, QA_IMP_001 QA_PASSED |
| Auth-first API／safe errors／Audit | DEV_API_001 | QA_API_001 QA_PASSED |
| Temporary Internal Pilot session／site scope | DEV_PIL_001 | QA_PIL_001, QA_PIL_002 QA_PASSED |
| Orthogonal obstacle-safe routing | DEV_UIX_002 | QA_UIX_001 QA_PASSED |
| TXT／MD／strict CSV v2 Preview／Missing Info／Apply | DEV_IMP_001/002 | QA_IMP_001 QA_PASSED |
| Safe／Full gated five-file ZIP與 canonical round-trip | DEV_EXP_001/002 | QA_IMP_001 QA_PASSED |

## 2. Deferred and excluded product scope

- OIDC／MFA／正式 Session：`DSG_OIDC_001` 及後續票 `DEFERRED`。
- 正式跨站 Customer／Topology RBAC：`DSG_RBAC_001` 及後續票 `DEFERRED`。
- DOCX／XLSX／PDF／OCR：`DSG_DOC_001` 及後續票 `DEFERRED`。
- Internet／production data／production credentials：Pilot 禁止。
- Agent／Wazuh／漏洞偵測：屬 `netNNassist`，不在本 freeze。
- ZIP import：未核准；只支援匯出 ZIP，匯入前由使用者解壓選取 CSV。

## 3. Acceptance evidence

- QA_API_001：auth-first、strict limit、安全錯誤與 protected API smoke 通過。
- QA_DBM_001：真 PostgreSQL role/grant、runtime DDL denial、migration/checksum/artifact/secret gate 通過。
- QA_PIL_001／002：真 DB scope、Browser login/session/revoke、RBAC、cleanup 通過。
- QA_UIX_001：幾何 invariant、Browser routing visual 與 performance budget 通過。
- QA_IMP_001 2026-08-29：Browser Preview unique controls、pre-read size gate、new/merge/replace、Safe ZIP round-trip、masked credential zero-write 與 secret boundary 通過。
- Latest full Node：192/192；TypeScript、build:local、scoped ESLint 通過。

## 4. Known non-blocking issues

| Issue | Decision |
|---|---|
| Windows `npm.cmd run lint` 依賴 `bash` 而 blocked | 不阻擋本 freeze；每票 scoped ESLint 已通過。DEV_REL 必須保留紀錄，部署前另修 lint runner 或於含 bash 的 CI 重跑。 |
| build chunk size／route classification／plugin timing warnings | 無測試失敗；列為 performance/tooling observation，不擴張本 checkpoint scope。 |
| Full OIDC/MFA/rate-limit 尚未實作 | 已明確 DEFERRED；Pilot 限 trusted intranet/VPN、HTTPS、synthetic data。 |

## 5. Preliminary workspace inventory

在 PM freeze 文件落盤前的 read-only inventory：

- Base HEAD：`cbce10bba027d246ef78e92a1e2f01660da55e1f`。
- Tracked paths changed：41（37 modified、4 deleted）。
- Untracked files：135。
- 原 workspace 屬使用者與多票累積成果；不得 reset、clean、checkout 或 stash-pop。

`DEV_REL_001` 開始後須重新產生完整 machine-readable inventory、path-to-ticket map、tracked binary patch、approved untracked archive 與 SHA-256，因本 Freeze Manifest／ticket status 本身會形成核准的 freeze delta。

## 6. Include／exclude policy

Include：核准 source、migration metadata、scripts、tests、package/lock、project-local skill、治理／開發／QA文件與正式 QA screenshots／summaries。

Exclude：`node_modules/`、`dist/`、`test-results/`、`.local/`、local PostgreSQL data/log、`.env.local`、active secret／token／DSN、暫存 server PID/port artifacts。

任何不在兩者且無 primary Ticket 的 path 都是 stop condition，不得自行丟棄或併入。

## 7. Frozen checkpoint sequence

1. `[PM_GOV_002] docs(governance): establish engineering ticket baseline`
2. `[PM_GOV_002] chore(tooling): register project-local topology skill`
3. `[DEV_AUTH_001] feat(auth): gate demo identity and seed`
4. `[DEV_DBM_001] refactor(db): separate migration and runtime boundaries`
5. `[OPS_SEC_001] chore(db): harden local postgres bootstrap secrets`
6. `[DEV_SEC_001] fix(credentials): isolate credential storage boundaries`
7. `[DEV_PIL_001] feat(pilot): add internal pilot session and site scope`
8. `[DEV_UIX_002] feat(routing): add obstacle-safe orthogonal links`
9. `[DEV_IMP_002] feat(import): enforce strict preview and bundle contract`
10. `[DEV_EXP_002] feat(export): add canonical safe csv bundle`
11. `[QA_REL_001] test(release): add acceptance evidence and release map`

Existing pre-freeze commits, including `cbce10b fix(api): harden audit logs auth-first contract`, are not rewritten; QA release map must associate them with their governing Ticket.

## 8. Freeze rule

從本票 `READY` 起停止加入新產品功能。只允許 DEV_REL／QA_REL 的 snapshot、commit split、equivalence、測試與狀態文件。新需求回到新 Ticket，不得混入 frozen checkpoint。
