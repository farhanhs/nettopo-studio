# 多客戶多拓樸儲存開發紀錄

日期：2026-07-28

## 本次目標

優先完成「多重設備拓樸設定以及儲存」：使用者可以在同一頁切換不同客戶與不同拓樸版本，並且把資料保存在本機瀏覽器 IndexedDB。

## 已安裝套件

- `dexie`：本機 IndexedDB 資料庫。
- `zustand`：跨 topbar、sidebar、canvas、inspector 的狀態管理。
- `zod`：保留給下一階段文件匯入與 CSV schema 驗證。
- `papaparse`：保留給下一階段 CSV 匯入與反向輸出。
- `dom-to-image-more`：保留給下一階段拓樸圖面匯出圖片/PDF。

## 已完成實作

1. 新增共用資料模型：
   - `app/lib/topology-types.ts`
   - 將 `Device`、`Link`、`Group`、`Project`、`CustomerRecord`、`TopologyRecord` 抽出。
   - 新增 `SAMPLE_PROJECT` 與 `EMPTY_PROJECT`。

2. 新增 IndexedDB 資料層：
   - `app/lib/topology-db.ts`
   - database name：`nettopo-studio-db`
   - tables：
     - `customers`
     - `topologies`
     - `meta`

3. 新增 Zustand store：
   - `app/lib/topology-store.ts`
   - 支援：
     - 初始化資料庫。
     - 從舊版 `localStorage` key `nettopo-studio-v1` 自動搬移第一筆拓樸。
     - 切換客戶。
     - 切換拓樸。
     - 新增客戶。
     - 新增拓樸。
     - 所有 Project 變更自動寫回目前拓樸。

4. 更新主頁 UI：
   - topbar 新增「客戶」選擇器。
   - topbar 新增「拓樸」選擇器。
   - 新增「新增客戶」按鈕。
   - 新增「新增拓樸」按鈕。
   - 新增客戶會建立空白「現況拓樸」。
   - 新增拓樸預設複製目前畫面作為新版草稿。
   - 切換客戶或拓樸時清除目前選取，避免右側資訊欄殘留舊資料。

5. 更新專案能力文件：
   - `.codex/abilities/topology-ui.md`
   - 補入 Dexie、Zustand、Zod、Papa Parse、dom-to-image-more 的用途。
   - 明確規定 topology project data 不再回到單一 `localStorage` record。

6. 更新文件生成拓樸 skill：
   - `.codex/skills/document-to-topology/SKILL.md`
   - 將輸出目標改為符合 IndexedDB topology store 使用的 `Project` schema。

7. 補齊客戶/拓樸管理功能：
   - 客戶支援重新命名、複製、刪除。
   - 拓樸支援重新命名、複製、刪除。
   - 刪除最後一個客戶時會自動建立空白示範客戶。
   - 刪除客戶最後一張拓樸時會自動建立空白「現況拓樸」。
   - 複製客戶會一併複製底下所有拓樸與 Project 資料。
   - 複製拓樸會複製目前 Project 並切換到新的拓樸版本。

8. 調整上方 UI：
   - 客戶與拓樸切換器固定在 app 上方工具列。
   - 每組切換器旁加入新增、改名、複製、刪除操作。
   - 自動儲存狀態移到同一個上方專案管理區，方便確認目前資料狀態。

9. 新增 PostgreSQL 儲存端口：
   - 安裝 `postgres` driver。
   - 新增 `/api/topology` API route，支援讀取、儲存 Project、新增/改名/複製/刪除客戶與拓樸。
   - 新增 `db/topology-postgres.ts`，負責 PostgreSQL schema 初始化與 CRUD。
   - 新增 `NEXT_PUBLIC_TOPOLOGY_STORAGE` 切換：
     - `indexeddb`：維持原本瀏覽器 IndexedDB 模式。
     - `server`：改走 `/api/topology` 與 PostgreSQL。
   - 新增 `.env.example` 與 PostgreSQL `docker-compose.yml`，方便內網部署前測試。

10. 新增第一版角色權限模型：
   - PostgreSQL schema 新增 `users`、`sites`、`user_sites`。
   - `topologies` 新增 `site_id`、`owner_user_id`、`created_by_user_id`、`updated_by_user_id`。
   - 內建兩個站點：北一站、北二站。
   - 內建測試使用者：
     - `manner@company.local`：老闆，可讀寫全部。
     - `north1.manager@company.local`：北一站站長，可讀寫北一站拓樸。
     - `north2.manager@company.local`：北二站站長，可讀寫北二站拓樸。
     - `engineer@company.local`：工程師，只能讀寫自己建立/負責的拓樸。
     - `sales@company.local`：採購與業務，可讀取全部但不能寫入。
   - `/api/topology` 依目前使用者做資料過濾與寫入權限檢查。
   - 新增 `/api/session` 提供目前使用者、站點與粗粒度權限資訊。
   - 正式帳號登入尚未接入前，可用 `NETTOPO_DEV_USER_EMAIL` 切換 mock 使用者。
   - UI 會依角色停用/隱藏新增、改名、複製、刪除、儲存與自動整理操作。

## 驗證

- `npm.cmd exec eslint -- app/page.tsx app/lib/topology-store.ts app/lib/topology-db.ts app/lib/topology-types.ts`
  - 結果：通過。

- `npm.cmd exec next -- dev -p 3000`
  - 結果：啟動成功。

- `Invoke-WebRequest -UseBasicParsing http://localhost:3000`
  - 結果：HTTP 200，首頁可編譯載入。

## 已知限制

- 全專案 `tsc --noEmit` 目前會被既有 Cloudflare worker 型別擋住：
  - `cloudflare:workers`
  - `Fetcher`
  - `D1Database`
- 這不是本次 IndexedDB/Zustand 變更造成，但後續若要建立完整自動測試流程，需要補 worker/env 型別設定或拆分 app-only typecheck。

## 下一步建議

1. 加入客戶與拓樸重新命名、刪除、複製功能。
2. 為 IndexedDB store 增加 app-only 自動測試。
3. 用 Zod 定義 `Project` schema，讓文件匯入與 CSV 匯入共用同一套驗證。
4. 開始實作 CSV 匯入/輸出：
   - `devices.csv`
   - `links.csv`
   - `groups.csv`
   - `credentials.masked.csv`
   - `missing-info.csv`
