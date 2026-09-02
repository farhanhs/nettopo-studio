# Product Decision Log

此表用來防止「推薦」在跨組轉述後被誤認為「已批准」。只有 `APPROVED` 可以成為 `READY` 工單的產品依據。

| Decision ID | Status | 決策 | 影響 Tickets | 備註 |
|---|---|---|---|---|
| `PM_GOV_001-D01` | `APPROVED` | NetTopo Studio 專注拓樸文件／資料交換；監控與 Agent 屬於 netNNassist | 全部 | 產品邊界 |
| `PM_GOV_001-D02` | `APPROVED` | Migration 修改者與 Application Runtime 使用者分離 | DEV_DBM_001 | Runtime 不讀 SQL、不 migrate |
| `PM_GOV_001-D03` | `APPROVED` | 先建立內網 Internal Pilot，完整正式 RBAC 延後 | DEV_PIL_001, DSG_RBAC_001 | Pilot 不是 production |
| `PM_GOV_001-D04` | `APPROVED` | Pilot 只用 synthetic data，不放正式 credential | DEV_PIL_001, DEV_SEC_001 | 安全硬邊界 |
| `PM_GOV_001-D05` | `APPROVED` | Pilot Engineer 可建立 synthetic Customer；不得擴張為正式 Customer mutation 權限 | DEV_PIL_001 | 回填先前使用者對 Pilot 唯一例外的明確指示 |
| `PM_GOV_001-D06` | `APPROVED` | Internal Pilot 先採 Temporary Pilot Session；正式 Entra OIDC 延後 | DEV_PIL_001, DSG_OIDC_001 | 符合輕量快速內網 Pilot 路線 |
| `PM_GOV_001-D07` | `APPROVED` | Pilot full export 預設禁用 | DEV_EXP_001 | 如需測試必須另有受控 gate 與權限 |
| `PM_GOV_001-D08` | `APPROVED` | 正式採用本 Engineer Ticket 治理規則 | PM_GOV_002 | 2026-08-19 使用者明確核准 |
| `PM_GOV_001-D09` | `APPROVED` | 設備連結預設採直角路由，線段不得與非端點設備疊合 | DSG_UIX_002, DEV_UIX_002 | 若無可行路徑不得退化為穿越設備的 fallback |
| `PM_GOV_001-D10` | `APPROVED` | 連接點預設位於朝向對端的最近設備邊；只有實際重疊／同 corridor 才配置 offset | DSG_UIX_002, DEV_UIX_002 | Offset 必須 deterministic 且拖曳後穩定 |
| `PM_GOV_001-D11` | `APPROVED` | 新工作建立或啟動前，必須回溯既有指令、Decision、開發計畫與測試紀錄，完成 Requirement Traceability Gate | 全部 | 避免反覆改寫底層架構與局部補洞 |
| `PM_GOV_001-D12` | `APPROVED` | 程式現況與歷史文件只能作證據；產品語意以最新 Approved Decision、憲章與 Active Ticket 為準 | 全部 | 衝突需顯式 SUPERSEDE，不得靜默覆寫 |
| `PM_GOV_001-D13` | `APPROVED` | 核准 NetTopo Studio 架構分層、資料流、Ticket ownership 與 release dependency map | DSG_ARC_001, 全部 | 2026-08-19 使用者明確推進確認 |
| `PM_GOV_001-D14` | `APPROVED` | Audit API 採 Strict `limit`：缺失預設 100；僅整數 1–200 合法；空值、小數、0、負數、超過 200、非數字或多值回 `400 INVALID_LIMIT` | DSG_API_002, DEV_API_001, QA_API_001 | 2026-08-20 PM 依使用者授權繼續推進 Ticket，採設計組推薦方案 |
| `PM_GOV_001-D15` | `APPROVED` | 啟動 OPS_DBM_001 非破壞性本機 PostgreSQL 修復；先做 process／port／data／log／DSN 診斷，禁止 reset、刪除或重新初始化既有 cluster | OPS_DBM_001 | 2026-08-20 PM 依使用者授權繼續推進 Ticket |
| `PM_GOV_001-D16` | `APPROVED` | Internal Pilot 沿用既有 `nettopo` 作為 Migration owner，新增最低權限 `nettopo_runtime` 作為 Application Runtime role；本階段不搬移資料庫物件 ownership | OPS_DBM_002, QA_DBM_001 | 2026-08-20 PM 依輕量 Pilot 與 Migration／Runtime 分離原則推進 |
| `PM_GOV_001-D17` | `APPROVED` | Active local DB credential 不得等於任何 tracked example/default；輪替 Migration owner credential，tracked config 改為明確 placeholder／required env，local secret 只存 ignored `.env.local` | OPS_SEC_001, QA_DBM_001 | QA_DBM_001 secret leakage gate 的 P0 corrective action |
| `PM_GOV_001-D18` | `APPROVED` | Current Internal Pilot 採 native Windows PostgreSQL；本機無 Docker CLI 時，Compose 在 OPS_SEC_001 只需靜態 fail-closed／zero-secret 驗證，實際 `docker compose config` 移到採用 Docker 路線前的 OPS_PIL_001 gate | OPS_SEC_001, OPS_PIL_001 | 不以未使用的部署替代路徑阻擋目前 native Pilot，但不得宣稱 Docker 已驗證 |
| `PM_GOV_001-D19` | `APPROVED` | Local log hygiene 採 value-based gate：role-password statement 只可保留操作骨架，password operand 必須是精確 `[REDACTED_TOKEN]`；active/inactive credential、完整 DSN、未核准 token 任一命中即失敗，不能只因出現 CREATE/ALTER ROLE 或 PASSWORD 關鍵字而失敗 | PM_GOV_003, QA_DBM_001 | 第二次 QA_FAILED root-cause review；目前 3 個命中 operand 均為核准 marker，active/full DSN 零命中 |
| `PM_GOV_001-D20` | `APPROVED` | Pilot 身分不得提升正式 DB RBAC：allowlist `admin` 必須綁定 active DB `boss`，`engineer` 必須綁定 active DB `engineer`；兩者都必須指派至明確 Pilot site，有效權限為 Pilot role、DB RBAC、Pilot site 三者交集 | DSG_PIL_001, DEV_PIL_001, QA_PIL_001 | 修正 email-only allowlist 與 DB user/role/site 未綁定的候選缺口 |
| `PM_GOV_001-D21` | `APPROVED` | Temporary Pilot Session 是內網測試 bootstrap，不是 production authentication；只允許 synthetic data、受信任內網/VPN 與 HTTPS，禁止 Internet／production data／production credential；正式 OIDC、MFA、rate limit 於 Pilot 後或部署 gate 處理 | DSG_PIL_001, DEV_PIL_001, OPS_PIL_001 | 延續使用者的輕量快速內網 Pilot 路線，明確記錄剩餘風險與部署硬邊界 |
| `PM_GOV_001-D22` | `APPROVED` | CSV Bundle v2 Browser 驗收採固定五檔；Full round-trip 比較完整 canonical Project，Safe round-trip 比較 `safeCanonical(original)`；masked credential 只供預覽且不得寫回；輸入上限為五個 CSV／一份文件、單檔 10 MiB、批次 25 MiB | DEV_SEC_001, DEV_IMP_001, DEV_EXP_001, QA_IMP_001 | 2026-08-25 使用者核准執行 QA_IMP_001 規劃；ZIP 匯入仍不在本階段，需先解壓後選取 CSV |
| `PM_GOV_001-D23` | `APPROVED` | CSV Bundle v2 是 strict exchange protocol：固定五個 canonical members、canonical filename 唯一、bundle schema／sharing 一致，且須依 `File Gate → Manifest Gate → Envelope／Row Validation → Relation／Missing Info → Preview → Apply` 執行；v1 三檔只保留隔離的 legacy compatibility，不得降低 v2 gate | PM_GOV_004, DSG_IMP_002, DEV_IMP_002, DEV_EXP_002, DEV_SEC_002, QA_IMP_001 | 2026-08-26 QA_IMP_001 root-cause review；Release 維持 blocked，先完成設計合約再依序修正與同票重驗 |
| `PM_GOV_001-D24` | `APPROVED` | Internal Pilot 功能範圍 freeze；以 `cbce10bba027d246ef78e92a1e2f01660da55e1f` 為 checkpoint base，原 dirty workspace 保持不動，先建立可驗證 recovery snapshot，再於獨立 worktree依 Ticket／hunk拆分 commit，最後由 QA_REL_001 驗證逐 commit 與 frozen-tree equivalence；正式設計以 `RELEASE-CHECKPOINT-CONTRACT.md` 為準 | DSG_REL_001, PM_REL_001, DEV_REL_001, QA_REL_001 | 2026-08-30 使用者核准 DSG_REL_001 設計並要求移交執行；後續 DEV_REL_001 因 raw patch secret boundary stop evidence 停止。2026-08-31 使用者核准 DSG_REL_001-R1，DEV_REL_001 改用 sanitized overlay recovery 重啟 |
| `PM_GOV_001-D25` | `APPROVED` | 優先驗證產品功能在工程師實務工作流的正確性；`DEV_REL_001` Release checkpoint 暫緩，先執行 QA-only `QA_PIL_003` Browser UAT。此驗證不改產品語意，因此不新增 DSG 前置；若發現缺陷，再由 PM 建立最小 DEV 修復票 | QA_PIL_003, DEV_REL_001, QA_REL_001 | 2026-08-31 使用者明確要求先往功能性 Ticket 執行，避免繼續耗時於 Release／DSG 細節 |
| `PM_GOV_001-D26` | `APPROVED` | 較大功能區塊須先完成獨立 QA，再由開發組建立可辨識 checkpoint；`QA_REL_001` 通過 recovery／逐 commit／frozen-tree equivalence 後，開發組可將 checkpoint branch push 至既有 origin。此授權不包含 merge、deploy 或改寫既有遠端歷史 | DEV_REL_001, QA_REL_001 | 2026-09-01 使用者要求完成較大區塊後責請開發組 git push；`QA_PIL_003` 已完成獨立完整 UAT，故解除 D25 暫緩並啟動 checkpoint 流程 |

## 更新規則

- Decision ID 不重用。
- 推薦只能是 `PROPOSED` 或 `WAITING_APPROVAL`。
- 只有使用者／PM 明確確認才能改為 `APPROVED`。
- 被新決策取代時改為 `SUPERSEDED`，並填入新 Decision ID。
- 工單不得引用 `WAITING_APPROVAL` 作為開始實作的依據。
