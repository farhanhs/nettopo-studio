# Engineer Ticket Register

- 更新日期：2026-09-04
- 排序：Priority → Planned Order → Ticket ID
- 狀態來源：目前工作樹、開發／測試紀錄與已確認產品方向

## P0／P1 執行佇列

### 2026-09-08 UI／Canvas Bug 分流（D31）

本輪只完成 PM 審查、發單與排序，不直接修改產品。三項既有語意缺陷可按序進 DEV；路由交叉最小化屬延伸能力，必須先完成設計並回 PM/使用者核准。

| 順序 | Ticket chain | 狀態 | 判定 |
|---:|---|---|---|
| 1 | DEV_UIX_006 → QA_UIX_002 | READY → BLOCKED | Inspector selection 資料殘留，CORRECT |
| 2 | DEV_UIX_007 → QA_UIX_003 | READY → BLOCKED | Topbar 中等寬度/zoom 重疊，CORRECT；回歸 DEV_UIX_004 |
| 3 | DEV_UIX_008 → QA_UIX_004 | READY → BLOCKED | 登入後 Canvas 初始 viewport/resize，CORRECT |
| 4 | DSG_UIX_003 → DEV_UIX_009 → DEV_UIX_003 → QA_UIX_005 | READY → BLOCKED | 多成本繞線，EXTEND；設計批准前不得開發 |

### 最新功能結果：DEV_PIL_002 checkpoint pushed

`DSG_PIL_002` 設計完成；`DEV_PIL_002` 功能完成。2026-09-08 QA 已補齊 accessible close selector 完整 Pilot UAT，以及 360/768/1280/短高度/長文字/200% scaling responsive Browser 證據，結果 `QA_PASSED`。三段 ticket commits 已 push 至 `origin/codex/dev-rel-001-checkpoint`，remote-tracking HEAD `1b0b084518886cda347f175bfc959401fd1d18ed`；未 merge、未 deploy。

| Ticket | Status | 工作 |
|---|---|---|
| DSG_PIL_002 | DONE | 新增拓樸欄位及響應式容器契約已完成 |
| DEV_PIL_002 | QA_PASSED | 新增拓樸站點/未指定站點修正已通過補強驗收並 checkpoint |
| QA_PIL_004 | QA_PASSED | 完整 Pilot UAT、responsive Browser matrix、cleanup=0 均通過 |

### D29 當前優先指示（優先於下方歷史摘要）

`QA_REL_001` 最新結果為 `QA_FAILED`（CRLF checksum）；依使用者指示啟動 DSG_DBM_002 → DEV_DBM_002 → QA_REL_001 同票 pre-commit re-test。所有組別在任何新 staging/commit 前停止等待使用者批准，禁止 push/merge/deploy；先前自動 checkpoint/push 授權暫停。既有17 commits不變。

| Ticket | Status | 負責工作 |
|---|---|---|
| DSG_DBM_002 | READY | 跨平台 checksum 與既有 applied migration 相容設計 |
| DEV_DBM_002 | BLOCKED | 等設計交付後最小實作，保持 unstaged |
| QA_REL_001 | QA_FAILED | 準備同票重驗；DEV READY_FOR_QA 後驗證未提交候選 |


