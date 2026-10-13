# QA_ENV_001 — 環境隔離工具與 Native／Container 一致性驗收

## 2026-10-12 OPS native lifecycle candidate — BLOCKED_METADATA

依使用者核准的 R3 有界授權補充，在 `QA_NTM_003` 當批完成後接手 OPS_ENV_001 固定候選。root branch／HEAD 為 `dustool`／`72783636a8b22f353e8c25fe68b859ad62e3c237`；接手時全樹 dirty count 295，較 OPS 紀錄 293 多出的變化不直接視為候選漂移。QA 以 doctor scoped fingerprint `4f964676b7147cf93d16fe2db8bdf25293941dc24ab9b359361f31b7784e2ad5` 及工具／dependency精確hash鎖版，已重跑 doctor MATCH。

本批只驗 containment、scope/dependency drift、OS-only no-env 與 ENV-06 normal／controlled failure／readiness timeout 的 owned PID／random loopback non-5432 port／directory cleanup。新增 QA-owned `tests/qa-env-001-native-lifecycle.test.mjs`；不修改 OPS 工具、產品、Auth、OPS tests、package/lock 或規則。Docker engine lifecycle／cold-start、B3／CI、Browser維持 `NOT RUN/BLOCKED`，不由 native 結果泛化。

正式執行前發現 OPS 交付的 `4f9646...` doctor fingerprint 其實涵蓋 package/lock 與整個 app/db/scripts/tests，是廣域 source observation，不是本次 CLI→native-lifecycle→environment/policy 與 native PG 工具的精確 dependency manifest。依 Harness §4，QA 已直接同票要求 OPS 只補 metadata：逐檔 raw hash/bytes/realpath、實際載入 closure、initdb/postgres/pg_ctl 來源版本與hash、manifest自身hash及 writer-stop。QA runner準備不屬OPS候選，須分層記錄。三個 lifecycle案例目前仍 `NOT RUN`，fixture directories=0，未建立PID/port/dataDir；狀態 `BLOCKED_METADATA`，next owner OPS_ENV_001。工具與產品維持凍結。

OPS 後續補交 manifest raw `cdb80b098a0b4e0da357be278defc95e0546db67ff3e3b0030fb857c470a537c`，但 QA 重新鎖版發現 `scripts/qa-env/native-lifecycle.mjs` 從首次接手觀測 raw `37ffedd7075d764952e2d780d601822cfdadb6cd65ec2bf5640fb3ef4bd3c6b7` 變為 manifest 的 `8f01b2f56effa90dcaf801a5842f756d54763b47c5aaa22995dfaad9beb57ed2`，與「工具程式保持凍結」不一致。QA 已要求 OPS 說明精確差異／原因、必要時重跑自測並重新固定manifest；不自行回退。正式 lifecycle 仍未開始，狀態補記 `BLOCKED_CANDIDATE_DRIFT`，owned resources仍none。

### Native B1 independent result — QA_PASSED；整票仍 BLOCKED

OPS 已證明漂移僅為 timeout branch 未使用的 `catch (error)` → `catch`，重跑自測並交 final manifest raw `2b7dcf35efc0bf20421fa2a28be2b7bcb70257e76a46430acae417e514ad8e8f`。QA 重鎖 11 entries：0 mismatch／0 root外路徑／0 reparse，writer stopped；QA runner raw `01901cf2560b7b36b62da1fc32c531bbede37ca5acc70430d869197189ec1cf8` 分層記錄。

獨立結果：containment/no-env＋normal/failure/timeout 5/5 PASS；OPS guardrails 4/4 PASS；實際 CLI normal PASS。Failure 明確在 PostgreSQL ready 後回 `CONTROLLED_INIT_FAILURE`；timeout 回 `READINESS_TIMEOUT`。三路及CLI run均為random loopback non-5432、具名PID，測後PID停止、port closed、directory removed；最終fixture dirs=0。Node checks、scoped ESLint、diff check PASS，manifest測後11/11一致、index empty。

QA加強斷言時曾有一次4/5：錯誤要求timeout一定有`failureMessage`；cleanup已通過。QA-only斷言校正為既有契約的code-only safe surface後完整重跑5/5，失敗歷史保留，不算OPS缺陷。

Native B1 phase為 `QA_PASSED` 並release候選鎖；整票仍 `BLOCKED`，Docker cold-start×2、container B3、Browser、CI/rulesets維持 `BLOCKED/NOT RUN`。未讀env／現用DB，未用Docker／Browser／live，無安裝或Git寫入。完整證據：[qa-env-001-native-lifecycle-2026-10-12.md](../../dev測試紀錄/qa-env-001-native-lifecycle-2026-10-12.md)。

