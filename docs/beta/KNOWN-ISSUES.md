# 已知限制

- 此包是本機回饋候選，未發布、未部署。獨立 QA_BTA_001 尚待完成。
- 固定 Windows x64、Node 24.18.0、127.0.0.1:4317；不支援自訂 port、localhost、IPv6 或 LAN。
- 初次 setup 需網路；日常應可離線。公司 proxy/離線 npm 安裝不是已驗證範圍。
- 單一瀏覽器 profile 的 IndexedDB，不是多使用者共享，也不是永久備份。
- 完整 JSON 一次只備份一張拓樸；請確認檔案存在且非空。無 ZIP 匯入、無整個工作區還原。
- 本機模式沒有公司登入、權限管理、PostgreSQL、憑證保存、AI、HR、監控或自動更新。主線唯讀模型檢視不增加持久化能力。
- 本機模式不接受 dev identity header，也不開任何 topology/session/credentials/audit/health server API。
- Windows PowerShell/CIM 必須能讀取自己的程序資訊；歸屬無法證實時啟停會 fail closed，不終止未知程序。
- 開發自測的 1280px Chrome/Edge 流程不能替代完整 Browser/離線/響應式獨立 QA，歷史 UAT 缺口另行保留。
- 原專案完整 lint 依賴 Bash；Windows 此環境以 scoped ESLint 留證，不能宣稱全量 lint 已通過。
