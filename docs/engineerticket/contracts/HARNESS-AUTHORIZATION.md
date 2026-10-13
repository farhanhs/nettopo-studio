# R3 補充 — 有界授權、環境責任與驗收證據

生效：2026-10-12；治理票 `PM_GOV_005@dustool`。使用者核准「按照補強…更改授權與分工…若有需要新增對話或更改環境…sandbox、資料庫、library…」。這是既有 R3 的執行補強，不另建票庫、不重開產品契約。

2026-10-13 具名覆蓋：使用者已核准已驗收 NTM／Native B1／對應治理的 [commit／push](../../dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md)。只對這些精確候選解除下文 PRE-COMMIT Git 停令，其餘限制與歷史保持。

## 1. 生效範圍與停止點

- 授權處理已核准工作包的開發、獨立驗收、同票修復，以及必要的隔離測試環境。不是自動啟動所有歷史票、Auth/live、AIL 或新功能。
- 當前產品接續：`DEV_NTM_003 → QA_NTM_003`，PLAN-R1／NTM-PLAN-R1.1，checkpoint 工作樹；必要 QA 後 **PRE-COMMIT 停止**。Beta 保留既有排序，不併入此次候選。
- 當前環境接續：root `OPS_ENV_001` 本補充 phase → `QA_ENV_001` 獨立驗證；不能以環境進階工作阻擋無 DB 相依的 NTM 純模組驗收。
- 最新 PRE-COMMIT 停令優先於歷史小批次 commit 授權。沒有 stage、commit、push、merge、部署、公開 Release 或 live 公司 API／OTP 權限。
- 本文件只在下表條件成立時取代歷史「一般同票交接／隔離環境準備逐次等 PM」限制；其餘安全界線與失敗紀錄保留。

## 2. 分工與持續交接授權

| 角色 | 主責／可直接完成 | 不可代替的責任 |
|---|---|---|
| PM | 優先序、scope、必要 acceptance、候選核收、例外決策與本文件 | 不代 QA 簽 PASS，不以規則授予 OS／遠端實際權限 |
| DSG（既有設計組） | 新欄位／新語意／兩種合理解讀的契約 | 既有契約 bug 不重送完整設計，不改正式 QA 中契約 |
| DEV（既有開發組） | 唯一產品 writer、自測、完整 manifest、READY_FOR_QA、同票修復 | 不改獨立 QA 斷言或替 QA 核收 |
| QA（既有測試組） | 自有工具與案例、hash 鎖定、正式批次、缺陷與 cleanup、同票重驗 | 不改產品換 PASS；環境可用與產品通過分開 |
| OPS（專責環境組） | `OPS_ENV_001` 具名工具、隔離資源、版本與回復證據 | 不改產品、Auth、QA 獨立斷言或共用治理；QA_ENV_001 獨立驗證 |

使用者本次授權包含：PM 向上述具名工作組派送本範圍工作；DEV 與 QA 可直接互送同票交付／退修，OPS 與 QA 可直接互送具名環境交付／退修，所有組可向 PM 回報。這是本使用者指示的延續，不以別組訊息本身冒充使用者授權。對話 ID 見 [實施紀錄](../../dev開發紀錄/2026-10-12-pm-harness-authorization.md)。新功能與其他對話不繼承授權。

每次交接僅一個 next owner。正式 QA 鎖定產品與相依後，DEV 停止該候選寫入；QA 完成本批與 owned cleanup，記 `release-for-repair` 才直接退 DEV。一般失敗集中回報，不逐例等 PM；秘密、資料破壞、歸屬不明或候選被改立即停止受影響案例。QA_PASSED 交 PM，不自行開下一產品票。

## 3. 有界操作授權