## 2026-10-09 Docker 隔離入口 DEV 重驗可用，整票仍 BLOCKED

使用者本日明確要求確認 Docker 容器隔離測試，僅就此有界自測解除下方歷史停止操作限制，不擴成 cold-start、独立 QA 或部署授權。DEV 於 13:24（Asia/Taipei）使用既有 PostgreSQL fixture 完成 6/6：正常 migration/verify、角色/DML/DDL 邊界、受控初始化失敗清理、SQL timeout/interrupt 取消、兩組並行隔離。schema `0006` ready，測前後候選 hash 不變；每組自建容器/網路/資料卷均零殘留，port 關閉，原有資源保留。

**目前 Docker PostgreSQL 隔離入口可用；此為 DEV 自測，不是獨立 QA_PASSED。** 整票維持 BLOCKED，cold-start ×2、B3/CI 等未完成項及歷史失敗保留。本轮未改產品、未修復或刪除原缺少密碼的手動 PostgreSQL 容器。候選、run IDs、exit、清理與限制見 [DEV 10/09 重驗證據](../../dev開發紀錄/2026-09-20-ops-env-001.md)。下一責任組 PM 追蹤剩餘驗收；本次不派啟 QA。

## PM 裁定 A（2026-09-26）

Docker再次報錯後本票維持BLOCKED/ENVIRONMENT，不再操作Docker/WSL。DEV_ENV_001新native fixture只授權QA依受控入口獨立重驗Auth剩餘整合，不代表本票cold-start/B3/CI完成；保留所有歷史及未驗項。完整裁定見[PM交接](../../dev開發紀錄/2026-09-26-pm-auth-remaining-acceptance.md)。不以環境票blocked停止不依賴Docker的已核准Native Auth驗收，也不將其泛化為Pilot部署放行。

## 2026-09-26 Auth剩餘驗收readiness

本輪窄幅解除後僅正常啟動Docker Desktop一次並等待45秒，engine仍`DOCKER_ENGINE_UNAVAILABLE_AFTER_BOUNDED_WAIT`，故停止Docker路線；未重啟/重裝/reset/prune。compose與images.lock固定版本/digest且只含PG，無需更新，不冒稱container app。正式doctor顯示Node24.18、PG17.10、dependencies MATCH、fixture dirs0，native入口READY且candidate fingerprint已保存。B2 DEV-owned fixture仍缺native DB seam、gateway control secret與safe ZIP合併scan，已具名退DEV最小修正。完整紀錄見[2026-09-26 readiness](../../dev測試紀錄/qa-auth-remaining-acceptance-2026-09-26.md)。

正式native `auth-contract-boundaries`以更新後fingerprint執行3/3 PASS，三fixture均PID/port/process/directory cleanup完整，candidate unchanged且fixture dirs0。這不代簽B2真Browser剩餘整合。

## 2026-09-22 無 Docker靜態／入口盤點結果

Native ENV-06既有受控入口會先執行固定Docker probe的`doctor()`；在使用者暫停全部Docker diagnostic/query期間不能安全執行，也不修改原runner繞過，normal/failure/interruption均`NOT RUN / BLOCKED_DEPENDENCY`。B3／Testcontainers／CI無核准可執行入口，標`BLOCKED_IMPLEMENTATION`，不新增套件、平台或remote job。完整證據見[無Docker QA批次](../../dev測試紀錄/qa-nondocker-auth-env-2026-09-22.md)。既有A/C1/B2 PASS保留，整票仍BLOCKED。

## 2026-09-22 優先序調整：暫緩 Docker，續行獨立工作

使用者要求「跳開這部分先做其他驗證跟開發」。Docker故障診斷、啟停、cold-start、容器實跑全部暫緩；不再查詢/修復Docker，不重裝/刪socket/WSL shutdown。整票仍BLOCKED，不等於取消原必要條件或接受風險放行。

QA改優先QA_AUTH_003/001的無Docker真200%zoom及既有純工具缺口；Native ENV-06僅在既有入口可完全不呼叫Docker、無現用env/5432、owned PG可安全辨識清理時執行。若其preflight仍依賴Docker，停該子項具名回報，不為繞過環境而重寫runner或mock代簽。B3/CI保持未建置盤點結果，不擴新平台。所有新runtime操作先確認自身前次資源歸屬，不刪未知殘留。其餘授權沿原票，詳見PM排程紀錄`docs/dev開發紀錄/2026-09-22-pm-nondocker-priority.md`。

