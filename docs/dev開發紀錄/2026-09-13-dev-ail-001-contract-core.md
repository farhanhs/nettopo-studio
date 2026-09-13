# DEV_AIL_001 — 共用資料契約與佈局核心實作

- Date：2026-09-13
- Development Branch：`codex/ai-layout-poc`
- Worktree：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc`
- Base Commit / 實際 HEAD：`1b0b084518886cda347f175bfc959401fd1d18ed`
- Integration Target：`codex/dev-rel-001-checkpoint`
- Evidence version：本日未提交的 contract/core slice；不是 commit 或獨立 QA 結果。
- 授權：使用者「請處理共用資料契約與佈局核心實作」。
- 狀態：`IN_PROGRESS`。這個區塊完成；完整 DEV_AIL_001 尚有 scorer、worker、page integration/build。

## 1. 本輪交付

| 檔案 | 責任 |
|---|---|
| app/lib/topology-layout-contract.ts | R1 strict internal/request/response/intent/ref/ProviderGraph schemas；positions/pins/ref集合驗證；safe error；full Project canonical JSON與SHA-256 |
| app/lib/topology-geometry.ts | 從既有router取得178×112與margin；拒絕client改尺寸或未整合AST geometry |
| app/lib/topology-layout-core.ts | snapshot／plan／draft；auto-detect、three-tier、spine-leaf、ELK layered純運算；pins、detached scorer projection |
| app/lib/topology-layout.ts | ordinal name/id tie-break及非locale大小寫，消除同名設備input-order依賴 |
| tests/dev-ail-001-contract.test.mjs | 9項shared contract行為測試 |
| tests/dev-ail-001-core.test.mjs | 13項core行為測試，包含真實bundled ELK及注入錯誤engine |

其餘原有dirty PM/DSG文件保留，不重新整理、不stage。未改page、router、store、API、DB、package/lock、env。

## 2. 開發／設計對接入口

1. `captureLayoutSnapshot(project, {topologyId, customerId?, capturedAt?})`
   - 在第一個await前deep clone；strict Project驗證，credentials/unknown fields拒絕而非strip。
   - 返回deep-frozen快照。baseRevision為full durable Project canonical SHA-256；graphHash只含geometry/nodeRects/link refs的cache資料。
   - caller仍需自行drain queued writes；本函式不實作store concurrency或transaction。
2. `resolveLayoutPlan(snapshot, request, {intent, refMap}?)`
   - 驗topology/revision/hash/base geometry、pins、smart limits及完整ref map。
   - quick不接受provider intent；smart要求已驗證intent/map。函式只做本機運算，不呼叫模型。
3. `buildLayoutDraft(snapshot, request, provider?, engine?)`
   - 重新hash驗快照完整性；請求／provider輸入在await前複製。
   - 只輸出既有設備完整positions；finite/range檢查在rounding與pin還原前執行。
   - **回傳`status: unscored`，不是可套用LayoutCandidate。**沒有metrics、canApply或safeReasons。
4. `projectWithLayoutPositions(project, positions, pins?)`
   - 產生獨立Project副本，僅改x/y，供未來scorer測試。
   - 不是apply API，不驗權、不寫入、不能繞過未來scorer或store boundary。

未實作的public toggle `preserveRelativePositions`不出現在schema；傳入會拒絕。Internal preserveGroups固定true；proposal wire採R1 §17.2六欄契約，不含Project、geometry、identity或provider endpoint。

## 3. Pure layout 行為

- 三層式沿用既有角色分類、260×150欄位間距；Spine–Leaf沿用240×170列間距，數值由base dimensions＋相同gap建立。
- ELK沿用layered/network-simplex/layer-sweep，增加固定seed與node/link排序；引擎只收到id、尺寸、links，不含name/IP/credentials。
- Grid內部排序保留connectivity sweep；同名以ordinal id收尾。固定intent的layer內nodeRefs視為集合，layer/groupOrder本身為有意義的順序，不能任意重排。
- intent的layers、direction、groupOrder、emphasisRefs、compact對應本地定位，不接受任意ELK options或程式碼。
- `group-by-function`無intent時依type分組；`grouped`依既有groupId分桶；`backbone-centered`採既有三層分類與居中排版，非AI生成語意。balanced/reduce-crossings均使用現有connectivity/ELK sweep；是否真的改善留給下一段scorer比較。
- pins精度原封保留，其餘座標固定到小數2位。pins造成的重疊仍只能是unscored draft，之後硬gate必須拒絕。
- 名稱同時符合多層分類的設備沿用legacy「最後一次assignment」的角色歸屬，再去掉重複membership；可能消除空／重複層，因此不承諾此類模糊圖的pixel位置字節相同。
- 不承諾新視覺label box品質；沒有替換目前畫布按鈕處理器。

## 4. Canonical／安全注意事項

現有validateProject會trim文字／lowercase色碼；layout只使用它做strict合法性檢查，保留原始durable欄位，避免一次排版順便改名稱或色碼。ID必須非空、無前後空白且refs完整，不接受trim後才成立的模糊identity。

Canonical排序object keys與devices/links/groups id，省略undefined、-0轉0；不正規化名稱／網路字串。測試證明name尾端空白、ip、quantity、group collapsed/color、link speed與x/y的改動都會改baseRevision。

SHA-256使用Web Crypto，適合capture；**不得在未保活Dexie transaction內直接await此helper**。Atomic apply/undo仍屬DEV_AIL_003，必須依R1設計。

ProviderGraph schema可拒絕raw name/IP額外欄位並核對degree、group size、refs；此處尚未實作服務端payload重建、opaque token生成、授權、byte gate或網路呼叫，均屬DEV_AIL_002。

## 5. 驗證紀錄

完整focused command：

```text
node --test --test-concurrency=1 tests/dev-ail-001-contract.test.mjs tests/dev-ail-001-core.test.mjs tests/topology-layout.test.mjs tests/topology-routing.test.mjs tests/topology-routing-qa-uix.test.mjs tests/topology-visibility.test.mjs tests/topology-validation.test.mjs tests/topology-transfer.test.mjs
```

結果：**63 tests / 63 pass / 0 fail / 0 skip**（新增22＋既有41）。含真ELK的模式／空圖／單點／cycle／disconnected／無線混合／permutation驗證，以及strict schemas、非法engine output、pins精度、input immutability、原始dual-spine fixture、safe CSV/JSON/ZIP基線。

其他命令（cwd皆為AI worktree）：

```text
node C:/Users/DUS/Desktop/project/nettopo-studio/node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node C:/Users/DUS/Desktop/project/nettopo-studio/node_modules/eslint/bin/eslint.js app/lib/topology-layout-contract.ts app/lib/topology-layout-core.ts app/lib/topology-geometry.ts app/lib/topology-layout.ts tests/dev-ail-001-contract.test.mjs tests/dev-ail-001-core.test.mjs
git diff --check
```

- tsc：PASS。
- Scoped ESLint：PASS，0 errors / 0 warnings。
- diff check：PASS，僅CRLF提醒。
- 起初49項測試中3項ELK失敗：in-process bundled shim無terminate方法。改為不呼叫shim的terminateWorker；回歸通過。未改QA／原有測試來配合通過。

依賴限制：本worktree仍未建立node_modules；Node與tsc/ESLint使用主workspace ancestor套件。這些是source/Node驗證，**不是隔離build或worker bundle證據**。未install、junction或複製env。

NOT RUN：build、Browser、worker cancellation/performance、完整Node全套、DB、正式QA、live provider。無DBfixture、無外部資料傳送、無需DB cleanup。

## 6. 同票剩餘工作／停止點

1. scorer與LayoutCandidate/metrics schema：完整route集合/status、nodes重疊、非端點遮擋、crossings/segments/bends/length/movement/bounds與tuple tie-break。
2. 原圖／quick／smart最多3候選比較；沒有安全改善則保留原图。
3. 外層Worker／runner：core＋router＋scorer整段5秒deadline、terminate、cancel、late result隔離；不能用Promise.race假裝CPU已中止。
4. worktree依賴與build驗證後，page僅排版helper抽離轉接；雙軌Preview/Apply/Undo仍留DEV_AIL_003。
5. 同票完整驗證才READY_FOR_QA。本輪不啟動其他DEV/QA、不commit/push/merge/deploy。
