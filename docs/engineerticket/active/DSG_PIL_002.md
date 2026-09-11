# DSG_PIL_002 — 新增拓樸站點欄位與響應式容器設計

| 欄位 | 值 |
|---|---|
| Group | DSG |
| Feature | PIL |
| Priority | P1 |
| Status | DONE |
| Owner | 設計組 |
| Downstream | DEV_PIL_002 → QA_PIL_004 |
| Authorization | 使用者核准先由 DSG 補齊功能欄位，盡量相容響應式容器 |

## Requirement Traceability

- 來源：DEV_PIL_002、QA_PIL_004、DSG_PIL_001、DEV_UIX_004/005、PM_GOV_001-D20/D21/D25/D29，以及本次使用者核准的五步功能計畫。
- 目標：消除允許本機未指定站點情境的新增拓樸阻擋；不將載入失敗、權限不足或 Pilot 缺少 site binding 誤當成可未指定。
- 本輪僅設計與文件，不修改產品、schema、migration、package、env；不啟動 DEV/QA 執行。
- 依 topology-ui skill，保留現有容器與 Zustand mutation/persistence 邊界；不另建 localStorage topology 儲存路徑，不把容器尺寸寫入 domain。

## Deliverable

在 `docs/engineerticket/contracts/TOPOLOGY-CREATE-SITE-RESPONSIVE.md` 交付一份精簡、可直接實作的規格，含以下五項：

1. **模式與狀態矩陣**：browser-local / server / Pilot 與 loading、error、loaded-empty、loaded-with-options；明訂可提交條件、retry、失去權限與重複提交處理。development/demo 名稱本身不等於允許 server 缺 siteId。
2. **欄位與對接表**：依目前程式核對新增拓樸既有欄位，不憑空新增業務欄位；逐欄記錄 UI label、資料 key/type、來源、必填/唯讀/disabled、預設值、驗證及 payload omission。未指定是顯示字串，不是假 ID；允許時 siteId 缺值，不偷偷回填 activeTopology 舊站點。
3. **響應式容器規格**：沿用既有 modal/form/topbar/panel 元件及樣式，定義容器寬高、窄容器單欄與寬容器配置、min-width/文字換行、內容捲動、footer actions 不遮擋、短視窗與鍵盤使用。尺寸依可用容器判斷，不只依全螢幕寬度；避免對整個 workspace 做重設計或全域 CSS 改動。
4. **安全與持久化**：本機允許缺值時經既有 Zustand action/Dexie 保存並 reload；server/Pilot 維持 site 授權與後端驗證，不從 UI 推導新權限。標示最小 allowed paths、禁止修改區域及需要回 PM 的 no-path。
5. **驗收映射**：為 DEV_PIL_002 與 QA_PIL_004 提供操作步驟與預期結果；至少覆蓋 360px、768px、1280px 視窗及窄面板/短高度、200% zoom、長站點名稱/長錯誤訊息、鍵盤焦點與 label、無橫向溢位、按鈕可見可操作。這些為本票提議驗收尺寸，不宣称現有 mobile 全產品支援已完成。

## 協作與停止條件

- 先唯讀查驗目前產品與 checkpoint 差異，標示設計參考的 branch/HEAD/檔案位置，不把原工作區髒變更當成新功能授權。
- 設計組只更新本票與上述 contract；Register 由 PM 維護。
- 完成回報 DESIGN_COMPLETE 給 PM，列出 downstream 實作/驗收摘要與未決事項；本輪不自行通知 DEV 開工、不開額外設計票。
- 若必須改 DB schema、放寬 Pilot/production scope、增加相依套件或重設計全站容器，停止回 PM。
- 禁止 stage/commit/amend/cherry-pick/rebase/merge/push/tag/deploy；設計通過不等於 commit 核准。

## Design Output — 2026-09-04

已完成設計契約：[TOPOLOGY-CREATE-SITE-RESPONSIVE.md](../contracts/TOPOLOGY-CREATE-SITE-RESPONSIVE.md)。

參考狀態：

- 原工作區：branch `dustool`，HEAD `cbce10bba027d246ef78e92a1e2f01660da55e1f`。
- 只讀觀察 checkpoint worktree：branch `codex/dev-rel-001-checkpoint`，HEAD `73c38014c0ef2de8066f220268292730bef02d15`。
- PM 訊息曾引用 checkpoint HEAD `87a04d57d8d848b42924f01924286bf4bce46ff9`；DEV/QA 開工前需自行核對 active worktree HEAD，不以本設計票推定 checkpoint diff。

設計裁定：

- 只有 `browser-local + sites loaded-empty` 可建立「未指定站點」拓樸。
- `loading`、`error`、server empty、Pilot empty 均不得被當成真空清單；submit 必須 disabled 或由後端 fail closed。
- `未指定` 只是 UI 顯示字串，不是 fake site ID；payload 應 omit `siteId`，不得送 `""`、`none`、`unspecified`、`local` 等值。
- 新增拓樸時若使用者選擇/允許未指定，不得用 `activeTopology?.siteId` 偷偷回填舊站點。
- server/Pilot createTopology 保持 site scope 與後端驗證，不因 development/demo 字樣放寬。
- 響應式修正限於既有 modal/form/topbar/panel 容器：窄寬單欄、內容可捲動、footer 可達、長文字不爆版、200% zoom 與鍵盤焦點可用；不做全站容器重設計或新套件。
- Zustand/Dexie 仍是 local persistence boundary；component 不直接寫 Dexie，panel/container size 不寫入 topology domain。

DEV_PIL_002 最小方向：

- 主要檔案：`app/page.tsx`、`app/globals.css`、必要的 `app/lib/topology-store.ts` hunk、DEV-owned regression tests 與開發紀錄。
- 禁止：DB schema/migration、Pilot/server policy 放寬、Customer/RBAC 正式設計、新 package、廣域 CSS reset、Import/Export/Credential 行為、QA-owned scripts、Register、任何 stage/commit/push/deploy。

QA_PIL_004 驗收方向：

- browser-local 空站點可建立且 reload 後仍為 `未指定站點`。
- local 空值不造 fake ID、不繼承 active topology 舊站點。
- 有站點清單時既有選擇與保存不退步。
- loading/error 不是空清單。
- Pilot/server 缺 site 不放寬。
- 360px、768px、1280px、短高度、200% zoom、長站點名稱/錯誤、鍵盤焦點、無橫向溢位。

本輪依指示不自行通知 DEV/QA 開工；等待 PM 後續派工。

## PM Scope Review — 2026-09-08

- 設計契約內容完整，狀態由 `READY` 校正為 `DONE`。
- downstream 曾在 PM 二次派工前提前執行；此流程偏差不改變設計內容，但不作為未來自動移交先例。
- 設計邊界維持：僅 browser-local 真空站點可為未指定；server/Pilot 不放寬；響應式修改限既有容器。
