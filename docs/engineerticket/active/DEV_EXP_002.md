# DEV_EXP_002 — Canonical Five-file Export／Round-trip Correction

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | EXP |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 048 |
| Checkpoint | Transfer Export Correction |
| Dependencies | DSG_IMP_002 approved；DEV_IMP_002 READY_FOR_QA |
| Created／Updated | 2026-08-26 |

## Objective

依同一份 v2 contract 收斂 Safe／Full 五檔 ZIP 與 round-trip canonical equality，避免 exporter 與 importer 各自解讀 schema、sharing、header-only 或空值。

## Minimum Scope

- ZIP 正好五個 canonical members；empty credentials／missing-info 仍輸出核准 headers。
- 每個非空 row 的 schemaVersion／sharing 與 bundle mode 一致；禁止同一 bundle 混用 Safe／Full。
- Safe default；Full 仍受 feature flag + Pilot admin + active DB boss + Pilot site binding 控制。
- Full round-trip 比較 `canonicalProject`；Safe 比較 `safeCanonical(original)`，包含關聯、空值、座標、quantity、group 與 missing-info。
- CSV formula neutralization 與 deterministic 欄位／row order 不回歸。

## Release Evidence

完成 pure round-trip regression 與真 ZIP 解壓五檔檢查，並通過 tsc、scoped lint、build:local；完成後只可標 `READY_FOR_QA`。

## Development Evidence — 2026-08-26

- 新增 `canonicalProjectForTransfer()`，供 Full／Safe round-trip regression 使用同一 canonical 比較規則。
- CSV formula neutralization 擴充至 LF 與全形 `＝＋－＠` 觸發字元；既有 ASCII `= + - @ tab CR` 不回歸。
- 新增 `tests/dev-exp-002-export-contract.test.mjs`，覆蓋 canonical five members、ZIP 五檔、safe/full sharing consistency、safe/full round-trip equality、formula hardening。
- 驗證：targeted transfer/export tests PASS，33/33；`tsc --noEmit` PASS；scoped ESLint PASS；`build:local` PASS；full Node tests 178 pass／9 skip／2 fail（兩個 fail 為真 PostgreSQL QA fixture 缺 `DATABASE_URL`，非本票）。