## 2026-09-22 單次啟動收證：環境仍阻擋

使用者另授權PM正常啟動Docker一次並同步收證。20:31:09–20:32:05（UTC+8）實際觀察56.4秒，17次version probe皆Server unavailable；20:31:15新backend log再次記socket/stale/file-inaccessible及backend crashed。沒有重啟/重裝/刪檔/容器操作，仍有Desktop/backend程序不代表engine ready。整票BLOCKED/ENVIRONMENT；最新資源狀態未能查詢，不宣稱cleanup=0。詳見[單次啟動收證](../../dev測試紀錄/docker-single-start-capture-2026-09-22.md)。本次一次start授權已用完，QA不得再啟動/修復；Next owner=PM/OPS，待具名根因診斷授權。既有產品與phase結果不改。

## PM 停止裁定：Docker 啟動後未就緒（2026-09-21）

依QA即時回報採方案A，整票維持BLOCKED，原因分類ENVIRONMENT；不判NetTopo產品FAIL。正常stop/start後engine named pipe不可連線，start命令完成不等於engine ready；使用者中止後續status/logs，本輪不再發起Docker查詢、啟動、重啟或恢復診斷。Next owner=PM/OPS，等待使用者確認一次有界診斷範圍或人工恢復。此段優先於下方啟停派驗授權。

現有第一輪證据僅能確認server API 29.8.0、具名hello-world exit0與當時零殘留。QA需補是否實際完整stop→backend退出→start→ready；未有證據不能計入cold-start通過次數。最新engine/資源狀態因診斷中止為未確認，不把前一次零容器當成目前全面cleanup證據。恢復後仍須達成兩次連續完整cold-start成功，不能只補一次第二輪即關閉事故。

QA先落盤已有命令/時序/exit與失敗歷史，不為補報告重跑。A/C1/B2原候選歷史PASS保留；Docker相依Auth案例及cold-start停，native ENV-06本輪未執行維持NOT RUN。可繼續不接觸runtime的B3/CI文件盤點與工具靜態準備，不建立新資源。拓樸分支純開發不因Docker故障改判失敗。禁止reset/reinstall/prune/刪socket/WSL廣域shutdown或強制關閉未知process。

## 2026-09-21 使用者授權接續剩餘環境驗收

使用者明確要求繼續測試本票尚缺部分。Next owner=測試組，branch=dustool；本段為最新執行入口，優先於下方歷史只準備/未派native描述。當前整票BLOCKED不因派驗即改PASS；正式batch開始由QA標IN_QA，依完整結果恢復BLOCKED/QA_FAILED或QA_PASSED。

1. **先取得環境空檔**：收束既有Auth active run並驗owned cleanup，記所有測試process/port/fixture及Docker containers占用。此輪由同一QA owner串行使用Docker，不中止仍在執行的Auth。發現他組/未知容器或依賴daemon工作時，cold-start部分BLOCKED並回PM，不停止他人工作。
2. **Docker cold-start ×2**：使用已確認per-user安裝`C:/Users/DUS/AppData/Local/Programs/DockerDesktop`。核准在確認無其他使用者工作依賴後，正常關閉Docker Desktop並確認engine/backend停止，再正常啟動、等待有界ready，連續完成兩輪。每輪驗server API及具名ephemeral最小容器exit0/無殘留，依當輪timestamp檢查socket crash；不是兩次version查詢代替cold-start。必要正式升權照工具流程；不wsl --shutdown、不重開Windows、不force-kill未知process、不刪socket/重裝/reset/prune。正常stop/start無法完成即保留證據停該項。
3. **Native ENV-06**：依現有scripts/qa-env/policy.json具名synthetic runner核對可執行範圍，再固定當前source/tool manifest，以乾淨env、獨立非5432 PG、run-owned目錄補normal/failure/interruption lifecycle證據。QA可新增tests/qa-env-001-native-*.test.mjs/QA-only收證helper，不能改產品/原fixture/DEV tests或放寬guard。已有同候選且證明無影響的證據可逐項引用，不無差別重跑全部Auth。runner無安全故障入口時列最小工具缺口，不能直接kill host PG或宣稱目錄空即cleanup通過。
4. **B3／CI completeness**：對照基線逐項列已實作/已驗/未實作/未授權，具現成安全本地入口者可按同一no-env/owned隔離規則驗。沒有Testcontainers/CI入口則NOT RUN或BLOCKED_IMPLEMENTATION，指出owner與最小後續scope；本次不安裝套件、不新增平台、遠端CI job或公司runner。不以「要測試」推導新增產品/環境功能開發。

