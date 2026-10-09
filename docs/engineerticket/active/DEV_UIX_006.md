# DEV_UIX_006 — Inspector 切換設備／連線資料同步

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | QA_PASSED |
| Planned Order | 070 |
| Change Type | CORRECT |
| Owner | 開發組 |
| QA | QA_UIX_002 |

## Requirement Traceability

| Gate | 內容 |
|---|---|
| User Intent | 點擊設備或連線後，Inspector 必須立即顯示該筆資料，不殘留前一筆欄位值 |
| Historical Sources | DSG_UIX_001、DEV_UIX_001、QA_PIL_003；2026-09-08 使用者截圖回報 |
| Approved Decisions | PM_GOV_001-D11/D12/D13/D25/D31 |
| Affected Layers | `app/page.tsx` selection、DeviceInspector/LinkInspector、DEV regression |
| Preserved Invariants | React Flow controlled view；表單只在提交後經 Zustand 寫入；credential boundary 不變 |
| Conflict Check | 不重用已完成的 DEV_UIX_004；該票處理登入者浮層遮擋，不是表單 remount |
| Regression Map | device list、canvas node、link list、edge selection、save/delete、read-only role |
| No-path | 若需改 Device/Link schema、Dexie 或 API，停止回 PM |

## Scope and Acceptance

- 確認 `defaultValue` 未受控表單在 selection ID 改變時未 remount 的根因。
- 以最小 remount key 或等價 state reset 修正；不得把未提交欄位自動寫回前一筆。
- 設備 A→B→A、設備→連線→設備時，名稱、類型、IP、群組、port、speed 均對應選取資料。
- 儲存只更新目前選取 ID；快速切換不得交叉寫入。
- Allowed：`app/page.tsx` Inspector/field hunk、DEV-owned test、開發紀錄。禁止 schema/package/credential/API/RBAC 改動。

## DEV Implementation 2026-09-08

- `app/page.tsx`：在 selected `DeviceInspector` / `LinkInspector` render 上加入以 entity id 為基準的 React `key`，使 uncontrolled `defaultValue` 表單在同類物件切換時 remount。
- 保留 `onSave={(data) => updateDevice(selectedDevice.id, data)}` / `updateLink(selectedLink.id, data)` 的明確儲存語意；未提交欄位不會因切換選取自動寫回。
- `tests/dev-uix-006-inspector-remount.test.mjs`：新增 DEV focused regression，覆蓋 remount key、current selected id save target、無 autosave。

驗證：

- `node --test tests/dev-uix-006-inspector-remount.test.mjs`：PASS，3/3。
- `node --test tests/dev-uix-006-inspector-remount.test.mjs tests/dev-pil-002-topology-site.test.mjs tests/pilot-checkpoint.test.mjs`：PASS，17/17。
- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：PASS。
- `node_modules\.bin\eslint.cmd app\page.tsx tests\dev-uix-006-inspector-remount.test.mjs`：PASS。
- `npm.cmd run build:local`：PASS；僅既有 chunk size / route classification warning。

交付狀態：`QA_PASSED`；`QA_UIX_002` 已完成真 Browser 切換、儲存、reload 與 credential boundary 驗收。

## Checkpoint Preparation — 2026-10-02

狀態維持 `QA_PASSED`。本票已拆為順序 patch `001-dev-uix-006.patch`，只包含 Inspector remount product hunk、DEV test、票面與開發紀錄；已由 base 重建並獨立通過 hash／focused tests。完整 manifest 與排除範圍見 [checkpoint 準備紀錄](../../dev開發紀錄/2026-10-02-uix-006-008-checkpoint.md)。未 stage／commit／push／merge。
