# CSV Bundle v2 第一階段驗收 - 2026-08-10

## 測試範圍

- 專案：NetTopo Studio
- 功能：CSV Bundle schema v2 第一階段匯入／匯出
- 測試角色：測試組獨立驗收
- 測試日期：2026-08-10
- 工作區：`C:\Users\DUS\Desktop\project\nettopo-studio`
- 驗收原則：只進行驗證與風險回報，不修改產品程式碼

## 自動化驗證結果

| 驗證項目 | 結果 | 備註 |
| --- | --- | --- |
| `tsc --noEmit --pretty false` | 通過 | 無新增 TypeScript 錯誤 |
| `node --test tests/*.test.mjs` | 通過 | 60 tests passed |
| `npm.cmd run build:local` | 通過 | 僅出現既有大型 chunk 警告 |
| 本次變更範圍 ESLint | 通過 | 0 errors |

既有測試涵蓋 JSON round-trip、safe 匯出欄位移除、CSV v2 五檔輸出、header-only 選用檔、ZIP 五檔名稱、v1 CSV 相容、legacy 帳密遮罩預覽、關聯錯誤、群組警告、merge ID remapping、blocking missing-info exclusion，以及未知／混合檔案拒絕。

## UI Smoke Test

1. 啟動本機 preview server。
2. 使用 `sean.sie` 測試身分登入。
3. 確認登入後可進入 NetTopo Studio 工作頁面。
4. 點擊「匯入」，確認原生檔案選擇／拖放入口可顯示。
5. 點擊「匯出」，確認 JSON 完整備份、安全分享版及 CSV 匯出入口可顯示。
6. 測試完成後關閉測試分頁與 preview server。

限制：測試環境持續顯示「正在載入拓樸工作區」，客戶與拓樸選單維持 disabled，因此未完成已有拓樸資料下的 ZIP 實際下載及匯入套用 E2E。

## 驗收結論

**不建議通過上線。** CSV Bundle v2 基礎資料轉換測試可通過，但仍有安全阻擋問題。

## 已確認問題

### P0：本機模式保存明文設備帳密

- `app/lib/topology-types.ts` 的 `Device` 仍含 `username`、`password`。
- `app/page.tsx` 新增與更新設備時會把帳密放入 `Device` 後呼叫 `setProject`。
- `app/lib/topology-store.ts` 只有 server storage 模式會執行 `stripProjectCredentials`。
- local storage 模式會複製完整 Project 並保存至 Dexie。
- `saveDeviceCredential` 在 local storage 模式直接返回，未形成獨立安全儲存邊界。

影響範圍包括 Project、React／Zustand state、IndexedDB，以及完整 JSON 備份；不符合「Project、React state、DOM、console、ZIP／CSV 與 audit metadata 不得出現明文帳密」的安全要求。

### P1：`usernameMasked` 未驗證實際遮罩格式

`MaskedCredentialSchema.usernameMasked` 使用一般 optional text 驗證。實測完整帳號字串可通過 schema，可能進入 import plan 與預覽 DOM。

### P1：憑證匯出提示文字損壞

`app/page.tsx` 的憑證匯出狀態訊息包含實際 `????????` 字串，使用者無法理解權限拒絕、無憑證或已遮罩筆數等狀態。

### P2：CSV v2 UI 文案仍為三檔

匯出視窗仍顯示「CSV 三檔」，匯入及匯出說明只列出 `devices.csv`、`links.csv`、`groups.csv`，未包含 `credentials.masked.csv` 與 `missing-info.csv`。

## 建議開發優先順序

1. 從 `Device`／Project schema 移除 `username`、`password`，讓 local 與 server storage 共用相同憑證安全邊界。
2. 所有 JSON／CSV／ZIP 匯出前再次執行 defense-in-depth credential stripping。
3. 對 `usernameMasked` 建立遮罩格式或可信來源驗證，拒絕未遮罩帳號。
4. 修復問號提示字串及 CSV v2 五檔文案。
5. 修復工作區載入狀態後補做完整 UI E2E。

## 建議補充測試

- local／server storage 下 Project、Zustand 與 Dexie 均不得出現明文帳密。
- safe／full ZIP 解壓後確認五檔齊全，並掃描敏感 sentinel。
- 完整 JSON 備份不得包含 legacy 明文帳密。
- 拒絕未遮罩 `usernameMasked` 與非 `********` 的 `secretMasked`。
- 惡意 CSV formula injection、重複檔名及 mixed bundle。
- UI 檔案選擇、拖放、preview modal、warning acknowledgement、blocking exclusion。
- 建立新拓樸、合併、取代三種套用策略的整合測試。

## 協作紀錄

- 2026-08-10：驗收結論與開發建議已轉發至「PM組」對話。
- PM 建議：將 P0 明文憑證修正列為 CSV Bundle v2 上線閘門。

## P0／P1／P2 第一輪修正重驗

重驗日期：2026-08-10

### 通過項目

- TypeScript 檢查通過。
- 62 項 Node tests 全數通過。
- scoped ESLint：0 errors。
- `build:local` 通過，僅有既有 chunk size warning。
- 正式 `Device` model 已移除 `username/password`。
- `cloneProject`、`stripProjectCredentials`、`sanitizeProject` 可移除 runtime legacy `username/password/secret`。
- `setProject` 在寫入 state、server 或 Dexie 前使用 sanitized Project。
- local mode `saveDeviceCredential` 若收到帳密會明確拒絕，不再 silent return。
- full/safe JSON、CSV 與 ZIP 的明文 sentinel 掃描測試通過。
- 未遮罩完整帳號會被 masked credential schema 拒絕。
- CSV formula injection neutralization 測試通過。
- 在乾淨的 `4180` preview 埠確認 UI 顯示「CSV Bundle v2 五檔」及完整五個檔名。
- 憑證匯出提示原始碼已恢復為可讀中文。

### 環境辨識

`4173` 埠仍由舊 preview process 占用，因此最初看到舊版「CSV 三檔」。改用乾淨 `4180` 埠載入最新 build 後，五檔文案正確；舊畫面判定為環境殘留，不列為產品回歸。

### 尚未通過的上線條件

- 現有測試只驗證清洗純函式及 store 原始碼路徑，尚未真正以 IndexedDB／Dexie 整合測試證明 legacy record 載入後會清洗並回寫。
- 尚未以 server mode 實際攔截 credentials API request，證明 raw secret 只送 credentials API 且不進 Project payload。
- preview 登入後持續顯示「正在載入拓樸工作區」，無法完成設備帳密欄位 disabled、drag/drop、warning acknowledgement、blocking exclusion、new/merge/replace 的 UI E2E。
- 惡意 masked CSV 已測完整 username，但仍建議增加 raw secret、tab／CR 開頭及所有 `= + - @` 欄位的參數化案例。

### 重驗結論

P0 的 domain model、純函式清洗與匯出防洩漏核心修正已通過；整體上線閘門維持「有條件阻擋」，待 Dexie、server credentials API 與完整 UI E2E 獨立重驗通過後才能核准。