寫入僅本票、QA紀錄/安全summary及具名QA tests；Register本列可同步實際結果。Auth barrier/gateway工具正在變更時先固定候選，不混用舊B2結果；依impact回歸，已通過A/C1/B2歷史不覆寫。每项記PASS/FAIL/BLOCKED/NOT RUN、版本/實際命令/退出碼/時序/清理/next owner；secret僅bool/count/code。QA工具自行修復按R2，產品缺陷安全cleanup後原票退DEV。

不讀現用env/DB、不真DUS/OTP、不Git/deploy；拓樸DEV在獨立AIL樹，不因本輪暫停其純開發。測完可安全執行的環境batch後接續既有Auth剩餘授權，不為B3未建置無限阻擋Auth。PM派驗紀錄見`docs/dev開發紀錄/2026-09-21-pm-qa-env-remaining.md`。

## B2 三路徑獨立結果（2026-09-20／2026-09-21）

2026-09-21 Docker整改後：preflight與ephemeral hello-world PASS，19:10後無新socket crash marker；更新候選的normal、controlled init failure、PTY external interruption三路徑均完成。Normal補齊Cookie Path／expiry與DB Session revoke後protected mutation=401、Customer/Audit zero-write；三路徑各自resources=0、ports closed、run directory removed。第一次非PTY interruption為QA harness signal注入失敗，精確owned cleanup後改用PTY驗同一候選，失敗歷史保留。B2 phase PASS；Docker事故仍缺兩次cold start，QA_ENV整票另有B3／CI等未完成，故整票維持BLOCKED。詳見[QA B2紀錄](../../dev測試紀錄/qa-env-001-b2-auth-browser-2026-09-20.md)。

獨立正式 run `dev-env-001-b2-1789909094197-4a593a06` exit 0：isolated PostgreSQL migration、runtime role、run-owned TLS、synthetic DUS、App A/B、單一 HTTPS gateway、Chromium login/reload、真 Cookie、browser-facing headers-before-body abort 全部完成；source manifest=`12e4d1c...261d`、artifact=`ee517de...e9b`、A/B receipts齊全，`resourcesRemaining=0`、`portsClosed=true`、成功 run directory已移除。第一次 sandbox `EPERM` run保留為HARNESS歷史並已精確復原，不判產品失敗。

逐案判定：B2-TLS-01／ENV-01／ORIGIN-01／AUTH-01、AUTH-UI-11及success cleanup PASS；AUTH-SEC-04僅Secure/HttpOnly/SameSite/script-unreadable通過，Path/Max-Age未驗；AUTH-SEC-05、完整orchestrator受控init-failure／interruption cleanup仍NOT RUN。現有入口沒有上述模式／斷言，受影響部分依R2轉`BLOCKED`並直接退原DEV_ENV工具owner補最小fixture能力；不把正常路徑phase PASS宣稱為B2或整票完成。完整證據見[QA B2紀錄](../../dev測試紀錄/qa-env-001-b2-auth-browser-2026-09-20.md)。

### QA release for repair — B2 remaining evidence（2026-09-21，已由更新候選解決）

- Candidate：上述六檔hash；active QA run已結束，成功／失敗run均無owned process或run directory留存。
- 分類：QA／environment fixture evidence gap，不是產品FAIL；已完成PASS不失效。
- 最小補強：Cookie Path與Max-Age／expiry assertion；可控revocation後protected mutation及DB zero-write；可控init-failure與interruption，兩路皆輸出精確owned cleanup receipt。
- 不需：重做B2正常流程、Testcontainers／CI、大型統一runner、產品Auth語意變更或新dependency。
- Regression：原正常成功路徑、A/B receipt、headers-before-body abort及success cleanup不可退步。
- Next owner：DEV_ENV_001；READY_FOR_QA並提供新hash後，QA只先驗blocker與受影響回歸。

## D41 B2接續入口（2026-09-20）

QA-only前置已新增`tests/qa-env-001-b2-auth-browser-contract.test.mjs`，以八個case先阻擋不完整handoff；詳細映射見[準備紀錄](../../dev測試紀錄/qa-env-001-b2-auth-browser-preparation-2026-09-20.md)。DEV仍IN_PROGRESS，本輪未正式執行變動工具。

