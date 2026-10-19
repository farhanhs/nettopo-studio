# DEV_BTA_001–003 — 本機 Beta 唯讀 Preflight

日期：2026-10-09（Asia/Taipei）。Primary owner：DEV。結果：**preflight 已完成，三張 DEV 票仍 BLOCKED；沒有可交付執行包或產品 PASS。** 下一責任：DSG_BTA_001 完成契約，PM 核對 scope 後才解除產品寫入依賴。

## 授權、來源與候選

- Authority：root AGENTS / R3 本機 Beta 補充核准 / PM_BTA_001 / [核准計畫 Q1–Q12](C:/Users/DUS/Desktop/project/nettopo-studio/docs/開發計畫/2026-10-09-local-feedback-beta-plan.md) / 本樹 DEV_BTA_001–003。
- 工作樹：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1`；branch `codex/public-beta-0.1`；HEAD/base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`。
- 開始時 dirty 僅 register 與新 BTA 票據；產品 tracked diff 空，index empty。未切 branch、搬入其他樹、碰 root Auth 或 checkpoint NTM。CORE-R2 PRE-COMMIT 停止點不變。
- 本轮只讀程式、package/lock、票與治理文件；只寫本日誌、自身票尾與 register 自身三列。DSG 仍 IN_PROGRESS；未把先前其他分支測試當 Beta 證據。
- 本樹 `node_modules`、`dist`、`scripts/beta`、`release/beta`、LICENSE、THIRD_PARTY_NOTICES.md 均不存在。沒有執行或借用別樹相依，也沒有預建 artifact 可以檢查。

## 核心結論

| 問題 | 唯讀結論 | 尚需實證 |
|---|---|---|
| Node-target 預建產物能否搬移？ | 現有 build-local 有 Node target 路徑，但本樹無產物；只能判定有可評估入口，不能判 portable PASS | producer build 後搬至乾淨中文/空白路徑，只安裝 runtime，不提供 source/config/開發 node_modules，啟動與 chunk/asset 全閉包驗證 |
| 是否可直接沿用原 `npm ci --omit=dev`？ | 不可直接交付此方式：現有 start 明確呼叫位於 devDependencies 的 vinext CLI | 選定 launcher 後，以實際 artifact 的 bare/dynamic imports、RSC/SSR runtime 與 peers 生成獨立 runtime manifest/lock，乾淨安裝驗證 |
| 下載者是否需要 build？ | 核准包明確不允許；缺產物／相依應安全失敗，不能 fallback 到 dev/build | setup/start 程式及乾淨 ZIP 行為測試 |
| 無 DSN 能否 setup/build/start？ | local Dexie 不需要 PG，但現有 CI/explicit-production policy 要 migration DSN；目前無免公司登入 Beta profile | 契約明確區分本機 Beta 與正式/CI migration gate，無假 DSN、無現用 env、禁止 server API 的 producer/start 測試 |
| 日常能否斷外網？ | 尚未驗；Google font 宣告與 build/runtime chunk 資源需追查 | 新 Browser profile、外網阻斷但 loopback 可用，進入/編輯/保存/重載/備份/CSV 真流程 |

## DEV_BTA_001：入口與安全前置

1. `app/lib/server/runtime-policy.ts:1` 僅 development/test/production/pilot；無獨立 Beta profile。未知值預設 production，auth 預設 disabled。`app/page.tsx:499` LoginGate 仍依 session / Demo / Pilot；無設定不是可直接進入編輯器的匿名本機入口。
2. `runtime-policy.ts:113` 在 `NETTOPO_RUNTIME_PROFILE=production` 或 `CI=true` 且缺 migration DSN 時拒絕。預設 production（變數未設）與 explicit production 的檢查有差異；不能以略去變數、關閉 CI 或補假 DSN 宣称已達成 Beta no-DB。具體例外必須由 DSG 明列，且不能削弱原正式 migration 規則。
3. `app/lib/topology-store.ts:20` / `app/page.tsx:109` 依 `NEXT_PUBLIC_TOPOLOGY_STORAGE` 選 server。這是 client build 輸入，不能只在解壓後 start 設 local，就假設能修正先前已建成 server 的 JS。producer 必須固定 local；runtime 設定衝突也需 fail closed。
4. 本機 Dexie DB 名 `nettopo-studio-db`，版本 1，customers/topologies/meta。保存不需要公司帳號或 PostgreSQL，但固定 scheme/host/port 與 Browser profile 是資料位置邊界；不得因 port 衝突無聲換 origin，或把 localhost/127.0.0.1、Chrome/Edge 當共享資料。
5. 現有 store `LOCAL_ADMIN_USER` 實為具名 engineer，page 顯示姓名/職稱並依角色控制操作。Beta 應使用契約定義的匿名 local 能力，不把它改成 server Boss 身分來解鎖功能；公開包不帶個人/公司預設身分。
6. 不只隱藏 UI：`/api/topology`、credentials/audit/session、dev/pilot session/identities、`/api/health/schema` 均需依契約統一 deny / safe projection。health/schema 現在會呼叫 createRuntimeSql，不能把它當 Beta readiness。被拒請求必須在 DB/business side effect 前停止。
7. CSV 匯出的 `readMaskedCredentialsForExport()` 仍有 credentials API fetch；Beta 應以本機 capability 明確使用 header-only/no-permission 路徑，不授予 credential API，五檔 contract 不變。local credential write 仍須明確不可用，不能退回 Project。
8. 現有 `scripts/preview-server.mjs:49` 直接以 request Host 建 URL，host/port 也可由 env 覆寫；這不是完整 Beta Host/Origin/Fetch Metadata 防護。loopback bind 是必要但不充分條件。具體 canonical origin、API allow/deny、safe error/status/security headers 交 DSG，不自行發明通用 auth bypass。

