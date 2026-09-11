# 2026-08-10 CSV Bundle v2 交接紀錄

## 背景

設計組已將 NetTopo Studio 的 CSV Bundle v2 第一階段實作交接給開發組。使用者指定後續「實際開發」工作由開發組對話執行，設計組主要承接 PM 規格、資料結構、框架設計、演算法方案與 backlog 整理。

本次開發組已將同一份交接內容轉貼給測試組對話，請測試組後續負責獨立驗證、bug 回報、補測試建議與風險清單。

相關對話：

- 設計組來源 task：`019fda8a-0b05-7a41-8fe0-b72f8c12ad9d`
- 測試組 task：`019fac8e-94dc-79c1-b156-7f242cf82967`
- Workspace：`C:\Users\DUS\Desktop\project\nettopo-studio`

## 已完成範圍

- `app/lib/topology-transfer.ts` 升級為匯入/匯出單一權威契約。
- CSV Bundle schema v2 支援五檔：
  - `devices.csv`
  - `links.csv`
  - `groups.csv`
  - `credentials.masked.csv`
  - `missing-info.csv`
- safe 為預設匯出模式。
- full 匯出需使用者再次確認。
- safe/full 都不得輸出明文帳密。
- 新增 `fflate` dependency，CSV bundle 以動態 import 產生 `topology-csv-bundle.zip`。
- 第一階段 CSV 匯入仍以同時選取或拖入 CSV 檔案為主。
- ZIP 匯入保留後續開發。
- v1 `devices/links/groups` 三檔 CSV 向後相容。
- legacy `devices.csv` 若含 `username/password`，只進 masked preview，不進 `Project`。
- 新增 `app/lib/credential-masking.ts`，統一 `MASKED_SECRET` 與 `maskCredentialUsername`。
- `db/credential-crypto.ts` 改用同一 credential masking helper。
- 新增 `app/lib/topology-missing-info.ts`，Missing Info engine 為純函式，且使用 deterministic id。
- 新增 `app/lib/topology-document-parser.ts`，`.txt/.md` deterministic parser 只產生 draft/evidence，不直接寫 store。
- 新增 `app/components/import/*`：
  - `FileDropZone`
  - `ImportPreviewModal`
  - `ImportSummary`
  - `MaskedCredentialPreview`
  - `MissingInfoChecklist`
  - `ImportIssueList`
- `app/page.tsx` 已接入 drop zone、preview、warning acknowledgement、blocking exclusion、CSV ZIP export。
- `app/globals.css` 補 preview modal、tabs、checklist、table、credential notice 樣式。
- `tests/topology-transfer.test.mjs` 已改成 CSV Bundle v2 驗收測試。

## 安全邊界

- `Project` 不保存 `username/password/secret`。
- `credentials.masked.csv` 只作安全預覽，不可寫回 credentials API。
- `secretMasked` 固定為 `********`。
- raw `username/password/secret` 不應出現在 `Project`、React state、DOM、console、ZIP/CSV 或 audit metadata。

## 設計組回報驗證結果

- `node node_modules\typescript\bin\tsc --noEmit --pretty false`：通過。
- `node --test tests/*.test.mjs`：通過，60 tests。
- `npm.cmd run build:local`：通過。
- scoped ESLint 對本次變更檔案：0 errors。
- 完整 lint 若直接掃整個 repo，會掃到 `.local/postgresql-17.10/...pgAdmin` vendor/runtime 目錄而失敗，非本次改動問題。
- 先前 `npm run lint` 也曾因 Windows PATH 找不到 bash 失敗。

## 工作樹注意

使用者要求保留不屬於本功能的既有變更，不要 reset 或覆蓋。

交接時已知既有非本功能變更：

- `.codex/abilities/topology-ui.json` deleted
- `.codex/abilities/topology-ui.md` deleted
- `README.md` modified
- `.codex/skills/topology-ui/` added
- `docs/dev開發紀錄/開發計畫/開發計畫0804.md` added

本次 CSV Bundle v2 相關變更主要集中於：

- `app/lib`
- `app/components/import`
- `app/page.tsx`
- `app/globals.css`
- `db/credential-crypto.ts`
- `package.json`
- `package-lock.json`
- `tests/topology-transfer.test.mjs`

## 已轉交測試組的驗收方向

1. 跑 `tsc`、`node --test tests/*.test.mjs`、`npm.cmd run build:local`。
2. 針對 CSV Bundle v2 匯出 ZIP 做內容檢查：五檔齊全、欄位正確、safe/full 均無明文 secret。
3. 針對 v1 CSV 匯入做向後相容檢查。
4. 針對 legacy `username/password` 做安全預覽與 `Project` 無寫入檢查。
5. 針對 UI drop zone、preview modal、warning acknowledgement、blocking exclusion 做手動或自動化驗證。
6. 回報任何 blocker、回歸風險、缺測試點給開發組。

## 後續待辦

- 等測試組回報 CSV Bundle v2 第一階段驗收結果。
- 後續 ZIP 匯入、更多文件解析、正式 credentials 匯入流程需另立規格後再開發。
- 若測試組回報安全邊界破口，優先處理。
