# QA_NTM_004 — 投影／導航獨立驗收

| 欄位 | 值 |
|---|---|
| Status / Order | QA_PASSED（PROJ-R1 fixed candidate；PRE-COMMIT） / 166 |
| Primary QA | 測試組 019fac8e-94dc-79c1-b156-7f242cf82967 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | 590339395ec8cf5af5591d3be4379bd3ab4ebc6b |
| Integration Target | 同分支；不跨線整合 |
| Dependency | DEV_NTM_004 固定 candidate；DSG_NTM_001 §5 addendum／PM scope |
| Authority | 2026-10-14 使用者接續開發；root R3／HARNESS-AUTHORIZATION |
| Stop | PRE-COMMIT；不 stage/commit/push/deploy/live |

依 [DEV_NTM_004](DEV_NTM_004.md) PROJ-01–08 獨立建立預期值與 synthetic fixture；目前只準備，不鎖產品、不宣稱正式 PASS。沿 DSG_NTM_001 §5 對齊必需核實欄位、缺項／stale closure、選取 fallback、隱藏資料不再載入、readonly 接入與 Browser 操作範圍；語意未定先列缺口，不自行降 gate。

允許自身 `tests/qa-ntm-004-*`、具名 QA-only fixtures、本票、register 本列與 `docs/dev測試紀錄/qa-ntm-004-*.md`；不修改產品／DEV tests／其他 QA 斷言／歷史 manifest。既有依賴可用，不新裝套件、不載現用 env/DB。

正式驗收：確認 DEV READY_FOR_QA 停寫、完整 dependency closure/path containment 與測前 hash；固定本批 acceptance，分 module/Browser/回歸/效能觀測。Browser 先確認 owned loopback server/port、隔離 profile/storage、no-current-env 與 cleanup；fixture 展示不能代稱正式產品整合。無 DB 必要依賴時不啟 DB/Docker。匿名真案例與 UAT 未提供維持 NOT RUN/BLOCKED。

失敗完成所有可獨立案例後集中回報，cleanup＋release-for-repair，直接同票 DEV；保留首輪與重驗結果。產品變動依影響重驗；前票 PASS 不代替本票。必要驗收通過回 PM PRE-COMMIT，未驗 UI/persistence 不能被純函式 PASS 蓋過。

next owner：QA 準備；正式產品驗收 NOT RUN。完整範圍與分工見 [root PM 紀錄](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-14-pm-ntm-projection-start.md)。

## 2026-10-14 QA preparation result

狀態：`PREPARED / FORMAL NOT RUN`。已新增契約中立的 `tests/fixtures/qa-ntm-004/projection-vectors.json`、`browser-matrix.json` 與 `tests/qa-ntm-004-preparation.test.mjs`，覆蓋 PROJ-01–08，但不 import／呼叫尚未固定的產品 projection seam。Browser 方案固定 owned loopback、random non-5432 port、隔離 profile/storage、explicit no-current-env、PID/port/profile/download/temp cleanup；本輪沒有啟 server、DB、Docker 或 Browser。

阻擋正式斷言的 DSG §5 必補點：公開 Interface 與 typed result/error、physical/logical membership truth、verified-only relation＋endpoint＋identity closure、legacy interface unknown/stable-ID 規則、selection/breadcrumb/collapse fallback、authorization-before-projection、safe source/trust allowlist、V1 writer 與 V2 readonly adapter 邊界、keyboard/touch/responsive 非顏色提示，以及效能資料集／觀測定義。完整準備紀錄：[qa-ntm-004-preparation-2026-10-14.md](../../dev測試紀錄/qa-ntm-004-preparation-2026-10-14.md)。Next owner 保持 QA preparation；DEV `READY_FOR_QA`＋writer stop＋manifest 前，正式 PROJ-01–08 均 `NOT RUN`。

### SECTION5-R1.1 pending oracle addendum

PM 已核收上述 6/6 僅為工具自檢；QA 不以 SECTION5-R1 提前固定產品 expected。新增 requirements-only `tests/fixtures/qa-ntm-004/r1-1-pending-oracles.json`：CORE legacy fingerprint 為 `stableHash(JSON.stringify(rawValue))`，PLAN fingerprint 為 canonical raw value 的 async SHA-256，兩者不得視為相同算法。R1.1 必須明訂 CORE legacy unverified、PLAN-produced fieldTrust／optional-record stale、record-vs-field 不自動升級、typed errors／total sort rank、physical blank-port／logical mapping及未知 selection 不回顯。未重跑準備或啟正式驗收；固定 candidate 前仍 `NOT RUN`。

### SECTION5-R1.1 fixed runner preparation

