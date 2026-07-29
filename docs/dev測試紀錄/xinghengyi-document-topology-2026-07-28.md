# 興恆毅文件生成拓樸測試 - 2026-07-28

## 測試目的

驗證 NetTopo Studio 目前能否從客戶設備資訊文件生成可用的網路拓樸，並與使用者提供的實際架構圖比對差異。

本紀錄只放可提交的測試摘要，不保存明文帳號密碼。客戶原始資料、遮蔽帳密、截圖、PDF 與 localStorage 測試資料放在 git-ignored 的 `private/` 目錄。

## 測試來源

- 文字來源：`C:\Users\DUS\Desktop\工作文件\客戶資料\興恆毅\興恆毅設備資訊.txt`
- 參考圖來源：`C:\Users\DUS\Desktop\工作文件\客戶資料\興恆毅\ChatGPT Image 2026年6月3日 10_29_30.png`
- 實際 app 測試資料：`private/xinghengyi-topology.local.json`
- 實際 app 測試報告：`private/xinghengyi-test-report.md`
- 實際 app 截圖：`private/xinghengyi-app-screen.png`
- 實際 app PDF：`private/xinghengyi-app-print.pdf`

## 文件解析結果

從 TXT 文件生成：

- 設備：16
- 連線：15
- 容器/群組：4
- 遮蔽帳密項目：8

已生成的主要節點：

- Hinet WAN
- ASUS RT-BE88U
- `V Sense Spa_officials`
- `V Sense Spa`
- HP LaserJet M141w
- 櫃台電腦 `desktop-M218ITR`
- 財務電腦 `desktop-helen`
- Google Home
- iPad Pro 12.9
- iPhone 13 Pro Max
- 6 個監視器點位

## 與參考架構圖的資訊落差

目前生成結果只依照 TXT 文件產生，因此和參考圖相比是「部分正確，但不完整」。

### TXT 明確不足造成的缺漏

- 沒有 `Internet cloud` 圖面節點。
- 沒有明確寫「中華電信數據機」作為獨立設備，只寫到 WAN IP 與 Hinet 帳號。
- 沒有發票 POS 機。
- 沒有中華電信全互通。
- 沒有 `v sense lounge wifi`。
- 沒有 ASUS AiMesh 節點：
  - B1 洗衣房，1G 實體線回程。
  - B1 走廊，無線回程，目前有問題可能更換。
- 沒有 LAN1 / LAN2 實體連線關係。
- 沒有明確標示攝影機分別連到哪個 SSID。
- 沒有完整數量資訊：
  - 筆記型電腦 x2。
  - iPad x5。
  - Google Home 壁掛喇叭 x5。
  - 小米 Wi-Fi 攝影機 x5。
- 沒有頻段策略：
  - `v sense spa`、`v sense lounge wifi` 僅發送 2.4GHz。
  - `v sense spa officials` 是店內設備主網。

### 目前邏輯/資料模型不足造成的偏差

- SSID 目前被近似成 `access-point`，但 SSID 是邏輯網路，不等於實體 AP。
- 印表機、攝影機、POS、mesh-node 目前沒有專用設備類型，只能用 `client` 近似。
- 監視器位置被拆成多個 client，但無法判斷應該聚合成「攝影機 x5」或分到 `v sense lounge wifi`。
- 目前沒有數量型節點或群組折疊，因此多台同類設備會讓畫面偏密。
- 目前文件生成流程還不是 app 原生功能，本輪用 DevTools Protocol 將 JSON 注入 localStorage。

## 功能驗證結果

### app 載入與資料注入

- 測試方式：Next dev server + DevTools Protocol 注入 `localStorage`。
- URL：`http://localhost:3000/`
- 結果：通過。
- 觀察：
  - 預期 16 個設備，畫面顯示 16 個節點。
  - 預期 15 條連線，畫面顯示 15 條連線。
  - ASUS RT-BE88U 可見。
  - `V Sense Spa_officials` 可見。

