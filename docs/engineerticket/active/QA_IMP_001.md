# QA_IMP_001 — Import／Export Browser E2E、Round-trip 與 Secret Scan

| 欄位 | 值 |
|---|---|
| Group | QA |
| Feature | IMP |
| Priority | P0 |
| Status | QA_PASSED |
| Planned Order | 042 |
| Checkpoint | Transfer Acceptance |
| Dependencies | DEV_SEC_001／DEV_IMP_001／DEV_EXP_001 READY_FOR_QA；QA_PIL_002 QA_PASSED |
| Created／Updated | 2026-08-25／2026-08-29 |

## Objective

以真 Browser、真 PostgreSQL 與真 Dexie 證明 Import Preview、三種套用策略、五檔 ZIP、Safe／Full gate、Round-trip 與 plaintext-secret boundary。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | TXT／MD／CSV 預覽確認後寫入；CSV 五檔可安全雙向交換且可驗證還原 |
| Historical Sources | CSV Bundle v2 handoff／acceptance、QA_PIL_002、Requirement Baseline |
| Approved Decisions | `PM_GOV_001-D04`、`D07`、`D11`、`D12`、`D22` |
| Change Type | VERIFY；發現產品缺口另開 CORRECT ticket |
| Affected Layers | Parser、Zod、Preview、Zustand、Dexie、API、PostgreSQL、ZIP、Security、Browser |
| Preserved Invariants | Project 無 credential；QA 不改產品；Pilot site/RBAC；Migration/runtime boundary |
| Rollback／No-path | QA fixture finally cleanup；失敗保留證據並依 IMP／EXP／SEC 路由退件 |

## Checkpoints

### IMP-A — Contract／Parser

- TXT、MD、CSV v1/v2、ZIP拒絕、mixed/unknown/duplicate file、schema/sharing一致性。
- 五檔/大小/row limits、duplicate ID、broken endpoint/group、XSS與formula input。

### IMP-B — Preview／Missing Info

- counts、masked summary、Blocking/Warning/Info、source evidence。
- Cancel zero-write；blocking exclusion cascade；warning acknowledgement。
- 畫面不得同時出現兩套可操作的 strategy/confirm controls。

### IMP-C — Apply／Persistence

- `new`／`merge`／`replace` 的 DB／Zustand／Dexie 前後 snapshot與 reload。
- merge ID remap及 link/group/credential preview reference一致。
- replace 不影響其他 topology；masked credential 不寫回。

### EXP-A — ZIP／Safe-Full

- Safe 預設、Engineer Full deny、Admin+Boss+flag gate。
- ZIP 正好五檔；header-only權限策略；formula與secret scan。

### EXP-B — Round-trip

- Full：export → unzip → import → apply → reload → re-export，canonical Project 100% equality。
- Safe：同流程，比較 `safeCanonical(original)`。

### SEC-A — Secret Boundary

- sentinel scan：Project、Zustand、Dexie、DOM、console、network、PostgreSQL、Audit、JSON、CSV、ZIP。
- raw username/password/secret、ciphertext/nonce、cookie/token/DSN 任一命中即 P0 fail。

## QA Boundaries

- 可新增 QA-only fixture/test/script/screenshot/log與更新本票/register。
- 禁止修改 `app/`、`db/`、產品 tests、migration、OPS script、DB role/grant或 `.env.local` 配合通過。
- 使用 loopback Pilot與 QA-only synthetic fixture；結束後 DB/Dexie cleanup=0。
- Browser evidence 不得以 source scan取代；Browser工具不可用時須完成 troubleshooting並如實記錄。

## Failure Routing

- Parser／Preview／Apply → `DEV_IMP_002`。
- ZIP／Safe-Full／Round-trip → `DEV_EXP_002`。
- Secret/persistence → `DEV_SEC_002`，P0。
- QA selector／fixture問題留在本票，不改產品。

## Stop Condition