## DEV_BTA_002：可搬移 runtime 與離線前置

### 已存在的建置／啟動路線

- `scripts/build-local.mjs:5–11` 呼叫本樹 vinext build，設定 `NETTOPO_RUNTIME=node`；`vite.config.ts:52` 因此不載 Cloudflare plugin。這是 producer 候選入口，不是下載者 setup 命令。
- package 的 build/build:local/preview/start:local 會載 `.env.local`，部分另載 `.env`。Beta producer/setup/start 必須使用契約核准的封閉設定，不直接轉呼會讀現用 env 的 script。
- start/start:local 直接依賴 `node_modules/vinext/dist/cli.js`。既有 preview 另以相對 URL 載 `dist/server/index.js`、提供 `dist/client` 靜態資源。它提供可參考的路徑解析，但沒有包內 dependency closure、owned stop 與安全請求驗證的完整保證。
- 一般 build/validate-artifact 是 Bash/Sites Worker 流程：要求 default.fetch 與 dist/.openai/hosting.json；不能當 Node Beta artifact 的驗收器。
- Node build 仍會掛 `sites()` plugin（`build/sites-vite-plugin.ts`），將 hosting metadata/可選 drizzle 複製到 dist/.openai。Beta ZIP 必須採明確 allowlist，不能整個 dist 或 repo 直接壓縮，也不能帶入 hosting/migration metadata。

### 鎖定版本與 runtime closure

由本樹 lock 讀到 vinext 0.0.50、Vite 8.0.13、React/ReactDOM/react-server-dom-webpack 19.2.6、Next 16.2.6、Zod 4.4.3。vinext、vite、react-server-dom-webpack 在 lock 標 dev；vinext peer 包括 React/ReactDOM/RSC/Vite 及 plugins。**宣告中的 dev/prod 分類不是實際 server artifact imports 的替代證據。**

後續最小驗證順序（本輪未執行）：

1. DSG 選定 Node launcher/輸出契約；producer 在本樹自有乾淨依賴建 Node-target 產物，不使用其他樹 node_modules。
2. 記 server/client/chunks/public/fonts/manifest 的完整相對路徑與 hashes，查 bare imports、動態 imports、source-map/絕對路徑、需要的 runtime exports；缺項不刪到「看似能跑」。
3. 依選定 launcher 與實際閉包建立包內獨立 package.json/lock。若仍呼叫 vinext CLI，vinext 及所需 peers 不能只留 dev；若自有輕量 launcher 可避開 CLI，仍要證明 RSC/SSR/chunk/external imports 齊全，不能先宣稱只需 React。
4. setup 僅對包內 lock 安裝受控 runtime，首次可連網，不 build、不取 source、不安裝全域套件。需處理 npm lifecycle/native optional dependencies 與 Windows 架構，不能盲目全開或全關 scripts 後省略測試。
5. 將實際 ZIP 解到新的中文與空白路徑，切斷原 checkout 及其相依存取，驗 setup/start/stop。日常 start 不碰 npm/更新；缺依賴清楚拒絕；port conflict 不殺未知 process、不自動換 origin。stop 不只信 PID，須核本包 ownership，避免 PID reuse 誤殺。

`package.json` 宣告 Node >=22.13.0；這不是已驗所有較新 Node/Windows 的承諾。實際支援版本須由乾淨包 QA 具名固定；本輪未安裝或执行 Beta runtime。

