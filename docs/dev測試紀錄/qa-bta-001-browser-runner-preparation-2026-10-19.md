# QA_BTA_001 isolated Browser runner preparation — 2026-10-19

Result: `QA TOOL PREPARATION PASS / REPAIRED PRODUCT NOT RUN`.

PM authorized an independent QA-owned Playwright path after Windows Computer Use refused control of an existing Chrome window whose URL could not be established. This preparation does not retry, attach to or read any existing Chrome/Edge window or user profile. DEV currently owns product repair; the runner was not executed against the variable product.

## Confirmed public seams

The runner uses only the approved packaged interfaces: fixed `http://127.0.0.1:4317`, a new persistent profile under the QA evidence root, visible UI roles/labels, Browser downloads, IndexedDB, and package-provided JSON/CSV files. Required phases are entry/security, four responsive widths, device/group/link CRUD and layout, reload persistence, injected IndexedDB failed-write zero mutation, full/safe JSON exchange, exact five-file CSV export/reimport, Preview new/merge/replace/cancel/warning handling, observed Browser-channel offline enforcement, and synthetic sentinel scans across DOM/console/network/IndexedDB/downloads.

External requests are recorded and aborted by Playwright routing. This is accurately reported as `observe-and-abort-non-loopback-not-os-firewall`; it is not an OS firewall or proof about unobserved processes/channels. The runner requires a synthetic non-loopback fetch to be observed and aborted while canonical loopback navigation succeeds. Its A08 ledger separately records page navigation, subresources, dedicated workers, service workers, WebSockets, Node launcher and Node server. Any channel not actually observed remains `NOT_RUN_UNOBSERVED`; Node launcher/server remain `NOT_RUN_REQUIRES_SEPARATE_PROCESS_NETWORK_FIXTURE` because Browser routing cannot observe their sockets.

## Isolated dependency

Owned directory: ignored `.local/qa-bta-001-20261019/tools/`.

- `@playwright/test` exact `1.62.1`.
- resolved closure: `playwright` `1.62.1`, `playwright-core` `1.62.1` (optional `fsevents` absent on Windows).
- official npm registry, own user/global npmrc, `ignore-scripts`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, no audit/fund/update notifier.
- first lock resolution inside the normal sandbox failed `ENOTFOUND`; identical authorized official-registry retry passed. `npm ci` added three packages. No browser download directory exists.
- runner imports Playwright only from the explicitly supplied isolated module path; it does not resolve through DEV workspace `node_modules`.

## Self-test

`node --check scripts/qa-bta/full-browser-runner.mjs`: PASS.

`node --test tests/qa-bta-001-full-browser-harness.test.mjs`: 4/4 PASS. These tests verify the required phase list, fixed loopback/new-owned-profile/channel policy, fail-closed option validation, and that no unobserved offline channel can be promoted to PASS. They are QA-tool tests, not product or Browser PASS.

Hashes:

- runner: `4f79041ae2f7fd410f758499c860bd8b9c01af7be16f6d89d1d28265f20b2089`
- runner test: `2854a399e777444a969f99f4f608b14cb25092ba5d1eb0184fa3c344b1282618`
- isolated package: `d81b3cfeca0c640c48921bed306d9433ba5ec49f43de4164885c24de75aa1a86`
- isolated lock: `d2ac4d5c97f287ca13314b7a5a4ea09f434f5b6616cbb6fa4d1d9c436b39576d`

Formal execution remains gated on a new DEV fixed packet, writer stop, renewed product/artifact hashes, and ordinary platform approval to launch installed Chrome/Edge headless processes. Any runner defect found before product assertions is QA-owned and must not be converted into a product failure; any explicit platform refusal stops that Browser path without fallback to a personal profile.
## 2026-10-19 PM depth-gap preparation

使用者恢復測試組接單後，PM 指派 QA 在等待 R3 fixed packet 期間補齊既有 R1.1 深度 phase 工具。此批只修改 QA-owned runner／tests／fixtures；未啟動 package、未測 mutable 產品、未修改產品碼或 DEV tests。

新增／更新：

- `scripts/qa-bta/browser-assertions.mjs`：獨立 canonical／safe projection、五檔 fixture envelope 檢查、sentinel per-sink scanner與positive-control、phase matrix完整性檢查。
- `scripts/qa-bta/full-browser-runner.mjs`：新增 `validateDeepBrowserPlan()`；沒有64位candidate SHA、DEV writer-stop、完整A04/A05/A06/A07/A09/A10 matrix或六類fixtures即fail closed。
- `tests/qa-bta-001-browser-assertions.test.mjs`：深度工具自測。
- `tests/fixtures/qa-bta-001/formal-browser-matrix.json`：逐phase steps／expected truth／evidence／stop conditions。
- `canonical-project.json`、`legacy-project.json`、`future-project.json`、`warning-import.md`。
- `blocking-v2/`：跨資料關聯阻擋用canonical五檔CSV。
- `sentinel-v2/`：QA-only惡意masked credential輸入，四類synthetic sentinel只允許存在於owned input fixture。

TDD證據：首輪因缺 `browser-assertions.mjs` 產生 `ERR_MODULE_NOT_FOUND`；第二輪因缺 `assertFiveFileFixture` export失敗；第三輪因缺 `validateDeepBrowserPlan` export失敗。逐slice補最小實作後：

