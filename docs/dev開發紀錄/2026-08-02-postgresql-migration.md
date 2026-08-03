# PostgreSQL Migration 開發紀錄

日期：2026-08-02

## 本次完成

- 將應用程式內逐張執行的 `CREATE TABLE IF NOT EXISTS` 改為正式 migration runner。
- 新增 `schema_migrations`，記錄 migration 版本、名稱、SHA-256 checksum 與執行時間。
- migration 使用 PostgreSQL advisory lock，避免多個服務程序同時啟動時重複套用。
- 每份 migration 在單一 transaction 內執行；失敗時不留下半套資料表。
- 已套用的 migration 只會略過；若執行後又修改舊 SQL，checksum 驗證會中止並要求新增下一版 migration。
- 應用程式 bundle 會內嵌 migration SQL，正式建置不依賴外部檔案路徑。
- 新增 `npm run db:migrate`，供本機與正式伺服器在啟動前明確執行。

## 使用方式

在 `.env.local` 或 `.env` 設定：

```env
DATABASE_URL=postgres://nettopo:password@localhost:5432/nettopo_studio
NEXT_PUBLIC_TOPOLOGY_STORAGE=server
```

執行：

```powershell
npm run db:migrate
```

第一次會建立正式資料表與字典資料；第二次執行會顯示 migration 已略過，既有資料不會被刪除或重建。

## 驗證結果

- migration 單元測試通過。
- 相關 ESLint 檢查通過。
- Vinext/Vite production build 通過，並確認 SQL 已包含在 server bundle。
- 目前開發電腦尚未安裝 PostgreSQL 或 Docker，也未設定 `DATABASE_URL`，因此實際資料庫連線與重複執行測試留待本機 PostgreSQL 建置階段完成。

## 下一步

依原定順序進入 `validateProject(project)`，在專案資料寫入 PostgreSQL 前驗證欄位格式、設備與群組 ID，以及連線端點參照。
