# 測試紀錄索引

此資料夾保存 NetTopo Studio 的功能驗收、回歸測試、風險確認與測試組交接紀錄。

## 日誌清單

- `local-ui-smoke-2026-07-27.md`：本機 UI smoke test 與初步問題紀錄。
- `xinghengyi-document-topology-2026-07-28.md`：文件轉拓樸測試與資料匯入紀錄。
- `csv-bundle-v2-acceptance-2026-08-10.md`：CSV Bundle v2 第一階段驗收。
- `development-gate-acceptance-2026-08-10.md`：Development Gate 架構驗收。
- `migration-boundary-rbac-acceptance-2026-08-13.md`：Migration Boundary 與初版 RBAC 驗收。
- `rbac-p0-closeout-2026-08-13.md`：P0 Customer / Topology RBAC 收尾驗證，2026-08-14 更新。
- `qa-uix-001-routing-visual-2026-08-18.md`：DEV_UIX_002 直角避障路由與無線例外驗收。
- `qa-api-001-audit-api-2026-08-20.md`：QA_API_001 Audit API auth-first、strict limit、安全錯誤與 headers 驗收。

## 紀錄原則

- 不提交真實帳密、token、cookie、DSN 或客戶敏感資料。
- 測試 fixture、匯出檔、PDF、localStorage / IndexedDB dump 等臨時資料應放在 git-ignored 的 `private/` 或本機暫存區。
- 每份測試日誌應包含測試範圍、假資料摘要、指令結果、pass/fail、風險與後續建議。
