# QA_PIL_002 — Internal Pilot Browser Critical Flow

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | PIL |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 032 |
| Checkpoint | Internal Pilot |
| Dependencies | QA_DBM_001 QA_PASSED, QA_PIL_001 QA_PASSED |
| Created／Updated | 2026-08-17／2026-08-20 |

## Objective

在可運行的 Pilot 環境完成真實 Browser 流程，不以 rendered HTML 或 source guard 取代互動驗證。

## Required Flow

1. 以 Pilot profile 啟動。
2. Allowlisted Engineer login。
3. 顯示 INTERNAL PILOT 與 synthetic data 警告。
4. 依已批准規則建立 Customer／Topology。
5. TXT／MD／CSV drop → preview。
6. Cancel 不寫入。
7. Apply 經 Zustand action 寫入。
8. 編輯 canvas 並重新載入確認持久化。
9. Safe CSV ZIP 固定五檔。
10. Full export 不可用或由批准的 Admin gate 控制。
11. Logout 後舊 cookie 不能讀 protected API。

## Test Environment Boundary

- 僅綁定 loopback 的本機 Pilot server；不得部署、開放 LAN／Internet 或改 reverse proxy。
- 使用 QA-only Pilot site、Admin／Engineer 與 synthetic topology fixture；不得使用 production data／credential，結束後必須清理並證明零殘留。
- Pilot startup 必須使用 `.env.local` 既有 DB role 邊界；測試輸出不得顯示 password、完整 DSN、session secret、cookie value 或 credential 原文。
- Browser 行為必須以真實互動與 network response 驗證；rendered HTML、source guard、Node handler test 只能作補充。
- Engineer 與 Admin 分開登入驗證；不得透過修改 client state、local storage 或偽造 identity header 取得角色。
- 若 Import／Export 候選功能在 Browser 流程失敗，照實 `QA_FAILED` 並回傳具體斷點，不得縮小 Required Flow。

## Security / Failure Matrix

- 未登入直接開 workspace 或 protected API：401，且不顯示 synthetic topology。
- Engineer login：只見 Pilot site；可依 D05 建立 synthetic Customer／Topology；Credential／Audit／Full export 不可用。
- Admin login：只見 Pilot site；Full export 仍受 feature flag 控制，預設 off。
- Cookie tamper／logout／allowlist version revoke 後，舊 cookie 必須失效。
- Mutation network request 必須 same-origin、JSON、no-store；跨站資源 ID 不得由 UI 或 API 旁路。
- TXT／MD／CSV preview 的 Cancel 為零寫入；Apply 後才寫入；reload 後資料一致。
- Safe ZIP 必須固定五檔，內容與檔名通過 secret/formula scan；Full export 不得由 Engineer 啟用。

## Acceptance Evidence

- [x] Browser 測試步驟與結果。
- [x] 必要 screenshot／錄影或自動化 log。
- [x] Network response status、security headers 與 cookie attributes。
- [x] DB／Dexie 寫入前後證據。
- [x] Export ZIP 與 secret scan 證據。
- [x] QA-only DB fixture cleanup 計數為 0。
- [x] Browser critical flow 的 pass／fail／skip 與第一個阻擋點均寫入獨立測試紀錄。

## QA Result — 2026-08-20

- 結果：`QA_PASSED`（保留首輪 `QA_FAILED` 歷史；2026-08-24 Pilot session identity display quick re-test 通過）。
- 測試紀錄：`docs/dev測試紀錄/qa-pil-002-browser-2026-08-20.md`。
- 自動化摘要：`docs/dev測試紀錄/qa-pil-002-browser-summary.json`。
- 截圖：`docs/dev測試紀錄/screenshots/qa-pil-002-engineer-login.png`、`qa-pil-002-engineer-created-customer.png`、`qa-pil-002-txt-preview.png`、`qa-pil-002-csv-applied.png`。
- 首輪阻擋點：Allowlisted Engineer 登入 Pilot 後，workspace 曾顯示 `本機 Demo`／`DEV-DEMO`；已修正為使用 Pilot-bound `currentUser` 顯示，且 reload 會優先驗 `/api/session`。
- 已確認：未登入 401、Pilot login 200、cookie attributes、no-store/security headers、Engineer create synthetic Customer／Topology、Credential/Audit deny、TXT/MD/CSV preview/apply、reload persistence、safe CSV ZIP 五檔、logout/tamper/revoke 401、Admin/Engineer full export gate、QA-only DB fixture cleanup 為 0。

## Stop Condition

任一 required flow、security boundary、fixture cleanup 或敏感資料掃描失敗，狀態為 `QA_FAILED`。完成後停止交 PM，不自行啟動 `QA_IMP_001`、Release、checkpoint commit 或 deploy。
