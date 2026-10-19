# DEV_BTA_001 — 本機試用入口與安全邊界

| 欄位 | 值 |
|---|---|
| Group / Feature / Priority | DEV / BTA / P1 |
| Status | READY_FOR_QA |
| Planned Order | 156 |
| Owner | 開發組 / 019fa64f-d5f1-7d61-bf93-47a9e7c293c7 |
| Development Branch | codex/public-beta-0.1 |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1 |
| Base Commit | b5c53916cbda6f8bcd2f42f9d9772ef181c1adee（2026-10-19 FF；原始a9abe63保留歷史） |
| Integration Target | codex/public-beta-0.1；不合併其他分支 |
| Created / Updated | 2026-10-09 / 2026-10-19 |
| Governance / Work Package | root R3；PM_BTA_001；[核准計畫](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-local-feedback-beta-plan.md) |
| Engineering commit authority | 無；第一個必要獨立驗收PRE-COMMIT停，不stage/commit |
| Release / push / integration / deploy / live | 僅PM已完成建立GitHub baseline分支；後續push/tag/Release/merge/deploy/live未授權 |

## Objective / Requirement Traceability

核准契約下本機profile、免公司登入入口、local IndexedDB／session capability；server/HR/role override/credentials/migrations/seed不得可用；錯誤設定fail closed。

來源為本對話使用者「核准，請先開在github開分支然後馬上派單」及計畫Q1–Q12。首次install可連網、日常離線；Windows＋Chrome/Edge、單人IndexedDB、匿名案例、預建程式、Node自備。不是R3正式人事B工作包。root dirty Auth、checkpoint dirty NTM/QA和AIL全部排除。已有13檔UIX基準delta做常見secret-pattern/禁止路徑查核零命中；這不是全歷史/active-secret或Beta secret PASS。

## Dependencies / Next owner

R1.1 已核准、2026-10-19 PM接續已解除舊BLOCKED依賴；DEV實際完成main FF及候選保存後開始本機入口與安全實作。下方10/09 preflight為歷史。

Next owner：同一primary DEV接DEV_BTA_002；固定整包候選後QA_BTA_001。

## Allowed Files / Systems

app/lib/server/runtime-policy.ts、相關本機boundary/API deny seam；app/page.tsx、app/lib/topology-store.ts等必要hunks；自身tests/dev-bta-001*.mjs；自身票／log／register列。契約需附精確allowed paths，超出本清單先升級。

2026-10-19 PM A04退修追加：app/page.tsx panel boundary與／或app/globals.css直接相關面板尺寸/overflow/stacking最小hunk；DEV-owned fresh-profile Chrome/Edge 360/768/1024/1280互動測試。不新增面板功能、不重設視覺，不改安全/資料契約。root PM beta-resume日誌為授權來源；QA R2已release-for-repair。

2026-10-19使用者裁定刪除容器保留設備/連線並改為未分類，PM解除group語意BLOCKED、QA已cleanup/release。追加page group form/handler/control/確認/狀態hunks、直接相關globals responsive、可選純topology-group-operations.ts及自身tests。edit保留id/collapsed/membership；delete確認後只刪Group與解除target groupId。Cancel/missing/readonly/failure零mutation，commit-before-publish，不改store/schema/RBAC/CSV/QA。契約R1.1 §12 SHA256 69e3e5aa31d831a143fbd1999451a857d2e15d5bc038ef6d17b19e96e3222f1d；R4固定包後停止writer再交QA。

開始前讀root AGENTS/R3/BRANCH-MAP及本樹票；再次核branch/HEAD/dirty。只在本樹工作，不直接用root工作位置。正式QA時產品固定、一個primary產品writer。各owner只更新自身票及register列，PM維護治理／package source。

## Out of Scope / Forbidden Changes

不開NTM/CSVv3/AIL/HR/監控/新功能，不讀現用.env/DSN/秘密、不用現用DB或公司API/OTP，不安裝Docker/全域Node/Browser/新plugin、不重設使用者資料。不改正式RBAC/CSV/secret原契約，不將QA_FAILED/NOT RUN改PASS或移除獨立QA斷言。不stage/commit/push/tag/Release/merge/deploy，不改寫Git歷史、不搬另一工作樹候選。安裝必要workspace相依僅限本樹／具名自有隔離目錄，記artifact/hash/cleanup，不覆用另一工作線node_modules或env。

## Acceptance / Verification Evidence

