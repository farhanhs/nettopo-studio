# QA_BTA_001 executable harness preparation — 2026-10-19

## Result and boundary

Result: `QA TOOL PREPARATION PASS / PRODUCT NOT RUN`.

Branch／base為`codex/public-beta-0.1`／`b5c53916cbda6f8bcd2f42f9d9772ef181c1adee`。DEV_BTA_001仍持有產品writer；本輪只新增QA-owned scripts/tests/fixtures，未讀取或執行可變產品、未啟正式ZIP/server/Browser，BTA-A01–12均維持`NOT_RUN`。未讀現用env/DSN、未啟DB/Docker、未全域安裝、未借其他checkout dependencies。

工作樹在DEV開發期間出現`node_modules`；QA沒有用它執行此批或寫入它。正式Browser dependency若需要，須等DEV協調或使用QA具名隔離依賴目錄，不能以開發checkout相依證明portable package。

## Prepared executable seams

- `scripts/qa-bta/harness.mjs`：canonical path／Windows case-fold collision／NFC／reserved name／symlink/reparse拒絕；manifest/file digest；safe child env；offline URL與sentinel scan；owned cleanup；ZIP inspection/extraction；extracted payload/lock/SHA closure；setup/start/stop command seam。
- `scripts/qa-bta/list-zip.ps1`：使用Windows內建.NET只列ZIP metadata，供Node在解壓前驗證；不自行決定產品PASS。
- `scripts/qa-bta/package-runner.mjs`：固定ZIP外部hash、validated extraction與package preflight evidence；正式包到達前未執行。
- `scripts/qa-bta/browser-runner.mjs`：固定`127.0.0.1:4317`、Chrome/Edge fresh persistent context、local Beta banner、無公司/Demo登入、viewport/overflow、network/console/DOM/IndexedDB/sentinel evidence與context cleanup；目前只驗pure evidence classifier，正式產品Browser未執行。
- `tests/fixtures/qa-bta-001/browser-contract.json`與`test-selection.json`：固定channel/viewports/entry、`data-local-beta=true` banner selector、status/shutdown paths、control header與正向test/stage allowlist，明確禁止test glob、current env/DB/Docker/global install。

## Self-test history

1. 首跑`7/8`：合成ZIP由`CreateFromDirectory`產生Windows反斜線member，harness依R1.1正確拒絕；fixture改用逐entry canonical `/`，不放寬驗證。
2. 次跑`3/4`／合併`7/8`：Windows PowerShell 5未載入`System.IO.Compression`而找不到`ZipArchiveMode`；QA fixture顯式載入內建assembly。
3. ZIP/core重驗`8/8 PASS`。
4. 加Browser evidence核心後`10/10 PASS`。
5. 加extracted payload/lock/SHA closure及tamper拒絕後`11/11 PASS`。
6. 加safe-env runtime setup/stop command seam與正向selection guard後，最終精確allowlist`15/15 PASS`，0 fail／0 skip。
7. 依DEV尚未形成正式交接的介面協調資訊，收緊setup/stop stdout為唯一單行JSON、stderr必須空、僅允許`code/message/origin`欄位、`BTA_*` code及固定`http://127.0.0.1:4317` origin；同時固定Browser banner selector與control paths/header。重跑syntax與精確allowlist仍為`15/15 PASS`。此步只驗QA runner契約，未讀取或測試可變產品。

所有temp均由`mkdtemp`取得具名前綴，finally只刪該owned目錄；末端存在檢查為false。這是QA工具自測，不是DEV產品／Browser／portable package PASS。

## QA tool hashes

- `list-zip.ps1`：`1e57fbf3d9677010843b5deff64f0b4a9cf58ecd48767195b812062bed5af614`
- `harness.mjs`：`f942861aca05d3ae9c27dc41d03ae1ebfacc0d322d5da30a1c416a06f052e1e3`
- `package-runner.mjs`：`de39620d97f2a70d3245d7b82884e80c0934ab4c62ed4f32b55de902bcb5cb63`
- `browser-runner.mjs`：`02a1b670c803b9f932129fa4e8fe18a4aab7d69d1e9d41866db623ff46d988f2`
- `qa-bta-001-harness.test.mjs`：`dd7c2023c5d11239bd8bab1785e66fc084b18951ae9edce58927a292e3b460be`
- `qa-bta-001-browser-harness.test.mjs`：`dbcaceb2ca6c7e23cf14854d9bfe010ee97cb5ae509a64f46bc28afdbb423451`
- `qa-bta-001-selection.test.mjs`：`bb7617050735ed3798f8213ace898b75165089e13e03b8c7068120e6896024f0`
- `browser-contract.json`：`7eb5db7d5d5169bd35d860ef52746d2385bf2ab64862dcb3bcb0f0ee963f0660`
- `test-selection.json`：`9feef5a5d2c4d52f6c06cf411a3636a55ec2a821ba88ec27997428059d84d934`

## Formal entry still blocked

正式QA仍須同時取得DEV_BTA_001–003 `READY_FOR_QA`、產品writer stop、固定source/tool/dependency manifest、固定ZIP及外部SHA-256。收到packet後先驗dirty dependency closure與上述QA tool hashes，再轉`IN_QA`；不沿用main或DEV自測PASS。
