# NetTopo Studio — Agent 工作入口

本檔連接既有專案規則與 agent skills，不另建立一套開發流程。適用 PM、DSG、DEV、QA、OPS；先依本次使用者要求確認工作範圍，再讀相關文件。

## 開始工作前

1. 確認 repository、worktree、branch、HEAD 與 dirty changes；不得把未提交候選等同 HEAD。
2. 依 [分支與工作線索引](docs/engineerticket/BRANCH-MAP.md) 找到該票指定的工作樹，再讀該樹的票面、register、契約與日誌。索引中的歷史狀態不能替代當前證據。
3. 保留既有修改。跨分支同名票或文件不代表同一候選；不自行 checkout、搬移變更或整檔覆蓋另一工作線。

## Agent skills

### Issue tracker

沿用 `docs/engineerticket` 的 Markdown 票據、既有單號與狀態；操作對照見 [issue-tracker.md](docs/agents/issue-tracker.md)。不建立平行的 `.scratch` 票庫或 GitHub Issues。

### Domain docs

採 single-context，先追溯現有計畫、契約與決議；術語及 ADR 的讀取規則見 [domain.md](docs/agents/domain.md)。

## 工作與分工

- 開工、交接與準備 checkpoint 時讀 [輕量 DevOps／敏捷流程 R3](docs/engineerticket/contracts/DEVOPS-AGILE-WORKFLOW.md)。共用治理以 root 的 R3／D42 為唯一來源，產品票與證據仍以指定 worktree 為準；不改寫產品或安全契約。
- 涉及授權、跨組交接、sandbox、環境／資料庫／套件或候選證據時，讀 [R3 有界授權補充](docs/engineerticket/contracts/HARNESS-AUTHORIZATION.md)；核准的同票 DEV↔QA／OPS↔QA 可直接閉環，實際平台權限與 Git／live 停止點仍獨立。
- PM 管成果、範圍與優先序；DSG 管新語意與契約；DEV 管產品及自測；QA 管獨立測試及證據；OPS 管具名環境工作。
- 每個功能一個 primary DEV、每次交接一個 next owner。同一高衝突模組維持單一產品寫入線；正式 QA 期間固定受測候選。
- 已核准範圍內的明確缺陷沿原票 DEV↔QA 閉環，不為每次退修重新進設計或等待 PM 批准。新需求、契約歧義、越界操作及重大風險才升級。
- 保留失敗與重驗歷史。QA 不改產品換 PASS；DEV 不修改獨立 QA 斷言換 PASS。

## 驗收與停止點

- DEV 自測、獨立 QA、靜態檢查、Browser、真 DB、live 分開記錄；build、mock、舊分支 PASS 不替代未執行的行為驗證。
- 記錄產品與工具候選、測前後 hash、實際結果及必要清理。候選變動後依影響重驗，不能沿用受影響舊證據。
- `QA_FAILED` 是驗收失敗；`BLOCKED` 是缺必要條件；`NOT RUN` 是未測。`QA_PASSED` 不等於已 commit、已部署或 DONE。
- 技能名稱、票狀態與流程配置不會自行授權派工、產品修改、commit、push、merge、部署、現用資料庫、秘密讀取或真人 API／OTP；各自核對有效授權。
- 測試優先使用已核准的隔離 fixture，不預設載入現用 `.env`／DSN 或使用公司系統。清理只限已確認歸屬的自建資源。
- 使用者指定「commit 前停下」時，交付可審查的變更與證據後停止，不 stage、commit 或 push。
- 工作包已具名核准工程 commit 時，按 R3 的獨立 QA／精確 staging 條件存檔，不逐次重問；後續使用者停令優先。當前工作包以 [分支索引](docs/engineerticket/BRANCH-MAP.md) 及有效授權定位。[2026-10-13 commit／push 核准](docs/dev開發紀錄/2026-10-13-pm-approved-checkpoint-push.md) 僅解除已驗收 NTM／Native B1／對應治理的停止點；其餘票與跨分支整合／部署未放行。

## 回報

先說票號、候選及成果是否可用，再列已驗、未驗、阻擋與下一責任組；附實際文件連結。不將工具送出成功寫成已開工，不將階段 PASS 寫成整體完成。
