# DSG_REL_001 — Freeze／Recovery／Checkpoint 架構設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | REL |
| Priority | P0 |
| Status | READY |
| Planned Order | 049 |
| Checkpoint | Release Design |
| Dependencies | QA_API_001／QA_DBM_001／QA_PIL_002／QA_IMP_001 QA_PASSED |
| Created／Updated | 2026-08-30／2026-08-30 R1 |

## Objective

在不改寫、不清除原 dirty workspace 的前提下，保留完整可回復快照，於獨立 worktree 依 Ticket 與 hunk 重建可辨識 checkpoint commit chain，最後證明重建樹與核准 freeze tree 等價。

## PM Draft Input — Historical, Partially Superseded by R1

```text
Original dirty workspace（read-only freeze）
  → path-to-ticket inventory
  → tracked binary patch + approved untracked archive + SHA-256 manifest
  → recovery verification
  → independent checkpoint worktree from frozen HEAD
  → per-ticket/hunk apply + commit + test
  → final frozen-tree equivalence
  → QA_REL_001
```

R1 supersedes the raw `tracked binary patch` part of this historical draft. The approved direction remains freeze → recovery proof → checkpoint commits → QA, but canonical portable recovery now uses a sanitized overlay bundle.

### Safety rules

- 禁止在原 workspace 執行 `git reset --hard`、`git checkout --`、`git clean`、stash/pop 或覆寫式搬移。
- 原 workspace 在 DEV_REL_001 期間不得再加入產品功能；必要文件狀態更新須列入 freeze delta。
- 每個 changed/untracked/deleted path 都要映射 primary Ticket；無法映射即停止交 PM。
- `test-results/`、`dist/`、`node_modules/`、`.local/`、`.env*` secret 與 local DB/log 不得進 checkpoint；正式 QA evidence under `docs/dev測試紀錄/` 可納入。
- 共用檔案如 `app/page.tsx`、`topology-transfer.ts`、`topology-store.ts`、`db/topology-postgres.ts`、package/lock 必須 hunk 級拆分。
- 已存在的 pre-freeze commits 不改寫；只以 release map 對應 Ticket。

## Verification model

- Recovery：patch/archive manifest hash 可重算，且能在隔離目錄重建 frozen tree。
- Per commit：TypeScript、ticket targeted tests、必要 build／DB／Browser gate。
- Final：包含 mode、content hash、symlink/type 的 allowlisted tree equivalence；只允許明列的生成物與 release metadata 差異。
- QA_REL_001 必須獨立驗證，DEV 不可自證放行。

## Design-group Review Required

本文件目前是 PM 組整理的設計底稿，不是設計組正式交付。設計組必須獨立檢查 dirty workspace／Git index 安全、recovery artifact、path-to-ticket與hunk ownership、nested worktree可行性、逐 commit乾淨驗證、tree equivalence、secret與rollback/no-path；不可直接沿用「Approved」結論。

完成後須：

- 補齊 Requirement Traceability、impact matrix、資料／artifact契約、演算法／命令流程、錯誤與停止條件、DEV/QA handoff。
- 對 `.local/recovery/dev-rel-001/PATH-MAP.csv` 的未映射項目提出處理規則，但不得修改或刪除 recovery初稿。
- 將本票改為 `WAITING_APPROVAL`，同步 Register並停止；不得啟動 DEV_REL_001、建立 branch/worktree/commit或交 QA。

`PM_GOV_001-D24` 已校正為 `WAITING_APPROVAL`；設計未獲確認前不得作為開發授權。

## Design Output — 2026-08-30

已新增正式設計契約：[RELEASE-CHECKPOINT-CONTRACT.md](../contracts/RELEASE-CHECKPOINT-CONTRACT.md)。

設計組獨立審查 PM draft、REL 三票、最新 QA evidence、目前 Git 狀態與 `.local/recovery/dev-rel-001` 初稿後，裁定：

