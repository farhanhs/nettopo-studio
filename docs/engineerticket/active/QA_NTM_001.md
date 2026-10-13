# QA_NTM_001 — 可信拓樸核心與舊資料相容獨立驗收

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | QA / NTM / P1 |
| Status / Planned Order | QA_PASSED（CORE-R2 pure module only；完整 pipeline 仍 BLOCKED） / 153 |
| Owner | 既有測試組／019fac8e-94dc-79c1-b156-7f242cf82967／local |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | codex/dev-rel-001-checkpoint；未授權整合 |
| Governance / Checkpoint | root R3／D43/D44／DEV_NTM_001 PM Scope Review CORE-R1 |
| Created / Updated | 2026-10-09 / 2026-10-09 |
| Git / env / DB / live / deploy | 未授權 |

## Scope / Dependency

本票只驗 DEV_NTM_001 CORE-R1 新純模組，不是完整 ProjectV2 pipeline 或整個 NTM 的驗收。完整契約 WAITING_APPROVAL，只採 DEV 票尾 R1 固定的核心子集；NTM-A08／A10 的 domain／legacy 部分。CSV v3、scale/time、safe actor portability、真案例未批准／未交，不能自改規則代通過。

DEV writer 可工作時，只準備自身 runner/fixture；正式測試必須 DEV READY_FOR_QA、manifest/dependency完整、測前後 hash 核對、產品停止寫入後鎖版。QA 不改產品或 DEV 測試換 PASS；不操作 DB／Browser/env/live。DEV 不能修改本票獨立 QA 斷言。

## Fixed CORE-R1 Acceptance

| ID | 必要結果 |
|---|---|
| NTM-C01 | 有 port 的 legacy upcast deterministic且未核實；無port不造介面；原ID/quantity/string/order/geometry依合法legacy規格保留 |
| NTM-C02 | V2 strict schema／future version／duplicate ID／引用不存在／interface owner mismatch／alias collision／parent/area cycle 安全拒絕 |
| NTM-C03 | VLAN range／CIDR／logical relation／resiliency／trust evidence/value引用等核准模型不變量有正常／拒絕案例 |
| NTM-C04 | clone／canonicalization 不共享巢狀 reference、不丟安全資料、不默默verify；無變更input或外部持久化side effect |
| NTM-C05 | downcast可無損才成功，新資料 lossful 給 typed拒絕且原V2不變；不宣稱備份已生成 |
| NTM-C06 | 合成secret/raw-config/unknown-key輸入被拒；safe issue不回敏感輸入；純模組不能新增verify操作接受client actor作認證 |
| NTM-C07 | 舊types/validator/clone/store/transfer/API/db/UI未修改；新模組未從產品入口接入；不誤報可在UI保存／完整exchange PASS |

## Allowed / Evidence / Stop

Allowed write：本票、本地register自身行、`tests/qa-ntm-001-core.test.mjs`、`tests/fixtures/qa-ntm-001/`、`docs/dev測試紀錄/qa-ntm-001-core-2026-10-09.md` 及自身 summary/manifest。合成runner不得碰 `.env`／DB或現用檔；test temp清理只屬自己。

可以準備獨立斷言，no-env測自身工具（非產品正式PASS）；正式產品run待候選。所有實際case批次跑，保留失敗與重驗。測前後branch/HEAD/product+tools hash、依赖版本、active lock/cleanup记录清楚；必要條件全通才 CORE-R1 QA_PASSED。完整DEV_NTM_001整票pipeline未驗／NOT RUN，原A04/A05/A07缺口不變。後續到PRE-COMMIT交PM，不Git或擅自派其他票。

Browser／Dexie／真DB／CSVv3／匿名真案例：本phase NOT RUN，不以純core測試代簽。

## QA Preparation Result — 2026-10-09

狀態維持 `READY`；只完成 QA-owned runner／fixtures，未執行正式產品驗收。

- `tests/qa-ntm-001-core.test.mjs` 已固定 NTM-C01–07 的 domain／legacy／安全／純模組斷言。
- `tests/fixtures/qa-ntm-001/` 已建立 deterministic synthetic legacy 與 V2 fixture；不含秘密或真人資料。
- preparation-only no-env 預跑：fixture/tool guard 1 PASS；NTM-C01–07 明確 SKIP／`NOT RUN`；syntax與scoped ESLint PASS。
- DEV writer 仍 active，兩個新產品檔尚無 READY_FOR_QA manifest／dependency closure／writer stop／hash lock，因此未 import 或執行 WIP，不產生產品 PASS／FAIL。
- 正式 gate：DEV `READY_FOR_QA` 精確 CORE-R1 manifest＋PM具名交接＋writer停止＋測前後hash；不符合即 BLOCKED，不取 root Auth 或現用環境捷徑。

工具 hashes 與完整矩陣見 [準備日誌](../../dev測試紀錄/qa-ntm-001-core-2026-10-09.md)。Next owner：DEV 完成候選；PM 具名交 QA。QA 現在停止等待，不自動啟 formal run 或其他票。

## Formal QA Start — 2026-10-09

