# 2026-10-12 — PM Harness 授權／分工落地

## 授權與範圍

使用者核准按補強更改授權與分工，必要時新增對話／調整 sandbox、資料庫、library。沿用 PM_GOV_005／OPS_ENV_001／QA_ENV_001，不另建票庫。[生效規則](../engineerticket/contracts/HARNESS-AUTHORIZATION.md) 是唯一詳細授權表；AGENTS／R3 只連入口。PRE-COMMIT 仍有效，沒有 Git 寫入／發布／現用 env、DB 或 live 權限。

## 實際候選與查核

| 項目 | 2026-10-12 觀測／結果 | 證據性質 |
|---|---|---|
| root | dustool／72783636a8b22f353e8c25fe68b859ad62e3c237；開工前 291 dirty paths（38 modified、253 untracked） | 混合歷史候選，非乾淨 HEAD；本次不整樹凍結／搬移 |
| NTM 樹 | codex/dev-rel-001-checkpoint／a9abe637f0ad419aced6d31faf30a127ce5b81e6 | 產品仍未提交，獨立於 root 環境工具 |
| PLAN-R1 manifest | `docs/dev開發紀錄/checkpoints/dev-ntm-003-plan-r1/manifest.json`，raw SHA256 `b75045ead054d01906adfdb3dbd77f32e78938afa0f8724ac30da718a3641585` | PM 重新核 28 個 manifest entries，0 mismatch；不是完整 dependency closure 審查／獨立 QA |
| DEV_NTM_003 | READY_FOR_QA；交付自測 31/31、CORE+GEN+PLAN 104/104；writer 已聲明停止 | DEV 日誌／manifest 證據，PM 未代跑或代簽 |
| QA_NTM_003 | 派送前正式 NOT RUN；準備 8/8 PASS | 需 QA 自行核 runner／closure、鎖版再執行 PLAN-01–08 |
| root 工具 doctor | 08:33:30Z；Node 24.18.0／PG 17.10／Docker CLI 29.8.0；direct dependency parity MATCH、0 discrepancy | 本次實跑、只讀版本／檔案，未連 DB、未讀 env file |
| root source fingerprint | `7fa56f9d4510660763f7e8a28b3ac5720f31c762afea50cf0a46be81c494258b`，204 paths | 既有 doctor 的廣域觀測；不可代表 NTM 或未來 OPS scoped freeze |
| ENV-01–04 | `tests/ops-env-001-guardrails.test.mjs`，4/4 PASS | PM 自測，OS-only child env；不是 QA_ENV_001 整票通過 |
| 資源 | doctor 指定 fixture root 0 directories；本次未建立 DB／container／Browser 資源 | cleanup=none；不推論其他 fixture root 或所有程序已乾淨 |
| 尚未驗 | engine／container lifecycle、native DB lifecycle／recovery、本輪 Browser／CI 遠端設定 | NOT RUN／UNKNOWN，不將 CLI AVAILABLE 宣稱 engine READY |

讀取指令曾遇到 Git fsmonitor IPC 提醒；後續以單次 `-c core.fsmonitor=false` 核查，不修改全域 Git 設定。環境版本與 direct dependencies 已匹配，沒有重裝／升級 library 的理由；此 PM 前置檢查未修改工具、lock、Codex 設定或資料庫。後續 OPS 工具變更與 fixture 另由其票記錄，不沿用此靜態檢查當完工證據。

## 當前 owner 與派送

| 角色／對話 | 當前工作 | 下一 owner／停止點 |
|---|---|---|
| PM `019fc279-b2e8-7520-893c-dce960f76acc` | PM_GOV_005 授權與核收 | 使用者 PRE-COMMIT |
| DEV `019fa64f-d5f1-7d61-bf93-47a9e7c293c7` | DEV_NTM_003 候選凍結；收 QA 明確缺陷後同票修復 | QA_NTM_003 |
| QA `019fac8e-94dc-79c1-b156-7f242cf82967` | QA_NTM_003 正式驗收優先；環境候選 ready 後 QA_ENV_001 | DEV／OPS 同票退修，或 PM 核收 |
| DSG `019fda8a-0b05-7a41-8fe0-b72f8c12ad9d` | 既有契約保持；僅新語意再介入 | 無新增設計前置 |
| OPS `01a12f43-4d12-7933-a1af-366b9b8165f8`（local） | 專責對話已建立；快照確認已開工，正補 native lifecycle runner／normal、controlled failure、readiness timeout 自測 | QA_ENV_001，不代 QA 驗收 |

以上分工依使用者本次授權；跨組訊息可在本範圍直接回傳。派送／開工／完成分開記錄，後續證據追加，不覆寫失敗歷史。

派送工具確認：DEV、QA、DSG 訊息皆送達；compact snapshot 確認 QA 已核 manifest hash／工作位置並讀 root 授權，DEV 已收件維持凍結，DSG 僅核新流程不改契約。OPS 與 QA 均仍執行中，沒有宣稱正式 PASS。環境自測與 NTM 正式 QA 位於不同候選，不互相覆寫；沒有額外 parallel 產品 writer。

## 本次規則變更

- AGENTS 移除過期「當前只 A」的靜態宣稱，改查具名工作包與最新停止點；詳細授權只存一份。
- R3、PM_GOV_005、OPS_ENV_001、branch map、票模板連到授權補充；保留原歷史。
- OPS 由 PM 暫代改為專責 owner；同票 DEV↔QA、OPS↔QA 不逐輪等 PM。
- 環境權限採條件式有界授權，保留 workspace-write、工具核准、精確資源歸屬與清理；非 blanket admin。