BTA-A03＋受影響登入/role/secret regression自測；不採可偽造身分header；不使用現用env／DB／公司API；無credential明文state/storage回歸。READY_FOR_QA交manifest/hash/差異，不宣稱獨立QA PASS。

Required acceptance IDs依核准計畫 BTA-A01–12；具體契約完成後列適用矩陣，必要項不削減。candidate、tools、deps及artifact測前後hash、實際版本、結果、owned cleanup與next owner都需記錄。Code/QA/Git/live分開。

| Evidence | Result | Date |
|---|---|---|
| PM baseline branch / clean worktree | a9abe637f0ad419aced6d31faf30a127ce5b81e6；正式產品測試NOT RUN | 2026-10-09 |
| 此票實作／獨立驗收 | NOT RUN | 2026-10-09 |

## 2026-10-19 DEV self-check

Local-beta policy、capability-first entry、無 server principal 的 local editing、metadata request gate、IndexedDB commit 後 publish 已實作。DEV/runtime/demo gate 10/10、tsc、scoped ESLint 0 errors 通過；隔離 CI=true/no-DSN build-04 通過。Browser/store failure injection 待002產出可執行包後整包自測；此狀態非QA PASS，正式QA須三票固定ZIP後執行。證據見本日DEV log。

## Risks / Stop / Handoff History

### 2026-10-19 Engineering Archive Authorization

使用者另核准本機工程存檔commit、不push/發布、A08維持BLOCKED。隨收錄此註記的commit保存固定R4及對應證據；此為工程存檔，不是整包驗收完成。既有PRE-COMMIT停令只對此次精確stage/commit解除，產品writer仍停止，票況READY_FOR_QA不升級。範圍、授權、人類訊息ID與排除項見 [工程存檔紀錄](../../dev開發紀錄/2026-10-19-beta-engineering-snapshot.md)。

### 2026-10-19 R4 group correction ready for independent QA

使用者已裁定刪除容器保留設備與連線、成員改未分類，依 PM 精確 scope 與 R1.1 §12 完成。新增純 helper、Beta-only 編輯/刪除入口及確認/錯誤提示，沿既有單一 setProject 與 Dexie commit-before-publish，未改 store/schema/RBAC/CSV。R3 到 R4 僅 app/page.tsx、app/globals.css、app/lib/topology-group-operations.ts 三個產品 path 有差異。

R4 ZIP SHA256 `4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`，source manifest `4b1b0825a51acf934b812b0a073daab73b35467415d3f6784958e9c8564c98fb`。74 個 source inputs 包含新 helper，source/build drift=[]。DEV 正向 serial 135/135、lifecycle 12/12、真 ZIP Browser 2/2、tsc/scoped lint/build-09/diff-check PASS，payload scan 0。

Chrome155.0.8059.82、Edge155.0.4283.62，各360/768/1024/1280正常點擊、Cancel零寫入；真寫入驗 edit、空/非空折疊group delete、完整project保留、注入IndexedDB失敗零寫入/無成功提示、reload/完整JSON export/restore。Readonly/missing/排程後撤權由實際page handler注入測試證明，非真Browser角色測試。舊selector timeout保留為DEV工具失敗，未改QA斷言。

完整證據與限制見本日DEV log及 `.local/bta-20261019/artifacts-r4/dev-handoff.json`。產品writer停止，4317 listener=0、自有程序0、staged0；next owner QA_BTA_001。A08平台BLOCKED/full lint既有Bash blocker保留；尚非獨立QA PASS或整包放行。PRE-COMMIT停止，不stage/commit/push/Release/deploy。

同日後續QA已回R4產品修復驗收PASS：QA-owned21/21、雙Browser四寬度group edit/空及非空delete/Cancel/失敗零寫入，actual handler readonly/stale/missing拒絕；A05/A06/A07/A09/A10 R4深度重跑PASS。DEV重算兩份實測result hash與sourceDrift0確認一致，見qa-bta-001-r4-2026-10-19.md及DEV log。QA初報只列A08，後依A01–A12總表校正：整票BLOCKED還包含A02/A03/A11/A12的PARTIAL/NOT RUN子案例，DEV12/12不代QA證據。無產品退修，writer仍停；不能標整包QA_PASSED/commit-ready。next owner PM決定剩餘補驗及隔離環境；本票保持READY_FOR_QA，無Git操作。

