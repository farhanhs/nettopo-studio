# DEV_PIL_002 — 修正新增拓樸站點空清單阻擋

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | PIL |
| Priority | P1 |
| Status | PROPOSED |
| Planned Order | 034 |
| Checkpoint | Functional UAT |
| Owner | 開發組 |
| Created | 2026-08-31 |
| Updated | 2026-08-31 |

## Objective

修正工程師在本機 demo／功能 UAT 中新增拓樸時，因「所屬站點」下拉選單沒有任何資料卻被 `required` 擋住，導致無法建立拓樸的問題。

預期本機 demo／browser-local 或非 Pilot 的開發測試情境，站點欄位沒有可選資料時，可用「未指定」作為安全預設，讓使用者完成新增拓樸。

## Approved Decisions

- `PM_GOV_001-D03`：先驗證 Internal Pilot，正式 RBAC 延後。
- `PM_GOV_001-D04`：只用 synthetic data，不使用正式 credential。
- `PM_GOV_001-D11/D12/D13`：依追溯基線與架構邊界建立最小修復。
- `PM_GOV_001-D25`：先處理工程師實務工作流 UAT 發現的功能缺陷。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 新增拓樸流程不應因測試資料庫缺站點資料而卡死；沒有站點時使用「未指定」完成本機 demo／功能測試 |
| Historical Sources | `QA_PIL_003` UAT、使用者 2026-08-31 截圖、`app/page.tsx` 的 `SiteField required`、`topology-store.ts` 的 optional `siteId`、Pilot site boundary 決策 |
| Change Type | `CORRECT`：修正 UI/form 對空站點清單的阻擋，不改正式 Pilot site scope 語意 |
| Affected Layers | UI form、State action input、server/local topology creation behavior、QA fixture |
| Preserved Invariants | Pilot／production 仍不得默默跨站；正式 RBAC 不放寬；credential boundary 不變；不修改 migration SQL |
| Conflict Check | `PM_GOV_001-D20/D21` 要求 Pilot 必須有明確 site scope；本票只能讓本機 demo／非 Pilot 空站點時以 `siteId` 空值呈現「未指定」，不得讓 Pilot 繞過 site binding |
| Regression Map | 新增拓樸 modal、空 sites 清單、已有 sites 清單、Pilot site scope、reload persistence、QA_PIL_003 主流程 |
| Rollback／No-path | 若 server/Pilot 權限要求無法容許未指定站點，需停回 PM 裁定，不得把 Pilot site scope 改成 optional |

## Current Evidence

- 截圖：`C:\Users\DUS\Pictures\Screenshots\螢幕擷取畫面 2026-08-31 101557.png`
- `app/page.tsx`：
  - `SiteField` 使用 `<select name="siteId" ... required>`。
  - 若 `availableSites` 為空，select 沒有 option，表單無法 submit。
  - `addTopology()` 目前送出 `clean(data.get("siteId")) || activeTopology?.siteId`。
- `app/lib/topology-store.ts`：
  - IndexedDB/local path 建立 topology 時未強制 `siteId`，可保留未指定。
- `db/topology-postgres.ts`：
  - Pilot context 會強制使用 `pilotSiteId()`。
  - 非 Pilot server createTopology 目前缺 `siteId` 會 throw `siteId is required.`。

## In Scope

- 讓 `SiteField` 在 `sites.length === 0` 時顯示「未指定」選項，且不因 `required` 阻擋本機 demo／允許未指定的情境。
- 新增拓樸送出時，空白站點應保留為 `undefined`，UI 顯示為「未指定站點」。
- 若 server mode 在 development/demo 中仍需支援未指定拓樸，必須以最小、明確 profile gate 處理；Pilot／production 不得放寬。
- 補測：
  - 空 `sites` 時可建立拓樸。
  - 有 `sites` 時仍預選目前站點或第一個可編輯站點。
  - Pilot site binding 不被空白站點繞過。

## Out of Scope

- 正式 Customer／Site 管理設計。
- 正式 OIDC／完整 RBAC。
- migration/schema 變更。
- 更動 QA_PIL_003 既有失敗結論。
- 匯入／匯出 CSV contract。

## Acceptance Criteria

- [ ] 空站點清單時，「新增拓樸」modal 顯示可理解的「未指定」選項。
- [ ] 空站點清單時，使用者可建立拓樸，且拓樸顯示為「未指定站點」。
- [ ] 有站點資料時，既有站點選擇行為不退步。
- [ ] Pilot profile 仍需明確 Pilot site scope，不得靠空白站點繞過。
- [ ] QA fixture 可建立 synthetic site/customer/topology，並能覆蓋空站點與有站點兩種情境。
- [ ] Browser UAT 可從建立拓樸繼續到匯入、畫布與儲存流程。

## Stop Conditions

- 修正需要放寬 Pilot／production site scope。
- 修正需要修改 migration 或 DB schema。
- 修正會讓站長／工程師跨站建立或讀寫拓樸。

## Handoff

待 PM 核准後交開發組實作；完成後交 `QA_PIL_004` 重驗。
