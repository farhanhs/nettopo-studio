# NetTopo Studio 輕量 DevOps／敏捷工作流程 R3

## 2026-10-13 已驗收 checkpoint 的 Git 核准

使用者明確要求 commit and push，範圍與分支見 [具名授權](../../dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md)。只解除該候選的 Git 停止點，不改產品、安全契約或其他票的 gate。

## 2026-10-12 有界授權與環境分工補充

使用者核准 Harness 補強落地。依 [有界授權補充](HARNESS-AUTHORIZATION.md) 執行既有組別直接同票交接、OPS 環境主責、精確候選與證據；只在該補充列明的隔離操作範圍取代下文歷史逐次等待／環境限制。產品契約、獨立 QA 與 PRE-COMMIT 停止點不變；平台權限、現用資料、遠端修改不因文件自動放行。

## 2026-10-09 具名補充核准：本機 Beta

使用者核准 [PM_BTA_001](../active/PM_BTA_001.md) 與 [本機Beta工作包](../../開發計畫/2026-10-09-local-feedback-beta-plan.md)，明確要求先建立GitHub分支後派單。只啟動 `codex/public-beta-0.1` 上DSG_BTA_001、DEV_BTA_001–003與QA_BTA_001的具名範圍／相依；Beta不是本文件A→C→B的正式人事B，未啟其他功能或變更產品契約。

本次遠端權限僅建立baseline分支，已精確公開既有a9abe63基準；不得自行推後續變更。產品到第一個必要獨立QA PRE-COMMIT停止，無stage/commit/tag/Release/merge/deploy/live授權。CORE-R2及其他線停止點保留。下列10/05「只A」是當時授權歷史，本節僅新增此具名Beta包；其餘角色、固定QA、證據、安全與同票退修規則不變。


## 0. R3 生效與本輪工作包（2026-10-05）

- Authority：PM_GOV_001-D42；治理票：`PM_GOV_005@dustool`。使用者核准「落盤新規則，開始 A 工作包」。下列 R3 覆蓋衝突的歷史排程及 Git 停止點，未變更的 R2 角色、安全、獨立 QA 與閉環條文繼續生效。
- 產品優先序 **A 拓樸實用流程 → C AI 雙軌整理 → B 正式人事登入**。現在只啟動 [A-WP-20261005](../../開發計畫/2026-10-05-a-topology-work-package.md)；C/B、未核准或 DEFERRED 票不自動啟動。
- A→C 的成果門檻：固定候選的拓樸操作流程通過獨立自動化驗收，不以 build 或舊分支 PASS 替代。人工 F01–F12／原生縮放保留 NOT RUN／DEFERRED 及 owner，仍擋相應 UAT／release，**不擋本包工程 checkpoint**。
- C 首期只承諾雙軌 UI、mock backend、preview/apply/undo；真 GPT/provider、品質及成本另驗，不將 mock 寫成已串 GPT。B 的 live 上游、Client 設定與公司人事驗收另按具名工作包辦理。
- 本 root 文件是跨工作線唯一共用規則版本；worktree 只存入口引用。產品契約、票面、候選與證據留在指定 branch/worktree；root register 只索引，不複製異分支結果當本地 PASS。同名歷史票衝突以 `Ticket@branch + worktree` 識別，不覆寫或默默重編。

### 工程 checkpoint 與發布分離

工作包核准可包含 **範圍內的小批次 commit**，無需每個存檔點重複請批；不是所有票的無條件 Git 權限。當前生效範圍只有 A。每次 DEV staging/commit 前必須：

1. 記錄工作包核准、分支／base、票與該 checkpoint 的 acceptance IDs；確認沒有較新的使用者停令及 active QA/writer 衝突。
2. 取得獨立 QA 對精確候選及該 checkpoint 必要條件的 PASS；影響舊結果時重驗，不用 DEV 自測代簽。
3. 逐 path/hunk staging，核對 staged diff、secret/generated artifact、票屬性與依賴；不得盲目 `git add .`、整檔混入 Auth 或其他票。
4. 每個中間 commit 都可重建且通過相應 targeted tests；最終 committed tree 另驗內容等價與必要回歸。commit 前後實際 hash 記錄在票／日誌，不只記 dirty tree HEAD。
5. 尚未執行的 UAT/live/release 明列，不藉 checkpoint 標示整案 DONE。QA 無產品或 Git 寫入權；DEV 不改 QA 斷言換 PASS。

