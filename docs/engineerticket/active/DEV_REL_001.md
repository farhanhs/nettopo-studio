# DEV_REL_001 — Recovery Snapshot 與 Checkpoint 拆分

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | REL |
| Priority | P0 |
| Status | IN_PROGRESS |
| Planned Order | 051 |
| Checkpoint | Release |
| Dependencies | DSG_REL_001-R1 APPROVED；PM_REL_001 READY；PM_GOV_001-D24 APPROVED |
| Created／Updated | 2026-08-17／2026-08-31 |

## Objective

在 freeze 後保留完整 recovery snapshot，從乾淨基準依主軸重建可獨立 build/test 的 checkpoint commit chain。

## Planned Commit Chain

以 [PM_REL_001-FREEZE-MANIFEST.md](../runbooks/PM_REL_001-FREEZE-MANIFEST.md) 第 7 節為唯一順序來源；既有 pre-freeze commits 不 rewrite。

## Hard Rules

- 不在未 freeze 工作樹直接開始 staging。
- 先建立獨立 recovery branch／snapshot，且不合併 WIP snapshot。
- 共用檔案以 patch staging 分拆。
- 每個 commit 在沒有後續未提交內容干擾的乾淨 tree 驗證。
- 最終 tree 必須與 approved recovery snapshot 等價，差異須逐項說明。
- 原 workspace 不作 staging／reset／stash；在獨立 checkpoint worktree 執行。
- 啟動前先建立完整 path-to-ticket inventory、sanitized overlay recovery bundle、SHA-256 與 restore proof，並實際驗證可還原。
- 任何 path 無法映射、portable artifact secret hit 或 recovery 驗證失敗，狀態改 `BLOCKED` 並停下。

## Acceptance Criteria

- [ ] 每個 commit 可獨立 build/test。
- [ ] Commit message 含 Ticket ID。
- [ ] 無遺失新檔、文件、測試或 migration metadata。
- [ ] QA_REL_001 完成 tree equivalence 與逐 commit 驗證。

## Start Boundary

本票已因 R1 recovery artifact secret boundary 停止；2026-08-31 使用者已核准 `DSG_REL_001-R1` 並要求移交開發組，故可重新啟動，但只能依 R1 sanitized overlay recovery contract 執行。

## PM Priority Hold — 2026-08-31

使用者後續明確要求先執行功能性 Ticket，優先驗證產品在工程師實務工作上的正確性。依 `PM_GOV_001-D25`：

- 本票狀態暫改 `DEFERRED`，不是取消，R1 contract 與既有 stop evidence 全部保留。
- 不再產生新的 recovery artifact、branch、worktree、commit 或 checkpoint evidence。
- 先由 `QA_PIL_003` 執行 Browser UAT；完成後由 PM 依結果重新排序本票。
- 此暫緩不授權在其他 Ticket 混入 Release tooling，也不解除 push／deploy 禁令。

## PM Resume／Push Boundary — 2026-09-01

- `QA_PIL_003` 已由測試組獨立完整 UAT 判定 `QA_PASSED`，D25 的功能驗證前置已完成，本票解除 `DEFERRED` 並依 R1 contract 重啟。
- 依 `PM_GOV_001-D26`，先完成 sanitized overlay recovery、checkpoint chain 與 `DEV_REL_001 = READY_FOR_QA`；再由 `QA_REL_001` 獨立驗證。
- 只有 `QA_REL_001 = QA_PASSED` 後，開發組才可把 checkpoint branch push 到既有 `origin`；不得 merge、force-push、deploy 或改寫既有遠端歷史。
- 原 workspace 仍禁止 staging、commit、reset、clean、stash、branch switch；所有 commit/push 必須在核准的獨立 checkpoint worktree／branch 執行。

## Emergency Pause Evidence — 2026-08-30

- 未建立 recovery／checkpoint branch。
- 未建立任何 Git worktree或commit。
- 原 workspace index沒有 staged內容；HEAD仍為 `cbce10bba027d246ef78e92a1e2f01660da55e1f`，branch仍為 `dustool`。
- 只在 ignored `.local/recovery/dev-rel-001/` 產生 `base-head.txt`、`git-status-porcelain.txt`、`tracked-full-index-binary.patch`、`PATH-MAP.csv` 初稿；不得刪除或當成已驗證設計。
- 原 workspace僅有本票與Register狀態文件變動；已停止等待設計組。

## Historical PM Approval — 2026-08-30

使用者曾核准 `DSG_REL_001` 與 `PM_GOV_001-D24`，並要求移交開發組執行；本票當時更新為 `IN_PROGRESS`。此執行授權已因 R1 stop evidence 暫停，狀態退回 `BLOCKED`。

開發組只能依 [RELEASE-CHECKPOINT-CONTRACT.md](../contracts/RELEASE-CHECKPOINT-CONTRACT.md) 執行：

- 重新產生完整 recovery snapshot，不得覆寫 `.local/recovery/dev-rel-001` 既有初稿。
- 清零 PATH-MAP 的 `UNMAPPED`，修正 mojibake/byte-expanded 中文路徑問題。
- 原 contract 曾要求建立 approved untracked archive、tracked binary patch、manifest/hash、secret scan 與 restore proof；R1 已 supersede raw patch 作為 canonical portable artifact。
- 於核准的獨立 worktree 依 ticket/hunk 拆分 checkpoint commits。
- 每個 commit 必須乾淨 build/test，最後執行 final tree equivalence。
- 完成後只可更新為 `READY_FOR_QA` 並交 `QA_REL_001`；不得自行部署或標 QA pass。

## R1 Stop Evidence — 2026-08-30

DEV_REL_001 已依 stop condition 安全停止：

- 正式 recovery artifact 的 PATH-MAP 已清除 `UNMAPPED`；舊草稿 UNMAPPED 不是目前 blocker。
- 唯一 blocker 是 raw `tracked-full-index-binary.patch` 會保存 `.env.example` deleted historical credential syntax。
- portable recovery artifact 不得攜帶 active、usable 或 retired credential；不得以白名單忽略 `.env.example` 或 deleted lines。
- 原 workspace index 維持空；尚未建立 recovery/checkpoint branch、Git worktree、commit、push 或 deploy。

本票曾退回 `BLOCKED`，等待 `DSG_REL_001-R1` revised contract 由使用者／PM確認。2026-08-31 已確認，狀態更新為 `IN_PROGRESS` 並移交開發組。

重啟後 DEV_REL_001 只能依 R1 contract 執行：

- 產生 `current-files.zip`、`delete-manifest.json`、`mode-manifest.json`、`PATH-MAP.csv`、`HUNK-MAP.json`、`SHA256SUMS.txt`、`frozen-snapshot.json`、`secret-scan-report.json`、`restore-proof.md`。
- 不產生 raw full-index Git patch 作為 canonical／portable artifact。
- restore proof 必須由 base HEAD 套用 delete manifest、current-files overlay 與 mode manifest，不得依賴 raw patch。
- 完成後仍只能更新為 `READY_FOR_QA`；不得自行標 QA pass、push 或 deploy。
