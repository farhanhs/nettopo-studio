# AI Layout 雙軌整理交接契約

- Primary Ticket：PM_AIL_001 → DSG_AIL_001
- Development Branch：codex/ai-layout-poc
- Worktree：C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc
- Base Commit：1b0b084518886cda347f175bfc959401fd1d18ed
- Integration Target：codex/dev-rel-001-checkpoint
- 決策：PM_GOV_001-D33；2026-09-11
- 狀態：產品方向 APPROVED；詳細欄位／seam 由設計組收斂，尚未實作。

## 已核准產品方向

「快速整理」維持不依賴模型的原有自動排版；「智慧整理」以模型解讀整理意圖，再用相同 layout core 和既有路由引擎產生候選。第一版只調整圖面座標；不改真實設備、連線、群組歸屬、權限、站點或安全設定。此能力屬 NetTopo Studio 文件整理，D01 中 netNNassist 的監控／防禦 Agent 邊界仍有效。

首期不需要多 agent、向量庫、獨立微服務或 Codex shell 執行。Provider adapter 先設計 Responses API；本次只建分支及設計，不發送真實模型請求。

## 雙軌 UX

- 桌面：排版模式 select ＋「快速整理」＋「智慧整理」；小寬度可換行／使用 accessible action menu，不能遮住 Canvas/Inspector。
- 快速：現有 auto-detect/three-tier/spine-leaf/layered；provider 未設定／失敗不影響此入口。
- 智慧：整理目的、保留位置設備、保留既有群組、開始、取消；等待中允許使用者繼續操作，但原圖變動即候選過期。
- Preview：前後比較、交叉／遮擋／移動量摘要、簡短建議理由、套用／取消。
- 360/768/1024/1280、短高度、200% scaling；dialog 高度受容器限制、內文可滾動、footer 可達、keyboard/focus 正常。
- Apply 完成後提供單次復原；只回復此操作的座標，不能回寫舊版整份 Project 蓋掉後續編輯。
- 快速整理的 preview 是否預設開啟、復原有效期、budget 的確切值由 DSG 提供合理工程預設；不重新要求使用者核准已同意的雙軌方向。

## 建議資料物件：請設計組補成明確 TypeScript/Zod 契約

| 物件 | 核心欄位 | 所在邊界 |
|---|---|---|
| LayoutSnapshot | topologyId、baseRevision、graphHash、geometryVersion、完整 Project、nodeRects | 僅可信本地／服務端，不能整份送模型 |
| LayoutRequest | requestId、track=quick/smart、requestedMode、objective、pinnedDeviceIds | UI → app service；role/site 由 session 決定 |
| ProviderGraph | ephemeral node/link/group refs、deviceType、kind、adjacency、可選受控語意分類 | server allowlist 映射；排除原始識別與自由文字 |
| LayoutIntent | strategy、direction、layers(nodeRefs)、groupOrder、emphasisRefs、warnings | 模型輸出；有限 enum／長度／ref 檢查，不含 code/SQL/最終座標 |
| LayoutCandidate | requestId、topologyId、baseRevision、geometryVersion、positions[{deviceId,x,y}]、metrics、safeReasons | 本地純計算／短期預覽，不寫入 Project |
| ApplyLayout | topologyId、expectedRevision、candidate positions | 可信 apply seam；驗 finite/range/id 集合／pins／權限／revision |
| LayoutUndo | topologyId、appliedRevision、beforePositions、afterPositions | 短期 session command；後續變更衝突則拒絕復原 |

- 模型回傳 refs 必須存在、唯一、符合已知設備集合；任何新增 id／改接線要求都拒絕。
- 圖面 score 先驗硬限制，再比較交叉／重疊／遮擋／彎折／長度／移動量；不承諾全域最優。
- 把原圖、快速整理結果也列入候選，避免 AI 不佳仍強行套用；locked nodes 與全部 links 保留。
- 由程式映射 intent 為允許的 engine options，禁止模型直接傳任意 ELK option 或執行程式。
- group 排列是視覺排序；不建立新 Group 或改 Device.groupId。資訊不足回 warnings，不能猜主備事實。
- collapsed view 的虛擬節點不能成為 provider 或 durable ID。
- 第一版不新增 durable AI/route 欄位、CSV 檔案或 migration；確有必要由 DSG 顯式提出 impact。