| Order | Ticket ID | Group | Priority | Status | Checkpoint | 依賴 | 工作摘要 | 詳細紀錄 |
|---:|---|---|---|---|---|---|---|---|
| 001 | `PM_GOV_001` | PM | P0 | `READY` | Governance | — | 產品憲章、不可破壞底層規則與歷史基線已核准 | [active/PM_GOV_001.md](active/PM_GOV_001.md) |
| 002 | `PM_GOV_002` | PM | P0 | `READY` | Governance | PM_GOV_001 | 採用 Engineer Ticket 與 Requirement Traceability Gate | [active/PM_GOV_002.md](active/PM_GOV_002.md) |
| 003 | `DSG_ARC_001` | DSG | P0 | `READY` | Governance | PM_GOV_001 READY, PM_GOV_002 READY | 架構分層、資料流與責任 Ticket Map 已核准 | [active/DSG_ARC_001.md](active/DSG_ARC_001.md) |
| 004 | `DSG_API_002` | DSG | P0 | `DONE` | Pilot | DSG_ARC_001 READY, DSG_API_001 DONE | Audit API auth-first、limit、安全錯誤與行為測試詳細設計；strict limit 已核准 | [active/DSG_API_002.md](active/DSG_API_002.md) |
| 010 | `DEV_API_001` | DEV | P0 | `QA_PASSED` | Pilot | PM_GOV_002 READY, DSG_API_002 DONE | Audit API auth-first、strict limit、typed safe error 與 handler tests | [active/DEV_API_001.md](active/DEV_API_001.md) |
| 011 | `QA_API_001` | QA | P0 | `QA_PASSED` | Pilot | DEV_API_001 QA_PASSED | 重驗 Audit API auth-first、strict limit、安全錯誤與 protected API smoke | [active/QA_API_001.md](active/QA_API_001.md) |
| 020 | `OPS_DBM_001` | OPS | P0 | `READY_FOR_QA` | Pilot | PM_GOV_002 READY, PM_GOV_001-D15 | 非破壞性修復 Windows local PostgreSQL 啟動／連線阻擋 | [active/OPS_DBM_001.md](active/OPS_DBM_001.md) |
| 021 | `OPS_DBM_002` | OPS | P0 | `READY_FOR_QA` | Pilot | OPS_DBM_001 READY_FOR_QA, PM_GOV_001-D16 | 建立最低權限 Runtime role，與既有 Migration owner 分離 | [active/OPS_DBM_002.md](active/OPS_DBM_002.md) |
| 022 | `QA_DBM_001` | QA | P0 | `QA_PASSED` | Pilot | OPS_DBM_001/002, OPS_SEC_001 READY_FOR_QA, PM_GOV_001-D19 | 第三次重驗 value-based log redaction gate 與完整 DBM regression 已通過；保留前兩次 QA_FAILED 歷史 | [active/QA_DBM_001.md](active/QA_DBM_001.md) |
| 023 | `OPS_SEC_001` | OPS | P0 | `READY_FOR_QA` | Pilot | QA_DBM_001 QA_FAILED, PM_GOV_001-D17 | 輪替 local Migration credential，移除 tracked 有效 DB password 預設值 | [active/OPS_SEC_001.md](active/OPS_SEC_001.md) |
| 024 | `PM_GOV_003` | PM | P0 | `READY` | Governance | QA_DBM_001 second QA_FAILED | 校正 local log hygiene 為 value-based redaction gate，避免已遮蔽操作骨架被誤判 | [active/PM_GOV_003.md](active/PM_GOV_003.md) |
| 025 | `PM_GOV_004` | PM | P0 | `READY` | Transfer Governance | QA_IMP_001 QA_FAILED | 確認 v2 交換協定退件成立，核准 strict validation pipeline 與修正票鏈 | [active/PM_GOV_004.md](active/PM_GOV_004.md) |
| 030 | `DEV_PIL_001` | DEV | P0 | `READY_FOR_QA` | Pilot | DSG_PIL_001 DONE, QA_DBM_001 QA_PASSED, PM_GOV_001-D20/D21 | QA_PIL_001 退回最小 RBAC 語意修復完成：createTopology hidden-resource precedence、credential read-vs-write 語意 | [active/DEV_PIL_001.md](active/DEV_PIL_001.md) |
| 031 | `QA_PIL_001` | QA | P0 | `QA_PASSED` | Pilot | DEV_PIL_001 READY_FOR_QA, DEV_API_001 QA_PASSED, QA_DBM_001 QA_PASSED | 同票 Re-test 通過：RBAC precedence 修復、Pilot real DB scope、security/export matrix 與 full serial tests 已驗證 | [active/QA_PIL_001.md](active/QA_PIL_001.md) |
| 032 | `QA_PIL_002` | QA | P0 | `QA_PASSED` | Pilot | QA_DBM_001 QA_PASSED, QA_PIL_001 QA_PASSED | 2026-08-24 quick re-test 通過：Pilot session identity display、reload、logout/tamper/revoke、cleanup；Browser critical flow 維持通過 | [active/QA_PIL_002.md](active/QA_PIL_002.md) |
| 033 | `QA_PIL_003` | QA | P1 | `QA_PASSED` | Functional UAT | DEV_UIX_004/005 READY_FOR_QA, DEV_PIL_003 READY_FOR_QA, QA_PIL_002/QA_IMP_001/QA_UIX_001 QA_PASSED, D25 | 2026-09-01 同票完整 UAT 通過：topbar 不遮擋、drag/reload persistence、Pilot-only logout、TXT/MD/CSV import、routing、Safe ZIP、secret/formula scan、round-trip、Admin/Engineer spot check 與 cleanup=0 | [active/QA_PIL_003.md](active/QA_PIL_003.md) |
| 034 | `DEV_PIL_002` | DEV | P1 | `QA_PASSED` | Functional UAT | QA_PIL_003 evidence, D25/D30 | 空站點本機可建立未指定拓樸；server/Pilot 不放寬；已 checkpoint/push | [active/DEV_PIL_002.md](active/DEV_PIL_002.md) |
| 035 | `QA_PIL_004` | QA | P1 | `QA_PASSED` | Functional UAT | DEV_PIL_002, QA_PIL_003 evidence | 完整 Pilot UAT、responsive Browser matrix、secret/round-trip 與 cleanup=0 通過 | [active/QA_PIL_004.md](active/QA_PIL_004.md) |
| 036 | `DEV_UIX_003` | DEV | P1 | `BLOCKED` | Functional UAT | DEV_UIX_009 READY_FOR_QA, DEV_UIX_002/QA_UIX_001, QA_PIL_003 evidence, D25/D31 | 改善連線無效告警，僅負責路由仍無解時的具體 fallback 原因；等待多成本路由契約與 DEV_UIX_009 | [active/DEV_UIX_003.md](active/DEV_UIX_003.md) |
| 037 | `DEV_UIX_004` | DEV | P1 | `QA_PASSED` | Functional UAT Fix | QA_PIL_003 QA_PASSED, D25 | 登入者資料卡進入 responsive topbar flow；1280px 下正常 pointer 操作不再被遮擋 | [active/DEV_UIX_004.md](active/DEV_UIX_004.md) |
| 038 | `DEV_UIX_005` | DEV | P1 | `QA_PASSED` | Functional UAT Fix | QA_PIL_003 QA_PASSED, DEV_UIX_004 QA_PASSED, D25 | Canvas transient drag + drag-stop durable write；真 Browser reload persistence 通過 | [active/DEV_UIX_005.md](active/DEV_UIX_005.md) |
| 039 | `DEV_PIL_003` | DEV | P1 | `QA_PASSED` | Functional UAT Fix | QA_PIL_003 QA_PASSED, D06/D20/D21/D25 | Runtime profile 唯一 logout endpoint；Pilot logout 200、登出後與 tampered cookie 均 401 | [active/DEV_PIL_003.md](active/DEV_PIL_003.md) |
| 040 | `DEV_IMP_001` | DEV | P1 | `QA_RETURNED` | Transfer | DEV_SEC_001 READY_FOR_QA | 首輪交付保留；D22 contract 缺口改由 DEV_IMP_002 修正 | [active/DEV_IMP_001.md](active/DEV_IMP_001.md) |
| 041 | `DEV_EXP_001` | DEV | P1 | `QA_RETURNED` | Transfer | DEV_SEC_001 READY_FOR_QA | 首輪交付保留；canonical export／round-trip 改由 DEV_EXP_002 修正 | [active/DEV_EXP_001.md](active/DEV_EXP_001.md) |
| 042 | `QA_IMP_001` | QA | P0 | `QA_PASSED` | Transfer | DEV_IMP_002/DEV_EXP_002/DEV_SEC_002 READY_FOR_QA, QA_PIL_002 QA_PASSED | 2026-08-29 同票 Re-test 通過：Preview duplicated controls blocker 已解除，Browser new/merge/replace、safe ZIP round-trip、secret boundary 與 full regression 通過 | [active/QA_IMP_001.md](active/QA_IMP_001.md) |
| 043 | `DSG_UIX_002` | DSG | P1 | `DONE` | UI Routing | DSG_UIX_001 | 直角避障路由、最近設備邊連接點與重疊 offset 設計 | [active/DSG_UIX_002.md](active/DSG_UIX_002.md) |
| 044 | `DEV_UIX_002` | DEV | P1 | `QA_PASSED` | UI Routing | DSG_UIX_002 | 實作 obstacle-safe orthogonal routing、wireless 例外與 anchor lane | [active/DEV_UIX_002.md](active/DEV_UIX_002.md) |
| 045 | `QA_UIX_001` | QA | P1 | `QA_PASSED` | UI Routing | DEV_UIX_002 | 幾何 invariant、自動化與 browser 視覺驗收 | [active/QA_UIX_001.md](active/QA_UIX_001.md) |
| 046 | `DSG_IMP_002` | DSG | P0 | `READY` | Transfer Contract Correction | PM_GOV_004 READY, D22/D23 | strict v2 manifest、file gate、v1 compatibility、error／preview／round-trip／secret contract 已獲使用者核准 | [active/DSG_IMP_002.md](active/DSG_IMP_002.md) |
| 047 | `DEV_IMP_002` | DEV | P0 | `READY_FOR_QA` | Transfer Import Correction | DSG_IMP_002 READY | QA Re-test return fix：移除 legacy Preview 控制樹，確保 summary／issue／strategy／confirm 唯一且不可繞過 | [active/DEV_IMP_002.md](active/DEV_IMP_002.md) |
| 048 | `DEV_EXP_002` | DEV | P0 | `READY_FOR_QA` | Transfer Export Correction | DSG_IMP_002 approved, DEV_IMP_002 READY_FOR_QA | 五檔 canonical ZIP、Safe／Full 與 round-trip equality | [active/DEV_EXP_002.md](active/DEV_EXP_002.md) |
| 049 | `DEV_SEC_002` | DEV | P0 | `READY_FOR_QA` | Transfer Security Correction | DEV_IMP_002/DEV_EXP_002 READY_FOR_QA | Import／Export persistence、DOM、network、JSON／CSV／ZIP secret hardening | [active/DEV_SEC_002.md](active/DEV_SEC_002.md) |
| 070 | `DEV_UIX_006` | DEV | P1 | `READY` | UI Bug Fix | D31 | Inspector 切換設備／連線時表單資料必須同步，不得殘留前一筆 defaultValue | [active/DEV_UIX_006.md](active/DEV_UIX_006.md) |
| 071 | `QA_UIX_002` | QA | P1 | `BLOCKED` | UI Bug QA | DEV_UIX_006 READY_FOR_QA | 真 Browser 驗證 selection/form/save/reload 不交叉寫入 | [active/QA_UIX_002.md](active/QA_UIX_002.md) |
| 072 | `DEV_UIX_007` | DEV | P1 | `READY` | UI Responsive Fix | D31, DEV_UIX_004 QA_PASSED | Topbar 登入者、測試身分、排版與動作區在中等寬度及 zoom 不重疊 | [active/DEV_UIX_007.md](active/DEV_UIX_007.md) |
| 073 | `QA_UIX_003` | QA | P1 | `BLOCKED` | UI Responsive QA | DEV_UIX_007 READY_FOR_QA | 768/1024/1280、長身分、200% zoom bounding-box 與操作驗收 | [active/QA_UIX_003.md](active/QA_UIX_003.md) |
| 074 | `DEV_UIX_008` | DEV | P1 | `READY` | Canvas Resize Fix | D31 | 登入後首幀 Canvas 滿版、PanelGroup/React Flow resize/fit 同步 | [active/DEV_UIX_008.md](active/DEV_UIX_008.md) |
| 075 | `QA_UIX_004` | QA | P1 | `BLOCKED` | Canvas Resize QA | DEV_UIX_008 READY_FOR_QA | fresh login/reload/panel restore 的初始 viewport 與 pan/zoom regression | [active/QA_UIX_004.md](active/QA_UIX_004.md) |
| 076 | `DSG_UIX_003` | DSG | P1 | `READY` | Routing Extension Design | D31, DSG_UIX_002 DONE | 設備避障為硬限制，交叉／重疊／標籤／彎折／長度／穩定性為成本 | [active/DSG_UIX_003.md](active/DSG_UIX_003.md) |
| 077 | `DEV_UIX_009` | DEV | P1 | `BLOCKED` | Routing Extension | DSG_UIX_003 approved READY | 實作 deterministic bounded 多成本自動繞線 | [active/DEV_UIX_009.md](active/DEV_UIX_009.md) |
| 078 | `QA_UIX_005` | QA | P1 | `BLOCKED` | Routing QA | DEV_UIX_009/DEV_UIX_003 READY_FOR_QA | 幾何改善、穩定性、no-path、效能與真 Browser 驗收 | [active/QA_UIX_005.md](active/QA_UIX_005.md) |
| 049 | `DSG_REL_001` | DSG | P0 | `READY` | Release Design | DEV_REL_001 recovery artifact stop evidence, R1 APPROVED | R1 修訂 recovery artifact secret boundary：canonical format 改為 sanitized overlay bundle，已核准作為 DEV_REL_001 執行基線 | [active/DSG_REL_001.md](active/DSG_REL_001.md) |
| 050 | `PM_REL_001` | PM | P0 | `READY` | Release | D24 APPROVED, Release QA passed, DSG_REL_001-R1 APPROVED | Pilot scope freeze 與 R1 recovery artifact secret boundary 已核准；deploy 仍未授權 | [active/PM_REL_001.md](active/PM_REL_001.md) |
| 051 | `DEV_REL_001` | DEV | P0 | `READY_FOR_QA` | Release | QA_PIL_003 QA_PASSED, DSG_REL_001-R1 APPROVED, D24/D26/D27/D28 | Recovery、checkpoint chain、DB/Browser/security gates 與 DEV final equivalence 已完成；等待 QA_REL_001 獨立驗收 | [active/DEV_REL_001.md](active/DEV_REL_001.md) |
| 052 | `QA_REL_001` | QA | P0 | `QA_FAILED` | Release | DEV_DBM_002 READY_FOR_QA, D29 | CRLF migration checksum退件；設計/修正後同票pre-commit重驗，等待使用者commit approval | [active/QA_REL_001.md](active/QA_REL_001.md) |
| 060 | `OPS_PIL_001` | OPS | P1 | `BLOCKED` | Pilot deploy | QA_REL_001 | 部署 Internal Pilot、HTTPS、backup、health gate | 待建立詳細票 |
| 061 | `PM_PIL_001` | PM | P1 | `BLOCKED` | Pilot feedback | OPS_PIL_001 | 工程師試用、問題分級與下一階段決策 | 待建立詳細票 |

