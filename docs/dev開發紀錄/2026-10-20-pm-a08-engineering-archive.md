# A08 工具修復工程存檔（非驗收／發布）

- 授權：使用者在獲知「OPS 修復與自測完成、QA 尚未重驗、A08 BLOCKED」後明確要求 `commit`。
- 分支：`codex/public-beta-0.1`。
- 工作樹：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1`。
- 提交前 HEAD：`b6d508caee148b0557f0c9370252c8d1b2fcf8ef`。
- 範圍：OPS_ENV_001 的 A08 工具、QA_BTA_001 的 A08 runner／測試／矩陣、相關 QA 票與 register 列、OPS／QA 紀錄。本次是未完成驗收候選的具名工程存檔，不是必要 QA 通過的 checkpoint。
- 排除：root dustool/Auth、其他工作樹、未追蹤的 OPS_BTA_001 發布票、`.local` fixture／二進位／原始證據、env／秘密、產品重新打包、push／tag／Release／部署。

## 候選與結果

OPS 與 QA 對話在提交前均為 idle。OPS 最新回報已停止工具寫入，修復 run-id 前置 reservation、成功狀態及實際清理結果紀錄。QA 最新獨立結果仍是前一版的 `QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`；修復版尚待獨立重驗，歷史失敗不覆寫。`QA_BTA_001` 與正式 A08 維持 `BLOCKED`。

本輪 PM 存檔前檢查：

- `node --test tests/qa-bta-001-a08-tooling.test.mjs tests/qa-bta-001-a08-adapter.test.mjs`：9/9 PASS；這是工具回歸，不是完整 journal 審閱或正式 A08。
- OPS manifest 列出檔案的 raw SHA-256 drift：0。
- 暫存前 `git diff --check`（已追蹤變更）：PASS。完整 29 檔暫存後 `git diff --cached --check` 提醒兩份既有 QA／OPS 紀錄共七行 Markdown 行尾雙空白；保留原紀錄格式，未修改工具換取檢查通過。另有 Git CRLF 提醒。
- 29 個候選檔的常見秘密格式掃描：零命中；未讀取現用秘密，故不是 active-secret 驗收。
- 固定 R4 ZIP SHA-256 仍為 `4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`，未重建。
- 本輪不執行 Browser、外連、Firewall／Enforce、管理員操作或產品驗收；不建立 QA attestation。

工具中的 candidate HEAD 是工具交接時的來源識別，提交後仍保留歷史值，不把既有 R4 ZIP 說成由新 HEAD 重新建置。現有工具含本機固定路徑與 raw hash 綁定；其他 checkout／換行轉換／工具版本變動後必須重新核對，不保證直接可執行。

下一責任組：QA_BTA_001 對存檔工具候選進行獨立安全重驗；通過後才提供人工管理員操作步驟。真正 OS enforcement／pre-during-post／清理及產品離線驗收仍待執行。此次 commit 不解除這些 gate，也不授權 push／發布。
