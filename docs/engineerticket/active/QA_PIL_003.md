# QA_PIL_003 — 工程師實務工作流 UAT

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | PIL |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 033 |
| Checkpoint | Functional UAT |
| Owner | 測試組 |
| Created | 2026-08-31 |
| Updated | 2026-08-31 |

## Objective

以真實 Browser、真實 Pilot API／PostgreSQL 與合成的工程交接資料，證明一名內部工程師能在不使用 DevTools、直接改 DB 或繞過 UI 的情況下，完成「建立拓樸 → 匯入 → 檢查缺失 → 修正畫布 → 儲存重載 → 安全匯出 → 再匯入」工作。

## Approved Decisions

- `PM_GOV_001-D03`：先驗證 Internal Pilot，正式 RBAC 延後。
- `PM_GOV_001-D04`：只用 synthetic data，不使用正式 credential。
- `PM_GOV_001-D05`：Pilot Engineer 可建立 synthetic Customer／Topology。
- `PM_GOV_001-D07`：Full export 預設禁用。
- `PM_GOV_001-D09/D10`：直角避障、最近邊連接點與必要時 offset。
- `PM_GOV_001-D22/D23`：CSV Bundle v2 五檔、strict validation、safe round-trip 與 secret boundary。
- `PM_GOV_001-D25`：先做功能實用性驗證，Release checkpoint 暫緩；QA-only 驗證不需新增設計票。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 優先確認功能在工程師實際工作上是否正確、可完成任務，不再先投入 Release／DSG 流程細節 |
| Historical Sources | `QA_PIL_002` Browser flow、`QA_IMP_001` Import／Export E2E、`QA_UIX_001` routing 驗收、CSV Bundle v2 contract |
| Change Type | EXTEND（擴充驗收情境，不改產品語意） |
| Affected Layers | QA、Browser、Pilot、Import、Export、Canvas、Persistence、RBAC |
| Preserved Invariants | synthetic-only；不得存取正式資料／credential；Engineer 不得讀 Credential/Audit/Full export；Pilot site scope；safe export 不得含 secret |
| Conflict Check | 不修改產品程式、不變更 DSG_REL_001-R1；`DEV_REL_001` 僅因優先順序暫緩 |
| Regression Map | QA_PIL_002、QA_IMP_001、QA_UIX_001、QA_DBM_001；必要時執行 targeted regression，不以 unit/source scan 代替 Browser UAT |
| Rollback／No-path | 測試失敗只記錄證據並停止；不得由 QA 修改產品碼配合通過；由 PM 依首個可重現缺陷建立最小 DEV 修復票 |

## Dependencies

- `QA_DBM_001 = QA_PASSED`
- `QA_PIL_001 = QA_PASSED`
- `QA_PIL_002 = QA_PASSED`
- `QA_IMP_001 = QA_PASSED`
- `QA_UIX_001 = QA_PASSED`

## Test Scenario

使用 QA-only synthetic 客戶資料，內容應接近工程師收到的交接筆記：至少包含設備名稱／類型／IP、數筆連線、群組，以及刻意缺少的 port、VLAN、位置或管理資訊；可包含 credential-shaped 測試字串，但不得使用任何真實 secret。

### Primary Engineer Flow

1. 以 Pilot profile 在 loopback 啟動，使用 allowlisted Engineer 登入。
2. 建立新的 synthetic Customer 與 Topology。
3. 拖放 TXT、MD 與 CSV；不得靠 DevTools 注入檔案或狀態。
4. Preview 必須正確顯示設備數、連線數、遮蔽結果及 Missing Info Checklist。
5. 先取消一次並證明 DB／state 零寫入，再重新匯入並套用。
6. 若有 blocking item，使用 UI 排除不完整記錄；warning/info 必須依核准 acknowledgement 才能套用。
7. 在畫布移動設備、建立或修正連線、檢查 wired 直角避障、最近邊 anchor 與重疊 offset；不得有線穿越非端點設備。
8. 儲存並 reload；Customer、Topology、設備、連線、群組、位置與畫布結果必須一致。
9. 匯出 Safe CSV ZIP；必須正好五個 canonical members，解壓內容不得含 sentinel secret 或 formula injection。
10. 將匯出 CSV 以 New 或 Replace 再匯入，依 safe canonical equality 驗證可還原。
11. 登出後舊 session 不可再讀 protected API。

### Role Boundary Spot Check

- Engineer 看不到 Credential／Audit／Full export，不能靠已知 ID 越權。
- Admin 僅看到 Pilot site；Full export 仍受 feature flag 與 DB boss mapping 控制。
- 不使用 client state 修改、identity header 或直接 DB update 來完成正常流程。

## Practical Usability Evidence

除了 pass/fail，必須記錄：

