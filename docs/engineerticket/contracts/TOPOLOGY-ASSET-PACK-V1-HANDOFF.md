# 設備與連線圖像 v1 — PM 交付與整合指令

日期：2026-09-09。來源：使用者於「建立設備與連線類型圖像」要求製作目前專案設備／光纖、Cat6、Cat7 等連線圖像、透明去背、約 160×100，完成後下指令給 PM 組替換專案設備圖形，並置入可榫接連線的卯點。

## 交付內容

- `public/topology-assets/v1/devices/`：15 種設備的 160×100 PNG 與 320×200 `@2x` PNG。
- `public/topology-assets/v1/connections/`：Cat5e、Cat6、Cat7、光纖、未指定有線、無線共 6 種，同樣含兩種解析度。
- `public/topology-assets/v1/manifest.json`：圖片路徑、尺寸、設備卯點中心／半徑／互動熱區。
- `public/topology-assets/v1/index.html`：原尺寸圖庫，含深淺底與卯點熱區開關。
- `output/imagegen/topology-v1/originals/`：內建 image_gen 原始透明 PNG。
- `output/imagegen/topology-v1/sources.json`：逐張完整生成 prompt 與來源記錄。
- `output/imagegen/topology-v1/dock-points.json`：以原始圖片像素人工標定的凹槽中心。
- `output/imagegen/topology-v1/validation.json`：封裝器的尺寸、alpha、四角透明、hash 檢查結果。
- `scripts/package-topology-assets.mjs`：重製封裝工具。僅等比縮圖、透明補邊與保留原始 alpha；不以程式描圖或重新去背。

15 個設備 ID 與現有 `DeviceType` 一致：router、modem、firewall、switch、server、nas、erp、access-point、client、ssid、mesh-node、printer、camera、pos、iot。SSID 與 ERP 是逻輯／服務形象；圖像不是品牌或特定型號的產品規格圖。

## PM 請執行

依本次使用者指令建立／更新 Decision 與具名 DSG → DEV → QA 工單，安排這套素材取代畫布、設備清單及 Inspector 的字母 glyph。這是素材交付，不代表應用已完成換圖或互動接線已驗收。請協調 `DSG_UIX_003 / DEV_UIX_009 / QA_UIX_005` 的路由工作與 page/CSS/route hunk ownership，並回報接收、工單 ID、分工及驗收計畫。

### 設備圖與互動卯點

1. 使用集中 asset registry 映射 `DeviceType`，不要把 png 路徑或大圖 binary 存入 Device／Project。原圖作為設計來源，應用載入 public 的小圖。
2. 主圖容器為 160×100 CSS px，`object-fit: contain`；高 DPI 可用 `srcSet` 的 `@2x`。保留可讀的設備名稱、IP、數量與群組摘要。現有 node 為 178×112，不能直接把新圖塞入而造成文字裁切；明訂 node/layout/routing 共用尺寸並同步調整。
3. 圖上左右青色凹槽是可見卯點。manifest 的 `docks[].x/y` 是 160×100 圖框內像素座標；`u/v` 為正規化便利值，計算時優先用 x/y 精度。`radius` 是視覺近似半徑，`hitRadius: 12` 代表直徑 24 CSS px 互動熱區。不要只用小凹槽像素作點擊範圍。
4. 世界座標 = node 位置 + 圖框相對 node 的 offset + dock 座標 × 顯示比例。React Flow transform 只套用一次。圖片、Handle、可見線頭、路由與匯出須使用同一套座標轉換；不要用 DOM viewport 座標當 durable domain 資料。
5. 請實作真正可操作的連線熱區／Handle：開始連線、懸停提示、吸附、成功／不合法狀態與鍵盤可存取替代流程。接線完成仍須走既有驗證與 Zustand write boundary，保留 wired 的 fromPort/toPort 必填檢查。
6. 視覺卯點不是實體 port。`left/right` 不得覆寫 `fromPort/toPort`，也不能當成 Ethernet／光纖相容性證明。SSID 是邏輯節點，不得暗示實體插孔。
7. **D10 衝突須明確處理**：現有最近邊 anchor 支援上下左右且可沿邊投影，這批圖的固定裝飾凹槽只有左右兩個；它們不是直接替換 router anchor 演算法的契約。DSG 應提出保留最近邊策略的動態視覺 dock／短引線設計，或由 PM 明確 SUPERSEDE 所需局部規則。不要默默把所有接線鎖在左右，也不要宣稱只有 PNG 就已完成互動功能。
8. 固定凹槽位於圖形局部，不完全等同 node 矩形邊界。需定义凹槽到最近邊的引線及其端點例外；現行 obstacle validator 禁止路徑進入端點 interior。這項幾何差異必須在設計中處理，不能靠放寬非端點避障硬限制。

