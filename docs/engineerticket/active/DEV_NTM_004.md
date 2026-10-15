# DEV_NTM_004 — 實體／邏輯投影與工程導航

| 欄位 | 值 |
|---|---|
| Status / Order | QA_PASSED（PROJ-R1；2026-10-15 commit-only 核准，產品停寫） / 165 |
| Primary DEV | 開發組 019fa64f-d5f1-7d61-bf93-47a9e7c293c7 |
| Design / QA | DSG_NTM_001 §5 focused addendum / QA_NTM_004 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | 590339395ec8cf5af5591d3be4379bd3ab4ebc6b |
| Integration Target | 同分支；不跨線整合 |
| Authority | 2026-10-14 使用者接續開發；root PM 接續紀錄／R3 |
| Dependency | committed CORE-R2 / GEN-R1 / PLAN-R1；§5 最小對接契約與 scope 核對 |
| Stop | 本候選 commit-only；不 push／merge／部署／live／下一票 |

## 成果與當前放行

2026-10-15 使用者在 PM組明確要求 `commit`；PM 指派 primary DEV 精確提交 PROJ-R1，僅解除本候選 PRE-COMMIT 停止點。產品與獨立 QA 內容不改。提交範圍、乾淨 tree 驗證與歷史限制見 [checkpoint 紀錄](../../dev開發紀錄/2026-10-15-dev-ntm-004-checkpoint.md)；下列 10/14 無 Git 權限是保留的歷史，不再作本次 commit 的阻擋。完成後 next owner PM 核實 SHA，不推送或啟下一票。

2026-10-14 已收到並核對 [QA_NTM_004 正式獨立報告](../../dev測試紀錄/qa-ntm-004-proj-r1-2026-10-14.md)：189/189 module positive allowlist、29/29 QA batch、tsc/scoped lint、隔離build與V1 Browser通過，沒有產品退修。DEV再核manifest `ba766b4e68c1dd621a9e6ea2322eb67cd80a2021492221b638f2dcb02ee86c31` 及104/104檔案不變、index empty。下一owner PM核收，停在PRE-COMMIT。owned-mirror woff2非阻擋tooling風險待PM分流，未修復；真V2 persistence/area Browser、真DB/RBAC、匿名UAT仍未驗，不改本phase邊界。

2026-10-14 PROJ-R1 產品實作與DEV自測已交付：[開發報告](../../dev開發紀錄/2026-10-14-dev-ntm-004-proj-r1.md)、[精確manifest](../../dev開發紀錄/2026-10-14-dev-ntm-004-proj-r1-manifest.json)。7個產品paths、176/176安全子集、tsc/scoped lint、隔離build與V1 Browser PASS。保留首輪full suite 3FAIL/9skip與native fixture安全偏差；不冒稱全量PASS。下一owner QA_NTM_004，產品停寫，必要獨立QA後PRE-COMMIT。以下保留開工時preflight要求及來源。

以同一份 authorized Project 顯示實體接線、邏輯 VLAN/subnet 關係；可按穩定 entity ID 查設備／介面／區域／來源與可信狀態。父契約 §5、NTM-A01/A02/A03/A05/A10 是意圖來源，未決 CSVv3、actor 與真案例不因本票自動核准。

立即做 preflight、自身日誌與測試方案；只寫本票、register 本列及 `docs/dev開發紀錄/2026-10-14-dev-ntm-004-preflight.md`。讀實際 CORE/GEN/PLAN 與現有 UI/write pipeline，列最小可操作垂直切片、精確 product/test paths、closure 與舊功能影響。DSG 只補缺的欄位與拒絕語意；局部 scope 核對後再開產品寫入。不以另一純引擎交付宣稱 UI 整票完成。

特別核對：現行持久化仍是 V1，不得把 V2 snapshot 交舊 writer 丟欄位；優先評估 readonly projection 接入現有閱讀流程。若需持久化／可信身份／新 API，先具名報依賴與方案，不順帶修改。

## 必要驗收意圖 PROJ-01–08

1. **PROJ-01**：同份資料兩種投影 deterministic；原 Project 不變、無第二份 durable graph。
2. **PROJ-02**：entity/endpoint IDs 回鏈正確；legacy 缺 interface 明示未知，不把 canvas anchor 當介面。
3. **PROJ-03**：verified-only 檢查 relation 與必要 endpoints/identity closure；不偽造 verified，缺項／stale／過濾有安全原因，不宣稱 disconnected/healthy。
4. **PROJ-04**：area/site/device/interface 導航與切換保持可用的穩定選取；無效選取有明確 fallback，折疊不改實體連線。
5. **PROJ-05**：既有授權先於投影；不查隱藏站點、client area 不授權；safe summary 無 secret/raw source／不回顯敏感錯誤。
6. **PROJ-06**：真 Browser 可切換、檢索、查看來源與未核實原因；文字＋圖示／線型、鍵盤與觸控可用；360/768/1024/1280 CSS px 與短高度不遮關鍵控制、無頁面水平溢位。
7. **PROJ-07**：記錄合成資料規模、機器與耗時；不以未核准250ms或真案例規模宣稱產品承諾。既有必要效能 gate 不下修。
8. **PROJ-08**：CORE/GEN/PLAN 與被影響 UIX/legacy 回歸；manifest 含完整依賴、測前後 hash、owned cleanup。純 module／Browser／持久化／真 DB 分列結果。

## Preflight 交付歷史 / 2026-10-14

已核 SECTION5-R1.1 SHA-256 `d87640d787533de697b405f433843c132da38294bcea69d656778c0fc4b6bb34`。PM 已核局部契約；產品仍待精確 scope review。完整 traceability、V1 read/write gap、唯讀入口、digest/PLAN 等價抽取、allowed paths/hunks 與 PROJ regression 見 [DEV preflight](../../dev開發紀錄/2026-10-14-dev-ntm-004-preflight.md)。產品／Browser／正式 QA NOT RUN；下一責任組 PM 核 scope，非測試組開跑。

## 分工與安全

DEV 唯一產品 writer；QA 僅自身測試。正式 QA 收候選後停寫；一般缺陷在 QA 完成本批＋cleanup＋release-for-repair 後同票修復。保留現有 dirty 與歷史失敗。不得改 QA 斷言換 PASS。

無 NTM005/CSVv3、Auth、AIL、Beta、安裝／升級、現用 env/DB/secret、live、跨分支／Git 授權。完整交接見 [root PM 紀錄](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-14-pm-ntm-projection-start.md)。目前本phase已獨立QA通過；未驗項依上方正式報告保留，不啟動後續票或Git。