本包 **不包含 push、merge/cherry-pick／跨分支整合、部署、安裝、付費 provider、真人 HR/OTP、現用 DB/env/secret 存取**。這些必須另獲授權；本次不動 Docker 阻擋線。共用治理文件本輪只落盤，不混入 A 產品 commit。

## R2 生效歷史與繼續適用條文

- Effective：2026-09-20；Authority：PM_GOV_001-D41；治理票：PM_GOV_005。
- 適用：本專案 PM／DSG／DEV／QA／OPS；新票及既有已核准工作的後續執行。首先轉入 dustool 的 DEV_AUTH_003、QA_AUTH_003、QA_AUTH_001；既有產品契約、已驗結果及失敗歷史不重寫。
- 來源：過渡草案 R1.1 §2 五角色責任，以及使用者核准的 QA 往返檢討。完成兩階段過渡中的流程啟用，不等待 Auth 整票完成才改善流程。
- 優先順序：本文件取代 D38/D39、Auth R1 及歷史票面中「每次退件由 PM 解凍」「首個一般失敗就全停」「每次 QA 工具修補須 PM 重批」的流程要求；不取代產品／安全契約或外部操作權限。
- R2 當時未啟用小批次 Git 政策；R3 僅在具名核准工作包內依 §0 啟用。CI 平台、套件、安裝、全域技能仍不因流程改版取得授權；不同 worktree 不擅自切分支或搬入產品變更。

## 1. 五角色與單一成果

| 角色 | 對成果負責 | 可自行接續 | 必須升級／停止 |
|---|---|---|---|
| PM | 使用者成果、範圍、優先序、發布用途及階段核收 | 維護一次性的工作包、必要驗收清單與風險決策 | 新功能／方向、重大風險接受、額外權限交使用者；不逐個批准 bug 修復 |
| DSG | 架構、欄位、API／錯誤／UX 契約 | 開發前與 DEV／QA 對齊成功、拒絕、異常案例 | 只有新語意或兩種合理解讀才補設計；既有契約 bug 不重新設計 |
| DEV | 一個功能的端到端產品整合與自測 | 已核准 scope 內同票 CORRECT、直接交 QA | 不改獨立 QA 斷言換 PASS；越過 scope／新契約交 PM／DSG |
| QA | 獨立案例、測試工具、證據及重驗歷史 | 隔離環境預跑、修 QA 工具、批次驗收與直接退 DEV | 不改產品；不刪必要案例；環境與安全無法保證時停受影響部分 |
| OPS | 隔離環境、版本、設定、備份／回復與部署準備 | 既有具名環境票授權內的操作 | 安裝、現用 DB／秘密／真公司 API、部署等須各自授權 |

每個功能只有一個 primary DEV owner；每次交接只有一個 next owner。同一工作樹同一高衝突模組最多一條產品寫入線。QA 案例與 OPS 準備可提早並行；OPS 未指派時由 PM 持有待辦，不默認由 QA 接手。保留現有組別對話，不增管理層。

## 2. 五步工作流

1. **定義工作包**：PM 記錄使用者成果、contract@revision、票／phase、允許路徑、依賴、環境、必要 acceptance IDs、發布用途與停止點；已有批准資料只引用並補差異。
2. **實作與測試準備並行**：DEV 自測；QA 提前在已核准隔離 fixture 預跑工具、驗正常／異常／清理。預跑不是正式驗收，不需為每個工具參數回 PM。
3. **固定版本、完成本批**：DEV 交 manifest，QA 確認接收與鎖定後執行全部可獨立案例；同一狀態污染的相依案例列 BLOCKED，不為一般單項 FAIL 停止全部案例。
4. **DEV ↔ QA 同票閉環**：QA 集中退缺陷清單；DEV 按根因及相依分成小批修復；QA 先驗 blocker，再受影響回歸及本輪必要矩陣。只改工具則 QA 自行維護並建立新測試版本。
5. **成果核收**：QA 回報可演示／可內測／未放行的證據和限制；PM 在成果節點核收與安排下一工作包。工程 commit 依 §0 的工作包授權；沒有授權仍停止。通過測試不自動取得 push／整合／部署權限。

