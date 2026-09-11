# QA_PIL_004 — 新增拓樸站點資料與未指定站點 UAT

| 欄位 | 結果 |
|---|---|
| Ticket | `QA_PIL_004` |
| Date | 2026-09-04 |
| Tester | 測試組 / Codex |
| Result | `QA_PASSED` |
| Workspace | `C:\Users\DUS\Desktop\project\nettopo-studio` |
| Branch | `dustool` |

## 結論

`DEV_PIL_002` 的新增拓樸站點修正通過本票核心驗收。2026-09-08 依 PM scope review return 補強後，最終結果維持 `QA_PASSED`：browser-local 在站點清單為空時可顯示「未指定」、可建立拓樸、持久化為 `siteId: undefined`，reload 後仍顯示「未指定站點」，且不產生 `unspecified` / `none` / `local` / `default-site` 等 fake site id。

Pilot/server 權限邊界沒有放寬：已由 targeted guard 驗證 server/Pilot empty-site fail-closed、`addTopology()` 不再繼承 active topology site、Pilot checkpoint 不退步。2026-09-08 已修正 QA-owned `QA_PIL_003` supporting UAT selector，從舊的 visible glyph `×` 改為產品 accessibility 的 accessible name `關閉`；完整 supporting Pilot UAT 已走完 export、round-trip、secret scan、logout/tamper、cleanup=0。

## 新增 / 使用測試腳本

- 新增：`tests/qa-pil-004-topology-site-uat.mjs`
  - QA-only browser UAT。
  - 自動 build local artifact。
  - 啟動 loopback preview：`http://127.0.0.1:4404/`。
  - 使用 Playwright Chromium 操作本機 Demo。
  - 使用 ephemeral browser context；不建立 persistent PostgreSQL fixture。
  - 驗證 IndexedDB snapshot。
- 使用：`tests/dev-pil-002-topology-site.test.mjs`
  - 驗證 source/store/policy guard。
- 使用：`tests/pilot-checkpoint.test.mjs`
  - 驗證 Pilot/runtime/security checkpoint 不退步。
- Supporting run：`tests/qa-pil-003-engineer-uat.mjs`
  - 真 PostgreSQL Pilot fixture + browser flow。
  - 用於補充有站點資料與 cleanup evidence；最終停於非本票 selector timeout，詳見下方 caveat。

## Browser UAT 證據

Summary：

- `docs/dev測試紀錄/qa-pil-004-topology-site-summary.json`

Screenshots：

- `docs/dev測試紀錄/screenshots/qa-pil-004-local-empty-initial.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-360x520.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-768x720.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-1280x850.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-short-height-720x420.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-long-text-360x520.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-responsive-device-scale-2-360x520.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-created-unspecified-topology.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-device-persist-before-reload.png`
- `docs/dev測試紀錄/screenshots/qa-pil-004-reload-persisted-unspecified.png`

Browser UAT summary 重點：

| 項目 | 實測結果 |
|---|---|
| Mode | browser-local / Playwright Chromium / loopback preview |
| RuntimePolicy | `development` / `demo` / demoAuth=true / devIdentityOverride=false / demoSeed=false |
| Empty site option | `未指定` |
| Site select disabled | false |
| Site select required | false |
| Created topology | `QA PIL 004 未指定拓樸 ...` |
| Rendered site label | `未指定站點` |
| IndexedDB created `siteId` | `null` in JSON summary, representing persisted `undefined` |
| Fake site id detected | false |
| Device edit persistence | true after reload |
| 360px scrollWidth | 360 |
| 360px modalWidth | 344 |
| Modal layout | single column |
| Footer reachable | true |

2026-09-08 responsive review補強：

