# 本機 PostgreSQL 部署與跑通紀錄

日期：2026-08-02

## 完成狀態

- PostgreSQL 17.10 Windows x64 binary 已安裝在 `.local/postgresql-17.10/pgsql`。
- 資料目錄位於 `.local/postgres-data`，日誌位於 `.local/logs/postgres.log`。
- PostgreSQL 僅監聽 `127.0.0.1:5432`，資料庫為 `nettopo_studio`，使用者為 `nettopo`。
- `0001`、`0002`、`0003` migration 已套用；第二次執行會略過全部三筆。
- 正式 schema 共 23 張 public tables，migration、角色、權限與組織種子資料已驗證。
- 新增 Node 本機 production build，避免把 Cloudflare socket driver 放進 Node server。

## 日常啟動

第一次初始化或重建環境時：

```powershell
npm.cmd run db:local:setup
npm.cmd run build:local
```

平常開機後：

```powershell
npm.cmd run db:local:start
npm.cmd run db:migrate
npm.cmd run start:local
```

開啟 `http://127.0.0.1:3000`。`start:local` 會占用目前終端；按 `Ctrl+C` 停止應用程式。

查看與停止 PostgreSQL：

```powershell
npm.cmd run db:local:status
npm.cmd run db:local:stop
```

## 設定與機密

- `.env.local` 不進 Git，存放 `DATABASE_URL`、開發使用者與 AES-256-GCM 加密金鑰。
- `POSTGRES_POOL_MAX=1`，每次 API 操作建立 request-scoped SQL client，完成後確實關閉。
- API 只回傳 masked credential；ciphertext 與 nonce 只存在 PostgreSQL。
- 正式帳密上線前，仍需 HTTPS、正式登入/OIDC、金鑰輪替與備份還原演練。

## 端到端驗證

- 首頁、`/api/session`、`/api/topology`、`/api/audit-logs` 均回傳 HTTP 200。
- 拓樸資料為 1 位客戶、1 份拓樸、4 台設備與 3 條連線。
- 暫時 credential 寫入後只回傳 `********`，SQL 內為 ciphertext + nonce；測試後已刪除。
- `credential.upsert` 與 `credential.delete` 均留下 audit log。
- 採購與業務可讀取資料，但寫入回傳 HTTP 403；工程師不能修改他人擁有的拓樸。

## 公司內網下一步

目前應用程式與 PostgreSQL 都只綁定 localhost。準備讓同仁使用時：

1. 應用程式改由 `0.0.0.0` 或指定內網 IP 監聽，但 PostgreSQL 仍只對應用程式主機開放。
2. 在反向代理終止 HTTPS，Windows 防火牆只允許公司網段連入應用程式連接埠。
3. 用 Windows Service 或程序管理器管理 PostgreSQL 與 Node 自動啟動、停止及日誌。
4. 接正式帳號/OIDC 後移除 `NETTOPO_DEV_USER_EMAIL` 與 UI 測試身分切換。
5. 建立每日備份、離機副本、還原演練、監控與磁碟容量告警。
