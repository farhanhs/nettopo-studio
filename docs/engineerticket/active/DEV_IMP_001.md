# DEV_IMP_001 — TXT／MD／CSV Preview 與套用流程

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | IMP |
| Priority | P1 |
| Status | QA_RETURNED |
| Planned Order | 040 |
| Checkpoint | Transfer Import |
| Dependencies | DEV_SEC_001 READY_FOR_QA |
| Created／Updated | 2026-08-10／2026-08-26 |

## Objective

檔案先解析為 draft，經 Zod、Preview、Missing Info 與使用者確認後，才經 Zustand `importProject` 寫入 PostgreSQL／Dexie。

## Approved Contract

- `PM_GOV_001-D22`；TXT／MD 一次一份，CSV v2 固定五檔，v1 三檔相容。
- ZIP import、credential restore、DOCX/PDF/OCR 不在本票。
- v2 五檔必須齊全；credentials／missing-info 可 header-only。
- 五個 CSV／一份 document；單檔 10 MiB、批次 25 MiB。
- mixed source、unknown/duplicate filename、mixed schema/sharing、broken relation fail closed。
- Blocking 不可 Apply；排除不完整記錄後重算；Warning 需固定 acknowledgement。
- Cancel 對畫布、Zustand、Dexie、PostgreSQL 零寫入。

## Apply Semantics

- `new`：建立新 topology，原 topology 不變。
- `merge`：保留原資料，碰撞 ID deterministic remap，所有關聯同步。
- `replace`：只取代 active topology，確認前零寫入。
- 所有策略 reload 後一致；masked credentials 不寫回 credential store。

## Verification Gate

Browser 拖放／picker、Preview、排除、ack、new/merge/replace、reload、DB/Dexie snapshot；QA 不得修改產品碼。

## QA Return — 2026-08-26

`QA_IMP_001` 已證明 v2 缺檔、duplicate canonical filename、mixed sharing 與 pre-read size gate 未符合 D22。本票保留既有交付歷史，修正工作移至 `DSG_IMP_002 → DEV_IMP_002`；不得直接在本票以零散條件修補後宣稱重新送驗。