DEV_ENV_001最小native-hybrid HTTPS/雙instance/synthetic DUS fixture已核准實作/smoke，取代下方僅接收唯讀盤點的時點；B1/C1 R4 PASS保持。本票仍BLOCKED，可先準備具名QA-only案例；DEV交READY_FOR_QA、固定manifest、清理/信任契約後QA依R2直接核入口IN_QA，不逐輪等PMfreeze。核process最小secret、source/image、限定TLS信任、真單origin A/B、migration/runtime、headers-body時序及成功/失敗精確cleanup，結果供QA_AUTH_003引用。不得把DEV smoke代簽Auth PASS，不擴張產品/依賴/安裝/信任庫/現用DB/Git/live；B3/CI不啟動。工具缺口同票直接DEV退修，新權限/契約才交PM。

Auth環境對接清單：[qa-auth-remaining-acceptance-2026-09-20.md](../../dev測試紀錄/qa-auth-remaining-acceptance-2026-09-20.md)。只接收DEV_ENV_001 B2唯讀盤點，不因此啟動環境修改或宣稱真HTTPS/Cookie/DB完成。

- Status：BLOCKED（Phase A PASS；Phase C1 R4 PASS；B2三路徑PASS；Docker事故cold-start與B3／CI等其他phase未完成）

2026-09-29：依 PM 裁定 A，QA 已用 `--database=native` 獨立通過 Auth late Cookie/generation 與 Safe ZIP/secret-surfaces 真整合，且本次 run resourcesRemaining=0、portsClosed=true。此證據核收 DEV_ENV_001 的 Native Auth fixture，但 Docker cold-start、B3、CI 歷史 gate 不取消，因此本票仍為 `BLOCKED / ENVIRONMENT`，不泛化為 Native Pilot 部署通過。

### B2 QA入口核對（2026-09-20）

DEV交付六檔SHA-256全部一致；OpenSSL 3.5.7工具SHA-256=`78340fb01dea2df5caab73dcf28833b31329226a4c9e02f717f1d399592265b9`一致。DEV boundary＋QA handoff gate共7/7 PASS；限定TLS、process env、A/B single-origin、headers/body abort與cleanup契約入口成立。轉IN_QA，執行獨立真B2 orchestration；DEV smoke不代簽。
- Priority／Order：P1／142；Branch：dustool。
- Worktree：C:/Users/DUS/Desktop/project/nettopo-studio
- Source：D40／OPS_ENV_001／contracts/QA-ENVIRONMENT-BASELINE.md。
- Owner：測試組；PM 暫代 OPS 提供候選。

## 2026-09-20 Runtime 就緒補充

### PM 核收 C1 R4／下一工作線

2026-09-20：PM核對R4報告及21/21 hash一致，接受Phase C1 PASS，整票BLOCKED，Phase A PASS與全部失敗歷史保留。DEV_ENV_001僅B1 QA_PASSED；不因C1放行其他phase。full Node 278pass/6fail/9skip保留，ENV權限案例已targeted重驗，其餘Auth fixture/DB-env/skip不視為豁免。

下一優先回QA_AUTH_003的C02/C03 QA-only修正準備；native lifecycle／B2/B3另具名派驗，不作已可執行Auth的前置。C1工具/候選不得因此修改。不Git/live。

### Phase C1 R4 independent QA result

`C1 PASS`、整票`BLOCKED`：R4測前後21/21 hash一致。release前PID/activity/target-lock取消驗證、close/query success/reject/never bounded lifecycle、四個helper故障注入recovery、真SQL wait timeout/interrupt、rollback正反例、roles/DDL、effective-config污染、canary/junction、並行/init failure/CLI timeout、實際PG17.10及cleanup全部符合；最終Docker/run資源0。targeted 20/20、tsc與scoped lint PASS。無env full Node為278 pass/6 fail/9 skip；兩個ENV EPERM已合法權限targeted重跑PASS，其餘為已知Auth QA fixture及未載現用DB env的範圍外失敗，不宣稱全專案PASS。完整證據見`docs/dev測試紀錄/qa-env-001-phase-c1-2026-09-20.md` R4段。

### PM 最新派驗 — C1 R4 同票獨立重驗

2026-09-20：PM先實跑7項純behavior PASS與actual boundedSql never/reject兩反例（有界reject/tracking與lifecycle error保留），核准進QA，非代簽真DB。現在以 [R4 manifest](../contracts/QA_ENV_001-B1-CANDIDATE-R4.json) 凍結21檔；開工IN_QA，首輪/R2/R3失敗與PM return全部保留。

