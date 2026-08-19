# Engineer Ticket Register

- 更新日期：2026-08-20
- 排序：Priority → Planned Order → Ticket ID
- 狀態來源：目前工作樹、開發／測試紀錄與已確認產品方向

## P0／P1 執行佇列

| Order | Ticket ID | Group | Priority | Status | Checkpoint | 依賴 | 工作摘要 | 詳細紀錄 |
|---:|---|---|---|---|---|---|---|---|
| 001 | `PM_GOV_001` | PM | P0 | `READY` | Governance | — | 產品憲章、不可破壞底層規則與歷史基線已核准 | [active/PM_GOV_001.md](active/PM_GOV_001.md) |
| 002 | `PM_GOV_002` | PM | P0 | `READY` | Governance | PM_GOV_001 | 採用 Engineer Ticket 與 Requirement Traceability Gate | [active/PM_GOV_002.md](active/PM_GOV_002.md) |
| 003 | `DSG_ARC_001` | DSG | P0 | `READY` | Governance | PM_GOV_001 READY, PM_GOV_002 READY | 架構分層、資料流與責任 Ticket Map 已核准 | [active/DSG_ARC_001.md](active/DSG_ARC_001.md) |
| 004 | `DSG_API_002` | DSG | P0 | `DONE` | Pilot | DSG_ARC_001 READY, DSG_API_001 DONE | Audit API auth-first、limit、安全錯誤與行為測試詳細設計；strict limit 已核准 | [active/DSG_API_002.md](active/DSG_API_002.md) |
| 010 | `DEV_API_001` | DEV | P0 | `QA_PASSED` | Pilot | PM_GOV_002 READY, DSG_API_002 DONE | Audit API auth-first、strict limit、typed safe error 與 handler tests | [active/DEV_API_001.md](active/DEV_API_001.md) |
| 011 | `QA_API_001` | QA | P0 | `QA_PASSED` | Pilot | DEV_API_001 QA_PASSED | 重驗 Audit API auth-first、strict limit、安全錯誤與 protected API smoke | [active/QA_API_001.md](active/QA_API_001.md) |
| 020 | `OPS_DBM_001` | OPS | P0 | `WAITING_APPROVAL` | Pilot | PM_GOV_002 READY | 修復 Windows local PostgreSQL 啟動／連線阻擋 | [active/OPS_DBM_001.md](active/OPS_DBM_001.md) |
| 021 | `OPS_DBM_002` | OPS | P0 | `BLOCKED` | Pilot | OPS_DBM_001 | 建立獨立 Pilot DB、Runtime role、Migration role | OPS_DBM_001 |
| 022 | `QA_DBM_001` | QA | P0 | `BLOCKED` | Pilot | OPS_DBM_002 | 真實 PostgreSQL migration/runtime integration | [active/QA_DBM_001.md](active/QA_DBM_001.md) |
| 030 | `DEV_PIL_001` | DEV | P1 | `WAITING_APPROVAL` | Pilot | PM_GOV_001 READY, PM_GOV_002 READY | Pilot profile、Temporary Session、allowlist、安全 headers | 工作樹已有候選實作，仍需本票啟動批准 |
| 031 | `QA_PIL_001` | QA | P0 | `QA_BLOCKED` | Pilot | DEV_API_001, QA_DBM_001 | Pilot 模組完整驗收 | [active/QA_PIL_001.md](active/QA_PIL_001.md) |
| 032 | `QA_PIL_002` | QA | P0 | `BLOCKED` | Pilot | OPS_DBM_001, QA_PIL_001 | Pilot browser critical flow E2E | [active/QA_PIL_002.md](active/QA_PIL_002.md) |
| 040 | `DEV_IMP_001` | DEV | P1 | `READY_FOR_QA` | Transfer | DEV_SEC_001 | TXT／MD／CSV parser、Preview、Missing Info | 工作樹候選實作 |
| 041 | `DEV_EXP_001` | DEV | P1 | `READY_FOR_QA` | Transfer | DEV_SEC_001 | 五檔 CSV ZIP、safe default、round-trip | 工作樹候選實作 |
| 042 | `QA_IMP_001` | QA | P1 | `BLOCKED` | Transfer | DEV_IMP_001, DEV_EXP_001, QA_PIL_002 | Import／Export Browser E2E 與 secret scan | 待建立詳細票 |
| 043 | `DSG_UIX_002` | DSG | P1 | `DONE` | UI Routing | DSG_UIX_001 | 直角避障路由、最近設備邊連接點與重疊 offset 設計 | [active/DSG_UIX_002.md](active/DSG_UIX_002.md) |
| 044 | `DEV_UIX_002` | DEV | P1 | `QA_PASSED` | UI Routing | DSG_UIX_002 | 實作 obstacle-safe orthogonal routing、wireless 例外與 anchor lane | [active/DEV_UIX_002.md](active/DEV_UIX_002.md) |
| 045 | `QA_UIX_001` | QA | P1 | `QA_PASSED` | UI Routing | DEV_UIX_002 | 幾何 invariant、自動化與 browser 視覺驗收 | [active/QA_UIX_001.md](active/QA_UIX_001.md) |
| 050 | `PM_REL_001` | PM | P0 | `BLOCKED` | Release | QA_API_001, QA_DBM_001, QA_PIL_002, QA_IMP_001 | Pilot scope freeze 與 checkpoint 授權 | [active/PM_REL_001.md](active/PM_REL_001.md) |
| 051 | `DEV_REL_001` | DEV | P0 | `BLOCKED` | Release | PM_REL_001 | Recovery snapshot 與乾淨 checkpoint 拆分 | [active/DEV_REL_001.md](active/DEV_REL_001.md) |
| 052 | `QA_REL_001` | QA | P0 | `BLOCKED` | Release | DEV_REL_001 | 逐 checkpoint build/test 與最終 tree equivalence | 待建立詳細票 |
| 060 | `OPS_PIL_001` | OPS | P1 | `BLOCKED` | Pilot deploy | QA_REL_001 | 部署 Internal Pilot、HTTPS、backup、health gate | 待建立詳細票 |
| 061 | `PM_PIL_001` | PM | P1 | `BLOCKED` | Pilot feedback | OPS_PIL_001 | 工程師試用、問題分級與下一階段決策 | 待建立詳細票 |

