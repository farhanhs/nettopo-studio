# 2026-10-13 — 已驗收 checkpoint commit／push 授權

使用者在 Native B1 與 NTM PRE-COMMIT 核收後明確指示「commit and push」。本次只解除下列精確交付的 Git 停令，不解除新功能、現用 DB／env、跨分支整合或部署限制。

## 分支與範圍

| 工作線 | 起始 HEAD | 提交內容／Git owner |
|---|---|---|
| `codex/dev-rel-001-checkpoint` | `a9abe637f0ad419aced6d31faf30a127ce5b81e6` | DEV_NTM_001 CORE-R2 → DEV_NTM_002 GEN-R1 → DEV_NTM_003 PLAN-R1，含相應獨立QA／契約／證據；開發組 |
| `dustool` | `72783636a8b22f353e8c25fe68b859ad62e3c237` | Native B1 R2工具＋獨立QA／manifest；OPS先提交，釋放root Git writer後PM另交治理文件 |

Remote：`origin`／`https://github.com/farhanhs/nettopo-studio.git`。只正常 fast-forward 推各自同名分支，不 force／merge／cherry-pick，不動 Beta／AIL。若遠端出現未核准 divergence，停止該分支 push；另一線安全工作可繼續。

## 提交規則

- 精確檔案／hunk；未核准 Auth、舊 UIX／QA工具、環境其他 phase、現用資料與秘密保持未提交。
- 已驗收產品與工具保持原bytes；保留manifest歷史，Git EOL若有差異另提供normalized／committed-tree等價證據。
- 各中間commit與最終tree核對dependency closure及對應no-env測試；不依靠工作樹未tracked檔案掩蓋缺漏。
- 同一index一個writer：checkpoint由DEV；root先OPS，確認其完成後PM再接手。
- 本次共用治理commit限AGENTS入口、既有adapter、R3／Harness規則、PM_GOV_005、branch map、10/12核收紀錄與本紀錄；混合register／其他歷史產品文件保持未提交，避免連带帶入Auth待辦。

## 驗收參照與限制

依 [10/12 PM核收](2026-10-12-pm-harness-authorization.md)：NTM PLAN獨立10/10、affected122/122；Native B1獨立5/5、guardrails4/4及真CLI通過，實際push前依owner再核精確候選。

NTM沒有UI／durable persistence／Browser／DB整合；QA_ENV_001整票仍BLOCKED（Docker／container B3／Browser／CI等），本次存檔不代表部署完成。Git結果依實際commit與remote SHA核對另記；此授權紀錄不是成功宣告。

## 本輪已執行紀錄（追加，不取代昨日QA）

- OPS Native B1工具commit `ed23a1ed0c984cd8d264ea0c8106e0b867127ff6` 已推送，PM以fresh `ls-remote`確認當時 `origin/dustool` 同SHA。11檔未包含獨立QA runner，因此PM將已驗原bytes runner另外存為 `8bda303`（單檔test commit）；未修改其斷言，syntax與兩項無DB檢查PASS。
- OPS提交後重驗：guardrails4/4 PASS；三條native lifecycle在initdb、beforePID失敗（Windows目錄建立錯誤），owned cleanup complete。QA已同票独立重現normal失敗，初步排除committed bytes／EOL改動；環境因素仍待診斷，昨日Native B1 QA_PASSED歷史保留，**當前重現能力不能宣稱PASS**。
- 2026-10-13 fresh remote baseline：`codex/public-beta-0.1=a9abe637f0ad419aced6d31faf30a127ce5b81e6`、`codex/dev-rel-001-checkpoint=1b0b084518886cda347f175bfc959401fd1d18ed`。NTM所需4筆UIX祖先已在核准的公開Beta基底可達，本次正常推送checkpoint分支可包含其必要歷史，不授權新增UIX變更或改寫歷史。
- root governance僅文件存檔，不把本次native FAIL以規則或文件改成PASS；Auth及其他混合dirty保留。最終各分支remote SHA及NTM提交結果依完成後實際核對另記。

## Native B1 同候選提交後補验

在 `e8088a989dfbde0b4f4451dc3dd9ee77fc2f4df4`（已與遠端dustool相同）上，PM取得平台針對既有一次性fixture測試的 `require_escalated` 核准，原封不動執行 `node --test --test-concurrency=1 tests/ops-env-001-guardrails.test.mjs tests/qa-env-001-native-lifecycle.test.mjs`，**9/9 PASS、0 fail/skip**。此是PM提交後補驗，不代稱新QA獨立簽核；受限執行context的FAIL歷史保留，不更改全域sandbox設定。

| Scenario | Run ID | Port／PID | Result／cleanup |
|---|---|---|---|
| normal | ops-env-001-1791877823162-c13f5509 | 62950／48400 | PASS；complete |
| controlled failure | ops-env-001-1791877841175-1ab1ba2f | 62484／53184 | 預期 CONTROLLED_INIT_FAILURE；complete |
| timeout | ops-env-001-1791877858782-d6490bf6 | 59922／51456 | 預期 READINESS_TIMEOUT；complete |

三路皆通過PID停止／port關閉／dataDir移除斷言，測後fixture dirs=0。工具raw仍`8f01b2f56effa90dcaf801a5842f756d54763b47c5aaa22995dfaad9beb57ed2`、QA runner raw仍`01901cf2560b7b36b62da1fc32c531bbede37ca5acc70430d869197189ec1cf8`；7個已提交工具／測試檔與working tree normalized bytes全一致。未修改程式、現用env／DB或測試斷言。

判讀：同候選在不同執行權限context結果不同，受限環境相容性仍是限制；這不是精確Windows root cause定論。整體QA_ENV_001仍BLOCKED於其餘phase，不能擴張成全環境完成。

## 最終推送核收

PM已fresh read-back核對 `origin/codex/dev-rel-001-checkpoint=590339395ec8cf5af5591d3be4379bd3ab4ebc6b`，與該工作樹HEAD相同。三筆：CORE `545ab726cf8d7ecd329b8af0411c7b04054637cf`、GEN `dbdbc915399bfe65190879b0bdcc16c77a7f7a52`、PLAN `590339395ec8cf5af5591d3be4379bd3ab4ebc6b`；各提交後乾淨tree分別28/28、73/73、122/122，tsc／scoped ESLint均PASS。PM另讀最終plan-committed測試log確認122/122、0 fail/skip及静態檢查exit0，並核對47個新增NTM／交付檔案範圍、index空。相關檔案：[NTM checkpoint](https://github.com/farhanhs/nettopo-studio/blob/590339395ec8cf5af5591d3be4379bd3ab4ebc6b/docs/dev%E9%96%8B%E7%99%BC%E7%B4%80%E9%8C%84/2026-10-13-ntm-checkpoint.md)。

root已推：`ed23a1e` Native工具、`8bda303` 獨立QA runner、`e8088a9` 治理、`9944319` 執行context補證；PM核remote dustool與9944319一致，再以本文件的獨立docs commit保存最終核收。所有推送為同名branch正常fast-forward，沒有改寫歷史／整合／部署；Beta保留a9abe63。

根目錄Auth產品與其他混合dirty、checkpoint的舊UIX／Pilot測試及混合治理仍未提交，未宣稱工作樹全乾淨。工作到本次commit／push完成為止，不自動開下一票。CORE原核准文件的Markdown whitespace提示有保留，產品／測試檔diff-check通過；未將文件提示或Native受限context失敗隱藏成全綠。
