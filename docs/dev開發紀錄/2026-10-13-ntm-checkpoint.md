# 2026-10-13 NTM CORE / GEN / PLAN Checkpoint

## Authority And Scope

使用者在 PM 組明確核准 `commit and push`。本次依 root 的 `docs/dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md`，只對 checkpoint 工作樹內已獨立驗收的 NTM 候選分三筆存檔。舊票面與 manifest 的 PRE-COMMIT、READY_FOR_QA、失敗及停止紀錄維持歷史原文，不回寫成事後成功；本紀錄補充本次具名 Git 授權與自測證據。

- 工作樹：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`。
- 分支：`codex/dev-rel-001-checkpoint`；起始 HEAD `a9abe637f0ad419aced6d31faf30a127ce5b81e6`；開始時 index empty。
- Remote：`origin`，`https://github.com/farhanhs/nettopo-studio.git`；只允許正常推同名分支。
- Fresh remote baseline：checkpoint `1b0b084518886cda347f175bfc959401fd1d18ed`；public-beta-0.1 `a9abe637f0ad419aced6d31faf30a127ce5b81e6`。
- PM 已確認四筆必要祖先 `5ee0e11`、`c481ab4`、`cb485ea`、`a9abe63` 已在核准的公開 Beta baseline 可達。本次可正常帶上既有祖先，不新增 UIX 工作、不改寫歷史、不改 Beta。
- 本次唯一產品範圍：CORE-R2、GEN-R1、PLAN-R1 / NTM-PLAN-R1.1；沒有修改產品實作或 QA 斷言。

## Commit Map

| 順序 | 候選 | 精確範圍 | 本輪已驗證 reference |
|---|---|---|---|
| 1 | DEV_NTM_001 CORE-R2 | model/types、DEV/QA runner、2 fixtures、父契約、001 DEV/QA 票與歷史紀錄/manifest，共14檔 | commit `545ab726cf8d7ecd329b8af0411c7b04054637cf`，tree `b4d63faa31362cffe329cb827dc60decdb539e77` |
| 2 | DEV_NTM_002 GEN-R1 | candidates、DEV/QA runner、2 fixtures、002 DEV/QA 票與紀錄/manifest，共12檔 | commit `dbdbc915399bfe65190879b0bdcc16c77a7f7a52`，tree `46d654f3dc90c455268e679459d4c663aea6d25e` |
| 3 | DEV_NTM_003 PLAN-R1 | change-plan、DEV/QA runner、4 fixtures、003 DEV/QA與DSG票、section4契約、紀錄/manifest，共20檔；另加本紀錄 | 20檔候選的提交前 tree `6e70385eca8a05876d3506a84ad274326a75215c` |

第3筆的最終 commit SHA 於提交後產生，不在此預先宣稱。提交後須再從該 commit 匯出乾淨副本執行同樣測試、核對最終 tree，成功才可 push；實際 SHA、remote read-back 及最後結果另交付 PM。

## Verification

本次是 DEV 對精確 tree 的存檔重驗，不取代或重新授予 QA 狀態。既有獨立 QA 來源為 [QA_NTM_001](../engineerticket/active/QA_NTM_001.md)、[QA_NTM_002](../engineerticket/active/QA_NTM_002.md)、[QA_NTM_003](../engineerticket/active/QA_NTM_003.md)；三者的 pure module phase 已 QA_PASSED，舊失敗歷史保留。

| 執行對象 | Serial Node | TypeScript | Scoped ESLint | 證據性質 |
|---|---|---|---|---|
| CORE staged tree | 28/28 PASS | PASS | PASS | 不含未提交 GEN/PLAN |
| CORE commit | 28/28 PASS | PASS | PASS | 另建乾淨副本重跑 |
| CORE+GEN staged tree | 73/73 PASS | PASS | PASS | 不含未提交 PLAN |
| CORE+GEN commit | 73/73 PASS | PASS | PASS | 另建乾淨副本重跑 |
| CORE+GEN+PLAN staged tree | 122/122 PASS | PASS | PASS | 348個 archived blobs 全部逐檔核對 |