## 已完成或待 checkpoint 的基礎工作

| Ticket ID | Group | Priority | Status | 工作摘要 | 證據／備註 |
|---|---|---|---|---|---|
| `DEV_UIX_001` | DEV | P1 | `DONE` | React Flow canvas、ELK layout、群組、路由與基礎 UI | 已存在於先前 commit |
| `DEV_DOM_001` | DEV | P1 | `DONE` | Device／Link／Group domain 與多拓樸基礎 | 已存在於先前 commit |
| `DEV_AUTH_001` | DEV | P0 | `QA_PASSED` | Development Gate、Demo identity/header/seed 隔離 | 尚待 checkpoint 重組 |
| `DEV_DBM_001` | DEV | P0 | `QA_PASSED` | Migration CLI 與 Runtime DB 邊界分離 | Migration Boundary 已通過，真 DB 驗收另見 QA_DBM_001 |
| `DEV_SEC_001` | DEV | P0 | `READY_FOR_QA` | Project／State／Storage 明文憑證清除與 masked boundary | [active/DEV_SEC_001.md](active/DEV_SEC_001.md)；待 QA_IMP_001 真 Dexie/API integration |
| `DSG_PIL_001` | DSG | P1 | `DONE` | Internal Pilot 與 OWASP 邊界設計；未決選項已由 D03–D07、D20–D21 收斂 | [active/DSG_PIL_001.md](active/DSG_PIL_001.md) |

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
| `DSG_REL_001` | DSG | P0 | `READY` | R1 修訂 Freeze／Recovery canonical artifact 與 secret boundary，已核准 | DEV_REL_001, QA_REL_001 |
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

- Current checkpoint：`DEV_REL_001` 已 `READY_FOR_QA`；R1 recovery、checkpoint chain、真實 DB、Browser UAT、security 與 DEV final equivalence 已完成。現在交 `QA_REL_001` 獨立驗收；只有 QA 通過後才依 D26 push checkpoint branch，不 merge/deploy。
- 自動化測試快照：QA_IMP_001 2026-08-29 Re-test：Preview ownership 30/30 pass；targeted transfer/security 41/41 pass；Browser re-test pass；serial full Node tests 192/192 pass；tsc pass；build:local pass；scoped ESLint pass；full lint 仍因 Windows 缺少 bash blocked。
- P0 fail：目前無 QA_DBM_001／QA_PIL_001／QA_PIL_002／QA_IMP_001 blocker。
- Functional UAT：`QA_PIL_003` 已通過，覆蓋 `session-profile`、Canvas drag persistence 與 Pilot logout endpoint。`DEV_REL_001` 已完成並交 `QA_REL_001`；尚未授權 push、merge 或 deploy。
- Pilot deploy 仍未授權；`OPS_PIL_001` 維持 blocked。
