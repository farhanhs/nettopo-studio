# OPS_ENV_001 — 開發／QA 環境隔離與一致性

## 2026-10-12 補強 phase／owner 交接

使用者核准必要隔離環境調整；本 phase 依 root [R3 有界授權補充](../contracts/HARNESS-AUTHORIZATION.md)。Owner 改專責 OPS（ID 見 [PM 實施紀錄](../../dev開發紀錄/2026-10-12-pm-harness-authorization.md)），PM 不再同時寫工具。下方 PM 暫代與 Auth 排序為歷史，不授權重啟 Auth 產品。

### 2026-10-12 OPS 補強候選交付（OPS primary writer）

- Status：READY_FOR_QA（OPS tool candidate）；整票仍 IN_PROGRESS，Docker／B3／CI 不因本候選改判 PASS。
- Candidate：root `dustool`／HEAD `72783636a8b22f353e8c25fe68b859ad62e3c237`，dirty baseline 295 paths；scoped fingerprint `7f8993acbb22fa77e4a7936a3d7c2d21f5d8f6f11883a6f81a892d57ef6d9024`，由 `node scripts/qa-env/cli.mjs doctor` 產生。
- Allowed tool paths：`scripts/qa-env/cli.mjs`、`scripts/qa-env/native-lifecycle.mjs`、自有 `tests/ops-env-001-*`；doctor 的 dependency closure 仍鎖 `package.json`／`package-lock.json`／installed direct dependencies，未新增依賴。
- OPS self-test：guardrails ENV-01–04 4/4 PASS；ENV-06 normal／controlled failure／readiness timeout 3/3 PASS；每路徑非 5432、具名 PID、port closed、directory removed；failure/timeout 保留預期 FAILED scenario 且 cleanup complete。
- Evidence：[`OPS_ENV_001 2026-10-12 candidate`](../../dev開發紀錄/ops-env-001-2026-10-12.md)。下一 owner=既有 QA 對話 `019fac8e-94dc-79c1-b156-7f242cf82967`，先完成 QA_NTM_003 當批後鎖定本候選做 QA_ENV_001；OPS 不代簽 QA。

### 2026-10-12 Native B1 independent QA handoff

QA_ENV_001 已核收 Native B1 `QA_PASSED`；整票 QA_ENV_001 仍 `BLOCKED`。QA 獨立核對 manifest 11/11、0 mismatch、0 root 外路徑、0 reparse，並完成 containment/no-env、guardrails 4/4、native normal/failure/timeout 與 CLI normal，native acceptance 5/5 PASS。所有 run 均 loopback non-5432、具名 PID 停止、port closed、directory removed，fixture dirs=0；QA runner 與 OPS candidate 分層。正式證據：[QA native lifecycle report](../../dev測試紀錄/qa-env-001-native-lifecycle-2026-10-12.md)。

保留 QA harness 首次 4/5 失敗及校正後 5/5 PASS 歷史；timeout 以契約 `READINESS_TIMEOUT` code 驗證，不要求非契約 failureMessage。Docker cold-start×2、container B3、Browser、CI/rulesets 仍 `BLOCKED/NOT RUN`，未由 Native B1 泛化放行。Native phase next owner=PM/OPS（僅剩餘明確環境 scope）；本票不因 B1 QA_PASSED 自動 DONE。

範圍：先讀既有 `scripts/qa-env`、`scripts/qa-container`、native fixture helper 與相關環境票／runbook，保留 dirty 基線。僅修改具名環境工具及自有 OPS 測試、`infra/qa`／QA Compose／runbook 必要欄位、本票與 register 本列；不得改產品、QA 獨立 runner／斷言、package/lock 或共用治理。若現有 helper 為 DEV 所有，先記精確檔案交接取得 sole writer，勿整檔覆蓋。沒有 active QA 的工具才可變更。

目標：scoped candidate／完整相依 manifest 與 evidence index、no-env 執行、資源 ownership／cleanup／recovery 證據。優先重用既有工具；若工具檢查已滿足要求，補證據即可，不為形式重寫。保留舊 CLI 行為，不靜默把原 full-root gate 換成局部 PASS。原版本／失敗保留。

驗證：自身 guardrails＋disposable native PG 的 normal/failure lifecycle；Docker 先有界確認本機 engine，未就緒記 BLOCKED，不重装或重開機。工具候選完成直接交 QA_ENV_001 鎖版獨立驗證；QA 優先完成 NTM 當批再接環境，不搶同一 owner。無 stage/commit/push／現用 env/DB／live；PRE-COMMIT 停。庫版本目前匹配，無新增依賴必要，若出現必要缺口依補充提交具名 dependency delta 再處理。

- Status：IN_PROGRESS（Phase A與C1 R4 PM核收；native lifecycle／B2／B3未完成）
- Priority／Order：P1／141
- Branch／Worktree：dustool／C:/Users/DUS/Desktop/project/nettopo-studio
- Base：72783636a8b22f353e8c25fe68b859ad62e3c237；dirty candidate 另記，不冒充 HEAD。
- Created：2026-09-20；Decision：PM_GOV_001-D40。
- Owner：PM 暫代 OPS；QA_ENV_001 獨立驗證；Auth 產品 writer 仍是 DEV_AUTH_006。

## 2026-09-20 安裝授權與 Phase A 核收

最新核收：QA_ENV_001 C1 R4 PASS，PM核21檔一致；DEV_ENV_001 B1改QA_PASSED。完整隔離PG工具可作後續基礎，不代表app/Browser/CI完成。下一优先回Auth C01–C03後端驗收，環境進階補強不再占用此可執行主線。QA_ENV_001其餘phase仍BLOCKED，另具名授權。