### 連線類型

目前 `Link` 只有 `kind: wired | wireless`、fromPort、toPort、vlan、speed；Cat6／Cat7／fiber 尚非獨立可設定欄位。現有 `linkVisualClass` 依速度推定 copper/fiber 樣式，不能用來證明線材種類。

請 DSG 定義獨立的媒介欄位與相容性契約，例如 wired 的 `unspecified | cat5e | cat6 | cat7 | fiber`，wireless 依 kind 使用無線素材。名稱／完整 schema 由設計票收斂；**不能由速度推定實體線材**。舊資料未填時顯示未指定有線；不將既有 1G/10G 連線批次改成光纖。線材顏色只供 UI 辨識，不是產業強制配色。

新欄位若寫入 durable Link，須同步 API/Zod/本機及伺服器 persistence/JSON/CSV round-trip，保留固定五檔 CSV 與 legacy compatibility；schema version／migration 影響由設計票明訂。圖片用於下拉選項、圖例及 Inspector；畫布的線條仍應清楚可選取，不把整段 cable PNG 拉伸成任意長度連線。

## 追溯與不變條件

- Change Type：圖像替換及媒介表達為 EXTEND；固定 dock 對 D10 的影響由 PM 明確判定，不能預先當成已批准的 SUPERSEDE。
- Historical Sources：REQUIREMENT-BASELINE、DECISION-LOG、ARCHITECTURE-MAP、DESIGN-DEVELOPMENT-MAP、DSG_UIX_002、DSG_UIX_003；app/page.tsx、app/lib/topology-types.ts、app/lib/topology-routing.ts 是現況證據。
- Applicable Decisions：D09 避障、D10 最近邊／重疊 offset、D11/D12 追溯與權威、D13 分層、D29 Git 人工批准、D31 路由分流。新素材需求來源為本次使用者明確指令，正式新 Decision ID 由 PM 指派。
- Affected Layers：UI、routing/layout、Domain/validation、state/storage、API、Import/Export、QA。
- Preserved Invariants：controlled view、Zustand write boundary、route/dock/lane 為 view derivation；非端點 obstacle-safe；wireless 例外；credentials 隔離；safe export；既有資料相容性。
- Rollback：asset registry 可回復既有 glyph；不刪既有設備、連線與 port metadata。載圖錯誤需有可讀 fallback，不讓整個拓樸空白。

## 驗收要求

- 15 個 DeviceType 全覆蓋；6 種連線素材存在；PNG 160×100、透明 alpha、無白底／棋盤格烘焙；深淺背景可讀。
- 圖框、名稱、IP、數量不重疊；拖曳、縮放、平移、自動布局、群組折疊／展開及重載後位置一致。
- 逐設備檢查可見線頭與卯點中心偏差，預設比例應不大於 1 CSS px；不同縮放也須吻合。測試 source/target、上下左右配置、多線重疊與 dense graph。
- 真實拖線能開始／吸附／取消／保存；wired 缺少介面時維持既有阻擋；只讀使用者不能新增連線。素材圖庫的可點熱區不代表產品接線驗收。
- Cat6、Cat7、fiber 與 speed 可獨立選定；舊資料保持未指定；切換 kind 的不合法媒介組合有定義；API／JSON／五檔 CSV round-trip 不遺失欄位。
- 延續 tests/topology-routing.test.mjs、tests/topology-routing-qa-uix.test.mjs、tests/topology-layout.test.mjs、拖曳保存與匯出相關回歸，包含 image/PDF 匯出透明度和線頭位置。
- 素材封裝驗證與獨立產品 QA 分別回報；本次交付不聲稱既有產品完整 lint/test/build 通過。

Commit／push／merge／deploy 依既有 PM 授權範圍另行處理；本次素材任務不產生這些操作。