- 保留原 workspace read-only freeze、recovery snapshot、逐 ticket/hunk checkpoint、final tree equivalence 的主方向。
- 不直接沿用 PM draft 的 PATH-MAP；目前 draft 仍有 `UNMAPPED` 與 mojibake/byte-expanded 中文路徑，DEV_REL_001 啟動前必須重新產生並清零未映射項。
- 推薦本地 Windows/Codex execution 採 ignored nested Git worktree：`.local/worktrees/dev-rel-001-checkpoint`；repo 外 sibling worktree保留為 CI/OPS 或使用者另授權時的更強隔離方案。
- `.local/recovery/dev-rel-001` 既有四份初稿只作輸入證據，不得修改、刪除或當成已驗證 recovery。
- HEAD 維持 `cbce10bba027d246ef78e92a1e2f01660da55e1f`；既有 pre-freeze commit 不 rewrite，只以 release map 關聯。

本段為使用者核准前的設計輸出狀態：本票當時改為 `WAITING_APPROVAL`，`PM_REL_001`、`DEV_REL_001`、`QA_REL_001` 仍維持 `BLOCKED`，`PM_GOV_001-D24` 仍維持 `WAITING_APPROVAL`；使用者／PM 確認前不得建立 branch、worktree、commit、recovery snapshot新版、或移交開發／測試。

## PM Approval — 2026-08-30, Superseded for Recovery Format by R1

使用者已核准本設計並要求移交執行：

- `PM_GOV_001-D24` 更新為 `APPROVED`。
- `DSG_REL_001` 更新為 `READY`。
- `PM_REL_001` 與 `DEV_REL_001` 可依 `RELEASE-CHECKPOINT-CONTRACT.md` 進入執行流程。
- `QA_REL_001` 維持 `BLOCKED`，直到 `DEV_REL_001` 完成並進入 `READY_FOR_QA`。

此核准仍保留 D24 的 freeze/checkpoint 方向；但 DEV_REL_001 已因 recovery artifact secret boundary 停止。R1 確認前，正式執行不得重啟。正式執行仍必須遵守 contract 的 stop conditions：任何 unmapped path、portable artifact secret hit、restore proof 失敗、worktree 不安全、commit 無法獨立 build/test 或 final tree equivalence mismatch，都必須停止回報 PM。

## Revision R1 — Recovery Artifact Secret Boundary

DEV_REL_001 依原 contract 執行前置 recovery artifact 時已安全停止。正式 PATH-MAP 已清除 `UNMAPPED`，但 `tracked-full-index-binary.patch` 會保存 `.env.example` 的 deleted historical credential syntax；即使該值已被舊 QA 判定不可再作為 active credential，portable recovery artifact 仍不得攜帶歷史 credential。

R1 設計修訂已寫入 [RELEASE-CHECKPOINT-CONTRACT.md](../contracts/RELEASE-CHECKPOINT-CONTRACT.md)：

- canonical recovery format 改為 sanitized end-state overlay bundle。
- raw full-index Git patch 不再是 portable checkpoint／recovery artifact。
- restore 改為：base HEAD → delete manifest → current files overlay → mode manifest → frozen tree equivalence。
- secret gate 區分 `active_exact`、`usable_dsn`、`retired_exact`、`approved_placeholder`、`credential_syntax`。
- `retired_exact` 出現在 portable artifact 仍 hard fail，必須重產 sanitized overlay。

## R1 Approval — 2026-08-31

使用者已核准 `DSG_REL_001-R1`，並要求移交開發組。R1 正式成為 DEV_REL_001 的 recovery artifact secret boundary 執行基線。

- `RELEASE-CHECKPOINT-CONTRACT.md` R1 狀態更新為 `APPROVED`。
- `DSG_REL_001` 狀態更新為 `READY`。
- `DEV_REL_001` 可重新啟動，且只能依 sanitized overlay recovery bundle 執行。
- `QA_REL_001` 維持 `BLOCKED`，直到 `DEV_REL_001` 完成並進入 `READY_FOR_QA`。
- push、deploy 與 OPS Pilot 仍未授權。