規則落盤不代表工具補強／獨立驗收已完成。本輪交付在 PRE-COMMIT 停止，不 stage／commit／push。

## 追加 — QA_NTM_003 完成與 PM PRE-COMMIT 核收

QA 正式回報 PLAN-R1 `QA_PASSED` 後，PM 讀取 checkpoint 樹 `docs/dev測試紀錄/qa-ntm-003-plan-r1-2026-10-12.md` 與 QA_NTM_003 正式結果，重新核實 branch／HEAD 如上、DEV manifest raw `b75045ead054d01906adfdb3dbd77f32e78938afa0f8724ac30da718a3641585`、28 entries 全數匹配、QA formal runner raw `5c9480733b53ab891918675f15820ef5c644cc41ad3b9efb05ce1dc0582f783e` 匹配；index 仍空。

- 接受獨立 QA 證據：PLAN-01–08 10/10 PASS；CORE/GEN/PLAN 受影響 serial batch 122/122 PASS，0 fail/skip；tsc／scoped lint／syntax／diff check PASS。PM 核證據，不冒稱自己重跑 QA。
- 產品為純 snapshot change planner：預覽／明確決策／一次性套用、取消不改原資料、衝突與 stale 拒絕、protected trust 不可提升；成功 receipt 明列 `persistence:not-performed`。
- QA 報告測前後 hash 一致，no-env、无 owned service／DB／Browser 資源，cleanup=0，已 release candidate lock。無產品退修項。
- PLAN-R1 達到本純模組 **PRE-COMMIT 審查點**；next owner 使用者審查／PM 保持候選。沒有啟動下張產品票，無 Git 寫入。
- actor-backed verification、durable persistence、Zustand/Dexie、API、Browser、DB、Auth/RBAC、CSV、live 仍 NOT RUN；本核收不代表 UI 可演示或正式發布。
- 建議後續提交仍分 CORE → GEN → PLAN 相依單位；PLAN 產品／DEV自測／QA正式證據一起追溯，root 治理與 OPS 工具另組，不整樹提交。精確 staging／中間 commit 重建及 committed-tree 驗證待使用者授權，未執行。
- OPS_ENV_001 補強獨立進行，尚未核收；不將 NTM PASS 搬作 QA_ENV_001 PASS，也不以 OPS 尚未完成阻擋本純模組 checkpoint。

## 追加 — OPS_ENV_001 交付 QA

OPS 回報工具 READY_FOR_QA；[交付日誌](ops-env-001-2026-10-12.md) 記 CLI／native lifecycle runner／OPS自測三檔，guardrails 4/4＋native normal/failure/timeout 3/3 自測 PASS。保留早期 EBUSY／parallel initdb contention，最後使用 sequential 證據。這不是 QA_ENV_001 PASS。

PM 核 root branch／HEAD 未變、index 空，確認 QA 已實際開始環境接收／hash 核對，不重複派單。交付所稱 scoped doctor fingerprint `4f964676b7147cf93d16fe2db8bdf25293941dc24ab9b359361f31b7784e2ad5` 實際含廣域 app/db/scripts/tests：PM 已提醒 QA 按 Harness §4 建立精確工具 dependency closure／逐檔hash與runner分層；缺交付metadata直接向OPS補齊，不能用dirty count或廣域hash代替本次完整manifest。正式工具QA及cleanup/recovery仍待獨立證據，Docker／Browser／CI不因此放行。下一 owner QA_ENV_001，工具 writer 維持停止。

## 追加 — Native B1 獨立驗收核收／PRE-COMMIT

PM 已讀 [QA 完整紀錄](../dev測試紀錄/qa-env-001-native-lifecycle-2026-10-12.md)，接受 **Native B1 phase QA_PASSED**，不將 `QA_ENV_001` 整票改 PASS。

- 精確候選以 manifest 內容 `B1-native-lifecycle-R2` 為準；檔名保留 `OPS_ENV_001-B1-MANIFEST-R1.json`，QA報告標題沿用R1，但final hash明確對應R2，不引用初版候選。PM重新計算 manifest SHA256 `2b7dcf35efc0bf20421fa2a28be2b7bcb70257e76a46430acae417e514ad8e8f`、11 entries bytes/hash 全部一致；QA runner SHA256 `01901cf2560b7b36b62da1fc32c531bbede37ca5acc70430d869197189ec1cf8` 一致。
- QA獨立 containment/no-env＋normal／PG-ready後controlled failure／readiness timeout：5/5 PASS；guardrails4/4及真CLI normal PASS。QA報告每路具名PID停止、port關閉、dataDir移除。PM只讀再次確認 owned fixture directories=0、index空；沒有重新啟動測試資源。
- 保留廣域fingerprint不足、37ff→8f01候選漂移及QA錯誤timeout message斷言4/5的歷史；R2重鎖、完整重驗後核收，未因改動小免驗。
- 本次OPS工具達必要獨立QA的PRE-COMMIT審查點；產品NTM與root治理／OPS工具分開審查，無stage/commit/push。下一 owner PM／使用者，不自行擴啟剩餘環境phase。
- 整票仍BLOCKED：Docker cold-start×2、container B3、Browser、CI/rulesets各自維持原BLOCKED／NOT RUN／UNKNOWN；未完成的環境／安全證據不由此phase代簽。