```text
node --test tests/qa-bta-001-browser-assertions.test.mjs tests/qa-bta-001-full-browser-harness.test.mjs
11 tests / 11 pass / 0 fail
node --check scripts/qa-bta/browser-assertions.mjs
PASS
node --check scripts/qa-bta/full-browser-runner.mjs
PASS
git diff --check -- <本批QA paths>
PASS
```

主要固定hash：

- browser assertions：`89a91b5e9179a7dd88386f2efa9225e42ac349130bae74c155e9221f52c88714`
- full Browser runner：`d96cfdabacbc61b9d018d81dc23d678b17ed65758f73c2c7fd74d0bd7e68eeb9`
- assertions test：`0a65051da7aac7df0e12ce42be39dbde1734e951faf9b4f7c5c8e62109b590ef`
- formal matrix：`bacd9d98097eb212d7672683c3510184f0bf3d121c043cc361c1aea75086fc9b`
- canonical project：`0538e94fb38e7cef7a1e01966a7bd3539075deacf4d829857346624ea53e05c0`

R3依賴仍明確保留：正式 Browser edit/delete selector、package stop/start後同owned profile重開、Preview實際文案／disabled狀態及下載內容，只能在DEV writer-stop並交固定R3 SHA/manifest後執行與校準；本次工具自測不是產品PASS。A08未觀測channels仍維持PARTIAL／NOT RUN，不因本批補強改判。

## Group CRUD approved-semantics preparation

使用者已裁定刪除容器時保留設備與連線、只解除目標成員 `groupId` 成為未分類。DEV 為唯一產品 writer；QA 未對可變產品執行正式測試，只固定獨立 expected truth。

- 新增 `tests/fixtures/qa-bta-001/group-crud-cases.json`：空組、非空折疊組、跨組連線、其他組及未分類設備，並提供獨立 edit/delete expected snapshots。
- 新增 `tests/qa-bta-001-group-semantics.test.mjs`。
- `browser-assertions.mjs` 新增 group edit/delete transition 與 zero-mutation assertions。Edit只允許name/kind/color，保留id/collapsed/membership；delete只移除目標Group並清除其成員groupId，保留所有設備／連線／端點／座標／欄位與其他組。
- Cancel、storage failure、readonly rejection共用exact zero-mutation assertion；正式Browser仍須分別觸發，不以pure helper代PASS。

TDD首輪因helper exports不存在而RED；最終 explicit QA tools `17/17 PASS`、syntax PASS、scoped diff-check PASS。Hashes：assertions `c81433ea316b8cf7e7e28ae904a93810e8556bae303fc3f9da303659c18bd645`；group test `bf4304b0ba6c9f79f6ec3cd667373c10be1824e4deb5602ef511e292957b19ae`；fixture `6ca70cbbeaa2cf1814b7be816fa62b28f40f78fd18bee040d89c6239aa8cc6b4`。

候選影響圖：`app/page.tsx` group handlers/list/modal與可能的純group helper會直接使A04、A05持久化／failed-write、A06輸出還原與A09 sink證據失效，必須在新fixed packet重跑；若`app/globals.css`改動，Chrome/Edge 360/768/1024/1280也必重跑。A07/A10僅在import paths/hash未變且dependency manifest證明無影響時才可逐項引用R3，否則重跑。A08保持平台BLOCKED。

DSG 後續交付正式驗收 oracle：`LOCAL-FEEDBACK-BETA-V1 R1.1 §12` raw SHA-256 `69e3e5aa31d831a143fbd1999451a857d2e15d5bc038ef6d17b19e96e3222f1d`。QA 依此再補 raw array order 精確保留與 missing-target fail-closed；新增一個預期RED（舊helper錯誤接受missing target），修正後整組QA tools `18/18 PASS`。最新版hash：assertions `f94547be982798e05b08781326948cd3631380b92f074915889a89ae4f0f9f12`；group test `012aa4c3b0e5aa00cc390714b2eda0177cae04576405113ddb707b53abbefd65`；fixture仍 `6ca70cbbeaa2cf1814b7be816fa62b28f40f78fd18bee040d89c6239aa8cc6b4`。先前17/17及舊hash保留為準備歷史，不作新packet正式runner版本。

新packet Browser oracle另需直接驗證確認文案包含affected count；Cancel、missing target、readonly與injected persistence failure各自零寫入且無false success；save/reload/export/restore與雙Browser四寬度。這些仍為正式產品NOT RUN，不能用pure helper代簽。

R4 metadata 接收規則：正式 fixed packet 時獨立重算並交叉核對 `(1)` R1.1 §12 contract path/revision/raw SHA `69e3e5aa31d831a143fbd1999451a857d2e15d5bc038ef6d17b19e96e3222f1d`、`(2)` handoff packet自身SHA與其中的contract/source/ZIP identities、`(3)`完整source manifest與sourceDrift、`(4)`ZIP外部SHA與package artifact manifest。契約是非runtime治理來源，不要求正文進ZIP或因此改producer；但packet必須明列其identity。任一identity漂移、缺欄或無法鏈結就停止正式QA並請DEV／PM釐清。產品group helper及runtime dependencies仍需包含於source closure，不得以contract非runtime為由排除。