Cancel寫入、round-trip遺失、secret命中、Full權限旁路、masked credential寫回、replace跨 topology、五檔契約錯誤任一發生即 `QA_FAILED`。完成後停止交 PM，不啟 Release／commit／deploy。

## QA Result — 2026-08-25

結果：`QA_FAILED`。

主要 blocker：

- CSV Bundle v2 缺 `credentials.masked.csv` 仍被接受。
- 同批次重複 `devices.csv` 仍被接受，存在 last-wins 風險。
- 同一 v2 bundle 混用 safe/full sharing 仍被接受。
- 未找到 D22 10MiB single-file／25MiB batch 前置 size gate；10MiB runtime probe 超過 60 秒後中止。

測試紀錄：`docs/dev測試紀錄/qa-imp-001-2026-08-25.md`。

## PM Disposition — 2026-08-26

PM 以 `PM_GOV_004`／`PM_GOV_001-D23` 確認退件成立。本票維持 `QA_FAILED` 並保留首輪證據；先由 `DSG_IMP_002` 完成 contract，依序完成 `DEV_IMP_002 → DEV_EXP_002 → DEV_SEC_002` 且全數 `READY_FOR_QA` 後，才可在同票啟動 Re-test。不得跳過 Browser apply／round-trip／secret scan，也不得以本次 19/19 基礎測試取代未執行的 acceptance。

## QA Re-test — 2026-08-26

狀態：`QA_FAILED`。

DEV_IMP_002、DEV_EXP_002、DEV_SEC_002 已回 `READY_FOR_QA`，本輪以同票 Re-test 方式複驗；2026-08-25 `QA_FAILED` 歷史與證據保留不覆蓋。

Re-test 結論：

- PASS：strict import parser／manifest/file gate、export canonical round-trip、secret boundary developer regression、TypeScript、scoped ESLint、build:local、serial full Node tests。
- PASS：Browser oversized CSV 在 `File.text()` 前 blocking，DB zero-write。
- FAIL：正常 CSV Bundle v2 Browser Preview 中仍出現兩個 strategy select，違反 IMP-B「唯一策略／確認控制」與 `CSV-BUNDLE-V2-CONTRACT` Preview state machine。
- 附帶觀察：oversized blocking issue message 在 UI 中渲染 2 份。

測試紀錄：`docs/dev測試紀錄/qa-imp-001-retest-2026-08-26.md`。

建議退回 `DEV_IMP_002` Preview/UI hunk，移除舊 import summary/options/confirm controls 或保證不可操作、不可繞過。

## QA Re-test — 2026-08-29

狀態：`QA_PASSED`。

DEV_IMP_002 已回 `READY_FOR_QA` 並宣稱完成 QA Return Fix；本輪以同票 Re-test 方式複驗，保留 2026-08-25 首輪 `QA_FAILED` 與 2026-08-26 Re-test `QA_FAILED` 歷史與證據，不覆寫原始失敗原因。

Re-test 結論：

- PASS：Browser Preview duplicated controls return fix；strategy select、confirm action 與 oversized blocking issue 均為唯一渲染。
- PASS：oversized CSV 在 `File.text()` 前 fail closed，且 DB zero-write。
- PASS：warning acknowledgement、blocking fail-closed、Cancel zero-write、new／merge／replace PostgreSQL apply、masked credential zero-write。
- PASS：安全 CSV ZIP 正好五檔，解壓後重新匯入並 replace round-trip 通過；Pilot Engineer Full CSV disabled。
- PASS：strict parser／manifest、export round-trip、secret boundary、TypeScript、scoped ESLint、build:local、full Node tests、DB verify。
- BLOCKED（既有環境）：`npm.cmd run lint` 仍因 Windows 缺少 `bash` 無法執行；本輪 scoped ESLint 已通過。

測試紀錄：`docs/dev測試紀錄/qa-imp-001-retest-2026-08-29.md`。
