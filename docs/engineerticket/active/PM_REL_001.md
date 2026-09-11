# PM_REL_001 — Pilot Scope Freeze 與 Checkpoint 授權

| 欄位 | 值 |
|---|---|
| Group | PM |
| Feature | REL |
| Priority | P0 |
| Status | READY |
| Planned Order | 050 |
| Checkpoint | Release |
| Dependencies | QA_API_001, QA_DBM_001, QA_PIL_002, QA_IMP_001 |
| Created／Updated | 2026-08-17／2026-08-30 |

## Objective

確認 Internal Pilot 的功能、已知問題、延後項目與測試證據，停止加入新功能並授權建立 recovery snapshot／checkpoint commits。

## Freeze Output

- Approved Ticket list。
- Deferred Ticket list。
- Known Issues 與不阻擋理由。
- 全測試、real DB、browser E2E、secret scan 證據。
- Freeze commit 基準與工作樹清單。

正式 Freeze Manifest：[PM_REL_001-FREEZE-MANIFEST.md](../runbooks/PM_REL_001-FREEZE-MANIFEST.md)。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 驗收完成後依主軸拆成可辨識 checkpoint，避免不同功能與高衝突檔案纏繞 |
| Historical Sources | 使用者 checkpoint 指示、ARCHITECTURE-MAP、DEV_REL_001、QA_API/DBM/PIL/UIX/IMP 紀錄 |
| Approved Decisions | PM_GOV_001-D02/D03/D04/D11/D13/D22/D23/D24 |
| Change Type | EXTEND；只整理已核准成果，不新增產品語意 |
| Affected Layers | Git history、release docs、tests；原產品 tree 只做等價重建 |
| Preserved Invariants | 原 workspace 不覆寫；credential／migration／Pilot／RBAC／Import contract 不變 |
| Conflict Check | Dirty tree 多票共用檔案，禁止整檔 staging；既有 commit 不 rewrite |
| Regression Map | 每 commit targeted gate；最終 full Node、DB、Browser、build、secret與tree equivalence |
| Rollback／No-path | Sanitized overlay recovery artifact/hash；未映射 path、portable artifact secret hit 或 equivalence mismatch 立即停止 |

## PM Draft Freeze Review — 2026-08-30

- 所有 release 依賴已 `QA_PASSED`；無剩餘 P0 QA failure。
- 未發現需要變更 Approved Decision 的產品語意；所有候選能力均可追溯至 Freeze Manifest 的 Ticket。
- 最新 full Node 192/192，real DB、Browser、round-trip、secret gates 通過；Windows full lint blocked 列為已知工具問題，scoped ESLint 已通過。
- 原先把「繼續下一張 ticket」視為可由 PM 直接代替設計組核准，已於使用者指出後校正。
- 本票曾因 `DSG_REL_001 IN_DESIGN`、`D24 WAITING_APPROVAL` 而 `BLOCKED`；2026-08-30 使用者已核准 `DSG_REL_001` 與 D24，可進入 checkpoint 授權流程。

## Acceptance Criteria

- [x] P0 release QA Tickets 全部 `QA_PASSED`。
- [x] 設計組完成 path／hunk／recovery／equivalence契約，且無未批准產品語意混入。
- [x] 最新完整驗收 0 fail；核心 DB／Browser／Import apply／round-trip 無 skip。
- [x] `DSG_REL_001` 完成並由使用者／PM明確核准 D24與checkpoint拆分。

## Stop Condition

本票曾解除 `DEV_REL_001` 的 checkpoint 執行阻擋；R1 secret-boundary stop evidence 出現後，`DEV_REL_001` 必須等待 `DSG_REL_001-R1` revised contract 確認。2026-08-31 使用者已確認 R1，可重新啟動 DEV_REL_001。任何新功能、無 Ticket路徑、portable artifact secret hit、recovery不可重建或tree equivalence mismatch都必須停止。

## Historical PM Approval — 2026-08-30

使用者曾核准 `RELEASE-CHECKPOINT-CONTRACT.md` 並要求移交開發組執行。`PM_REL_001` 更新為 `READY`，當時僅授權 `DEV_REL_001` 依 contract 進行 recovery snapshot、checkpoint worktree、逐 commit build/test 與 final tree equivalence；不授權 Pilot deploy。此執行授權已被下方 R1 hold 暫停。

## R1 Revision Hold — 2026-08-30／Resolved 2026-08-31

DEV_REL_001 已依 stop condition 停止：raw full-index Git patch 會攜帶 `.env.example` deleted historical credential syntax，不能作為 portable recovery artifact。PM freeze 方向仍有效；2026-08-31 使用者核准 `DSG_REL_001-R1`，DEV_REL_001 可依 sanitized overlay recovery contract 重啟。QA、push、deploy 仍未授權。

## Functional Gate Completed／D26 — 2026-09-01

- `QA_PIL_003 = QA_PASSED`，工程師實務工作流的大區塊已完成獨立 UAT。
- `DEV_REL_001` 解除 D25 暫緩，依 R1 重啟 checkpoint chain。
- 使用者已授權「大區塊完成後由開發組 git push」；此授權被收斂為：`QA_REL_001` 通過後 push checkpoint branch 至既有 origin，不含 merge、force-push、deploy 或遠端歷史改寫。