`app/layout.tsx` 仍用 next/font/google 的 Geist/Geist_Mono。只有 source 宣告不能判定產物是自託管、外部 fallback 或缺字型；應在 producer artifact 確認本地 font/CSS（或核准系統字型策略），再跑新 Browser 的斷網驗收。dynamic import 的 Demo/SAMPLE chunk 也須做公開內容審查；demoSeed off 不等於敏感名稱不在 downloadable assets。

## DEV_BTA_003：文件／公開內容前置

- 本樹尚無 LICENSE / notices / Beta quick start / setup tools，README 仍含開發與 PostgreSQL 流程；不可直接當下載包說明。
- layout metadata、登入頁有公司識別，store 有具名本機 user；需在 DSG allowed hunks 中具名處理，不搬 root HR/Auth。公開範例須另造 synthetic，不將既有命名樣本默認匿名。
- 使用者指定 `Copyright (c) 2026 sean.hsieh`。實際第三方 notices 應按交付的 runtime/assets/license files 收集，不能只把所有套件寫成 MIT。lock metadata 已有 MIT 與 postgres 的 Unlicense 等差异，未檢查全部授權正文/素材權利，不能宣稱法律審查完成。
- 文件必須分「完整匿名備份」與「safe 分享」：safe 已移除欄位不能還原原值；两者都不含明文 credentials。資料位置固定、升級前手動備份、復原/不相容拒絕、已知限制與版本/hash須可查。
- feedback 本地模板只收版本、重現步驟、預期/實際與使用者確認過的匿名截圖；不自動上傳拓樸/log/env/組態。外部 Issues 不取代內部票庫。

## 最小風險與交接要求

DSG/PM scope check 需至少固定：獨立 Beta profile/capability 與禁止混用的 env；producer no-DSN 與原 migration gate 的安全分界；唯一 Node runtime entry 與 runtime manifest 位置；固定 origin / Host-Origin / server API deny；setup/start/stop ownership；offline fonts/assets；公開識別/範例替換路徑。若需要修改未列 allowed path（例如 Sites build plugin 或 artifact validator），先補精確 hunk 授權，不能為了打包擴整套架構。

產品寫入解除後順序仍 001 → 002 → 003；002 應先做最小可搬移 artifact proof，失敗就回報真正 blocker，不改成下載者重 build。整包固定 manifest 後才正式 QA；BTA-A01–12、保存/交換/secret/離線/停止/恢復均需本分支本候選的新證據。

## 唯讀證據與未驗

本輪只執行 Git read/status 與檔案讀取/hash；未執行 build/test/lint、安裝、Node server、Browser、DB、Docker、公司 API 或連網操作。未讀現用 env/DSN/秘密、未寫產品、未 stage/commit/push。無自建 runtime/temp resource，需要清理的資源為零。

收證工具一項更正：PowerShell 第一次解析 npm lock 因空字串 root key 不支援而失敗；改 `ConvertFrom-Json -AsHashtable` 後成功，未採用初次的 null 結果。一次 Git ls-files 顯示 fsmonitor IPC warning，後續使用 `-c core.fsmonitor=false` 唯讀查核；沒有修改 Git 設定或清理 lock。

代表檔案 raw SHA-256（不是 Release manifest）：

| Path | SHA-256 |
|---|---|
| package.json | `34cdaec6df180571d475890dbded85b627e2e9af3dc0b2fa2f55cce046c9dc5e` |
| package-lock.json | `4d30e1dff901bcf26e1bd06071f34a12d6cc5bc28ee52d142d877749dccaa8b8` |
| scripts/build-local.mjs | `9b1c73e8832d983d1117651d85095f6f040c66ed351f1be9ad6625ddfd942b04` |
| scripts/preview-server.mjs | `2731dd1a2d093682b4e03d55c3badd66c3dcd4d804902bd6d1f08b4d55e80abe` |
| app/lib/server/runtime-policy.ts | `838f57ced766bd6a2fa6ddb90b5d41771a05ea195e077228739bb42ffa91a54c` |

Disposition：DEV_BTA_001/002/003 保持 BLOCKED；preflight 完成不是產品 READY_FOR_QA。Next owner：DSG / PM。停止等待契約與 PM scope check；Git、Release、完整 NTM/AIL/HR/DB 均未啟動。

收尾唯讀再確認：代表五檔 source hash 5/5 不變、產品 tracked diff/index 空、register diff-check PASS。同期 DSG 已轉 WAITING_APPROVAL，新增契約與 QA 準備文件為其他 owner 工作，未修改或將其視為 DEV 開工授權；下一 gate 為 PM 契約/scope 核對，三張 DEV 仍 BLOCKED。
