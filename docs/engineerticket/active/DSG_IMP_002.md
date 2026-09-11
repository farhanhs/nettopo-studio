# DSG_IMP_002 — Import／Export v2 Strict Bundle Contract

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | IMP |
| Priority | P0 |
| Status | READY |
| Planned Order | 046 |
| Checkpoint | Transfer Contract Correction |
| Dependencies | PM_GOV_004 READY；PM_GOV_001-D22/D23 |
| Created／Updated | 2026-08-26／2026-08-26 |

## Objective

把 CSV Bundle v2 從寬鬆 parser 收斂為可實作、可驗證且不可由 UI 繞過的正式交換協定；同時明訂 v1 legacy 三檔相容邊界。設計完成後停下交 PM 確認，不得直接啟動開發。

## Required Deliverables

設計組須新增 `docs/engineerticket/contracts/CSV-BUNDLE-V2-CONTRACT.md`，並在本票記錄交付結果，至少包含：

### 1. Validation pipeline and ownership

- 固定 `File Gate → Manifest Gate → Envelope／Row Gate → Relation／Missing Info → Preview → Apply` 順序。
- Browser adapter、pure transfer core、Zod schema、Zustand apply 各自只負責哪一層。
- `File Gate` 必須在 `File.text()`／Papa Parse／ZIP／Zod 之前；核心 API 也要能接收並驗證 size metadata，不能只靠 UI。

### 2. File and manifest contract

- v2 canonical members 必須正好包含：`devices.csv`、`links.csv`、`groups.csv`、`credentials.masked.csv`、`missing-info.csv`。
- credentials／missing-info 無資料時仍須存在且 header-only。
- canonical filename 規則：取 basename、Unicode NFC、ASCII lowercase；空名、路徑偽裝、canonical 後重複皆 blocking；禁止 `Map` last-wins。
- 五個 CSV／一份 TXT 或 MD；單檔最大 10 MiB、批次最大 25 MiB；mixed document+CSV、unknown member、ZIP import 均 blocking。
- 明訂 row limit、header width／cell length 等 parser 資源上限與超限行為。

### 3. Mode, version and sharing

- 提供 v1/v2 判定 truth table；以 canonical header／manifest 特徵先判模式，不以「任一成功 row」猜測版本。
- v2 所有非空 row 的 `schemaVersion` 與 `sharing` 必須 bundle-level 一致。
- 全部 header-only 時的 v2/version/sharing 推導規則；empty member 繼承 bundle envelope 的規則。
- v1 僅允許 legacy `devices.csv`／`links.csv`／`groups.csv` 相容模式，不能帶 v2-only member 或放寬 v2 五檔要求。

### 4. Typed data and error model

- 定義 `ImportFileDescriptor`、`BundleManifest`、`BundleEnvelope`、`ImportIssue`、`ImportPlan` 欄位與信任邊界。
- 至少定義 blocking codes：`FILE_COUNT_LIMIT`、`FILE_SIZE_LIMIT`、`BATCH_SIZE_LIMIT`、`MIXED_SOURCE_KIND`、`UNKNOWN_MEMBER`、`DUPLICATE_CANONICAL_FILENAME`、`V2_MEMBER_MISSING`、`CSV_HEADER_INVALID`、`BUNDLE_VERSION_MIXED`、`BUNDLE_SHARING_MIXED`、`ROW_LIMIT`。
- 錯誤不得回顯 secret、完整 CSV row、路徑、token 或 raw parser exception；每個 code 要有 Preview 文案與 source evidence 範圍。

### 5. Preview and apply state machine

- Blocking 時 `plan.canApply=false`，Apply control disabled，且事件 handler 仍要 fail closed；不能只靠按鈕 disabled。
- Warning acknowledgement、blocking exclusion／cascade revalidation、Cancel zero-write 的狀態轉移。
- 唯一策略／確認控制，避免兩套 UI state 造成 bypass。

### 6. Export, round-trip and secret boundary

- ZIP export 正好五個 canonical members，沒有資料仍輸出 headers。
- Full 比較完整 `canonicalProject`；Safe 比較 `safeCanonical(original)`；欄位排序、空值、數字、座標與關聯 remap 要明確。
- `credentials.masked.csv` 只供 preview；masked/raw/ciphertext/nonce 均不得寫入 Project／Zustand／Dexie project／PostgreSQL topology data。
- 列出 DOM、console、network、audit、JSON、CSV、ZIP 的允許／禁止敏感欄位。

### 7. Test and file ownership map

- unit／integration／Browser E2E 的 positive、negative、boundary matrix。
- 明訂 `DEV_IMP_002`、`DEV_EXP_002`、`DEV_SEC_002` 可修改檔案與高衝突 hunk ownership。
- QA 必須能以 QA-only fixture 直接驗證核心 contract，且 Browser 證據不得由 source scan 取代。

## Stop Condition

設計完成後將本票標為 `WAITING_APPROVAL`，通知 PM 並停止。不得修改 `app/`、`db/`、產品測試、package、migration，也不得自行啟動任何 DEV／QA ticket。

## Design Output — 2026-08-26

已新增正式設計契約：[CSV-BUNDLE-V2-CONTRACT.md](../contracts/CSV-BUNDLE-V2-CONTRACT.md)。

本設計將 CSV Bundle v2 收斂為 strict exchange protocol，固定 pipeline：

```text
File Gate → Manifest Gate → Envelope／Row Gate → Relation／Missing Info → Preview → Apply
```

本票已完成設計輸出。使用者批准前不得啟動 DEV／QA；批准後可依 `DEV_IMP_002 → DEV_EXP_002 → DEV_SEC_002 → QA_IMP_001 Re-test` 順序推進，且每張 DEV ticket 仍須遵守自身 allowed scope、依賴與停止條件。

## PM Approval — 2026-08-26

使用者已確認採用本設計：

- all-header-only v2 bundle 採推薦方案：視為空的 v2 safe bundle，僅產生 info issue `EMPTY_V2_BUNDLE`，不 blocking。
- 開發依序交由開發組處理：`DEV_IMP_002 → DEV_EXP_002 → DEV_SEC_002`。
- 開發完成後需交測試組執行 `QA_IMP_001` re-test 並產出初報告。

本設計票狀態更新為 `READY`；實作啟動仍須遵守各 DEV ticket 的 allowed scope、依賴與停止條件。