PM 已局部核可固定契約 SHA-256 `d87640d787533de697b405f433843c132da38294bcea69d656778c0fc4b6bb34`。QA 保留 pending sidecar 歷史，新增 `section5-r1-1-contract-vectors.json` 與 `qa-ntm-004-contract-preparation.test.mjs`：固定 shared PLAN digest canonical bytes／SHA-256、相同 PLAN input 的 ID/revision/field fingerprint 等價、legacy unverified fingerprint 不改且不雙算法猜測、完整 `$record` optional stale、record/field 不互升級、blank-port/legacy VLAN mapping與 unknown selection 零回顯。這是正式 runner 準備，不是產品 PASS；DEV candidate／manifest／writer stop 前，module與Browser仍 `NOT RUN`，不啟 server/env。

### PROJ-R1 scope-review QA additions

依 PM 精確 scope review，QA 增加 NFC 等價但 raw ID 不同的雙 permutation oracle：normalized key相同時以原始 ID Unicode code-point tie-break，禁止正規化／改寫 entity ID。Browser no-current-env 改為 sanitized project mirror gate；只清 child env 不足，舊 wrapper 明確禁用，正式執行前須證明工具 root 無 `.env*`、無 env-file flags/current-worktree dotenv discovery，且 mirror納入 owned cleanup。V1 validator strict／特定 cleaner 可丟頂層V2的事實勘誤已記錄，但不放寬 V2 writer 禁止；真 V2 Browser/persistence仍未放行。DEV仍active，正式QA維持 `NOT RUN`。

### Test selection / side-effect preflight

DEV broad glob 曾意外包含會直接啟 `initdb` 的 untracked `qa-pil-006-postgres-lifecycle.test.mjs`；清理完成但偏差保留，不判本票產品 FAIL，也不新增 DB 授權。QA 新增正向 `test-selection-r1.json` 與不執行模組的 source/import closure guard：module、Browser、DB／integration、unknown、full-glob 分類清楚；禁止 `tests/*.test.mjs` 或只排少數黑名單。DB cases為 `BLOCKED_NO_AUTHORIZATION`，Browser為獨立 owned gate，unknown未分類前 BLOCKED；安全 module subset通過也不得稱 full PASS。正式 runner須等DEV manifest/closure/writer stop後核檔案與hash。

QA selection guard 首跑 4/5，原因是自身 resolver 未處理 extensionless TypeScript import；未 evaluate 測試或啟程序。修正為既有檔案／`.ts`／`.tsx`／`.mjs`／`.js`／index 的 fail-closed解析後 5/5 PASS，失敗歷史保留。Runner `e05ef912...`、selection `b09aaca8...`；仍只屬準備證據。

## 2026-10-14 PROJ-R1 formal candidate lock

DEV 交付 `READY_FOR_QA` 並停止產品 writer。QA 獨立核對 worktree／branch／HEAD 為指定 `codex/dev-rel-001-checkpoint`／`590339395ec8cf5af5591d3be4379bd3ab4ebc6b`，index empty；未提交候選以 manifest `ba766b4e68c1dd621a9e6ea2322eb67cd80a2021492221b638f2dcb02ee86c31` 鎖定。104/104 `fileHashes` 與 7/7 product after hashes一致，realpath/fullpath均留在指定 worktree，SECTION5-R1.1 hash `d87640d...` 一致。交付 port 57661 無 listener，QA 檢查時無 postgres/initdb/pg_ctl 程序。

正式批次只使用正向 allowlist與QA獨立runner，不執行glob／DB cases；DB與未知案例保留 BLOCKED。產品 writer 在本批期間保持停止。狀態轉 `IN_QA`；送達與DEV自測不計QA PASS。

## 2026-10-14 PROJ-R1 formal result

結果：`QA_PASSED / PRE-COMMIT`。固定manifest `ba766b4e...86c31`測前後104/104 closure及7/7 product hashes一致，index空白、writer停止。OS-only正向module allowlist `189/189 PASS`；QA preparation/formal/selection `29/29 PASS`；tsc、scoped ESLint（0 errors／0 warnings）、sanitized build及scoped diff check通過。

QA-owned Browser最終run `qa-ntm-004-1943407f-1af9-433f-b716-68def6726937`通過V1 strict seed preflight、Reader physical/logical、legacy source/unverified、verified-only、search/list/root breadcrumb、keyboard、touch-enabled實際tap、五組viewport、44px hit target、Inspector reachability、zero-write、secret/console/network/storage、返回editor互動、topology switch隔離及session 401移除投影。context/browser關閉、preview signal exit、port rebind、0 downloads與mirror刪除均真實驗證，candidate unchanged。

保留14個Browser run歷史；早期均為QA harness校正，未改產品。vinext sanitized preview的11筆owned-mirror `.woff2` console＋11筆matching request failure列非阻擋tooling風險；分類精確綁定本run mirror，其他錯誤不例外。真V2 persistence/area Browser、真DB/RBAC Browser與匿名UAT依契約維持BLOCKED／NOT RUN。完整報告：[qa-ntm-004-proj-r1-2026-10-14.md](../../dev測試紀錄/qa-ntm-004-proj-r1-2026-10-14.md)。Next owner：PM核收；停止於PRE-COMMIT，不stage/commit/push/deploy。
