# QA_BTA_001 A08 工具準備 — 2026-10-19

## 狀態

- Beta worktree／branch／HEAD：`codex/public-beta-0.1`／`b6d508caee148b0557f0c9370252c8d1b2fcf8ef`。
- 固定受測物仍是原 R4 ZIP SHA-256 `4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`，不是以新HEAD重產的包。
- packet `a83fd109…02c57`、contract `69e3e5aa…22f1d`、source manifest `4b1b0825…98fb`、artifact manifest `f84b91cd…53f1d`身分沿既有R4證據一致。
- A08正式狀態仍 `BLOCKED / NOT RUN`。目前未見 `scripts/ops-bta-a08/` 可審版本，沒有合法管理環境、PM-approved external destination/port或完整專用Browser executable closure；不得執行真規則。

## QA-owned 準備資產

- `tests/fixtures/qa-bta-001/a08-channel-matrix.json`：固定候選；專用Node/Chrome/Edge network-control的pre/during/post同目的地port；七個產品channels的observer-positive-control／觀測期間／事件；loopback、daily flow與cleanup矩陣。
- `scripts/qa-bta/a08-assertions.mjs`：fail-closed檢查OPS工具審閱與正式evidence，拒絕placeholder、route/CSP-only denial、缺channel、缺daily flow或不完整cleanup。
- `scripts/qa-bta/a08-formal-runner.mjs`：只做schema validation，輸出固定為`A08_EVIDENCE_SCHEMA_VALIDATED_NOT_ACCEPTANCE`／`BLOCKED_PENDING_RAW_PROVENANCE_AND_HUMAN_QA_REVIEW`；結構上不得輸出`A08_QA_PASS`。正式PASS只能由QA核對collector/run provenance、raw evidence、工具／候選hash與人工安全審閱後寫入報告；不碰防火牆。
- `tests/qa-bta-001-a08-tooling.test.mjs`：工具契約正負自測。

TDD歷史：首輪因把40字元commit SHA當64字元digest，以及placeholder檢查順序錯誤而2 FAIL；修正QA-only validator後 `3/3 PASS`，syntax PASS。hash：assertions `4da820c19f1bdafa9f1355fa8bbbcc8ab743178db6ba67e2a5341a7dec5cc066`、test `965e7d327b5ff8b01dac3c76522194f3cb2f44c87339d41a893a7c6c9c880d06`、matrix `b6313d5dd442f904f3e00ef92984a07a7d9c8ffa11aaa10f4c2a06c8f06b1239`。

## 正式 A08 必要矩陣

1. OPS先完成專用Node、Chrome、Edge副本的realpath/reparse/hash/process identity與owned rule工具；QA tool review必須PASS，真規則尚未套用。
2. 首次setup可連網；進入正式期後，固定同一PM核准非loopback destination/port，專用Node/Chrome/Edge逐exe取得：pre `SUCCESS` → during `DENIED_BY_OWNED_RULE` → post `SUCCESS`，並核規則與子程序覆蓋。
3. 產品channels不得合併推論：`node-launcher`、`node-server`、Browser page、subresource、dedicated worker、service worker、WebSocket。先用QA自有loopback fixture逐通道證明observer能看到事件，再觀測原R4。產品未使用的channel可記`NOT_USED_WITH_OBSERVER_PROOF`，但須有觀測期間／events／positive-control；不能拿source scan或Playwright route/CSP代替。
4. pre/during/post每階段 `http://127.0.0.1:4317` 必須可用，listener只能IPv4 loopback；不開LAN。
5. during階段以固定R4 package與QA-owned profiles執行：
   - `r4-group-browser-runner.mjs`：entry/edit/save/reload及group完整性；
   - `r3-deep-runner.mjs`：backup/restore、Full/Safe JSON/CSV exchange與independent oracle；
   - 正式evidence必須把兩者hash與daily flow逐項綁定，不可沿用封鎖前舊PASS。
6. finally只移除本批owned rules/process/profile/listener；baseline rules unchanged，unknown resources preserved，4317 listener0，ZIP hash unchanged。

## OPS 交付給 QA 的最小前置

- `scripts/ops-bta-a08/` 完整工具與明確正向檔案清單；工具writer停止。
- mock／自有loopback自測證據，包含partial setup、timeout、failed rule creation、nested finally cleanup。
- 絕對隔離根、所有祖先與exe realpath/reparse檢查、exe SHA-256、規則名稱與ownership、程序父子樹與cleanup清單。
- PM明確核准的外部positive-control host／port與可用性前置；不得由QA猜測或臨時改目標。
- 合法Windows管理權限證明；若仍Access Denied，保持BLOCKED，不重試繞過。

停止點：本輪只完成QA工具準備。未改產品、未執行外部probe/Firewall、未開Browser、未讀env/DB/公司API、未stage/commit/push/Release。
