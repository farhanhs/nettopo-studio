# PM_AIL_001 — 雙軌整理分支與設計開發對接計畫

- 日期：2026-09-11
- Development Branch：codex/ai-layout-poc
- Worktree：C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc
- Base Commit：1b0b084518886cda347f175bfc959401fd1d18ed
- Integration Target：codex/dev-rel-001-checkpoint
- 決策：PM_GOV_001-D33 APPROVED
- 本輪交付：分支/worktree、功能盤點、資料交接、工單；產品介面及模型功能尚未實作。

## 使用者已確認

1. 建立獨立智慧整理功能分支。
2. 後續新票／重新交接舊票明列 Development Branch、Worktree、Base Commit、Integration Target。
3. 雙軌介面：「快速整理」走現有本地演算法；「智慧整理」經模型意圖解析後共用排版與路由。
4. 先整理拓樸功能及欄位，設計組與開發組依相同契約對接。

## 現有功能已盤點

設備／連線／群組、Customer/Topology 選取與CRUD、四種排版選項、直角路由／最近邊 anchor、折疊視圖、Inspector、拖曳、Zustand/Dexie/server儲存、TXT/MD/CSV匯入預覽與五檔匯出、scope/session/credential邊界。

資料真相：
- Project = devices + links + groups。
- AIL 首期只改 Device.x/y；Link/Group 及其他 Device 欄位保持原值。
- Group.kind=site 不是 TopologyRecord.siteId。
- 提案、評分、路由點與模型內容只存在短期候選層。
- setProject 現在背景儲存且回傳 void；新功能必須增加明確 acknowledgement 與 compare-and-apply seam。
- base 未包含 UIX_006–008 候選；未整合 AST geometry 或 Link.medium。

## 工單鏈

PM_AIL_001 → DSG_AIL_001 → DEV_AIL_001（core/scorer）＋DEV_AIL_002（provider/API）→ DEV_AIL_003（UI/apply/undo）→ QA_AIL_001（mock/Browser/storage）→ QA_AIL_002（synthetic live比較）。

本輪啟動設計與 read-only 開發對接；其餘票先列依賴，不因建分支而自動實作。設計組收到精確分支與文件；開發組已發送相同資料包，回報狀態需以實際交付核實。

## 權威入口

- [分支地圖](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc/docs/engineerticket/BRANCH-MAP.md)
- [功能與資料地圖](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc/docs/engineerticket/contracts/TOPOLOGY-FUNCTION-DATA-MAP.md)
- [雙軌交接底稿](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc/docs/engineerticket/contracts/AI-LAYOUT-DUAL-TRACK-HANDOFF.md)
- [DSG詳細契約](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc/docs/engineerticket/contracts/AI-LAYOUT-DETAILED-CONTRACT.md)
- [AIL工單總表](C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/ai-layout-poc/docs/engineerticket/TICKET-REGISTER.md)

## 分支驗證與提交邊界

git worktree list 確認新分支與 worktree；branch=codex/ai-layout-poc、HEAD=上述 base。本輪新增/修改均為 docs；未複製 .env、DB、node_modules 或 checkpoint dirty product files。未 stage/commit/push/merge/deploy；新文件目前為本地未提交交付。產品測試與模型品質尚未執行，不以文件檢查替代。