先R3兩blocker與PM boundedSql blocker：真DB特定PID release前取消、close正常/拒絕/never、query cancel無效+force reject/never均有限返回且不假稱已停止，最終QA_CLEANUP_ERROR/recovery/秘密移除；追蹤與錯誤不得被後續成功抹去。再既有R01–03/C01–04適用回歸，含rollback反例、主timeout/query deadline/interrupt、roles/DDL、canary/並行/cleanup/版本/secret。記實際觸發至process exit時間，不能只信stage report。模擬helper故障與真網路故障分開表述。

QA-only source定位可依helper抽取更新，保留安全語意並附可執行行為證據，不要求舊race/字串形狀。DEV full Node 7fail/9skip的原因分類仍需核實；能安全隔離重驗的ENV EPERM/舊guard於本階段處理，Auth/現用DATABASE_URL不自行修補或載env。範圍外失敗如實列為未核收，不因此宣稱全專案PASS。

僅QA tests/docs與自有隔離Docker資源；正常升權流程沿用，不改產品/DEV tests/node_modules/現用5432/env。測前後核21hash。若阻擋則安全清理QA_FAILED/BLOCKED具名回報，全部C1通過僅phase PASS、整票BLOCKED等其他phase。不B2/B3/native/Browser/CI/Git。

### PM Behavior review 阻擋派驗

2026-09-20：DEV交回ordering/close修正後，PM實跑純boundedSql反例發現cancel與force-close都不settle時函式仍pending；同票先退DEV補同鏈路。不產生R4 freeze、不啟QA；本票仍QA_FAILED，R3歷史保留。新增close helper兩項行為測試PASS不等於整條query abort生命週期PASS。

### PM R3 退件核收／等待修正版

2026-09-20：PM接受兩缺口，核21檔一致。真DB基本取消與清理證據保留；source guard失敗不是實際force-close故障注入。DEV_ENV_001限定解凍PID/order、close settlement/final recovery、DEV測試與必要純helper seam。QA維持QA_FAILED等新freeze。下輪要真DB及reject/未settle行為反例；source guard可因helper抽取/移除race調整，不要求特定實作形狀，安全語意不減。

### Phase C1 R3 independent QA result

`QA_FAILED`：R3測前後21/21 hash一致。真DB timeout／interrupt兩案皆到達advisory-lock wait barrier，scenario約432/427ms，整個process約10.1/9.8秒退出且cleanup complete。但候選在釋放blocker後才以`granted=false=0`檢查，未依票面於釋放前核特定waiter PID/query已停止；`closeSqlClient`第二個force-close race若delay先到仍直接從openClients移除，可能把未settle誤報closed。QA語意guards 0/2 FAIL；資源0，依stop condition未續其餘R3回歸。完整證據見`docs/dev測試紀錄/qa-env-001-phase-c1-2026-09-20.md` R3段。

### PM 最新派驗 — C1 R3 SQL-wait 同票重驗

2026-09-20：以 [R3候選](../contracts/QA_ENV_001-B1-CANDIDATE-R3.json) 凍結21檔；只三個核准檔變更、18依賴一致。正式派驗，開工IN_QA，保留前兩次QA_FAILED與Phase A PASS。先SQL-wait blocker，再原rollback/roles/DDL/環境隔離/cleanup等R01–03、C01–04適用回歸，不沿用R2 PASS代簽R3。

具名檢查：

- 真DB query確已wait後才取消，測timeout及可攔截interrupt；核實主controller／CLI timeout／單query deadline路徑，不僅獨立scenario controller。四類parent clients與transaction控制均不得裸等；pre-abort後不得新執行SQL。
- 不能只以釋放blocker後granted=false為0當取消證據：waiter可能已取得lock。請在釋放前核waiter PID/query已停止，並核無意外取得lock或提交DML；記真barrier和取消結果。
- DEV約0.43秒是scenario elapsed，不是timeout-to-process-exit。QA獨立記触發時間至程序退出、cleanup結果並核宣稱<40秒budget；不能只信report。
- cancel失敗／未settle時force-close、安全錯誤、Promise rejection是否被處理、close超時是否被誤當closed，皆按原有界取消要求抽驗。當前driver行為需核對，不能假設end呼叫一定已關閉；不改node_modules或產品換PASS。
- cleanup獨立20秒controller改到共用helper，須重驗foreign canary、failure recovery、精確owner及同時run互不影響；保留secret與21檔測前後hash檢查。