「完成本批」不是等待所有產品或整個專案全部測完。每批是一個可演示功能／明確 phase，失敗集中回報；不得長時間跨多個不相干功能囤積缺陷。

## 3. 候選、直接退修與證據

- QA 正式測試期間產品固定。記錄 repo/branch/worktree/base、產品 path/hash、QA runner/fixture 版本、依賴及實際 artifact；dirty tree 不能只記 HEAD。
- QA 結束受影響 batch 並完成 owned resource cleanup 後，發送同票退件並記錄 `QA release for repair`：候選、具名缺陷、契約來源、最小 allowed paths/hunks、回歸案例、next DEV owner。DEV 收件核對無 active QA 後，將自己的票改 IN_PROGRESS 即可修，不必再等 PM 解凍。
- 不得同時測試和修改同一候選；若有獨立 immutable snapshot，記錄其來源與隔離，不能混用不同版本證據。
- DEV 完成後 READY_FOR_QA，交新 manifest／差異與自測。QA 自行驗 hash、鎖版、進 IN_QA；一般 QA 準備→預跑→正式測試及同票重驗不再逐次等 PM freeze。
- QA-only 工具維護保留原失敗、變更原因、同等契約斷言與前後版本；不需產品解凍。修工具不能將真產品偏差重新定義為合法，也不能直接改舊 manifest 假稱未變。
- 新候選變動會使受影響證據失效；QA 依 dependency／impact map 決定重跑。只有可證明未受影響、產品／依賴相同的案例可引用舊證據，必須逐項列出，不把舊整票 PASS 搬到新版本。
- 正式 acceptance 清單在 batch 前固定；新增發現依既有契約分類，不可測後刪失敗案例或暗加新功能需求。

## 4. 停止條件、缺陷分類與延後

**立即停止受影響執行**：秘密外洩、未核准真系統／現用 DB 存取、資料破壞風險、fixture 污染、資源歸屬／清理不可確認、候選遭並行修改。先安全收束，不為「全測完」繼續高風險操作。前置壞掉只阻擋相依案例；獨立案例在隔離與候選仍可信時繼續。

| 分類 | 判斷／處理 | 是否擋本輪成果 |
|---|---|---|
| 產品核心／安全缺陷 | 登入失效、授權越界、舊 Session 恢復、秘密／資料錯寫、主要操作無安全替代 | 擋；依既有契約直接 DEV 修復，保留 QA 獨立重驗 |
| 次要產品缺陷 | 目標用途主要操作仍可完成，無安全／資料影響，例如非必要視覺改善 | QA 提證＋DEV 影響分析，PM 批次核准延後；不得自行降低既有必要 acceptance |
| QA 工具／fixture 缺陷 | 呼叫參數、時序 barrier、收集器或測試資料錯誤 | QA 自修預跑；所缺必要證據仍擋驗收，不能當產品通過 |
| 環境／不可測／不穩定 | 缺前置、未執行、偶發 timeout | 列 owner 與下一步；是否擋取決於必要 acceptance，不預設無害 |

延後必填：defect ID（沿用票內編號）、原要求／結果、影響與證據、目標發布用途、替代方式、owner、後續 ticket、具體到期日／里程碑、核准人、`blocksRelease` 與理由。一般非核心項由 PM 在既有用途內批次核准；改功能承諾、核心安全或重大營運風險交使用者。不得把認證／授權／秘密／資料完整性硬邊界當低優先修飾項。

QA 工具 FAIL 不自動等於產品 FAIL；沒有觀測不等於零洩漏。不刪失敗歷史、不把 NOT RUN／skip／deferred 記 PASS。票狀態與發布判斷分開：有未解產品失敗仍 QA_FAILED；必要證據不足為 BLOCKED；全部原定必要條件通過才 QA_PASSED。若 PM 核准將非核心要求移到後續票，須具名 scope revision 並保留原結果，不能宣稱原 full suite 全綠。

## 5. 何時交 PM／使用者