| Scenario | scrollWidth | modalWidth | grid | footer reachable | keyboard focus/action | overflow |
|---|---:|---:|---|---|---|---|
| 360x520 | 360 | 344 | 1 column | Pass | close/input/site/copy/cancel/submit reachable | none |
| 768x720 | 768 | 744 | 2 columns | Pass | close/input/site/copy/cancel/submit reachable | none |
| 1280x850 | 1280 | 920 | 2 columns | Pass | close/input/site/copy/cancel/submit reachable | none |
| 720x420 short height | 720 | 704 | 1 column | Pass | close/input/site/copy/cancel/submit reachable | none |
| 360x520 long text stress | 360 | 344 | 1 column | Pass | close/input/site/copy/cancel/submit reachable | none |
| 360x520 deviceScaleFactor=2 | 360 | 344 | 1 column | Pass | close/input/site/copy/cancel/submit reachable | none |

200% zoom method：使用 Playwright `deviceScaleFactor=2` 的獨立 browser context，模擬 200% display scaling，不修改產品碼。長文字 method：在 QA-only script 內對已開啟的 modal 注入超長站點/錯誤提示文字到 DOM 作 stress measurement；產品碼未修改。

Candidate file SHA256 before re-test：

| File | SHA256 |
|---|---|
| `app/page.tsx` | `1E8B2F74F094EF969B46D77399A82905D56CD460B90B280DA7EE25B97DAEDF3D` |
| `app/globals.css` | `1D874F787CEA7BF22C8E70DB876D3AC0D9D2863B1E4506DB473BDD00AF4A0BBF` |
| `app/lib/topology-store.ts` | `8A5D2B7BCA304683AE484E7F5D05165AFD2ACF64541C4C477A8B133F755A0003` |
| `docs/engineerticket/active/DEV_PIL_002.md` | `6968520D36AED6A8DDC36628AD5FEA96AABE265261FBF34C8F91E190EBC9AFDA` |

Network evidence：

- `/api/runtime-capabilities` returned 200 with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- `/api/dev/session` returned 200 for local Demo login.
- Reload restore first observed `/api/session` 503 in local mode without runtime DB, then `/api/dev/session` 200 fallback. This is outside the `DEV_PIL_002` site field fix and did not affect local browser flow.

## Pilot / PostgreSQL supporting evidence

本機 PostgreSQL 初次不在 listening 狀態：

- `tests/qa-pil-003-engineer-uat.mjs` first run stopped at `connect ECONNREFUSED 127.0.0.1:5432`.
- Ran `npm.cmd run db:local:start`; PostgreSQL then accepted connections on `127.0.0.1:5432`.

Second supporting run reached browser flow and produced:

- `docs/dev測試紀錄/qa-pil-004-supporting-pilot-uat-summary.json`

Relevant supporting results after 2026-09-08 selector sync:

| 項目 | 結果 |
|---|---|
| Unauth protected topology | 401 |
| Engineer Pilot login | 200 |
| Cookie attributes | `__Host-nettopo-pilot-session`, `Path=/`, `Max-Age=21600`, HttpOnly, Secure, SameSite=Strict |
| Pilot dataset sites visible to Engineer | only Pilot site |
| Synthetic create DB snapshot | sites=2, users=3, customers=2, topologies=3, credentials=0, audit_logs=3 |
| TXT preview masked credential | true |
| TXT cancel zero-write | true |
| MD preview | true |
| CSV applied counts | devices=3, links=3, groups=1 |
| Engineer credential write | 403 |
| Engineer audit read | 403 |
| Canvas route evidence | 3 wired orthogonal resolved, 1 wireless resolved |
| Reload persistence | devices=3, links=4, groups=1; moved router persisted |
| Safe ZIP export | fixed five files |
| Secret scan | PASS |
| Formula neutralization | PASS |
| Safe canonical round-trip equality | PASS |
| Logout / tampered cookie | 401 / 401 |
| Cleanup | sites=0, users=0, customers=0, topologies=0, credentials=0, audit_logs=0 |

Caveat resolved：

