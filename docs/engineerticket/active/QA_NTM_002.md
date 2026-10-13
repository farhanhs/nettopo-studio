# QA_NTM_002 — 介面候選引擎獨立驗收（GEN-R1）

| 欄位 | 值 |
|---|---|
| Status / Planned Order | QA_PASSED（GEN-R1 pure engine only） / 162 |
| Owner | 測試組 019fac8e-94dc-79c1-b156-7f242cf82967 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | 同分支；不整合／不 Git |
| Authority / Dependency | 使用者「啟動後續開發」；DEV_NTM_002 GEN-R1 固定候選後正式 QA |

必要案例與真值依 [DEV_NTM_002](DEV_NTM_002.md) GEN-01–07，獨立造 explicit/template/manual/conflict/missing/invalid/secret fixtures。不改產品或 DEV assertions；可新增 `tests/qa-ntm-002*.test.mjs`、`tests/fixtures/qa-ntm-002/**` 與自身日誌／manifest／票／register列。

準備與正式分開；開測核來源／相依／工具精確hash及單一候選凍結。以真函式行為驗證優先序、碰撞、人工編號邊界、穩定ID、原文無損、verified保護、typed error無輸入回顯及無副作用；不可僅 source guard 判PASS。完成全部獨立可測case後集中回報，缺條件只BLOCK相依case。

CORE-R2 既有獨立回歸須核精確依賴後執行／記錄；不覆寫 R1/R2 歷史。no-env、現有本樹相依、合成資料；無 Browser/DB/live/安裝/Git。無自建資源也記 cleanup=0。失敗先釋放候選再直接交 DEV 同票修，重驗保留歷史。

本票只證明純候選引擎，未證明 UI 建設備、保存、實際廠商模板、整份原始組態解析、CSV v3、真人案例或整個 NTM 完成。必要 QA 後交 PM PRE-COMMIT，禁止 stage/commit/push。Beta QA 準備不取消；兩工作線工具和證據各自隔離。

## Preparation — 2026-10-09

QA 已在指定 checkpoint worktree 接單，核對 branch／HEAD為 `codex/dev-rel-001-checkpoint`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6`，保留既有dirty變更。新增QA-owned GEN-01–07語意向量、合成secret rejection fixture及preparation runner；不假設DEV尚未公開的API名稱或資源上限。正式產品仍 `NOT RUN`，待manifest＋writer stop＋hash lock；未讀env、未碰Browser／DB／live／安裝／Git，Beta證據未混用。

Preparation self-check 首輪4 PASS／1 QA coverage aggregation FAIL；合併獨立secret fixture的GEN-06/07 coverage後5/5 PASS，syntax與scoped ESLint PASS。QA-only hashes：runner `9ec88971be2a3b7b87670049f52236bcaabf8156bd82f30b656ae65a762d1367`、generation vectors `be8efff781ab758a7401ae458378aba923393cd5edd7b325ceec6a46a54361f1`、secret fixture `afcf87133049a112e31e1fdbf80fbab4921fb90dd9cd36d7b7782145a11bd873`。狀態維持 `READY` 等固定候選，GEN-01–07產品全數 `NOT RUN`；cleanup=0、index empty。

## Formal QA Start — 2026-10-09

使用者已直接允許 DEV 交測。QA 獨立核對 branch／HEAD、GEN manifest `b2ada6bd...`、兩候選 `d53c2f46...`／`137e674a...`、CORE-R2七檔與 preparation 三檔均精確MATCH；Node `v24.18.0`、Zod `4.4.3`、index empty、product writer stopped、owned resources=0。狀態改 `IN_QA`，新增QA-owned正式行為runner並執行GEN-01–07及CORE-R2回歸；不改產品或DEV assertions，不載env，不碰Browser／DB／Docker／live／安裝／Git。

## Formal QA Result — 2026-10-09

結果：`QA_PASSED`，僅限 GEN-R1 pure engine。

- QA formal GEN-01–07：7/7 PASS。
- 完整 serial batch：73/73 PASS、0 FAIL、0 SKIP（QA formal 7＋QA preparation 5＋DEV GEN 33＋CORE DEV 20＋既有QA core 8）。DEV cases僅回歸證據，不取代獨立7項。
- TypeScript noEmit/incremental false：PASS；scoped ESLint max-warnings 0：PASS。
- 測後 manifest、兩候選、CORE-R2依賴、QA tools/fixtures hashes與測前鎖定一致；index empty、diff-check無whitespace error（僅既有CRLF advisory）。
- 正式runner首輪3 PASS／4 FAIL均為QA adapter錯誤（template fixture欄位、limit property名稱、parentName觀測層、getter被QA clone提前觸發）；只修QA runner後同候選7/7 PASS，歷史保留，未改產品或DEV assertion。
- env／Browser／DB／Docker／live／安裝／external/temp resources皆未使用；cleanup=0。產品測試鎖已釋放。

未驗且不得誤報PASS：UI建設備、Zustand/Dexie/store/API/DB、CSVv3、full build/full suite、真廠商模板、raw config parser、真人案例、完整NTM。Next owner：PM PRE-COMMIT checkpoint；未授權stage／commit／push。
