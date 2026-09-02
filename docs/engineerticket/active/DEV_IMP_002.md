# DEV_IMP_002 — Strict Import File／Manifest／Preview Gate

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | IMP |
| Priority | P0 |
| Status | READY_FOR_QA |
| Planned Order | 047 |
| Checkpoint | Transfer Import Correction |
| Dependencies | DSG_IMP_002 READY |
| Created／Updated | 2026-08-26／2026-08-29 |

## Objective

依核准後的 strict bundle contract 修正 `DEV_IMP_001` 退件項：在讀取／解析前拒絕超限輸入，建立 canonical manifest，阻擋缺檔、同名覆蓋、混版／混 sharing，並確保 Preview／Apply 無繞過路徑。

## Minimum Scope

- Browser file metadata 與 pure core 共用的 count／10 MiB each／25 MiB batch gate。
- v2 固定五檔、header-only optional members、duplicate canonical filename blocking。
- v1/v2 隔離辨識；bundle schemaVersion／sharing consistency。
- typed blocking issue、`canApply=false`、Apply handler fail closed、Cancel zero-write。
- preserve Papa Parse + Zod、new／merge／replace、Missing Info 與 masked preview boundary。

## Release Evidence

- QA 首輪四個 failing probes 全部先由 DEV regression 重現再修復。
- 邊界值涵蓋 `limit-1`、`limit`、`limit+1`；證明 oversized input 在 `File.text()`／parser 前被拒絕。
- duplicate canonical names 不得建立 lossy `Map`；缺任一 v2 member、mixed sharing/version 均 blocking。
- targeted tests、tsc、scoped lint、build:local 通過後只可標 `READY_FOR_QA`，不得自行啟動 QA。

## PM Approval — 2026-08-26

使用者已核准依 `CSV-BUNDLE-V2-CONTRACT` 執行 strict import 修正。本票可由開發組開始；完成後需留下初始開發報告，並依序解除／交接 `DEV_EXP_002`、`DEV_SEC_002`，三張修正票完成後再交測試組執行 `QA_IMP_001` re-test。

## Development Evidence — 2026-08-26

- 新增 core metadata gate：`ImportFileDescriptor`、10 MiB single-file、25 MiB batch、canonical filename duplicate/path spoof/unknown member fail closed。
- CSV Bundle v2 改為 strict manifest/envelope：五個 canonical members、header-only v2 safe empty bundle info issue、v1/v2 truth table、mixed schemaVersion/sharing blocking。
- `app/page.tsx` 匯入流程改為通過 metadata gate 後才 `File.text()`；`confirmImport()` 重新檢查 `canApply`、blocking issue、missing blocking、warning acknowledgement。
- 新增 `tests/dev-imp-002-transfer-contract.test.mjs`，並重跑 `QA_IMP_001` 首輪四個 failing probes。
- 驗證：targeted transfer tests PASS；`tsc --noEmit` PASS；scoped ESLint PASS；`build:local` PASS；full Node tests 178 pass／9 skip／2 fail（兩個 fail 為真 PostgreSQL QA fixture 缺 `DATABASE_URL`，非本票）。

## QA Re-test Return — 2026-08-29

`QA_IMP_001` 2026-08-26 Re-test 已確認 strict parser／manifest／file gate 與 oversized pre-read blocking 通過，但 Browser Preview 仍同時渲染兩個 strategy select，oversized issue message 也出現兩份。原因是 `app/page.tsx` 已掛入 `ImportPreviewModal`，下方仍保留舊 transfer picker／summary／issues／options／actions JSX；目前只靠 CSS 隱藏部分舊節點，並未形成唯一可存取控制樹。

本票重開為 `IN_PROGRESS`，只允許以下最小修正：

- `app/page.tsx`：刪除 `ImportPreviewModal` 之外的 legacy picker、summary、issues、strategy/name、replace warning、cancel/confirm JSX；保留 `FileDropZone` 與單一 `ImportPreviewModal`。
- `app/globals.css`：移除只為遮蔽 legacy transfer JSX 的 selector；可在同一 hunk 去除完全重複的 import-preview CSS 宣告，不做視覺重設計。
- `app/components/import/*`：只有在維持單一 Preview control ownership 所必需時才可修改。
- `tests/`：新增或補強 product regression，證明正常與 blocking Preview 均只有一份 summary／issue、一个 strategy select、一个 confirm action；不得修改 QA-only 測試來配合通過。

必須保留：

- `confirmImport()` 的 server/store write 前 fail-closed re-check。
- warning acknowledgement、blocking exclusion cascade、new／merge／replace 語意。
- 已通過的 metadata-first `File.text()` gate、v1/v2 contract、Safe／Full export、secret strip。

完成後須重跑 targeted transfer/UI tests、`tests/qa-imp-001-browser-retest.mjs` 的產品相關 probe（可作 developer preflight，但不得宣稱 QA 通過）、TypeScript、scoped ESLint、`build:local`。只能回到 `READY_FOR_QA`，不得自行啟動 QA、Release、checkpoint 或 deploy。

## QA Return Fix Evidence — 2026-08-29

- `app/page.tsx`：移除 `ImportPreviewModal` 後方 legacy file picker、summary、issues、strategy/name、replace warning、cancel/confirm JSX；匯入 modal 現保留 `FileDropZone` 與單一 `ImportPreviewModal` ownership。
- `app/globals.css`：移除只為遮蔽 legacy transfer JSX 的 selectors，並清理同區塊重複 import preview CSS。
- `tests/dev-imp-002-preview-ownership.test.mjs`：新增 regression，鎖定 page import block 不再擁有 legacy strategy／issue／summary／confirm controls，且 `ImportPreviewModal` 僅提供一個 strategy select、一個 confirm action。
- Targeted：`node --test tests\dev-imp-002-preview-ownership.test.mjs tests\dev-imp-002-transfer-contract.test.mjs tests\qa-imp-001-transfer-contract.test.mjs tests\topology-transfer.test.mjs` PASS，30/30。
- Developer QA Browser preflight：先執行 `npm.cmd run db:local:start` 與 `npm.cmd run db:verify`，schema ready；再執行 `node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-imp-001-browser-retest.mjs` PASS。Summary：`strategySelectCount=1`、`confirmButtonCount=1`、`duplicateIssueMessageCount=1`、oversized `File.text()` spy 未被呼叫、DB cleanup 全部 0。此為 developer preflight，不宣稱 QA 通過。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- Scoped ESLint：PASS；`app/globals.css` 因 ESLint config 不處理 CSS 顯示 ignored warning、exit 0。
- `npm.cmd run build:local`：PASS；僅既有 plugin timing／chunk size／route classification warning。
- `git diff --check`：PASS；僅 CRLF 提醒。