- 一般既有契約修復、QA 工具維護：DEV／QA 直接交接，PM 只收 batch 摘要，不作每輪前置批准。
- 兩次修復重驗仍是同一根因：DEV／QA 先提供短根因／缺失測試／改善方案，第三輪前交 PM 協調；其他獨立工作不必全停。
- 超 scope、新 schema／依賴／API／角色／生命週期／安全語意、契約衝突、環境權限不足、WIP 衝突、風險延後：升級 PM，必要時 DSG／OPS。
- 改專案方向／功能承諾、新外部權限、重大風險接受、超出既有授權的 Git／release／live：使用者決定。
- 跨組派送失敗時記 delivery blocked 與 next owner，通知 PM 協助；不能宣稱送達或因工具問題越權修改另一組程式。

## 6. 狀態、最小紀錄與回顧

`READY → IN_PROGRESS → READY_FOR_QA → IN_QA → QA_PASSED`；失敗沿原票 `QA_FAILED → 同票修復 → READY_FOR_QA → IN_QA`。QA 票保留 QA_FAILED 與歷史直到開始重驗；DEV 在 QA release for repair 後管理自己的開發狀態。BLOCKED 記必要條件及 owner。DONE 仍須核准 checkpoint，不因流程上線就把產品票改完成。

工作包／交接只須以下核心欄位；同一資料引用一份文件，不反覆貼歷史：

```text
Ticket / branch-worktree-base / contract@revision / user outcome / release profile
Scope + allowed paths / primary DEV / QA owner / environment owner
Candidate + QA tool version / active run or release-for-repair / next owner
Acceptance IDs: expected / actual / evidence / PASS-FAIL-BLOCKED-NOT RUN
Defects: ID / category / impact / owner / regression / blocksRelease
Deferred: approved scope revision / follow-up ticket / due / workaround / approver
Authorization: code / QA / commit / push / deploy / live (separate)
```

DB／安全／競態才加 fixture provenance、PID/port/dataDir、時序及 cleanup；一般文件工作不填無關附錄。phaseResults 在主 QA 票，Register 只摘要；PM／Decision 的 shared files 由 PM 主責，各組只改自己票及 Register 本列。

第一個轉入工作包完成後由 PM_GOV_005 回顧：首次驗收結果、產品／工具／環境失敗數、DEV↔QA 回合數、等待 PM 次數與原因、延後項及使用者可操作成果。無基準不承諾提速百分比；不新增常駐監控。

## 7. D41 切換紀錄與當時權限邊界（歷史）

- 即日起全專案採上述角色及流程；未核准／DEFERRED 票不因流程改組自動啟動。既有正在測試的 batch 先安全結束，再按新交接接續，不中途改判定。
- Auth 當前用途仍是 synthetic 可演示驗證；R9 首批6＋Functional4 PASS 保留，未驗項及整票 BLOCKED 不因 D41 改成 PASS。
- QA_AUTH_003／QA_AUTH_001 可在既有隔離 mock Browser scope 完成第三批 scanner/生命週期/響應式/鍵盤工具、自測與 owned build/preview/Browser，QA 自行保存新候選並批次執行，不再等 PM 逐次 freeze。可修該票 QA-only runner/helper 的必要工具缺陷，須記影響並回歸；不得改產品或減少 assertion。
- DEV_AUTH_003 維持目前 READY_FOR_QA；只有 QA 具名缺陷並 release for repair 才啟動同票產品修復，沿既有 UI/Auth allowed scope。後端新契約／schema／無關模組不在此授權。
- 尚未就緒的真 DB＋HTTPS Browser、headers-streaming 等不得以 mock 代驗；先記需要的 fixture／owner，未在既有環境票核准的操作由 OPS／PM 另核。QA_AUTH_002 真公司 DUS／真人 OTP 不啟動。
- D35/D37 的登入當下驗證＋既有權限、unknown 停止並明確重啟、安全儲存例外等全部不變；DEV_AUTH_004/005 仍延後。
- Git 條件、push/merge/deploy/live、現用 env／DB／秘密與安裝權限逐項沿用既有核准。本次只修改流程與交接，不執行 Git，不宣称公司系統已接通。
