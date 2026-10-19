# Beta R4 工程存檔

日期：2026-10-19，Asia/Taipei。範圍：DEV_BTA_001–003 / codex/public-beta-0.1。

## 授權與狀態

使用者於PM組明確核准：「核准先做工程存檔 commit，不 push 或發布，A08 維持 BLOCKED，後續再補驗。」已直接讀取人類訊息核實，非僅依轉述；thread `019fc279-b2e8-7520-893c-dce960f76acc`、turn `01a15441-fb6f-7850-9c88-ab5be0cdf927`、message `01a15441-fc2e-7a33-aa69-6cb3dc8b93ed`。root PM beta-resume日誌另有同名授權段，留在root，不混入本Beta commit。

本次只解除R4精確staging及一個本機工程存檔commit。QA_BTA_001仍BLOCKED，A08必要gate未降低；DEV票仍READY_FOR_QA，不改DONE/QA_PASSED/Release-ready。沒有push、tag、Release、跨分支合併、部署、其他產品票或主機設定授權。

存檔對應收錄此文件的commit，可用 `git log -1 --format=%H -- docs/dev開發紀錄/2026-10-19-beta-engineering-snapshot.md` 查實際SHA，避免在commit內自我引用其hash。commit成功後的證明保存在ignored工程證據目錄並回報PM。

## 候選

- 唯一worktree：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1`。
- Branch：`codex/public-beta-0.1`；parent/base：`b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`。
- 受驗R4 ZIP SHA256：`4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`。
- Handoff raw SHA256：`a83fd10995cfa88c2470e771c39a58c9cbd9a5e0abe239a35ff82521e7a02c57`。
- Source manifest SHA256：`4b1b0825a51acf934b812b0a073daab73b35467415d3f6784958e9c8564c98fb`，74 inputs逐檔raw hash零漂移。
- 契約R1.1 §12 raw SHA256：`69e3e5aa31d831a143fbd1999451a857d2e15d5bc038ef6d17b19e96e3222f1d`。
- QA及產品writer已停止；DEV是本次唯一Git writer。原root dustool/index/Auth WIP不操作。

## 精確範圍

[工程path清單](2026-10-19-beta-engineering-paths.json)列出105個預定提交path、scope、74項受驗source raw hashes、49個QA-owned檔案原始hash及排除理由。只stage精確清單，禁止git add .或目錄盲加。

- 35個R4產品／封裝／公開來源變更：local-beta入口與安全policy、IndexedDB commit-before-publish、群組edit/delete、panel CSS、runtime/setup/start/stop、producer、公開說明、licenses/notices與canonical合成範例。
- 51個DEV/QA測試及fixtures、7份獨立QA紀錄、9份契約/DEV/DSG/QA票與開發紀錄，保留原失敗及限制，不改QA斷言或結論。
- Register只新增本Beta區段及本次存檔註記；baseline其餘NTM/Auth等歷史內容不改。另有本文件及path清單兩個工程metadata檔。
- 共用app/page.tsx、topology-store.ts、runtime-policy.ts等逐hunk核對，僅Beta已驗delta；在完整閉包中單一存檔，不硬拆依賴不完整的中間commit。

唯一納入的binary是 `samples/beta/synthetic-topology-csv-bundle.zip`，為PM明確確認的source asset，SHA256 `2516dbe5f22910797201a1ca00a830cc40ee80f9a3c7fc1d5be2ca1bc780bf53`；實際解壓只有devices/links/groups/credentials.masked/missing-info五CSV，合成資料與safe round-trip測試通過。不是generated release ZIP。

排除 `.local`、release成品ZIP/dist、node_modules、現用env/DSN/秘密、test-results及OPS A08未完成可執行草稿。兩個原有OPS文件留未提交：`docs/dev開發紀錄/2026-10-19-ops-env-001-a08.md`、`docs/engineerticket/active/OPS_BTA_001.md`；它們屬不同owner的環境/發布階段。既有register對OPS的連結是工作樹索引，不代表該階段已納入本存檔。

## 獨立證據與限制

權威：[R4 QA報告](../dev測試紀錄/qa-bta-001-r4-2026-10-19.md)。R4群組修復、A04/A05/A06/A07/A09已觀測sinks/A10通過；A11安全負向補驗通過。A02/A03為PASS_WITH_DECLARED_LIMITS，A12為PASS_WITH_AUTHORIZED_SCOPE，不擴大已驗環境。

- group evidence SHA256：`bbbe08285a65971b934d353469ec9618912ee468c946465d57f0bdc4a3213dba`。
- deep evidence SHA256：`6f8051301a6c3bdf0253ebcdf72eda268db2d505f3e852e5c40eb81ac9a027d8`。
- runtime-negative evidence SHA256：`113ea55b30f52f527b3610449b32976eea871fab63f328dc18b213ccbf3737d2`。
- 支持實測Node24.18.0/npm11.16.0、Chrome155.0.8059.82/Edge155.0.4283.62；替代Node/npm只有validation seams，未安裝替代binary。未開LAN listener、未讀active env/DSN/秘密、未觀測OS/process/log sinks不宣稱PASS。
- A08仍因Windows管理權限缺口BLOCKED；Browser route/CSP不替代OS/Node全面網路隔離。OPS草稿NOT READY，不能直接執行。PM安排合法隔離環境與完整工具後由QA另驗，不能以此commit取代。
- 全量lint既有Windows Bash launcher blocker保留；本次不重新執行DB、網路或Browser測試。先前固定R4 build/tsc/scoped lint/Browser證據不改寫為新執行。

## 工程檢查

提交前明確正向清單156/156通過，未用tests glob、未讀.env、未啟DB/Browser/網路。這是DEV工程回歸，含原QA-owned測試的本地重跑，不冒稱另一次獨立QA。提交後以同清單再驗；命令與結果在 `.local/bta-20261019/engineering-snapshot/`。

候選scan只讀精確納入檔案；命中為既有README三項placeholder與五項QA synthetic fixture/context，不含可用token、private key或真實憑證；既有QA負向fixture保留，不為零命中刪測試。static local imports完成解析，三個runtime生成輸出以producer來源及R4 artifact hash核對，不將dist誤加進Git。

Git沿用既有core.autocrlf=true；原始工作樹74來源raw hash仍須等於R4。staged/committed blob另與Git clean-filter hash逐檔比對，只允許Git既有CRLF/LF文字正規化，binary逐byte相等；不修改工作樹換行或永久Git設定。QA-owned原始內容另逐檔hash鎖定。

完整staged `git diff --cached --check` 回exit2，共14處原有new blank line at EOF，位於QA/DSG/DEV紀錄、票、契約及QA fixtures；先前只檢tracked diff沒有涵蓋這些當時untracked檔案。為保持QA原文及固定契約hash，本次不做格式改寫。補充排除blank-at-eof的檢查為0，沒有其他whitespace錯誤；不將預設diff-check標PASS。staged等價核對144 blobs：97 byte-exact、47僅Git CRLF→LF；74 source與49 QA原始hash不變。

## 重建邊界

既有producer在 `scripts/beta/package.mjs` 鎖定原R4 base `b5c5391` 與Beta branch。提交後HEAD變更，直接重新package會fail closed；本次不改受驗producer來迎合新HEAD。source閉包/lock/producer完整存檔，但重現原R4必須在另獲授權的隔離工作樹重建原base加本存檔source overlay，並核對path清單的raw hashes及Git換行。新HEAD直接產包支援需另次明確修正及驗證，不屬本次存檔。現有R4 ZIP/packet保留原hash，不重新標籤為新commit產物。