## API／儲存與部署對接

建議 POST /api/layout/proposal，最終名稱由 DSG 定稿：
- 驗 identity → origin/content-type → size/schema → readable/writable topology scope → 建立最小 payload → provider。
- server mode 由服務端依授權讀 graph，不能信任 client 指定的 site/role/整份外送內容。
- local mode 沒有對應 server DB topology：DSG 必須獨立定義受 development gate 的 synthetic graph 通道，或在純 local 關閉智慧功能並顯示原因。不可用不存在的 DB id 假裝已驗權。
- propose 不寫 DB。apply 必須再驗身分、scope、snapshot revision；即使模型運算期間停用帳號或修改站點，亦 fail closed。
- DSG 必須明訂 atomic stale check：local 以相同 Dexie transaction check/update；server 在 transaction 內鎖定目標並比較 canonical revision/hash 後更新。既有 updatedAt/versionLabel 不能直接當強一致 revision。
- abort/cancel/requestId 隔離；模型遲到結果不套用。持久化失敗與 pending 狀態須有明確回報。
- typed errors：auth/scope 沿用既有 401/403/404；另定 INVALID_LAYOUT_REQUEST、INVALID_LAYOUT_PROPOSAL、STALE_LAYOUT、AI_UNAVAILABLE、TIMEOUT、LIMIT_EXCEEDED、NO_SAFE_LAYOUT；HTTP mapping 由 DSG 定稿，不回 raw provider error。
- node/server API key 設 server-only；不放 NEXT_PUBLIC_*、Project、DOM、export 或 log；版本與 enabled/model/timeout/token budget/max nodes 的變數名稱由 DSG 一次定稿。

## 資料外送邊界

以欄位 allowlist 重建 provider graph。匿名 refs 不得使用原始 id/name/IP/MAC/URL/customer/site 名稱；不送 credential，包含 masked record、原始設定檔與完整 Project。自由文字 objective 也可能含敏感值：MVP 優先受控目的選單；若保留自由文字，DSG 必須定義限制／外送預覽，不得宣稱 regex 能保證完全去識別。

回覆僅是未信任的建議；模型沒有 shell、DB、網路設備或檔案修改工具。API data retention 與雲端外送需明示；store:false 不代表所有資料零保留。先用 synthetic fixtures，真實付費請求留到 QA_AIL_002 環境及預算確認。

## 分工與順序

1. PM_AIL_001：分支、盤點、D33、工單 branch/worktree 規則。
2. DSG_AIL_001：本契約細化、欄位圖、接口、響應式 UI、錯誤／concurrency、fixture/test matrix，交付後 PM scope review。
3. DEV_AIL_001：純 layout core、geometry adapter、候選與 scorer。
4. DEV_AIL_002：provider interface／後端 policy、minimized graph、mock provider；依契約可與 core 部分並行，但禁止共改 page.tsx。
5. DEV_AIL_003：雙軌 UI、preview、compare-and-apply／undo、storage acknowledgement。
6. QA_AIL_001：deterministic/mock + real Browser/local/server boundary；PASS 不代表模型品質。
7. QA_AIL_002：受控 synthetic live provider 比較，記錄模型／prompt版本、token／延遲／圖面品質與工程師偏好。

## Evidence

現況：[TOPOLOGY-FUNCTION-DATA-MAP.md](TOPOLOGY-FUNCTION-DATA-MAP.md)。
OpenAI 官方背景：[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[data controls](https://developers.openai.com/api/docs/guides/your-data)。
ELK：[kieler/elkjs](https://github.com/kieler/elkjs)。
