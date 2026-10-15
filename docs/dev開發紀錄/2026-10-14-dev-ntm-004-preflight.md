# DEV_NTM_004 Preflight / 2026-10-14

Status: `PREFLIGHT_COMPLETE / AWAITING_PM_SCOPE_REVIEW`。不是產品候選、不是 READY_FOR_QA。

## 1. 候選與授權

- Product worktree: `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`。
- Branch / HEAD: `codex/dev-rel-001-checkpoint` / `590339395ec8cf5af5591d3be4379bd3ab4ebc6b`。本輪 index empty；不把既有 dirty 當 HEAD。
- Root `dustool` / `d3f2a64517523b8471ce17889f0db3de2e68238f` 僅讀共用治理；Auth 等工作線不在本票範圍。
- 2026-10-14 使用者在 PM 組要求「請按照現在的工作流程繼續開發」；以 root 同日 `2026-10-14-pm-ntm-projection-start.md`、R3 / HARNESS 為授權來源。
- PM 已核可 SECTION5-R1.1 局部契約，實讀 SHA-256 `d87640d787533de697b405f433843c132da38294bcea69d656778c0fc4b6bb34`。文件內 WAITING_PM_SCOPE_REVIEW 保留；本輪精確產品路徑仍由 PM 核 scope，DEV 不自行視為產品放行。
- DEV 唯一產品 writer；DSG 只補契約、QA 只做自身 preparation。既有治理、QA_REL_001、qa-pil-002-browser-flow、UIX evidence 與新 DSG/QA 文件均保留。

## 2. Requirement Traceability

| 項目 | 本票依據 |
|---|---|
| User Intent | 同一已授權拓樸可操作的實體／邏輯閱讀、穩定 ID 導航、來源與未核實原因；不以純引擎交付代稱 UI 完成 |
| Historical Sources | 父 TRUSTED-NETWORK-TOPOLOGY-V1 §5、DSG_NTM_001、DEV/QA_NTM_001–003、10/13 committed checkpoint、UIX006–008、當前 page/store/validation 實碼 |
| Approved Decisions | root R3/D42、當前工作線決議與今日 PM 接續、SECTION5-R1.1；未決 actor/CSVv3/規模/UAT 不變 |
| Change Type | EXTEND：既有 V1 的唯讀投影；PLAN digest 僅 behavior-preserving extraction，不改 decision/apply 語意 |
| Affected Layers | CORE read inspection/shared digest、pure projection、page view wiring、新閱讀 UI、DEV tests |
| Preserved Invariants | 既有身份/RBAC 先於投影；Project/V2 不回舊 writer；無第二 durable graph；無 client verified actor；不改 routing/持久化/transfer |
| Conflict Check | 高衝突 page 只 DEV 單線，store/DB/API 不寫；DSG/QA 檔只讀；產品 phase 前再核 hash/dirty，正式 QA 候選鎖定後 DEV 停寫 |
| Regression Map | 下節 PROJ-01–08，特別 PLAN digest 等價、CORE legacy 指紋保留、UIX生命週期與零寫入 |
| Rollback / No-path | 產品 phase 尚未開始；之後投影失敗只顯固定 safe error，保留可返回的原 V1 編輯器；不 fallback 到保存 V2、假 verified 或跨拓樸查詢 |

## 3. 實碼差距與讀寫邊界

| 實際入口 | 發現與處置 |
|---|---|
| `topology-types.ts` / `cloneProject()` | durable Project 只有 devices/links/groups；clone 會丟 V2 頂層 extension，不能用它保存 V2 |
| `topology-validation.ts` | StoredProject/Device/Link/Group 使用 strict schema；直接 validate 拒絕未知欄位。stripProjectCredentials 重建三集合，會移除頂層 V2；保留的 nested V2 欄位則可能被 strict 拒絕。不是所有 V2 欄位一律安全 strip |
| `topology-store.ts` | initialize/buildActiveState/setProject/select 等皆走 V1；local readActiveData 清理差異還會回寫 Dexie。不可把 V2 fixture 塞入現有 DB 宣稱產品支援 |
| API / PostgreSQL | 現有 GET 已走 identity/repository scope，dataset 與 save 仍 V1。只接當前已取得的 authorized project，不加另一個 endpoint 或按 area 補抓資料 |
| CORE / PLAN | CORE legacy private stableHash 與 PLAN canonical SHA-256 不同。R1.1 明定抽取 PLAN 原算法供 PLAN/read inspection 共用；不重算 CORE 既有 unverified 指紋、不猜兩算法 |
| `page.tsx` / `topology-visibility.ts` | selected device/link 與折疊 synthetic graph 不能代替 domain refs；舊 toggleGroupCollapsed 在可寫時呼叫 setProject，新閱讀折疊不共用它 |
| Canvas 生命週期 | 現有 ResizeObserver/fit gate 依 ready 與 panel lifecycle；切到新閱讀器再返回需重接 observer/flow，不能引入空白 canvas 或重選即 fit 的回歸 |