- 每個主要任務是否能由 UI 自行發現並完成。
- 完成時間、重試次數、卡住步驟與需要猜測的欄位。
- Preview、Missing Info、Apply strategy、Canvas link 操作與 Export 的使用者可理解性。
- 分級：`BLOCKING`（任務無法完成／資料錯誤或遺失）、`MAJOR_FRICTION`（可完成但容易誤操作）、`MINOR`、`OBSERVATION`。
- 問題必須附重現步驟、預期／實際結果、截圖及 network／DB evidence；不得只寫主觀感受。

## In Scope

- QA-only fixtures、Browser automation／人工互動證據、必要的 QA test 與測試紀錄。
- 實際 Pilot API、PostgreSQL persistence、CSV ZIP 與畫布互動。
- 發現問題後提出缺陷摘要與建議的最小 DEV ticket 範圍。

## Out of Scope

- 修改產品程式、schema、migration、package、env、RBAC 語意或設計 contract。
- Release recovery、checkpoint commit、push、部署或 LAN／Internet 開放。
- 正式 OIDC、MFA、正式資料與正式 credential。

## Allowed Files／Systems

- `tests/qa-pil-003-*`
- `docs/dev測試紀錄/qa-pil-003-*`
- `docs/dev測試紀錄/screenshots/qa-pil-003-*`
- 本 Ticket 與 `TICKET-REGISTER.md` 的 QA 狀態欄位
- loopback Pilot、QA-only PostgreSQL fixture 與暫時 Browser profile

## Forbidden Changes

- `app/`、`db/`、`scripts/`、產品 tests、migration、package 或正式環境設定。
- 為通過測試而降低 security／validation gate。
- 省略 Browser 流程後以 source scan 或既有 pass 代替。

## Acceptance Criteria

- [x] Primary Engineer Flow 逐步完成，無 `BLOCKING` 問題。
- [x] 匯入結果、reload persistence 與 Safe round-trip 資料正確。
- [x] Canvas 連線具可讀性，未發生穿越非端點設備或錯誤 anchor。
- [x] Engineer／Admin 權限邊界未退步。
- [x] sentinel secret 在 DOM、network、DB、Audit、JSON、CSV、ZIP 中均無不允許的明文。
- [x] QA fixture 與 Browser profile 清理完成，DB 殘留計數為 0。
- [x] 產出實用性紀錄；`MAJOR_FRICTION` 可列後續改善，但資料錯誤、安全錯誤或任務無法完成必須 `QA_FAILED`。

## Stop Condition

發現第一個可重現的 `BLOCKING`、資料損失、越權、secret leakage 或需改產品語意才能繼續時，立即保留證據並標 `QA_FAILED`，交 PM 拆最小修復票。QA 不得修改產品程式，也不得啟動 Release、OPS 或 deploy。

## Handoff History

| Date | From | To | Status | Summary |
|---|---|---|---|---|
| 2026-08-31 | PM | QA | READY | 使用者要求先驗證功能實用性；跳過新增 DSG 階段，直接執行工程師端到端 UAT |
| 2026-08-31 | QA | QA | IN_QA | 測試組啟動同票 UAT；保留 QA-only 範圍，不修改產品碼、Release、OPS 或 deploy |
| 2026-08-31 | QA | PM | QA_FAILED | 真 Browser UAT 於 Canvas/link inspector 觸發 BLOCKING：右下登入者資料卡片 `session-profile` 攔截 `儲存連線` 點擊，工程師無法完成修正連線流程；fixture cleanup=0 |
| 2026-08-31 | PM | QA | IN_QA | DEV_UIX_004 已 READY_FOR_QA；QA_PIL_003 同票 re-test，保留首輪 QA_FAILED 歷史並執行完整 UAT |
| 2026-08-31 | QA | PM | QA_FAILED | DEV_UIX_004 原遮擋 blocker 已解除，但完整 UAT 停在 Canvas drag persistence：正常路徑選取 Router 並拖曳後，DB 中 `uat-router` 座標仍為 `x=80,y=160`；fixture cleanup=0 |
| 2026-09-01 | PM | QA | IN_QA | DEV_UIX_004/005 與 DEV_PIL_003 後同票完整 UAT 重驗；保留先前 QA_FAILED 歷史，不啟動 deploy/Release |
| 2026-09-01 | QA | PM | QA_PASSED | 同票完整 Browser/Pilot/PostgreSQL UAT 通過：topbar 不遮擋、drag/reload persistence、Pilot-only logout、TXT/MD/CSV import、routing、Safe ZIP、formula/secret scan、round-trip、Admin/Engineer spot check 與 cleanup=0 全通過 |

## QA Result — 2026-08-31 UAT

結果：`QA_FAILED`

第一個可重現 blocker：

