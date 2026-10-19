# NetTopo Studio 本機試用

候選版本：0.1.0-beta.1。尚未公開發布；獨立 QA 結果以交付紀錄為準。

這是單人、本機 IndexedDB 工具，不需要公司帳號、Docker、資料庫或管理員權限。只用合成測試資料，不輸入真實客戶或設備帳密。現有唯讀模型檢視沿用主線基準，不代表新增 NTM 儲存、AI、HR 或監控能力。

## 第一次使用

1. 安裝 Node.js 24.18.0（Windows x64），其附帶 npm 必須為 11.16.0。setup 會在下載相依前比對這兩個精確版本；其他版本會被拒絕，不自動安裝或更新。
2. 將 ZIP 完整解壓到自己的目錄。中文及空白路徑可用；不要直接在 ZIP 檢視器中執行。
3. 執行 `setup.cmd`。這一步需要網路，僅從 npm 官方 registry 安裝鎖定的 runtime 相依；不 build，也不執行相依安裝腳本。
4. 執行 `start.cmd`，看到 `BTA_STARTED` 後，在 Chrome 或 Edge 開啟 `http://127.0.0.1:4317`。
5. 頂端應持續顯示「本機試用模式｜資料只保存在此瀏覽器設定檔」。沒有公司登入、Demo 帳號、站點身分切換。

日常使用只需 `start.cmd`，結束執行 `stop.cmd`。日常可離線，不會自動更新、上傳或聯絡公司系統。不要將本工具設成內網共用服務；它只監聽固定 IPv4 loopback。

## 結果碼

每個命令輸出單行 JSON，主要欄位為 `code`、`message`，啟動成功另有 `origin`。

| code | 處理方式 |
|---|---|
| BTA_SETUP_OK | setup 完成，可 start |
| BTA_STARTED / BTA_ALREADY_RUNNING | 同一自有實例可使用，網址不變 |
| BTA_STOPPED / BTA_NOT_RUNNING | 已停止或沒有自有服務；瀏覽器資料不刪除 |
| BTA_NODE_MISSING / BTA_NODE_VERSION_UNSUPPORTED | 確認 Node 精確版本與 Windows x64 |
| BTA_NPM_VERSION_UNSUPPORTED | setup 使用的 Node 附帶 npm 必須為 11.16.0；缺少、格式錯誤或不同版本都不安裝相依 |
| BTA_RUNTIME_NOT_SETUP | 先執行 setup |
| BTA_ARTIFACT_INVALID / BTA_DEPENDENCY_LOCK_MISMATCH | 不要繞過檢查；重新取得完整候選包，再 setup |
| BTA_PORT_IN_USE | 4317 已有未知服務或無法確認狀態；不要任意終止程序，不改用其他 port |
| BTA_OWNERSHIP_MISMATCH | 停止工具不能確認 PID/啟動時間/程式路徑；不會殺掉未知程序，請回報 |
| BTA_PROFILE_INVALID / BTA_STORAGE_MODE_INVALID | 包的本機模式不一致；不要設定公司 env 或 DSN |
| BTA_START_FAILED / BTA_STOP_FAILED / BTA_RUNTIME_FAILED | 保留候選版本與結果碼，按 FEEDBACK.md 回報 |

exit code：0 成功；2 必要條件；3 設定；4 連接埠/歸屬；5 完整性；6 執行失敗。

不要編輯 `beta-manifest.json`、`SHA256SUMS.txt`、runtime lock 或 `.state/instance.json`。停止令牌只在自有狀態檔，不要附到回報中。初始 setup 可重跑，但先停止自有實例；不會處理瀏覽器資料。

開發自測瀏覽器：Chrome 155.0.8059.82、Edge 155.0.4283.45。這不是所有 Windows／瀏覽器版本的相容保證；正式支持矩陣待 QA_BTA_001。