| 操作 | 本次可執行條件 | 需停止／升級 |
|---|---|---|
| Sandbox／程序 | 保留 workspace-write 與目前平台核准機制；必要受阻命令具名申請工具提升；程序只存取指定工作樹與 owned fixture | 不使用全域 bypass、不改系統安全政策／受保護 Codex 設定、不因拒絕改走繞過路徑 |
| 測試資料庫 | 自建 synthetic cluster／container，loopback、隨機非 5432 port、獨立 credential／migration+runtime role、具名 volume/dataDir；先記資源歸屬再操作 | 不載入現用 `.env`／DSN、不連開發或公司 DB、不重設共享 cluster、不改現用角色／密碼 |
| DB schema／回復 | 既有 migration 僅套到本次 owned fixture；可在 fixture 中測錯誤、timeout、復原與清理 | 產品 migration 修改仍屬 DEV 產品票；未知資源不刪除，不能全域 prune |
| library／工具 | 先比對 manifest／lock／installed；必要時於隔離工具目錄還原既有 lock，檢查來源、版本、install scripts；新增測試依賴須 OPS 記用途／替代方案／固定版本／影響與撤回，再由 QA 驗證 | 不執行無界 update 或 audit fix；major／產品 runtime 依賴、新授權／付費、主機級安裝及重開機先提出具名方案；不在 active QA 下改 lock 或 node_modules |
| Docker／Browser | 既有工具可供已核准 fixture 使用；先確認 engine/context 為本機；隔離 browser profile、不帶個人登入；停止／移除僅本票 owned 資源 | 不 mount 現用 env、home、Docker socket 或 production volume；不接遠端 daemon；不關未知程序 |
| GitHub／CI | 可唯讀核實 Actions／rulesets／branch protection；可在具名 OPS 交付中提出本地配置候選 | 權限不足記 UNKNOWN，不推斷未設置；變更遠端規則、secrets、workflow 推送與發布須另核准，不自動啟動外部付費 runner |

環境變更前寫明：ticket、owner、精確 target、目的、版本／來源、影響、回復方法、預期清理。操作後記實際結果，不將「已授權」寫成「已完成」。不增加框架或新依賴只是為滿足流程格式。

Sandbox 限制可存取的檔案／網路；approval 決定何時可請求提升，兩者不等同專案授權。依 [官方說明](https://learn.chatgpt.com/docs/sandboxing)；本文件不覆寫實際平台政策。OS-only 子程序環境是減少環境繼承，不是 OS sandbox，也不證明測試程式無檔案／網路副作用。

## 4. 候選與證據最小契約

沿用現有 manifest／verification JSON／日誌，不批次改寫舊格式。新批次或補測以增補 sidecar／同票欄位補齊：

1. `ticket@branch`、絕對 worktree、HEAD/base、dirty 狀態、contract revision、使用者授權來源、primary writer、next owner。
2. 產品 allowed paths 與完整 import／runtime dependency closure、raw SHA256、package/lock、實際工具版本；QA runner／fixtures 另列 hash。manifest 本身亦取 hash。既有 installed 版本相符不等於全部套件內容已驗完整性。
3. 正式前確認所有 realpath 在核准樹內、拒絕未核准 symlink／junction／越界；鎖版依範圍與相依，不使用混雜 root 的全樹 fingerprint 代表 NTM 候選。
4. 每項必要 acceptance 列 candidate、runner、執行時間／指令、環境／fixture provenance、預期／實際、PASS／FAILED／BLOCKED／NOT RUN、證據位置、owner／下一步。工具 preflight 與 DEV 自測不是獨立 QA。
5. 測前後 hash 一致性；偏移先分析影響，不沿用受影響舊 PASS。新增 dependency 需納入 closure，不能只 hash 頂層檔案。
6. 有資源時記 PID/container ID、loopback port、volume/dataDir、唯一 run ID／ownership marker、cleanup 與 recovery 結果；無資源記 `none`。目錄不存在不足以證明程序與 port 已清理。

新環境工具先自測正常／拒絕／timeout／失敗清理，再由 QA_ENV_001 獨立驗證；復原演練只用 disposable fixture。CI／container／native／Browser 是不同證據，不相互代簽。必要 gate 不足即保留阻擋，不用改規則換 PASS。

## 5. 本輪交付與完成判準

- PM：共用規則入口、授權表、具名 owner／交接、當前候選與狀態實施紀錄。
- OPS_ENV_001：優先補既有 runner 的 scoped candidate／證據與資源歸屬檢查；保持現有 CLI 相容，不默默改舊 acceptance；交固定工具候選＋自測＋可重現命令給 QA。先 native disposable lifecycle，容器若不可用只阻擋相依部分；不把 Docker 修復擴成無界主機維修。
- QA_ENV_001：依固定工具候選驗 containment、scope/dependency 漂移、環境過濾、normal/failure cleanup/recovery；獨立於 QA_NTM_003 排程，不同 worktree 不混結果。
- PRE-COMMIT：必要獨立 QA、精確差異、未驗項、owned cleanup、建議 commit 範圍交使用者。規則落盤或工具自測通過，不等於整個環境／產品已完成。
