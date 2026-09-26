# DEV_AIL_001 — 核心／Worker checkpoint

- 日期：2026-09-25；使用者要求繼續處理至下一個適合的 commit 點。
- Branch：codex/ai-layout-poc；Worktree：C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc。
- Parent HEAD：2e77d3fe299d2e231268bf7f3a124608ab7d9030（contract／pure core 已提交）。
- 決議：本輪收斂 scorer／Worker／quick page 轉接及獨立驗收為一個可追溯 checkpoint；不混入模型 API、雙軌 preview/apply/undo、Auth 或跨分支整合。停在 stage／commit／push 前。
- 建議 commit subject：`[DEV_AIL_001] feat(ail): add scored worker layout with phase-a verification`。

## 提交白名單（核准後逐檔加入，不使用 git add .）

- app/page.tsx（僅 layout 抽離及 quick runner 接線）
- app/lib/topology-layout-quality.ts
- app/lib/topology-layout-runner.ts
- app/lib/topology-layout-worker.ts
- tests/dev-ail-001-quality-worker.test.mjs
- tests/qa-ail-001-phase-a.test.mjs
- tests/qa-ail-001-worker-browser.test.mjs
- docs/dev開發紀錄/2026-09-22-dev-ail-001-completion.md
- docs/dev開發紀錄/2026-09-25-ail-core-worker-checkpoint.md
- docs/dev測試紀錄/qa-ail-001-phase-a-2026-09-22.md
- docs/engineerticket/contracts/QA_AIL_001-PHASE-A-CANDIDATE-R1.json
- docs/engineerticket/contracts/QA_AIL_001-PHASE-A-CANDIDATE-R2.json
- docs/engineerticket/active/DEV_AIL_001.md
- docs/engineerticket/active/QA_AIL_001.md
- docs/engineerticket/TICKET-REGISTER.md（僅 AIL001／QA_AIL001 列及狀態日期）

## 驗收與限制

- QA Phase A R2：runner 6/6、focused 64/64、真 Worker Browser 1/1，tsc／scoped lint／no-env build／diff-check PASS；依測試組回報，PM 不冒稱重跑。
- R2 14 檔 hash 經 PM 再核對一致。這次僅補錄文件，沒有修改產品／測試候選；DEV 自測 67/67 與 QA 64/64 分列。
- PM 文件補錄後的 git diff --check 通過（僅既有 CRLF 提醒），git diff --cached 為空；文件更新使用經正式升權審核的 apply_patch，不修改 Windows ACL。
- DEV_AIL_001 = QA_PASSED；QA_AIL_001 整票仍 BLOCKED。UIX 基線整合、完整頁面／儲存／跨拓樸／preview/apply/undo、真模型品質尚未驗收，不可部署作完整智慧整理。
- 既有 full Node 無 DB 環境的失敗未轉為 PASS；不為此啟 Docker、讀現用 env 或借用 dustool 測試基線。
- 核准 Git 後須重新核對 branch／HEAD／status、白名單與 staged diff、候選雜湊及必要回歸；任何產品變更使受影響證據失效。push／merge／deploy 另需核准。

## 下一工作包

### 2026-09-26 Git 授權與提交前檢查

- 使用者明確授權「commit and push」，取代本批原先的提交前停止點；僅限上述 15 檔白名單，不授權 merge／部署／其他功能。
- 目標：origin（github.com/farhanhs/nettopo-studio），refs/heads/codex/ai-layout-poc。提交前本地與遠端均為 2e77d3fe299d2e231268bf7f3a124608ab7d9030。
- PM 核對 R2 manifest 14/14 SHA-256 一致，並實跑提交前回歸 48/48 PASS、0 skip、exit 0；不取代既有 QA Phase A 64/64 與真 Worker Browser 1/1 證據。

```text
node --test --test-concurrency=1 tests/dev-ail-001-contract.test.mjs tests/dev-ail-001-core.test.mjs tests/dev-ail-001-quality-worker.test.mjs tests/qa-ail-001-phase-a.test.mjs tests/topology-routing.test.mjs tests/topology-layout.test.mjs
```

- 未改產品或 QA 測試；未讀 env、未啟 DB／Docker。實際 commit SHA 與 push 結果以 Git 記錄及本次交接回報為準，不預填成功。

### 後續順序（本次不啟動）

本 checkpoint 保存後，再評估 DEV_AIL_002 受控 mock 後端／provider 介面 preflight；不得推定已允許真模型外送。DEV_AIL_003 仍需明確 UIX committed integration。這些工作不加入本次提交。
