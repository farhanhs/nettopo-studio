# PostgreSQL 驗證、憑證與稽核紀錄

日期：2026-08-02

## validateProject(project)

- 所有 PostgreSQL 拓樸新增與儲存都必須通過 Zod schema。
- 檢查設備、連線與群組欄位型別、長度、數量上限與座標範圍。
- 檢查各集合 ID 不重複、群組參照存在、連線兩端設備存在，並禁止自我連線。
- `username` 與 `password` 不允許進入 `topologies.project` JSONB，只能透過 credentials API 儲存。
- Server storage 的前端請求也會先移除 legacy project credential 欄位。

## Credentials

- Migration `0003_project_device_credentials.sql` 新增 `project_device_id` 過渡欄位。
- 目前設備仍存於 project JSONB，因此先以 `topology_id + project_device_id + kind` 唯一綁定；設備正規化後可回填正式 `device_id` 外鍵。
- `/api/credentials` 支援 masked-only 查詢、加密新增／輪替與刪除。
- 明文只存在於單次 HTTPS request 與伺服器記憶體；資料庫只存遮罩、AES-256-GCM 密文、nonce 與 key version。
- 查詢 API 不選取或回傳 ciphertext、nonce。
- `NETTOPO_CREDENTIAL_ENCRYPTION_KEY` 必須是 base64 編碼的 32-byte 金鑰，正式環境不可提交到 Git。
- 目前 `credential.write` 只配置給 boss；其他角色只能依拓樸可讀範圍查看遮罩資料。

## Audit Logs

- 客戶與拓樸的 create、save、rename、duplicate、delete，以及 credential upsert、delete 都會寫入 `audit_logs`。
- 業務異動和 audit insert 位於同一個 PostgreSQL transaction。
- 稽核 metadata 只放 ID、名稱、筆數與原因，不放帳號、密碼、密文或 nonce。
- `/api/audit-logs?limit=100` 提供查詢，目前只有具備 `audit.read` 的 boss 可以使用。
- 移除設備時會自動刪除對應過渡期 credentials，並記錄刪除原因。

## 驗證

- 全部 Node 測試通過。
- 相關 ESLint 通過。
- Vinext/Vite production build 通過。
- 因本機尚未安裝 PostgreSQL 且未設定 `DATABASE_URL`，實際 migration 與資料庫 transaction 整合測試留待本機 PostgreSQL 建置步驟執行。
