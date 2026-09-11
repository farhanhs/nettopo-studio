# DEV_UIX_003 — 改善連線無效告警原因

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 036 |
| Checkpoint | Functional UAT |
| Owner | 開發組 |
| Created | 2026-08-31 |
| Updated | 2026-08-31 |

## Objective

修改「連線無效」告警訊息，讓使用者知道 spine-leaf 示範拓樸或手動建立連線被拒絕的具體原因，而不是只看到泛用錯誤。

## Approved Decisions

- `PM_GOV_001-D09/D10`：wired link 使用直角避障、最近邊 anchor 與必要 offset。
- `PM_GOV_001-D11/D12/D13`：依追溯基線與架構邊界建立最小修復。
- `PM_GOV_001-D25`：優先處理工程師 UAT 發現的功能可用性問題。

## Requirement Traceability

| 欄位 | 內容 |
|---|---|
| User Intent | 使用者看到 spine-leaf demo 的線路無效時，要知道是缺介面、重複端點、端口被占用、同設備自連，還是避障路由找不到安全路徑 |
| Historical Sources | `DEV_UIX_002`、`QA_UIX_001`、`QA_PIL_003`、`app/page.tsx validateLink()`、`topology-routing.ts` no-path route status |
| Change Type | `CORRECT`：改善既有 validation/routing warning 可理解性，不改 link schema |
| Affected Layers | UI validation message、Link Inspector、Canvas route warning label、QA Browser UAT |
| Preserved Invariants | 不放寬實體介面唯一性；不讓 wired link 穿越非端點設備；wireless 仍是 dashed direct/soft route 例外；route/anchor/lane 不寫入 domain |
| Conflict Check | 若 spine-leaf demo 因 fixture port 命名重複而觸發無效，應修 fixture 或訊息，不得移除端口唯一性規則 |
| Regression Map | addLink、updateLink、duplicate endpoint、occupied port、missing port、self-link、route no-path、spine-leaf demo import/layout |
| Rollback／No-path | 若告警原因需要改 link domain schema 才能表示，先回 DSG/PM，不得在 UI ticket 偷改 schema |

## Current Invalid Link Conditions

目前 `app/page.tsx` 的 `validateLink(project, link, ignoreId?)` 條件如下：

1. `from` 或 `to` 缺失，或來源與目的為同一台設備：
   - 回「請選擇兩台不同設備。」
2. `kind !== "wired"`：
   - 不做實體 port validation。
3. wired link 的 `fromPort` 或 `toPort` 空白：
   - 回「實體有線連線需要填寫來源與目的介面。」
4. 已存在相同兩端設備與介面的有線連線：
   - 回「已有相同兩端設備與介面的連線；連線視為雙向，不需要建立反向重複連線。」
5. 任一端點 `deviceId:port` 已被其他 wired link 使用：
   - 回「其中一個設備介面已被其他實體連線使用；同一個實體介面不能接到兩條線。」

Canvas route 另有 `route.status === "unresolved-no-path"`：

- 目前 label 只顯示「路徑受阻，請調整設備位置」。
- 未說明受阻線段、可能碰到的設備、或應調整哪一端。

## Suspected Spine-leaf Demo Failure Modes

需由開發組實測確認：

- 多條 spine ↔ leaf link 是否使用了相同 port 名稱，導致同一實體介面被占用。
- 匯入 fixture 是否缺 `fromPort`／`toPort`。
- route no-path 是否因 spine/leaf/server 排列太密，使避障演算法找不到安全 corridor。
- 告警是否來自 validation notice，而不是 route warning label。

## In Scope

- 將 `validateLink()` 的錯誤回傳改為可定位原因的 typed result 或至少包含：
  - 來源設備名稱
  - 目的設備名稱
  - 衝突 port
  - 已占用該 port 的既有連線
  - 建議修正方式
- Link Inspector／新增連線表單顯示具體原因。
- Canvas route no-path label 或 tooltip 顯示較清楚的原因與操作建議。
- 補測 spine-leaf demo 的連線有效性與錯誤訊息可讀性。

## Out of Scope

- 放寬同一實體介面只能接一條 wired link 的規則。
- 修改 durable Link schema。
- 重新設計 spine-leaf layout 演算法。
- 改變 wireless link 例外規則。
- 修改 import/export CSV v2 contract。

## Acceptance Criteria

- [ ] 缺來源／目的設備時，告警指出缺哪一端。
- [ ] wired link 缺 port 時，告警指出來源或目的哪個介面未填。
- [ ] 重複反向連線時，告警顯示已存在的連線名稱／兩端 port。
- [ ] port 被占用時，告警顯示被哪一條既有連線占用。
- [ ] route no-path 時，Canvas label 或 tooltip 告知是「避障找不到安全路徑」，並建議移動哪些設備或拉開間距。
- [ ] spine-leaf demo 若連線資料有效，不應顯示 validation invalid；若資料無效，訊息要能讓使用者修正。
- [ ] `QA_UIX_001` routing invariant 不退步。

## Handoff

待 PM 核准後交開發組實作；完成後交 QA 以 Browser UAT 與 routing tests 重驗。

## PM Scope Review — 2026-09-08

- 本票只負責 validation/no-path 的具體原因與 fallback 文案，不能取代使用者要求的自動交叉最小化。
- 自動路由延伸改由 `DSG_UIX_003 → DEV_UIX_009 → QA_UIX_005`；本票在 DEV_UIX_009 形成核准的 failure reason/status 前維持 `BLOCKED`。
