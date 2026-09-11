# DEV_UIX_006 — Inspector 切換設備／連線資料同步

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | READY |
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