- Engineer 匯入 CSV Bundle 並進入連線 Inspector 修正 port／speed 後，`儲存連線` 按鈕可見且 enabled。
- 真 Browser 點擊時被右下角 `aside.session-profile` 登入者資料卡片攔截 pointer events。
- 因無法送出 `/api/topology` POST，工程師主流程停在「修正連線」步驟，未能進入 routing、reload、safe export 與 round-trip。

已完成到失敗點前的驗證：

- 未登入 protected API 401。
- Pilot Engineer login 200；cookie attributes 符合 `__Host-`、Secure、HttpOnly、SameSite=Strict、Path=/、6h TTL。
- Pilot UI 未顯示 development identity selector。
- UI 建立 synthetic Customer／Topology 成功。
- Engineer 只看到 Pilot site；跨站 QA fixture 不可見。
- Engineer credential write 403；audit read 403。
- TXT/MD/CSV preview、masked credential summary、Missing Info、Cancel zero-write、blocking exclusion、warning acknowledgement、CSV apply 通過至失敗點。
- CSV Apply 後 masked credential 未寫入 `device_credentials`。
- finally cleanup 後 QA fixture counts：sites/users/customers/topologies/credentials/audit_logs 全部 0。

證據：

- 測試紀錄：`docs/dev測試紀錄/qa-pil-003-uat-2026-08-31.md`
- Summary：`docs/dev測試紀錄/qa-pil-003-uat-summary.json`
- Failure screenshot：`docs/dev測試紀錄/screenshots/qa-pil-003-failure-session-profile-overlap.png`

## QA Re-test Result — 2026-08-31 DEV_UIX_004 後

結果：`QA_FAILED`

結論：

- DEV_UIX_004 已解除首輪 `session-profile` 遮擋 Inspector action 的 blocker；QA re-test 已可點擊 `儲存連線` 並收到 `/api/topology` POST 200。
- 依 PM 指示補強 QA-only script：route DOM 明細、safe drag fixture、wireless create 後 DB wait、drag 後 DB wait、正常使用者路徑「設備頁籤 → 選 Router → 拖曳」。
- 補強後確認 routing DOM 正常：3 wired routes 為 `orthogonal/resolved`，1 wireless route 為 `wireless/resolved`，shared corridor offset 有觀察到。
- 新的第一個可重現 blocker：Canvas drag persistence。拖曳後 PostgreSQL Project 內 `uat-router` 仍維持 `x=80,y=160`，無法完成 reload persistence 與後續 safe export／round-trip。

證據：

- 測試紀錄：`docs/dev測試紀錄/qa-pil-003-uat-2026-08-31.md`
- Summary：`docs/dev測試紀錄/qa-pil-003-uat-summary.json`
- Screenshot：`docs/dev測試紀錄/screenshots/qa-pil-003-failure-session-profile-overlap.png`
- Cleanup：sites/users/customers/topologies/credentials/audit_logs 全部 0。

## QA Re-test Result — 2026-09-01 DEV_UIX_004/005 + DEV_PIL_003 後

結果：`QA_PASSED`

摘要：

- QA 獨立重跑 `tests/qa-pil-003-engineer-uat.mjs`，不採信 PM preflight 直接放行。
- DEV_UIX_004：1280×900 下 `session-profile` 不再遮擋 Inspector action；`儲存連線` 正常 pointer click POST 200。
- DEV_UIX_005：Router 拖曳後座標持久化；reload 後 Project 維持 3 devices / 4 links / 1 group 且 moved router persisted。
- DEV_PIL_003：Pilot logout 嚴格送 `DELETE /api/pilot/session`；logout 後 protected API 401；tampered cookie 401。
- Import/Export：TXT/MD/CSV preview、masked credential、Missing Info、blocking exclusion、warning acknowledgement、Cancel zero-write、Safe ZIP 五檔、formula neutralization、safe canonical round-trip 全部通過。
- Routing：3 wired routes `orthogonal/resolved`；1 wireless route `wireless/resolved`；shared corridor offset observed。
- RBAC/Security：Engineer credential write 403、audit read 403、Full CSV disabled；Admin 只見 Pilot site，Full CSV 預設 disabled；secret/sentinel scan 無命中。
- Cleanup：QA fixture counts 全部 0。

驗證：

- Browser UAT：PASS。
- Targeted DEV_UIX_004/005 + DEV_PIL_003：8/8 PASS。
- TypeScript：PASS。
- Scoped ESLint：PASS。
- `build:local`：PASS，僅既有 build warning。
- `git diff --check`：PASS，僅既有 CRLF warning。

證據：

- 測試紀錄：`docs/dev測試紀錄/qa-pil-003-uat-2026-08-31.md`
- Summary：`docs/dev測試紀錄/qa-pil-003-uat-summary.json`
- Canvas screenshot：`docs/dev測試紀錄/screenshots/qa-pil-003-07-canvas-routes.png`
