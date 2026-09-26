# DEV_AIL_001 — Scorer／Worker／Page Completion

- Date：2026-09-22
- Development Branch：`codex/ai-layout-poc`
- Worktree：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc`
- Actual HEAD：`2e77d3fe299d2e231268bf7f3a124608ab7d9030`
- Evidence：未提交工作樹；不是 commit 或獨立 QA 結果
- Status：`READY_FOR_QA`

## Scope Completed

- `topology-layout-quality.ts`：以既有 178×112 geometry 與既有 router 評分；完整 ID／finite／pins 由既有 contract 驗證；node overlap、wired unresolved、route-node occlusion 為 hard gate。
- 固定 ascending tuple：unresolved routes、crossings、shared segment、occlusions、bends、route length、movement、bounds、source rank、canonical positions。最多三個候選，輸入順序不影響結果；無安全且更佳候選時保留原圖。
- `topology-layout-worker.ts`：worker 內完成 snapshot、quick draft、routing/scoring/selection，不把 CPU 工作留在 UI thread。
- `topology-layout-runner.ts`：成功、worker error、5 秒 deadline、AbortSignal 均實際 `terminate()`；requestId 不符的 late reply 不會套用。
- `page.tsx`：移除頁面內重複 ELK／legacy layout helpers；既有自動整理按鈕只呼叫 runner，並以共用 `projectWithLayoutPositions` 套用安全建議位置。
- 未改 topology graph、links、groups、pins、router 演算法、store/API/DB/Auth、package/lock、AST/MED 或智慧整理 provider。

## Verification

Focused：

```text
node --test --test-concurrency=1 tests/dev-ail-001-contract.test.mjs tests/dev-ail-001-core.test.mjs tests/dev-ail-001-quality-worker.test.mjs tests/topology-routing.test.mjs tests/topology-layout.test.mjs
```

結果：41/41 PASS。涵蓋 hard gates、deterministic selection、三候選上限、worker success/deadline/abort terminate、late result 隔離、page runner/core 接線及既有 layout/routing/performance。

```text
node node_modules/typescript/bin/tsc --noEmit --pretty false
node_modules/.bin/eslint.cmd app/lib/topology-layout-quality.ts app/lib/topology-layout-worker.ts app/lib/topology-layout-runner.ts app/page.tsx tests/dev-ail-001-contract.test.mjs tests/dev-ail-001-core.test.mjs tests/dev-ail-001-quality-worker.test.mjs
npm.cmd run build:local
```

- TypeScript：PASS。
- Scoped ESLint：PASS。
- Worktree-local no-env build：PASS；worker 產物成功 bundle。只有既有 route classification／chunk size warning。
- `node --test tests/*.test.mjs`：240 total／229 pass／2 fail／9 skip。兩個失敗為無 `DATABASE_URL` 的既有真 PostgreSQL QA 測試：`qa-dbm-001-real-postgres`、`qa-pil-001-real-postgres`；AIL 測試與一般回歸皆 PASS。本票依限制未載 env、未啟 DB/Docker，故不把全套標成 PASS。
- `git diff --check`：PASS，僅 Windows CRLF 提醒。

## Limits / Not Run

- 未執行 Browser 視覺驗收；UIX_006–008 尚未整合到此 base，不能宣稱其 preview/apply/undo 完成。
- 未啟動 smart provider、外部模型、正式 API、DB、Docker 或公司資料。
- Quick runner 每次最多使用 original＋quick 兩候選；三候選能力已由 scorer contract/test 驗證，smart candidate 由後續核准票接入。
- 尚未 commit、push、merge 或 deploy；依票面停在 `READY_FOR_QA`。

## Candidate SHA-256

```text
app/page.tsx                                      352b1ca8d694acce5cc1dfd15780ec0749b82db8bb5e5bcbc3f3bbedd6fbd713
app/lib/topology-layout-quality.ts                a67794f520f91e62e21ba0a9cfafb4270afce9111adfbe4c723c331230455415
app/lib/topology-layout-runner.ts                 b649f9acaa0aea542545f4bf9d7626cbb8b63bc473527a763d95708370af60de
app/lib/topology-layout-worker.ts                 d378db035352bb0d5ff3638b10f96126e9a8ebeddf86fadf025ca8a5874b1629
tests/dev-ail-001-quality-worker.test.mjs          ec9bb8f53f6d3cc2f154b49bec9e6810bbc0360385acddbe4ebc1da3a1b9da8a
```

## 2026-09-25 QA Return Fix

- QA_AIL_001 Phase A 首輪為 `QA_FAILED`；唯一產品 blocker 是 clone/post 同步 throw 未走共同 cleanup。
- Runner 修正：同步例外也經 `finish()`，清除 message/error/abort listeners 與 deadline，worker terminate exactly once，並拒絕原錯誤；UI catch 不顯示原錯誤內容。
- DEV regression 分別注入 `postMessage()` throw 與 `structuredClone()` `DataCloneError`，核 post 是否執行、listener 清除、terminate count、deadline 後不二次結算。
- DEV＋QA blocker：11/11 PASS；完整 focused：67/67 PASS；TypeScript、scoped ESLint、no-env build、diff-check PASS。
- R2 changed hashes：
  - `app/lib/topology-layout-runner.ts`：`3224e6ac06b97fad4c1eb536890eae70594b6c8566f02b094b29723e8ce4b780`
  - `tests/dev-ail-001-quality-worker.test.mjs`：`0957f6e5ab9d7a3789b25ae11685e9b33661b8b0cde423bd614b54671b73b2fd`
- 完整候選見 `docs/engineerticket/contracts/QA_AIL_001-PHASE-A-CANDIDATE-R2.json`。R1 manifest與首輪QA失敗證據未覆寫。