收到 PM 具名 CORE-R1 正式交接；DEV writer 已停止。QA 已獨立核對 branch／HEAD、候選三檔與四個直接依賴雜湊均符合 manifest／lock，index empty，狀態改為 `IN_QA`，開始執行固定 NTM-C01–07。候選仍停在 PRE-COMMIT；本輪不碰產品碼、環境、DB、Browser、Docker 或 Git stage／commit／push。

## Formal QA Result — 2026-10-09

結果：`QA_FAILED`。最終獨立矩陣為 5 PASS／3 FAIL；DEV targeted regression 12/12、TypeScript、scoped ESLint PASS。候選與直接依賴的測後 hash 全部維持交接值，index empty。

- `NTM-C01 FAIL`：legacy `fromPort=" Gi0/1 "` 被 upcast 正規化為 `"Gi0/1"`，違反合法 legacy 字串無損保留。
- `NTM-C04 FAIL`：候選沒有匯出固定範圍所需的 `canonicalProjectV2()`，無法驗證 deterministic canonicalization。
- `NTM-C05 FAIL`：上述 port trim 使 `downcastProjectV2(upcastProject(legacy))` 不等於原 legacy Project。
- `NTM-C02/C03/C06/C07 PASS`；fixture/tool guard PASS。

首次正式 run 因 QA runner 把 canonical seam 全域前置檢查及純文字 `postgres` 誤當 persistence import，造成 1 PASS／7 FAIL。QA 僅修正自身工具：按 case 檢查必要 seam、將 source guard 限定為 import／side-effect API、修正 fixture 的核准 evidence method/fingerprint，以及接受等價 typed issue code；未修改產品或 DEV test。保留此歷史後重跑，最終缺口如上。完整證據見 [測試日誌](../../dev測試紀錄/qa-ntm-001-core-2026-10-09.md)。Next owner：DEV_NTM_001；修正後以同票 re-test，完整 NTM pipeline 仍未驗。

### QA release for repair — 2026-10-09

正式 run 已結束，`QA_FAILED` 與兩輪歷史保留。受測 manifest 為 `docs/dev開發紀錄/checkpoints/dev-ntm-001-core-r1/manifest.json`；candidate hashes：types `53ef00f4f668f151cc9e0a82c23550343428624399a8cd61d78d11d62e40997b`、model `2050a8b74b28bdc1b5bbb46049f4974958dea78b881117bb08e7bb294bddd0f3`、DEV test `b69c30544b5d149944284f58650bf23dd3641e680842ddc0df4ae3bc2d7bd154`。QA 無 owned external／temp resource，無需清理；產品鎖已釋放。Next owner：`DEV_NTM_001`。

- `NTM-CORE-01 legacy-port-loss`：legacy port safe string 被 trim，破壞 upcast／downcast lossless。
- `NTM-CORE-02 canonical-public-seam`：缺少 `canonicalProjectV2()` 公開 seam。

允許 DEV 僅在原兩個 pure module 與 DEV 自測範圍做最小修正；回交後先重驗 C01／C04／C05，再跑完整 C01–07。QA 不另改斷言、不擴張產品範圍。

## CORE-R2 Re-test Start — 2026-10-09

PM 已具名交接 CORE-R2；manifest `docs/dev開發紀錄/checkpoints/dev-ntm-001-core-r2/manifest.json` 為 `READY_FOR_QA` 且 `productWriterStopped=true`。QA 獨立核對 branch／HEAD、三個 candidate、四個 direct dependencies、runner／fixtures raw hash與bytes均符合 manifest／既有QA lock；Node `v24.18.0`、Zod `4.4.3`；index empty，未發現另一產品 writer。狀態改 `IN_QA`，先重驗 C01／C04／C05，再完整跑 C01–07。R1 QA_FAILED／QA-only correction／原三項失敗歷史保持不變；本輪不修改產品或DEV test，不載入env，不碰Browser／DB／Docker／live／Git stage／commit／push。

## CORE-R2 Re-test Result — 2026-10-09

結果：`QA_PASSED`（僅 CORE-R2 pure module）。R1 `QA_FAILED`、QA-only correction 與原 C01/C04/C05 失敗歷史均保留。

- 受影響案例先跑：C01／C04／C05，3/3 PASS。
- 完整獨立矩陣：fixture guard＋C01–C07，8/8 PASS。
- DEV regression：20/20 PASS；僅為補充，不取代獨立 QA。
- TypeScript `--noEmit --pretty false --incremental false`：PASS。
- scoped ESLint `--max-warnings 0`：PASS。
- 測後 candidate／dependencies／QA runner／fixtures raw hash與bytes均與測前鎖定值相同；index empty，`git diff --check` 無 error（僅既有 CRLF warning）。
- 沒有載入 env，沒有 Browser／DB／Docker／live／temp／external resource；cleanup count=0。產品測試鎖已釋放。

Next owner：PM checkpoint。此結果不代表完整 `DEV_NTM_001` pipeline、UI/storage/CSVv3、匿名真案例、原 A04/A05/A07 或 release 已通過；上述項目仍 BLOCKED／NOT RUN。停在 PRE-COMMIT，不 stage／commit／push。
