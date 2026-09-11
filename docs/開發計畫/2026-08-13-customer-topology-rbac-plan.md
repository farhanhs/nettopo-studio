# NetTopo Studio Customer / Topology RBAC 收尾開發計畫

- 日期：2026-08-13
- 來源：PM 組 P0 Customer／Topology RBAC 收尾設計
- 狀態：使用者已確認核心決策；可移交開發組實作
- 本文件只記錄產品／工程計畫，不代表已完成實作

## 本輪已確認決策

1. Customer create 第一階段採 Boss-only。
   - Customer 是全公司共享主檔。
   - 建立 Customer 等同新增全域主檔，需視為 Customer mutation。
   - 第一階段僅 Boss／`customer.write.all` 可建立 Customer。

2. Engineer topology read/write 必須同時符合 assigned site 與 owner/creator。
   - Topology 是 site ownership / isolation boundary。
   - Engineer 即使是 owner 或 creator，也必須仍被指派到該 topology 所屬 site。
   - 避免工程師被移出 site 後，仍因 owner/creator 身分跨站操作。

3. duplicateCustomer 第一階段採 Boss-only，且不複製 credentials。
   - `duplicateCustomer` 不得成為繞過 Customer mutation、createTopology、site visibility 或 owner scope 的捷徑。
   - 第一階段僅 Boss／`customer.write.all` 可 duplicate Customer。
   - 複製時可複製 Customer safe metadata 與 source topologies project。
   - 不複製 credentials。
   - 不複製原 audit metadata，只寫新的 audit action。
   - 多站 topology 在 Boss-only 前提下可保留原 site scope；新 topology 的 owner/creator/updatedBy 改為 actor。

## 本輪實作範圍

- 建立集中式 RBAC policy module。
- 建立 PostgreSQL resource scope query 邊界。
- 收斂 topology / credentials / audit API 的 session、active account、policy evaluation 與 safe error mapping。
- 修正 Customer / Topology mutation 權限：
  - createCustomer / renameCustomer / deleteCustomer / duplicateCustomer：Boss-only。
  - createTopology：必須驗證 active account、customer 存在且可見、targetSiteId 合法且不可由 header/client 偽造推導。
  - Engineer topology access：assigned site + owner/creator。
  - Sales：可讀但不得 mutation。
- 停用帳號對 Customer / Topology / Credentials / Audit 全部 fail closed。
- Audit metadata 不得保存 credentials plaintext、ciphertext、nonce、cookie、token 或 raw identity header。

## 這次先不處理，列入後續 backlog

### Customer 負責人資訊

需求目的：
- 讓使用者能看出某一 Customer 目前由哪些人或團隊負責。
- 支援維運／業務歸屬、聯絡窗口、案件負責人呈現。

第一階段不做為 RBAC 授權依據。

建議語意：
- Customer 負責人是業務／維運資訊，不是權限來源。
- 真正授權仍由 topology site、owner、creator、role、user_sites 決定。
- 不新增 `customers.owner_user_id` 作為權限欄位。

可能第二階段實作選項：
- 使用既有 `customer_profiles` 保存 `accountOwnerUserId` / `serviceOwnerUserId`。
- 或新增獨立 `customer_account_managers` / `customer_contacts` 類表。
- UI 顯示 Customer 底下 topology 的 site / owner / creator 彙總。

### Boss-only Customer Access Overview / 維護入口

需求目的：
- 提供 Boss 查看與調整 Customer 底下 topology scope 的入口。
- 解決「某客戶目前誰負責」與「誰可以編輯某張 topology」的維護問題。

第一階段先不實作。

建議能力：
- 查看 Customer 下所有 topology。
- 顯示每張 topology 的 site、owner、creator、可編輯角色來源。
- Boss 可轉移 topology owner。
- Boss 可調整 topology site。
- Boss 可查看哪些使用者因 site assignment 取得 Site Manager 編輯能力。
- Boss 可查看 audit trail。

限制：
- 不把 Customer owner 當作 RBAC 授權來源。
- 不讓 Site Manager / Engineer 透過此入口改 Customer 主檔。

## 第一階段不新增 migration 的原則

目前既有 schema 已具備：
- `users.disabled_at`
- `user_sites`
- `customers`
- `topologies.site_id`
- `topologies.owner_user_id`
- `topologies.created_by_user_id`
- `device_credentials`
- `audit_logs`

因此 RBAC 收尾應優先在 0004 既有 schema 上完成。

除非後續正式決定要新增 Customer 負責人持久化表、site-scoped audit permission、topology collaborator ACL，否則不得為本輪 RBAC 收尾建立空 migration。

## 移交開發組前提

開發組開始前需先檢查工作樹並保留其他組既有變更。

開發組只在遇到會改變上述產品決策的阻擋時回報；一般工程細節自行收斂。
