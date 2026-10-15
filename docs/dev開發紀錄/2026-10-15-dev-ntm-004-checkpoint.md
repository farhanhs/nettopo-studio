# DEV_NTM_004 / PROJ-R1 Engineering Checkpoint

## 授權與範圍

- 使用者在 PM組的 2026-10-15 訊息 `commit`；turn `01a13d55-124a-72c1-84f7-0a743ae21f86`、user message `01a13d55-1491-77f2-879f-6d466f3e8a36`。DEV已唯讀確認原訊息，不只採用轉述。
- Root PM 授權紀錄：`docs/dev開發紀錄/2026-10-15-pm-ntm-004-commit.md`；root 治理文件留在 dustool，不搬入產品分支。
- Branch/worktree：`codex/dev-rel-001-checkpoint` / `C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`。
- Base HEAD：`590339395ec8cf5af5591d3be4379bd3ab4ebc6b`；開始時 index 空白。只做一個 cohesive commit，不 push／merge／deploy／啟下一票。
- 固定 [manifest](2026-10-14-dev-ntm-004-proj-r1-manifest.json)：SHA-256 `ba766b4e68c1dd621a9e6ea2322eb67cd80a2021492221b638f2dcb02ee86c31`。提交前 raw hash 104/104 一致；產品停寫，manifest 不改。
- 精確 38 paths：7產品、5 DEV test/fixture、5 QA runners、5 QA fixtures、4既有DEV/DSG日誌與manifest、4 QA報告/summary/history、2合成資料截圖、4票面/§5契約、Register 本票段落、本checkpoint紀錄。無 Auth/UIX/GOV 其他票修改。
- `TICKET-REGISTER.md` 只 stage NTM004 section（165/166＋直接說明）；原工作樹其他新增歷史與其他票列完整保留。DSG票差異只有 §5 與 updated date。

## 提交內容驗證

DEV 於 2026-10-15 完成乾淨 staged tree 驗證，受測 tree `0ad7bda7e3973acf4689376c4b69202baa00822d`。382個檔案全部由該 Git tree blob 匯出，不複製工作樹的未提交檔案；唯一junction指向既有node_modules，沒有安裝或變更依賴。最終commit只允許本紀錄補上結果造成的metadata delta，其他受測blob必須相同。

| 驗證 | 本次實際結果 |
|---|---|
| Manifest raw hashes | 原工作樹104/104一致；所有104 paths均在staged tree內 |
| Git內容相等 | 30個closure文字檔因既有Git規則CRLF→LF；逐檔只允許此轉換，其餘bytes一致。這是Git normalization，不宣稱raw hashes與checkout無條件相同 |
| Selection／副作用guard | 明確執行QA selection runner，5/5 PASS；禁止glob，未選DB lifecycle runner |
| 正向module清單 | 依 `tests/fixtures/qa-ntm-004/test-selection-r1.json` 的20個精確entry，serial 189/189 PASS，0 fail/skip |
| Transfer／validation／types | 三個具名既有DEV allowlist entry，18/18 PASS，0 fail/skip |
| TypeScript | 乾淨tree `tsc --noEmit --pretty false` PASS |
| Scoped ESLint | 本次TS/TSX/MJS產品與DEV/QA runner，0 errors/warnings；不包含CSS或full-lint wrapper |
| Runtime policy + build-local | sanitized env下直接執行兩個既有scripts，PASS；既有chunk size／route classification warning保留 |
| 隔離 | 明確OS env allowlist＋test profile/disabled auth；dotenv read/open guard負向probe PASS。無現用.env/DSN，無DB／Docker／Browser／listener |
| Secret/generated範圍掃描 | 38個staged paths高可信DSN/private-key/JWT/API-token模式0命中；兩PNG為已檢視的合成QA截圖。未stage.local、env、build output或其他票。不是全專案秘密審計 |
| Diff check | 原始 `git diff --cached --check` exit1，僅§5契約L3–6四處既有Markdown雙空白換行；保留契約hash。排除該契約的scope檢查PASS；一次性 `core.whitespace=-blank-at-eol` 補充檢查PASS，不更改repo/global設定 |
| QA證據 | runner/formal/selection/report/summary/history六份raw hash均與PM核收值一致；本次不重跑Browser，不冒稱新的獨立QA |

機讀證據與logs保留於本工作樹 `.local/ntm004-commit-20261015/`（ignored，不入commit）。`verification.json` SHA-256：`e19eb4c68acc42733b448d14de2eced7640767aa8480180b8cbdd0a7241e46c0`；`paths.json` SHA-256：`99508f6697c3f5d09afa66e4cf86a267e460a059bbf9401a9a3908355c5decbb`。記錄逐log hash、所有normalized paths、staged tree與精確38 paths。測試程序全部結束，乾淨鏡像與log刻意保留為本票證據，無清除未知資源。

本次工具修正歷史：初始化path清單時誤將manifest物件當字串，尚未stage即中止，改以`.path`產清單；Windows sandbox首次junction EPERM，在正常權限提升後建立具名依賴junction，再逐blob核對既有鏡像後重跑成功。沒有改產品或QA測試來取得PASS。

重現注意：歷史QA Browser runner鎖定原工作樹raw manifest/hash；Git LF normalization後的乾淨checkout須按機讀mapping重新建立對應line-ending候選或由QA具名更新工具候選，不可直接忽略hash guard。這次乾淨tree已實際完成上述module／tsc／lint／build，Browser沿用未變產品的獨立QA證據，不將未重跑寫PASS。

## 獨立 QA 與限制

- [QA 正式報告](../dev測試紀錄/qa-ntm-004-proj-r1-2026-10-14.md) 與 runner/fixture/evidence 保持原 bytes；本次驗證是 DEV checkpoint regression，不另宣稱獨立 QA。
- 既有 QA：module 189/189、QA batch 29/29（有重疊，不加總）、V1 Browser/zero-write/secret/touch/cleanup PASS；manifest 104/104 不變。
- 首輪 DEV 全量測試 3 FAIL/9 skip 與 QA harness 失敗歷史保留。只執行核准 positive allowlist，禁止 glob、現用 env/DB、Docker、安裝。
- `QA_NTM_004-RISK-01`：owned mirror 的 11筆 woff2 console／11筆 request failure 未修復；PM核准為本工程checkpoint非阻擋風險，後續owner OPS_ENV_001（需具名scope），期限首次公開Beta打包前。仍擋公開release資產驗證。
- 真 V2 persistence／area Browser、真DB/RBAC Browser、匿名案例及硬體UAT仍未驗；full lint wrapper會載入現用env，本票不執行，scoped lint另列實際結果。
- 提交後 SHA/tree、index 空白、未提交範圍及保存性證據回報 PM。精確 SHA 不自我嵌入本 commit，不改寫歷史或增第二個補SHA commit。