## 已完成或待 checkpoint 的基礎工作

| Ticket ID | Group | Priority | Status | 工作摘要 | 證據／備註 |
|---|---|---|---|---|---|
| `DEV_UIX_001` | DEV | P1 | `DONE` | React Flow canvas、ELK layout、群組、路由與基礎 UI | 已存在於先前 commit |
| `DEV_DOM_001` | DEV | P1 | `DONE` | Device／Link／Group domain 與多拓樸基礎 | 已存在於先前 commit |
| `DEV_AUTH_001` | DEV | P0 | `QA_PASSED` | Development Gate、Demo identity/header/seed 隔離 | 尚待 checkpoint 重組 |
| `DEV_DBM_001` | DEV | P0 | `QA_PASSED` | Migration CLI 與 Runtime DB 邊界分離 | Migration Boundary 已通過，真 DB 驗收另見 QA_DBM_001 |
| `DEV_SEC_001` | DEV | P0 | `READY_FOR_QA` | Project／State／Storage 明文憑證清除與 masked boundary | 尚缺完整 Dexie/API integration |
| `DSG_PIL_001` | DSG | P1 | `WAITING_APPROVAL` | Internal Pilot 與 OWASP 邊界設計 | 設計完成，不代表全部選項已批准 |

## 前期設計工作單

下列單號補齊先前已討論、已設計或後續需要設計的工作。`DONE` 只代表設計交付已完成，不代表對應開發已 checkpoint。