允許QA-only tests/docs及自有隔離Docker資源；必要source定位可因BEGIN/ROLLBACK改為boundedSql調整，但保留同等語意和修改理由，runtime證據不可省。無法安全驗的案例具名BLOCKED，不拿host/他人資料做故障注入。遇blocker清理自身資源後QA_FAILED回PM；全C1過僅phase PASS，整票BLOCKED等其他階段。不進B2/B3/native/Browser/CI/Git。

### PM R2 退件核收／等待 SQL-wait 修正版

2026-09-20：PM確認21檔未變及取消機制缺口，接受QA_FAILED，沿DEV_ENV_001限定解凍SQL lifecycle/abort/delay helper和DEV測試/docs。QA維持QA_FAILED等待新候選，不對變動工具續跑。R2已通過項目保留為R2證據，並非自動適用下版。SQL-wait目前為source-confirmed缺口，未真注入SQL等待；下一輪需具名真DB wait/barrier、timeout/interrupt、有限退出及cleanup證據。原rollback問題已經真DB通過，不再描述為當前blocker。

### Phase C1 R2 independent QA result

`QA_FAILED`：R2測前後21/21 hash一致；原rollback blocker以真DB正常／insert誤commit／delete誤commit三路徑完成修復確認。R01污染effective-config、真foreign canary、junction、並行、初始化失敗、hold timeout／interrupt、cleanup-failure recovery、實際PG17.10與11/11 targeted tests均完成且QA資源清理為0。新blocker：AbortController只傳給child `run`與最後`delay`，父程序PostgreSQL queries沒有signal、statement timeout或cancel handle；SQL lock/wait期間timeout無法中止await query，不能以最後hold測試取代。詳`docs/dev測試紀錄/qa-env-001-phase-c1-2026-09-20.md` R2段。

### PM 最新派驗 — C1 同票 Re-test R2

2026-09-20：DEV已READY_FOR_QA，PM核對21檔只有核准probe變更，現在正式派同票重驗。以 [R2凍結manifest](../contracts/QA_ENV_001-B1-CANDIDATE-R2.json) 為準；開始改IN_QA，原QA_FAILED和Phase A PASS永久保留，QA日誌追加不覆寫。先驗正常rollback及兩個simulate誤commit反例，再跑下方原R01–03/C01–04完整矩陣；未跑項目不可沿用DEV自測PASS。

QA source guard目前硬編碼舊例外訊息與舊fixture ID，修正版已改為分開INSERT/DELETE probe。允許QA自行調整QA-only定位與斷言，以同等或更強語意驗commit-visible差異，不要求產品保留字面字串；須記修改理由並保留首輪失敗。source guard只作補充，須真DB執行正常與故意commit反例，確認失敗不是啟動／連線／其他錯誤冒充；記實際狀態與cleanup。

只操作自有隔離Docker run/project/labels及QA測試/docs，不讀現用env、不動5432/Auth/DEV測試/產品。測前後核21檔hash；所有舊scope安全限制仍有效。遇blocker安全清理後QA_FAILED回PM；C1全過僅phase PASS，整票BLOCKED等待剩餘phase。未授權B2/B3/native lifecycle/Browser/CI/Git。

### PM C1 退件核收／等待修正版

2026-09-20：PM核對QA報告及probe程式，接受C1 QA_FAILED；原失敗紀錄與21檔manifest保留。DEV_ENV_001僅解凍rollback probe與DEV測試／紀錄，其他依賴仍凍結。QA維持QA_FAILED，等DEV交付、PM核對新候選並重新派驗，不對變動中候選續跑。下一輪需真DB rollback/commit可觀察差異；現有source regression只是補充，不取代執行證據。其餘R01–03/C01–04未跑者仍未驗，不因本項修好自動通過。

### Phase C1 independent QA result

`QA_FAILED`：21/21凍結hash一致，首個真container正常流程完成且自身資源清理為0；但runtime DML rollback probe在同一transaction內先INSERT／UPDATE後DELETE同一row，再以transaction後count=0宣稱verified。誤commit也會得到相同結果，違反目前派驗要求的commit-visible差異。獨立回歸 `tests/qa-env-001-container-rollback-proof.test.mjs` 0/1預期失敗；依stop condition未擴大執行C01–C04。證據：`docs/dev測試紀錄/qa-env-001-phase-c1-2026-09-20.md`。

### 目前派驗 — Phase C1／DEV_ENV_001 B1 修正版