對 DSG §1 的事實校正：validation 是上述「strict 拒絕 + 特定清理丟頂層」混合行為。安全結論相同，應由文件 owner 修正文句，DEV 不改契約檔。

## 4. 最小可操作垂直切片

1. 原 V1 編輯器為預設；現有工作區加「唯讀檢視」入口與返回編輯器命令，不另做登入、上傳或 sample/V2 載入通道。
2. `page.tsx` 對已授權 active V1 Project 做獨立 clone、記憶體 upcast/validate，交給單一 async projector。無 setProject、save、credential、verify 或 apply callback 傳入閱讀器。
3. 新閱讀器提供實體/邏輯 segmented controls、verified-only checkbox、搜尋、breadcrumb、穩定 ID 列表與 safe Inspector；所有可見 items/relations/summaries 不靠 canvas 也可操作。
4. 實體 view 使用既有 routing 作 view geometry，wireless/orthogonal/no-path 語意不變；route-unresolved 不刪 domain relation。邏輯 membership 有明確獨立標示，不假裝實體接線。
5. 舊有明示 port 顯示 provisional/unverified；blank port 維持 device-to-device + 未知介面。邏輯 view 保留 inventory，但沒有 structured relations 時明示「未記錄結構化邏輯關係」及 legacy VLAN 字串計數，不推導 VLAN/subnet/area。
6. 新 view state 只在閱讀器：requested/effective selection、focus/collapse/search，不寫 Group.collapsed、座標、Zustand、IndexedDB 或 localStorage。過濾不覆寫原 requested ref；未知 client ID 不回顯。
7. customer/topology/identity 切換與 logout 在事件入口先撤下舊投影；ready false 或 session 401/403 清除。async result 有 scope/revision guard，過期 promise 不得把舊資料放回。既有身份/站點只作 cache invalidation，不從 client area 推導授權。
8. 閱讀時不提供編輯/匯入/匯出/自動排版命令；返回原編輯器才走原 V1 actions。閱讀器卸載/重掛不改舊 Inspector selection/drag persistence/fit gate 契約。
9. 新 CSS module 採 minmax(0, ...) 及局部垂直捲動，不改 globals 主題；360/768/1024/1280 與短高度皆能到達 controls/list/detail，觸控目標至少 44px。無新 dependency。

## 5. 送 PM 核對的精確 Allowed Paths / Hunks

以下是產品 phase 提案，目前尚未寫入：

| Path | 唯一核准用途／預計 hunk |
|---|---|
| `app/lib/trusted-network-digest.ts` (new) | 抽出 PLAN 既有 canonical + async SHA-256，維持原字串、array order、undefined omission 與 object key 排序 |
| `app/lib/trusted-network-change-plan.ts` | 僅原 canonical/fingerprint 定義區改為共用 import；compare 等其他使用保留；不動 schema、proposal、decision、apply、IDs/revision 語意 |
| `app/lib/trusted-network-model.ts` | 增加 read-only inspectTrustedField 與必要 entity/field lookup；共用 digest；不改 legacy stableHash/upcast/parse/canonical/downcast 既有輸出 |
| `app/lib/trusted-network-projection.ts` (new) | R1.1 async Outcome、typed errors、closure、rank/order、view membership、selection/breadcrumb/collapse、safe evidence summary；不讀網路/環境/store |
| `app/components/topology/TrustedNetworkReader.tsx` (new) | 閱讀 controls/list/Inspector/Canvas view mapping、非持久化 state 與 async scope guard；Canvas 可用檔內小 component，暫不另分檔 |
| `app/components/topology/TrustedNetworkReader.module.css` (new) | 僅新閱讀器 responsive/focus/44px targets/scroll/style；不重設既有 layout |
| `app/page.tsx` | import、TopologyApp view state/readonly upcast memo、customer/topology/identity/logout 切換撤下、入口/返回、原 PanelGroup 與閱讀器條件呈現、必要 ResizeObserver/flow 回到編輯器生命週期 hunk；不改 LoginGate/Auth/forms/import/export/store mutation 的 domain 語意 |
| `tests/dev-ntm-004-digest.test.mjs` (new) | 固定 committed PLAN baseline vectors 與 public prepare/apply 行為比對，證明 ID/revision/fieldFingerprint 不變；legacy CORE bytes 不變 |
| `tests/dev-ntm-004-trust.test.mjs` (new) | $record/optional 改動/stale、field 不能聚合成 record、未知算法不接受、unverified short-circuit、安全輸出 |
| `tests/dev-ntm-004-projection.test.mjs` (new) | PROJ closure/permutation/reference/fallback/legacy/secret-sentinel/immutability 行為測試，不用 source scan 代替 |
| `tests/dev-ntm-004-browser.mjs` (new) | DEV-only isolated Browser preflight、owned loopback port/context、no-current-env、scope/reset/zero-write/keyboard/viewports；build/server 啟動顯式 allowlisted fixture env，不用會讀現用 env 的舊 wrapper |
| `tests/fixtures/dev-ntm-004/projection-vectors.json` (new) | synthetic V2 fixture、fixed digest oracle、legacy V1 Browser seed；無真資料/帳密/公司系統 |
| 本票 / register 165 / 本日誌 | scope 核收、自測結果與 next owner；後續 QA handoff manifest 精確路徑於候選形成時列出，不擴產品範圍 |