後續QA已獨立補驗上述安全子案例，結果與runner hash由DEV重算相符：A02/A03為PASS_WITH_DECLARED_LIMITS、A11 PASS、A12 PASS_WITH_AUTHORIZED_SCOPE。未安裝替代Node/npm binary、未開非loopback listener、未讀active env/DSN/秘密；不得將此限制寫為已驗。A08仍平台BLOCKED，其他限制是否追加合法fixture由PM判定。無產品缺陷或退修，ZIP/packet/source不變、writer stopped；詳見DEV log「R4安全子案例獨立補驗接收」。

### 2026-10-19 R3 independent QA return / group semantics gate

QA R3已確認360px修復在Chrome/Edge四種width正常hit-test通過，原R2缺陷關閉。另R1.1 A04要求group create/edit/delete，目前只有新增及折疊，缺編輯/刪除，QA_FAILED且release-for-repair，見qa-bta-001-r3-2026-10-19.md。

DEV唯讀追溯沒有找到已核准group刪除後成員語意，且目前精確allowed hunk不涵蓋group mutation，已交PM核對。建議保留設備/連線、只清groupId，但未把建議實作成產品。PM正請使用者選擇保留成員或有成員時禁止刪除；待決策與scope落檔後同票續修。狀態BLOCKED僅針對此決策，產品仍固定R3未再改動；source/ZIP不變。QA深度NOT RUN、A08平台BLOCKED另列，沒有以本票靜態/Browser入口PASS代簽。

2026-10-19後續獨立QA已收斂A05/A06/A07/A09/A10真Browser深度矩陣為PASS，見R3報告續段；前段NOT RUN保留為歷史。DEV重新核對deep-result SHA256 77543de74d153eb636bba7ad7816f80be008c8e0af58f5ab225ee90adadcf300、runner SHA256 186f2b3f1bb86b04bb1d92f65bae7ef809d4a1dacc767dd5346f207d0888f7de，與QA回報一致，R3 ZIP/sourceDrift仍不變。這是承接獨立QA證據，不是DEV重新執行或整票PASS。產品退修僅餘A04 group edit/delete；A08仍由OPS/PM持有平台BLOCKED。DEV保持BLOCKED待使用者語意與PM精確scope，writer停筆，不stage/commit/push。

### 2026-10-19 A04 QA Return Fix R3

QA R2在Chrome/Edge 360x640重現新增設備被canvas pane攔截，正式release-for-repair。PM核准最小panel hunk後，DEV真ZIP/fresh-profile測試先重現雙Browser 360 FAIL，768/1024/1280 PASS。

根因為react-resizable-panels縮小外層allocation後，CSS仍強制內層sidebar/canvas/inspector min-width 280/520/300px；例如360px sidebar實際280px、canvas從x114.7開始，產生重疊。移除app/globals.css這三個重複min-width；保留Panel minSize/maxSize、儲存layout與UIX resize/fit機制，不以提高z-index或force click掩蓋。

R3真包DEV Browser 1/1 PASS（Chrome/Edge x四種width x設備/連線/容器正常點擊，parent containment）；targeted12/12、serial128/128、tsc/scoped lint/build-08/diff-check PASS，scan0。舊R2紅燈與新截圖/geometry記於本日DEV log。新ZIP SHA256 49a37e0d80680a2fa460f9677fbf012af6b4b25fb015d7100477d2ba25b1f4fd；source drift0、staged0、4317無listener。

產品writer停止，唯一next owner QA_BTA_001獨立重驗；QA原NOT RUN深度矩陣/離線Node enforcement不以DEV入口自測代替。仍PRE-COMMIT停，不stage/commit/push/Release。

秘密、資源歸屬、產品QA並行衝突或新語意立即停止受影響部分；缺條件BLOCKED，其他可獨立項仍可準備。普通既有契約缺陷DEV↔QA同票闭環並保留歷史；新package/API/profile语義超出本包交PM。GitHubbranch不是可用Release。

2026-10-09 PM建立本票；送達／實際開工另記，不將送單當IN_PROGRESS或PASS。

2026-10-09 DEV 完成核准的唯讀 preflight，狀態仍 BLOCKED。核實本樹 branch/base、產品 diff 與 index 均空；沒有搬 root/Auth/NTM。現有 policy 無 Beta profile、LoginGate 無匿名 local 入口；explicit production/CI 要 migration DSN，server/health API deny 與 Host-Origin 邊界需由 DSG 明確，不補假 DSN 或開 Demo。詳見 [DEV_BTA_001–003 preflight](../../dev開發紀錄/2026-10-09-dev-bta-preflight.md)。未改產品、build/安裝/啟服務/測試/Git；next owner DSG 契約 → PM scope check。