最新結果：WSL2.7.14.0安裝exit0；Docker Desktop4.91.0 per-user/WSL2/Linux containers安裝exit0並已開啟。CLI/engine29.8.0、Compose5.5.1；engine info回linux，無偵測到component servicing/WindowsUpdate待重開旗標。未自動接受條款／重啟主機。PG17.10與Node24.18.0官方映像已拉取並按digest跑無網路/readonly/--rm版本驗證，PASS；tag/digest固定於infra/qa/images.lock.json，版本容器與volume零殘留。Docker安裝／版本層完成，不等於DB/App/Browser/CI驗收。

PM現在啟DEV_ENV_001 B1做隔離PG Compose/lifecycle/migration-role工具，Auth產品候選不動；QA_ENV_001後續等B1 READY與PM freeze。下方「找不到Docker／等待安裝」為歷史。

使用者進一步明確要求「補安裝docker在這台電腦」，並確認符合免費使用條件。現在可安裝官方Docker與必要WSL，不代購訂閱、不自動接受首次啟動條款、不自動重開機。官方installer 4.91.0.239619／598.9MiB 已下載至 .local/installers/docker-20260920，Authenticode Valid、Docker Inc 簽署；WSL --install --no-distribution --web-download 已透過RunAs啟動，等待結果，尚不宣稱可用。

PM 已核對 QA_ENV_001 Phase A 報告及四工具hash一致，接受 ENV-01–05／6測試PASS、scopedlint PASS；native lifecycle/timeout/interrupt cleanup與container仍未驗。此核收不擴張產品或native測試授權，工具候選仍保留凍結以供後續追溯。

## 來源與保留規則

使用者要求審查測試組 Docker/Testcontainers/Playwright 建議並補齊乾淨一致的開發與測試環境。承接 D39 新流程及 D35/D37 Auth，不把工具升級當作替代原真 DB／Browser 驗收，也不延遲已可做的 Auth 修復。Change Type：EXTEND，限測試基礎設施；不是 reset／清空開發資料授權。

## Phase A — 現在執行

獨立新增 scripts/qa-env/*、tests/ops-env-001-guardrails.test.mjs、環境 runbook 與票面。PM 為這些新工具唯一 writer，不動 package/lock、現有 fixture helper、Auth 產品、現有 docker-compose.yml／開發 DB／env。DEV 與 QA 已收到互不改檔通知。

交付：no-env doctor；Node／直接依賴 lock 與安裝值／PostgreSQL 版本；來源 fingerprint；非破壞性 fixture 目錄盤點；native 具名案例入口，OS-only child env、不經 npm 自動讀 env 的 scripts、要求已核准凍結 fingerprint、測前後來源一致與目錄檢查。不是 sandbox，不能證明任意測試碼永不讀 env／開網路；僅批准名單內既有 synthetic runner，須由 QA 檢查其實際行為。

目前結果：4/4 guardrail unit PASS、scoped ESLint PASS、doctor PASS；Node 24.18.0、PostgreSQL17.10、直接依賴 MATCH、fixture directory count=0。未執行真 DB／Browser，未修改開發 shell 設定或讀 .env。詳 [日誌](../../dev開發紀錄/2026-09-20-ops-env-001.md)。

## Phase B — 容器與 CI 補強，入口尚未具備

2026-09-20 使用者補充「電腦已安裝docker，請要求授權打開並按需求設置映像檔」：已授权針對既有 Docker 提出系統啟動請求並建立本專案 QA image／隔離資源；不是授權重装、全域清理或刪除既有容器。PM 已兩次透過 require_escalated 唯讀查找安裝清單／執行程序／標準路徑及捷徑，均未找到目標，故未虛構路徑啟動。已請使用者提供捷徑目標或手動開啟。當前 blocker 是本工具環境找不到實際 executable/engine，不等於斷言使用者未安裝。

Docker CLI 不在 PATH，標準 Docker Desktop binary 位置亦未找到；不能宣稱 daemon/Compose 已可用。使用者選定公司容器主機或核准系統安裝後，依 [環境規格](../contracts/QA-ENVIRONMENT-BASELINE.md) 建立 docker-compose.qa.yml／QA image、獨立 Testcontainers integration adapter、真 HTTPS Browser 兩 app process、可選 Toxiproxy 及 CI matrix。

Compose 是 E2E stack owner，Testcontainers 是 integration fixture owner，不共同管理同一 DB。每個 case 或隔離 suite 獨立生命週期，suite 內清資料和並行隔離須證明；不要為每個小 assertion 啟一套昂貴 stack。

安裝 OS 軟體／WSL／daemon／重開機、接公司主機、外部 CI 啟用仍需具名環境確認；不自動下載或啟遠端。package/lock/Testcontainers 版本變更只在 Auth 受測候選解凍且工具子階段開始後處理。無 Docker 時可先交文件與工具測試，不以 YAML/source scan 宣稱容器 PASS。

## Acceptance／停止點

- ENV-01–04：不繼承DB/auth/preload/Compose；不改父環境；只允許具名 native cases；fingerprint 能偵測變更。
- ENV-05：doctor 不讀 env、不連 DB、不清理，版本不一致／fixture 尚存在須阻止 native execution；QA 獨立檢查。
- ENV-06：同候選 native lifecycle 的成功／失敗 cleanup、非5432、PID/dataDir/port；目前執行 NOT RUN，等 Auth freeze／自有fixture空檔。既有 helper 在 startup 部分失敗時的清理亦須檢查，不用「正常退出曾cleanup」代替。
- ENV-07：container migration/runtime 分權、image／lock parity、兩 app process、安全Cookie/多分頁、cleanup／故障注入及 CI，BLOCKED 等 runtime，不能省略。
- 不 commit/push/deploy，不清舊volume/目錄或動現用5432。Phase A 合格不等於整票完成或容器可用。
