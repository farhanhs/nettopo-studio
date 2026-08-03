# PostgreSQL 正式資料表規劃

日期：2026-08-02

本階段先完成正式資料表 schema。整體方向是「字典表 + 業務資料表」：

- 字典表放穩定選項，例如身份、權限、設備類型、群組類型、連線類型、憑證類型、設定類型。
- 業務資料表放會持續新增與異動的資料，例如使用者、客戶、拓樸、設備、連線、設備密碼、稽核紀錄。
- 目前仍保留 `topologies.project jsonb` 作為前端拓樸檔案的完整來源，避免正規化拆表後立刻影響現有 UI。`topology_devices`、`topology_links`、`topology_groups` 先作為下一階段 SQL 查詢、驗證、報表與設備清單的落地端口。

## 身份與權限

- `roles`：身份字典，包含 `boss`、`site_manager`、`engineer`、`sales_procurement`。
- `permissions`：權限字典，例如讀全部拓樸、編輯站點拓樸、讀取 masked credentials。
- `role_permissions`：身份與權限的對照表。
- `users`：帳號資料，包含 email、姓名、身份、`password_hash`、停用時間。密碼只會放 hash，不放明文。
- `sites`：站點資料，目前可放北一站、北二站。
- `user_sites`：使用者與站點對照。站長只能讀寫自己站點，就是靠這張表判斷。

## 客戶與拓樸

- `customers`：客戶主檔。
- `customer_profiles`：客戶設定檔案，使用 `kind + profile_key + profile_value jsonb` 儲存彈性設定。
- `topologies`：拓樸主檔，包含客戶、站點、擁有者、建立者、更新者、版本標籤，以及目前前端使用的 `project jsonb`。
- `topology_profiles`：架構設定檔案，結構與 `customer_profiles` 類似，但掛在單一拓樸底下。
- `topology_versions`：版本快照，用來做還原、歷史追蹤與正式稽核。

## 拓樸正規化表

- `device_types`：設備類型字典，例如 router、firewall、switch、server。
- `group_kinds`：群組類型字典，例如 site、domain、vlan。
- `link_kinds`：連線類型字典，例如 wired、wireless。
- `topology_groups`：拓樸群組資料。
- `topology_devices`：拓樸設備資料，包含 IP、MAC、型號、位置、管理 URL、畫布座標。
- `topology_links`：拓樸連線資料，包含來源設備、目的設備、連接埠、VLAN、速率。

## 憑證與安全

- `credential_kinds`：憑證類型字典，例如 device_admin、wifi、vpn。
- `device_credentials`：設備密碼表。目前只建立 masked/encrypted 結構：
  - `username_masked`、`secret_masked`：給 UI 顯示的遮罩值。
  - `username_ciphertext`、`secret_ciphertext`：未來加密後的密文。
  - `secret_nonce`、`key_version`：未來接 KMS、Vault 或本機加密金鑰輪替時使用。
- `api_tokens`：未來若要做 API token 或內部整合，用 token hash 與 scopes 管理，不存原始 token。

## 稽核

- `audit_logs`：記錄誰在什麼時間對哪種資料做了什麼動作。後續 rename、delete、duplicate、save、credential rotate 都應寫入這張表。

## 下一步

1. 把目前 runtime 的 `create table if not exists` 改成正式 migration runner。
2. 補 `validateProject(project)`，先驗證 `project jsonb` 的設備、連線、群組關係。
3. 把儲存拓樸時的 `project jsonb` 同步拆到 `topology_devices`、`topology_links`、`topology_groups`。
4. 補 audit log 寫入點。
5. 本機 PostgreSQL 跑通後，再整理正式 server 部署流程。