PM已核對修正版五檔hash與scope，凍結 [21檔候選/依賴manifest](../contracts/QA_ENV_001-B1-CANDIDATE.json)。開工IN_QA；保留Phase A PASS與首次PM_SCOPE_RETURN歷史，不是前次QA_FAILED。現在只驗C1 Docker PG fixture；native Phase B、app B2/Browser、Testcontainers/CI B3不在本輪。

範圍：先獨立ENV-R01–03，再ENV-C01–04。可新增tests/qa-env-001-container-*.test.mjs與QA紀錄，不改受測工具、DEV tests、Auth、migration、package/lock、現用env或原helper。沿自有synthetic Docker run-ID/project/labels、loopback非5432、自有一次性volume；正常升權流程可執行已安裝Docker，不讀秘密或操作既有資料。

必須補／核對可執行證據：

- 真spawn sentinel與effective Compose config：project/port/daemon/DSN不被父環境污染；秘密不進輸出/報告。只看factory物件不算。
- foreign canary：以mock可先確認零刪除呼叫，再用完全自建測試project驗真資源保留；不得拿現有開發容器當canary。cleanup只精確owner IDs；runId、目錄越界／junction、失敗secret檔移除而recovery保留。測前核RUN_ROOT非reparse；不得為測試改成指向使用者資料。
- role/owner/current＋future grants、DDL六項42501、零殘留；獨立rollback需留下「若誤commit即可觀察到」的差異，不得僅insert→delete後count0便宣稱rollback。
- 成功／初始化失敗／兩run並行／timeout與可攔截interrupt、cleanup故障保留證據；特別查abort已發生／SQL等待階段，不把只有最後hold的timeout當完整中斷保證。硬kill不聲稱finally必執行，確認redacted manifest足以按owner恢復。
- 實際image/server版本與lock相符，manifest前後不變；原腳本report自填version不能代替驗證；開發DB/5432不動。

發現blocker則安全清理自身資源並QA_FAILED回PM，不改產品或刪斷言。若某破壞性案例無法安全隔離則BLOCKED具名回報，不越界測。C1全通過只標phase PASS，整票仍BLOCKED等其他必要phase，交PM核收；不自行B2/B3/Browser/Git。

下方待DEV／BLOCKED敘述保留前次歷史，以此派驗段為目前入口。

最新PM預檢：DEV_ENV_001 B1已交付但同票退修ENV-R01–03（child env、清理歸屬與路徑、runtime權限矩陣）。QA維持BLOCKED，不執行舊候選cleanup；可準備具名案例，等PM重新freeze後再派驗。Phase A已驗工具不受此B1退修取代。

PM已完成Docker/WSL安裝及PG/Node image版本smoke，不是本票Phase C獨立QA。Docker缺少已解除；當前仍BLOCKED等DEV_ENV_001 B1 Compose/fixture工具與PM派驗。Phase A歷史PASS保留，native lifecycle/完整container/Browser/CI未跑。不得把下方舊NO_DOCKER摘要當目前主機安裝狀態。

Phase A：現有 Auth C01–C03 準備完成後，可獨立唯讀檢查 scripts/qa-env/*，重跑 tests/ops-env-001-guardrails.test.mjs、scoped ESLint、doctor；檢查 ENV-01–05、不讀現用env、不連DB、不啟容器、不清資料。產品 writer 正在 Auth 修復，不執行 native case 或全測。比較此工具候選測前／後 hash（來源 fingerprint 是整個 dirty 產品快照，可能因 DEV 合法寫入改變，不是本輪工具驗收固定候選）。不得修改產品／工具／DEV tests 換 PASS；補獨立測試請使用 tests/qa-env-001-*.test.mjs。

Phase B：PM 凍結可測產品且確認無其他 fixture 後，才真 native lifecycle／失敗 cleanup；container/Playwright/CI 依 runtime 就緒及具名派驗。只驗可執行層，不把未提供Docker當產品缺陷或自動略過。

phaseResults：A PASS（ENV-01–05，6/6；工具hash穩定）；B native NOT RUN；C container BLOCKED_TOOL_RUNTIME_UNVERIFIED。接受工具後整票仍 BLOCKED 等後續環境，不標整體 QA_PASSED。Phase A evidence：`docs/dev測試紀錄/qa-env-001-phase-a-2026-09-20.md`。

回報需列工具 path/hash、命令／結果、secret sentinel、不變的父環境、未啟動資源與 NEXT owner；保留缺陷。禁止秘密讀取、現用DB、真DUS、install、Git、deploy。
