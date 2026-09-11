# DSG_PIL_001 — Internal Pilot 與 OWASP 邊界設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | PIL |
| Priority | P1 |
| Status | DONE |
| Checkpoint | Internal Pilot |
| Created／Updated | 2026-08-20 |

## Approved Product Contract

- Runtime profile：獨立 `pilot`，不得退化為 development/demo。
- Authentication：Temporary Pilot Session；正式 Entra OIDC 延後。
- Data：synthetic-only，不得輸入 production credential 或客戶正式資料。
- Roles：Pilot `admin`、`engineer`；有效權限不得高於 DB RBAC，並限明確 Pilot site。
- Engineer 唯一 Customer 例外：可建立 synthetic Customer + 預設 topology，僅限 Pilot site。
- Full export：預設關閉；受控測試 flag 開啟時，也只能對 Pilot admin + DB boss 顯示，不得給 Engineer。
- Session：HttpOnly、Secure、SameSite=Strict、`__Host-` cookie、固定 TTL、allowlist version 可即時撤銷。
- Mutation：protected API 必須 authentication-first；登入端點本身要求 same-origin + JSON。
- Deployment：Temporary Session 只允許受信任內網/VPN + HTTPS，禁止 Internet exposure。

## Threat Boundary

| 威脅 | Pilot 控制 |
|---|---|
| Demo/header 身分偽造 | Pilot startup 禁 demo auth、dev header、demo seed；legacy header 401 |
| Allowlist email 冒用 | Email 必須再綁 active DB user、正確 DB role、Pilot site；部署另有內網/VPN 邊界 |
| Session 偽造/固定 | HMAC secret、nonce、expiry、constant-time verify、重新登入重發 cookie |
| 已撤銷 session | Allowlist version/role/email 每次 request 重驗 |
| CSRF | Mutation same-origin Origin/Referer + JSON；cookie SameSite Strict |
| 跨站/角色提升 | Pilot role ∩ DB role ∩ Pilot site；不相符不發 session |
| Production data 混入 | 獨立 Pilot DB、synthetic banner、Engineer credential API deny、full export default off |
| Error/response leakage | typed safe response、no-store/security headers；不回 token、stack、SQL、DSN、raw error |
| 暴力嘗試 | 此階段靠 trusted subnet/VPN；rate limit 在 `OPS_PIL_001` reverse proxy gate |

## Flow

```text
pilot startup validation
→ explicit site + strict allowlist + session secret
→ POST /api/pilot/session (same-origin JSON)
→ normalize/validate email
→ allowlist principal
→ active DB user + exact role mapping + pilot-site assignment
→ issue Secure HttpOnly __Host cookie
→ each protected request: session signature/TTL/version → DB RBAC/resource policy
```

## Resolved Decisions

- `D03` Internal Pilot first。
- `D04` synthetic-only。
- `D05` Pilot Engineer synthetic Customer exception。
- `D06` Temporary Pilot Session。
- `D07` Pilot full export default off。
- `D20` Pilot/DB role/site intersection。
- `D21` trusted network + HTTPS risk boundary。

設計輸出已完成且所有會阻擋開發的產品選項已收斂，對應開發票為 `DEV_PIL_001`。