各批均 0 fail、0 skip。測試使用 `node --test --test-concurrency=1`，依序累加 `tests/dev-ntm-001-core.test.mjs`、`tests/qa-ntm-001-core.test.mjs`、002的DEV/formal/preparation、003的DEV/formal/preparation。TypeScript 使用 `tsc --noEmit --pretty false --incremental false`；ESLint 只檢查該階段已納入的 NTM `.ts/.mjs`，`--max-warnings 0`。

清潔副本位於工作樹 ignored `.local/ntm-checkpoint-20261013/`，來源僅 Git tree/commit，不複製後續 WIP。Node `v24.18.0`、TypeScript `5.9.3`、Zod `4.4.3`、ESLint `9.39.4`；沿用既有 node_modules junction，實際解析到 root `C:/Users/DUS/Desktop/project/nettopo-studio/node_modules`，不宣稱套件物理隔離或沒有 junction。沒有安裝套件或改 package/lock。測試子行程只傳 OS/PATH/TEMP 等必要環境與 CI，不載 `.env`，不傳應用設定/DSN。

## Equivalence And Safety

- PLAN manifest 所列28項 contracts/files/dependencies/previous manifests/tool config/regression tools全部 raw hash MATCH，QA003 formal runner hash亦 MATCH。
- 全部46個既有 NTM 選定檔案，working bytes 與 Git blob bytes 完全一致；保留歷史 manifest 原始內容，沒有以新 hash 蓋掉舊候選。
- 原工作樹已盤點532個 tracked/untracked檔案，提交前全部 bytes 保持不變。本紀錄是唯一新增交付文件；ignored verification artifacts不 stage。
- 所有匯出 entry 均核對 Git blob bytes、mode `100644`、type blob；沒有新增 symlink、env、dist、node_modules、test-results或本機資料到提交中。
- 46檔限定敏感字串掃描未命中 private key、可用 password DSN、GitHub/API token、JWT patterns。secret rejection fixture明確為 `synthetic-qa-only`，`.invalid/never-connect` 不可連線 sentinel。這不是現用秘密盤點，也不聲稱掃描能排除所有未知秘密格式。
- 第1次 archive preflight 因 Windows tar 中文路徑解碼失敗，未進測試；第2次發現 archive沿用autocrlf轉換，与blob不符，未進測試。改採既有fflate解ZIP，僅archive命令設定 `core.autocrlf=false` / `core.eol=lf`，未改任何Git全域設定；第3次及後續逐blob比對通過。
- 另一工具初始化曾因測試用精簡env被誤套到Git、失去既有sandbox Git設定而失敗；已將Git與測試子行程環境分開，不改safe.directory或平台安全設定。
- CORE全檔 `git diff --cached --check` exit 2：父契約五處既有Markdown hard-break雙空白、兩份既有設計文件EOF空行。保留核准 bytes，沒有聲稱全檔diff-check PASS。CORE產品/測試scope PASS；GEN與PLAN全staged diff-check PASS。

詳細本機機器證據為 `.local/ntm-checkpoint-20261013/path-map.json`、`baseline.json`、`*-preflight*.json`、`*-committed.json`、同名前綴測試log、`secret-scan.json`、`final-safety.json`。這些只作本機存檔驗證，不作另一套票庫或產品測試。

## Remaining Scope

未stage混合 governance/register、QA_REL_001、舊UIX/Pilot QA工具/截圖、其他候選。root工作線的index/commit由OPS/PM負責，本次不操作。未啟動NTM004/005、UI、durable persistence、API、Browser、真DB、Docker、OIDC、Auth或部署。

完整應用build與全repo測試本輪 NOT RUN：當前具名授權是no-env純模組checkpoint；沿用既有純模組QA證據，不能推論完整NTM產品管線完成。push也不代表已部署或整票DONE。下一責任組為PM核收實際提交與遠端SHA，另決定後續產品接入範圍。