- 2026-09-04 supporting UAT had stopped at export modal close selector timeout because QA script still used `name: "×"` after the product accessible name was corrected to `關閉`.
- 2026-09-08 updated only the QA-owned selector to `getByRole("button", { name: "關閉" })`; product accessibility was not changed back.
- Full supporting UAT now passes.

## 驗收矩陣

| Criteria | Result | Evidence |
|---|---:|---|
| QA fixture 建立 synthetic site/user/customer/topology 前置資料 | Pass with supporting evidence | `qa-pil-004-supporting-pilot-uat-summary.json` afterSeed / afterSyntheticCreate |
| 空站點清單時新增拓樸可完成，顯示「未指定站點」 | Pass | `qa-pil-004-topology-site-summary.json`, screenshots |
| 空站點建立後保存為 undefined，不寫 fake site id | Pass | IndexedDB snapshot in QA_PIL_004 summary |
| 有站點清單時新增拓樸可用 Pilot site scope 建立 | Pass with supporting evidence | `QA_PIL_003` supporting run create customer/topology 200 + dataset only Pilot site |
| `addTopology` 不繼承 active topology site | Pass | `tests/dev-pil-002-topology-site.test.mjs` |
| Pilot/server empty-site 不可 UI/payload bypass | Pass | `tests/dev-pil-002-topology-site.test.mjs`, `tests/pilot-checkpoint.test.mjs` |
| Responsive 360px / short viewport | Pass | `qa-pil-004-responsive-unspecified-modal.png`, summary measurements |
| Browser main flow create topology → canvas/save/reload | Pass | QA_PIL_004 device persisted after reload |
| PostgreSQL fixture cleanup=0 | Pass with supporting evidence | `QA_PIL_003` supporting run cleanup all zero |

## Commands

```text
node --check tests\qa-pil-004-topology-site-uat.mjs
PASS

node --test tests\dev-pil-002-topology-site.test.mjs tests\pilot-checkpoint.test.mjs
PASS — 14/14

node tests\qa-pil-004-topology-site-uat.mjs
PASS — 2026-09-08 re-run summary docs\dev測試紀錄\qa-pil-004-topology-site-summary.json

node node_modules\typescript\bin\tsc --noEmit --pretty false
PASS

node_modules\.bin\eslint.cmd app\page.tsx app\lib\topology-store.ts tests\dev-pil-002-topology-site.test.mjs tests\qa-pil-004-topology-site-uat.mjs
PASS

git diff --check
PASS — only existing CRLF warnings
```

Supporting commands:

```text
node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-003-engineer-uat.mjs
2026-09-04 first supporting run: environment blocked by local PostgreSQL ECONNREFUSED 127.0.0.1:5432

npm.cmd run db:local:start
PASS — PostgreSQL accepting connections on 127.0.0.1:5432

node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-003-engineer-uat.mjs
2026-09-04 supporting partial — reached Pilot browser/DB flow and cleanup=0; final stopped at export modal close selector timeout

node --env-file-if-exists=.env.local --env-file-if-exists=.env tests\qa-pil-003-engineer-uat.mjs
2026-09-08 supporting re-run PASS — export/round-trip/secret scan/logout/tamper/cleanup=0
```

## 風險 / 未覆蓋

- `QA_PIL_004` local with-sites scenario cannot be represented in current browser-local Dexie durable schema because local DB only contains `customers`, `topologies`, `meta`; `sites=[]` is returned by local store. This is why with-sites behavior is validated through Pilot supporting evidence and targeted guard, not by injecting fake local `sites` storage.
- The previous `QA_PIL_003` selector/sync issue is resolved in QA-owned test code for this review; product accessibility remains `關閉`.
- Full npm lint was not rerun because project has a known Windows `bash` script blocker; scoped ESLint passed.

## Final Recommendation

建議 `QA_PIL_004` 可標記為 `QA_PASSED`。`DEV_PIL_002` 可進入下一個 checkpoint；不需要因本票退回開發組。