### 直角連線

- 結果：通過。
- 觀察：
  - 15 條 SVG path 皆無斜線段。
  - 目前仍有線條偏密問題，尤其是多個無線端點集中連到同一 SSID 時。

### 縮放

- 結果：通過。
- 觀察：
  - React Flow controls 可見。
  - minimap 可見。
  - zoom in 後 `.react-flow__viewport` transform 有變化。
  - zoom out 後 transform 再次變化並回到原比例。

### PDF 匯出

- 結果：通過，但仍是瀏覽器列印流程。
- 觀察：
  - 使用瀏覽器 print API 產生 PDF。
  - PDF 頁數：1 頁。
  - PDF 尺寸：A4 橫向，`841.91998 x 595.91998 pt`。
  - 初次測試曾產生 2 頁，原因是 print canvas 高度過高。
  - 已將 print canvas 高度從 `740px` 調整為 `700px` 後重測通過。

### 帳密遮蔽

- 結果：通過。
- 觀察：
  - 遮蔽版帳密清單在 `private/xinghengyi-credentials.masked.json`。
  - 掃描遮蔽版 JSON，未包含原始文件中的完整密碼字串。
  - 明文密碼只保留在使用者原始 TXT 文件，不寫入可提交文件。

## 自動測試缺口

目前這次測試主要是半自動 smoke test，不是完整 CI 自動測試。應拆成以下自動測試：

1. 文件解析測試
   - 給定範本化 Markdown/TXT。
   - 預期產出固定數量的 devices、links、groups。
   - 驗證不確定資訊會被列入 report，而不是被靜默猜測。

2. 帳密遮蔽測試
   - 給定含密碼的輸入。
   - 驗證輸出 JSON 不包含完整明文。
   - 驗證遮蔽格式一致。

3. 拓樸資料 schema 測試
   - 驗證每個 link 的 from/to 都能找到 device。
   - 驗證 wired link 的 port 欄位不重複佔用。
   - 驗證 groupId 都能找到 group。

4. 直角連線演算法測試
   - 驗證產生的 SVG path 只含水平/垂直線段。
   - 驗證線段不穿過非端點設備矩形。
   - 驗證 label 位置不落在設備矩形內。

5. app 匯入/載入測試
   - 目前缺少正式匯入功能，只能透過 localStorage 注入。
   - 待新增「匯入專案 JSON」後，測試應改成真正操作 UI 匯入。

6. PDF 匯出測試
   - 驗證輸出頁數為 1。
   - 驗證 A4 landscape MediaBox。
   - 驗證頁面沒有裁切主要拓樸。

## 後續功能建議

- 新增 app 原生「匯入專案 JSON」與「匯出專案 JSON」。
- 新增設備類型：
  - `ssid`
  - `mesh-node`
  - `printer`
  - `camera`
  - `pos`
  - `iot`
- 新增數量型節點或群組折疊，處理 `iPad x5`、`攝影機 x5`、`Google Home x5`。
- 文件生成拓樸時應輸出「缺資料問題清單」，讓使用者補資料，而不是只生成不完整圖。
- 將目前 `private/cdp-print-xinghengyi.mjs` 的測試流程整理成正式 test script，但輸入資料需改成不含客戶機敏資訊的 fixture。

## 結論

- 目前功能可從不完整 TXT 生成一張可用的初版拓樸。
- 若以使用者提供的實際架構圖為標準，目前結果不完整。
- 不完整的主要原因是輸入資料沒有描述更新後架構細節。
- 次要原因是 app 的設備類型、SSID 表達、數量聚合與正式匯入功能仍不足。
- 開發紀錄與測試紀錄應分開維護：實作變更寫入 `docs/dev開發紀錄/`，功能驗證、資料落差與自動測試項目寫入 `docs/dev測試紀錄/`。