不寫：topology-types/validation/store/db/visibility/layout/routing、API/repository/schema/migration、GEN、transfer/import/export、globals.css、package/lock/env、獨立 QA scripts/assertions、其他票或 root 產品線。若上述窄 hunk 無法完成，先具名回報，不自行擴檔。

## 6. 依賴與不能宣稱的功能

- 真 V2 Browser 資料來源仍缺 authorized V2 read path；本票不新增。純 V2 fixture 可驗 semantics，產品 Browser 只驗真 V1→readonly adapter。
- V2 save/reload 需另核 storage/API/validation/DB 範圍，本票 `NOT RUN`，不是已支援；不以 mock 持久化替代。
- verified-only 在現有 legacy 資料預期為空，因沒有正式 verification flow；顯示原因與重設篩選，不能做一個「設為已核實」按鈕補缺。
- logical inventory/導航可用，不表示公司 VLAN/subnet 已結構化建置。anonymous/live/UAT 仍未授權。
- 原 `scripts/run-uix-playwright.mjs` 會載入 .env.local/.env，本票不執行。新 DEV runner 在放行後只用既有 dependencies、自建 fixture，不 install、不 Docker、不碰現用 DB。

## 7. 必要 Regression / Evidence Map

| Gate | 放行後需提供的行為證據 |
|---|---|
| PROJ-01 | frozen input 不變；全排列同結果；固定 type rank + NFC code-point order；duplicate/invalid safe Outcome；記錄 fixture size/timing，不自創 SLA |
| PROJ-02 | typed endpoints 回鏈；blank/explicit port 與 legacy VLAN 字串；每 relation endpoint 存在，不從 canvas ID 反造 domain |
| PROJ-03 | 每類 $record 及 dependencies closure；optional mutation stale；PLAN authoritative digest；不雙算法接受、不 aggregate leaf trust；無 dangling edge |
| PROJ-04 | view/filter requested/effective 選取、fallback、area ancestor、unknown ID 不回顯、collapse zero-write；取消篩選恢復 intent |
| PROJ-05 | 身份/拓樸切換先清 view，延遲 async 不跨 scope rehydrate；401/403/ready false；DOM/error/evidence 無 actor/raw source/secret/hash |
| PROJ-06 | V1 真 Browser 入口→tabs/search/list/Inspector→返回編輯器；Tab/Enter/Space、44px、360/768/1024/1280、short height，截圖與overflow測量 |
| PROJ-07 | 實際 fixture entities/relations、OS/browser、duration；原 wired routing 效能 gate 不改 |
| PROJ-08 | CORE/GEN/PLAN 全回歸與新 digest public-output equivalence；UIX005 drag persistence、006 Inspector、007 topbar、008 resize/fit；routing/layout/visibility；V1 storage request/IndexedDB 前後無閱讀寫入 |

產品 phase 需 targeted + full Node、tsc、scoped ESLint、no-current-env build:local 等價入口與具名 Browser preflight。測前後 hash 含所有 changed product/test/tool paths 及 read-only closure (CORE/GEN/PLAN/types/validation/store/API/routing/visibility/page/runtime build dependencies)。DEV 自測不替代 QA_NTM_004。

## 8. 本輪結果與 Next Owner

- 已完成：權威文件/R1.1、branch/HEAD/index、實碼 write pipeline、68 個 product/NTM regression 路徑 SHA-256 基準、精確路徑與回歸圖。
- 本輪只寫 DEV_NTM_004、register 165、本日誌；未寫產品、未跑 Node/tsc/lint/build/Browser/DB、未讀 env、未 install、未 stage/commit/push。
- 收尾唯讀比對：68/68 product/NTM regression 路徑 raw SHA-256 不變；HEAD 仍為上述 5903393、index empty；scoped `git diff --check` exit 0，僅 register CRLF 提醒。新日誌/票面另查文件內容，不把 Git 對 untracked 的略過算作檔案驗證。
- QA 準備自檢不是產品 PASS；本票產品/Browser/正式 QA 仍 `NOT RUN`。此日誌不是 READY_FOR_QA 或部署核可。
- Next owner: PM 核本文件 §4/§5 精確 scope；核可後 DEV 才進產品。之後單一候選交 QA_NTM_004 獨立驗收，最後 PRE-COMMIT 停止。