| Ticket ID | Group | Priority | Status | 設計工作 | 對應開發／維運 Ticket |
|---|---|---|---|---|---|
| `DSG_UIX_001` | DSG | P1 | `DONE` | React Flow 畫布、ELK layout、群組、Inspector 與 UI 邊界 | DEV_UIX_001 |
| `DSG_UIX_002` | DSG | P1 | `DONE` | 直角避障路由、最近邊連接點、只在重疊時分流 | DEV_UIX_002 |
| `DSG_DOM_001` | DSG | P1 | `DONE` | Device／Link／Group domain、Zustand、Dexie、多拓樸資料流 | DEV_DOM_001 |
| `DSG_IMP_001` | DSG | P1 | `DONE` | TXT／MD／CSV 拖放、Preview、Missing Info 與套用流程 | DEV_IMP_001 |
| `DSG_EXP_001` | DSG | P1 | `DONE` | CSV Bundle v2、safe/full、五檔 ZIP 與 round-trip 契約 | DEV_EXP_001 |
| `DSG_SEC_001` | DSG | P0 | `DONE` | Credential 分離、masked schema、secret persistence boundary | DEV_SEC_001 |
| `DSG_AUTH_001` | DSG | P0 | `DONE` | Development Gate、Demo identity/header/seed 邊界 | DEV_AUTH_001 |
| `DSG_DBM_001` | DSG | P0 | `DONE` | Migration CLI、Runtime schema check、雙 DB role 架構 | DEV_DBM_001 |
| `DSG_API_001` | DSG | P0 | `DONE` | Protected API auth-first、401/403/404/503 安全錯誤契約 | DEV_API_001 |
| `DSG_API_002` | DSG | P0 | `DONE` | Audit API request precedence、limit、safe error 與可執行 Handler 測試 | DEV_API_001, QA_API_001 |
| `DSG_OBS_001` | DSG | P1 | `DONE` | Audit／Logging／Health 安全欄位與 no-store 邊界 | DEV_API_001, DEV_SEC_001, DEV_PIL_001 |
| `DSG_REL_001` | DSG | P0 | `WAITING_APPROVAL` | Freeze、Recovery Snapshot、Checkpoint 拆分與 tree equivalence | DEV_REL_001, QA_REL_001 |
| `DSG_DEP_001` | DSG | P1 | `PROPOSED` | Internal Pilot 網路、HTTPS、DB role、backup、health 部署設計 | OPS_DBM_002, OPS_PIL_001 |

## 延後工作

| Order | Ticket ID | Group | Priority | Status | 工作摘要 | 啟動條件 |
|---:|---|---|---|---|---|---|
| 100 | `DSG_OIDC_001` | DSG | P2 | `DEFERRED` | Entra OIDC minimal／正式登入設計 | Pilot 回饋或 Entra 設定可用 |
| 101 | `DEV_OIDC_001` | DEV | P2 | `DEFERRED` | OIDC login/callback/session/logout | DSG_OIDC_001 READY |
| 102 | `QA_OIDC_001` | QA | P2 | `DEFERRED` | OIDC、停用帳號、session revoke 驗收 | DEV_OIDC_001 READY_FOR_QA |
| 110 | `DSG_RBAC_001` | DSG | P2 | `DEFERRED` | 正式跨站 Customer／Topology RBAC | Pilot 完成後重新裁定 |
| 111 | `DEV_RBAC_001` | DEV | P2 | `DEFERRED` | 完整 Boss／Site Manager／Engineer／Sales 授權 | DSG_RBAC_001 READY |
| 112 | `QA_RBAC_001` | QA | P2 | `DEFERRED` | 跨站、防枚舉、停用帳號、TOCTOU 驗收 | DEV_RBAC_001 READY_FOR_QA |
| 120 | `DSG_DOC_001` | DSG | P3 | `DEFERRED` | DOCX／XLSX／PDF／OCR 輸入與報表規格 | Pilot 核心流程穩定 |
| 121 | `DEV_DOC_001` | DEV | P3 | `DEFERRED` | DOCX／XLSX parser | DSG_DOC_001 READY |
| 122 | `DEV_DOC_002` | DEV | P3 | `DEFERRED` | PDF／OCR／正式報表 | DEV_DOC_001 與安全評估完成 |

## 當前放行判斷

- Current checkpoint：**不通過**。
- 自動化測試快照：152 total，145 pass，0 fail，7 skip；DEV_API_001 targeted tests 14/14 pass；build:local pass；full lint 因 Windows 缺少 bash blocked，scoped ESLint pass。
- P0 fail：無已知 Audit API blocker；DEV_API_001／QA_API_001 已通過。
- P0 blocked：真實 PostgreSQL integration、完整 Pilot browser E2E、Import／Export Browser E2E 與 secret scan。
- 在 `PM_REL_001` 進入 `READY` 前不得建立正式 checkpoint commit 或部署 Pilot。
