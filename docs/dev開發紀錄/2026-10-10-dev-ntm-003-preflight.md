# DEV_NTM_003 Preflight — PLAN-R1 候選範圍

日期：2026-10-10 / Asia-Taipei。狀態：IN_PROGRESS preflight，產品實作未授權。Next dependency：DSG_NTM_001 §4 focused addendum，之後 PM 精確 scope check。本文是 DEV 現況盤點與最小實作建議，不取代 DSG 契約，不是新的產品決策。

## 候選、安全與權威

- Worktree：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint`；branch `codex/dev-rel-001-checkpoint`；HEAD/base `a9abe637f0ad419aced6d31faf30a127ce5b81e6`；index empty。
- root PM 權威：[2026-10-10-pm-ntm-plan-start](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-10-pm-ntm-plan-start.md)、共用 R3、[DEV_NTM_003](../engineerticket/active/DEV_NTM_003.md)。既有契約只讀；codebase-design 指引採小 interface、單一深 module、測試走公開入口，不新增假想 storage adapters。
- 已核 GEN-R1 manifest 的2候選、6依賴、4回歸工具、CORE-R2 manifest共13檔 raw hash 全部 MATCH；不是只看 HEAD。GEN engine `d53c2f462f59d0a87c7588c6e4240b37885be1bc5000e73a77588a5f93357701`，CORE model `b0217c37e2ef34a8432a40a21b16305892d73e94c14b18b8ea52cc4cecaa16e7`。
- QA_NTM_002 已獨立7/7、本批73/73、hash鎖一致並釋放產品鎖；本輪沒有重跑，不將舊 PASS 代簽 PLAN。QA_NTM_003 只準備語意向量，DSG只改文件；無 active 正式產品 QA 或另一產品 writer。
- preflight 前記錄164個 app/db/scripts/tests/package 檔案 hash 作只讀證據；既有 Auth/root、Beta、UIX dirty 保留。無 env/DSN/DB/live/安裝/Git 寫入，不切 Beta。

## GEN 到 Plan 的落差

| 現況來源 | 觀測 | 新 module 必須承接／不能假設 |
|---|---|---|
| [GEN types](../../app/lib/trusted-network-interface-candidates.ts:63) | candidate 有 interface/source/evidenceIds/unverified；conflicts 有 code/proposals/existing IDs/protected | 沒有 planId/baseRevision/proposalId/ownership/decision 或可寫授權。不能直接把這個結果當可執行 patch |
| [GEN conflict mapping](../../app/lib/trusted-network-interface-candidates.ts:374) | 同 draft 可產生多個 conflict；各 variant 可以共用 interface ID | proposal ID 需含 scope/field/operation/variant，不能只拿介面 ID 或陣列 index；同一變更的多個問題應集中，選項互斥與依賴明確 |
| [GEN row projection](../../app/lib/trusted-network-interface-candidates.ts:171) | 缺 aliases 會投影為 `[]`；衝突 variant 保留 parentName，但不同父方案可能尚無 parentInterfaceId | 不能把輸出缺欄/預設空陣列默認成「清空原值」。需 DSG 決定以 whole-interface 差異明示，或從已驗原輸入保留 presence mask；不可私自改 GEN shape |
| [GEN template removal](../../app/lib/trusted-network-interface-candidates.ts:383) | TEMPLATE_REMOVED 只有 existing IDs，沒有新 interface proposal | 不能憑模板未列出就刪除設備介面；建議本批只保留/排除，remove 明確不支援 |
| [CORE canonical](../../app/lib/trusted-network-model.ts:540) | canonicalProjectV2 只穩定 object key，保留 array order 與安全原文 | snapshot revision 應涵蓋整份 canonical current，不用 time、名稱或 topology.updatedAt 當唯一內容相等證據 |
| [CORE fingerprint](../../app/lib/trusted-network-model.ts:223) | legacy field fingerprint 是私有 deterministic hash；GEN ID 是 SHA-256 | 都不是身份簽章。不得假定所有64 hex fingerprint 都是同算法；plan old/new fingerprint 可另具命名空間，不默改舊 trust |
| [CORE trust validation](../../app/lib/trusted-network-model.ts:439) | 檢查 entity/evidence存在、verified actor/time結構；沒有查 session，也沒有證明 fieldPath/current value 的核實權威 | 新 apply 須按變更欄位重算/失效 trust；只 parse 通過不能當已认证 actor，也不能保留指向旧值的 verified |
| [CORE link validation](../../app/lib/trusted-network-model.ts:366) | 現有重點是 endpoint owner/reference；沒有完整「舊 port 字串 vs 新 name/alias」一致性動作 | 改名/alias/parent 操作要明確重驗受影響 link refs，不能為通過偷偷改 link 或抹除 fromPort/toPort；不支援就 typed reject |

## 現有產品管線不能直接接入

| 路徑 | 實際限制 | 本 phase 處理 |
|---|---|---|
| [StoredProjectSchema](../../app/lib/topology-validation.ts:48) | strict devices/links/groups，沒有 projectSchemaVersion/trustedNetwork | 不改，不把 V2 塞進去 |
| [stripProjectCredentials](../../app/lib/topology-validation.ts:122) | 回傳重新組裝的舊三集合，會丟棄頂層 V2 extension | 不能把 sanitize/strip 當 V2 安全保存；本批不呼叫這條 write path |
| [setProject](../../app/lib/topology-store.ts:387) | 先 sanitize 舊 Project、optimistic Zustand set，再背景 local update/server queue；未具備 trusted plan revision/原子 state+DB commit | 不能呼叫後宣稱 all-or-none persistence；本批僅回傳新 immutable snapshot |
| [saveTopologyProject](../../db/topology-postgres.ts:841) | 有 active user、Pilot scope、transaction row lock，但依舊 validateProject 舊 schema；沒有 trusted baseRevision compare/verify action | 既有 DB tx 不能直接當新 plan 的 transaction 證據；本輪不改或測 DB |
| [transfer schema](../../app/lib/topology-transfer.ts:86) | strict v1 Project；五檔 v2 exchange 不含新 container | JSON/CSV/ZIP 仍不是 V2 備份入口，不改 format/privacy |
| [confirmImport](../../app/page.tsx:1065) | 既有 canApply/blocking/warning/role recheck，用舊 materializeImport/importProject | 可作 fail-closed 行為參考，不等同受信任 plan/actor，不接 UI |
| [Pilot bound resolver](../../app/lib/server/pilot-request.ts:17)、[topology route](../../app/api/topology/route.ts:45) | server 認證在此，但尚無 trusted-verification adapter/權限動作；此樹沒有 session.ts | 不複製 root/Auth 新候選、不硬造 Boss；沒有具名可信 actor adapter 時 accept-and-verify 必須拒絕 |

## 最小 Interface 與範圍建議（待 DSG／PM 固定）

推薦第一批 `PLAN-R1 snapshot-only`，只新增 `app/lib/trusted-network-change-plan.ts`（型別與實作同檔）、`tests/dev-ntm-003*.test.mjs`、必要的自身 synthetic fixtures。保持 CORE-R2/GEN-R1 不動；不新增 pass-through storage abstraction。呼叫者只需 prepare / resolve / apply，完整性、來源映射、互斥決策、依賴、stale/tamper、trust invalidation 都集中同一 module。

候選 interface 意圖，不預設最終函式名稱：

1. prepare：接已授權範圍 current snapshot + 明確 device scope + 已驗生成輸入/可信模板；module內重新呼叫 GEN，不能盲信任意回傳 JSON plan。回可讀 preview 與不可由 request body 偽造的 instance-bound handle。GEN raw輸入只限已安全結構化資料。
2. resolve：只收固定 operation/action/target scope 的選擇，重算 blocking/warnings/dependency；不寫 Project。缺、重複、未知、互斥矛盾決策拒絕。preview.canApply 僅提示，非 apply 授權。
3. apply：校驗同 instance/owner scope、未竄改 handle/private plan、完整 current revision，再在深複製上建新 ProjectV2，所有關聯/trust驗證通過才回傳；任一失敗零部分結果。外部可見 DTO 與內部可執行 plan 分離，不用一般 hash 充當 MAC/signature。

第一批 operation 建議：新增介面與具體選定的介面欄位更新（最終 allowlist 由 DSG 固定）；keep-current/exclude無變更；add-alias 只有契約固定精確值與衝突處理後才實作。不支援 device/link/VLAN/subnet刪改、不自動刪除 TEMPLATE_REMOVED、自由fieldPath、任意patch或傳入actor。plan跨instance/reload/序列化重建不冒充合法ownership；必要時重建preview。

依賴方面：parent/alias以及現有 link/fieldTrust references 需閉包重驗；排除父新增後子新增不能孤立保留。只排除「擬新增/修改提案」，不順便刪既有子項。現有 record 被改值時撤銷對該舊值的 verified/actor/time，建立新 unverified provenance；keep/exclude應逐位元保持既有資料與trust，不能全面降級。

可信 actor：本批沒有真 server/session adapter，因此推薦 default deny `accept-and-verify`；未來若契約允許注入可信校驗依賴，只能作具名合成測試，不宣稱接通 Auth。client body的role/actor/capability、local placeholder/Boss、64hex fingerprint一律不能授予核實。既有 snapshot 內的 verified 僅結構相容，不能倒推 current caller 已認證。缺身份/權限/scope必須拒絕核實。

純 all-or-none 的成功只代表新 snapshot 全部有效、原物件未改；沒有 Dexie transaction、PG row-lock/revision CAS、Zustand rollback 或 multi-request race 證據。這些後續接入需另具名 scope，不在本次偷渡。

## PLAN-01–08 驗收準備

| ID | 純 module 必驗真值 | 不得宣稱 |
|---|---|---|
| PLAN-01 | 同輸入穩定差異/ID，原字串保留、取消/prepare零修改 | UI已可預覽 |
| PLAN-02 | 未解衝突、漏決策、重複/矛盾/未知決策、warning未ack拒絕 | 原UI gate自動等價 |
| PLAN-03 | snapshot stale、wrong device/owner/instance、DTO改canApply/內容/值均拒絕；clone/JSON重建handle不能冒用 | hash簽章/真RBAC/網路session |
| PLAN-04 | keep/exclude逐位元保留；接受受保護變更具名，舊trust失效且不自核實 | 已寫audit/DB |
| PLAN-05 | 缺trusted actor、任意body actor/role、錯scope核實全拒；合成adapter若核准則獨立標示 | 公司Auth/OIDC/真人核實 |
| PLAN-06 | 父排除、alias collision、link/trust孤兒、unsupported operation拒絕，不部分修改 | 其他domain完整編輯 |
| PLAN-07 | 最後一項錯誤也不回半份Project；成功新snapshot全量驗證 | 真DB transaction/競態通過 |
| PLAN-08 | unknown/raw/secret/錯誤不回顯，CORE/GEN受保護hash與回歸 | build/Browser/live/全產品PASS |

預計 no-env targeted tests、原 CORE/GEN 回歸、tsc/scoped lint。当前只有唯讀盤點，尚未執行以上測試；獨立QA準備與產品正式驗收分列。

## DSG 對齊與 PM gate

目前尚未看到完成的 §4 focused addendum。請 DSG 在既有補充內明確定稿：field presence/whole-record 語意、template-remove留存、可接受的GEN conflict及變更欄位、ownership機制、fingerprint命名空間與舊verified失效、trusted actor absent時的行為、Missing Info阻擋/警告分類。這些是本票已核准範圍的局部設計收斂，不重問使用者一般工程細節。

DEV 完成後對照上述落差核實可行性，提交最小路徑與驗收對照供 PM 明確解除產品phase。未取得 gate 前，本次寫入僅限此文件、DEV_NTM_003票及register本列；不提前新增產品/測試或改既有候選。

## §4 Addendum / PM Conditional Review

已完整讀取 DSG 新 [§4 focused addendum](../engineerticket/contracts/TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md)，原 R1 hash `258d5d7c9ec27125648aef71e865b65a368f09adb3fd3fbee0fb00584a10c157`。最小新增兩檔、prepare/resolve/apply、snapshot receipt `persistence:not-performed`、無actor adapter時核實和接受protected變值全拒絕，與本輪scope一致。

DEV識別的局部澄清已由PM具名納入 [scope review](C:/Users/DUS/Desktop/project/nettopo-studio/docs/dev開發紀錄/2026-10-10-pm-ntm-plan-scope-review.md)：

1. Prepared shape沒有staged evidence，不能僅靠可重算hash作為可執行plan；需私有snapshot/evidence closure＋owned handle，clone/JSON重建/cancel後使用拒絕。
2. 全域NFC與CORE原文/任何改動stale相衝突：`Cafe\u0301` → `Caf\u00e9` 不可因NFC同hash而繞過stale，也不可在keep/exclude中重寫原文。
3. GEN缺aliases投影成[]，缺optional字段不是clear意圖；只接受明確present且可解釋的差異，不能默默移除。template/conflict重疊需唯一mapping。
4. legacy私有fingerprint不等於新SHA256，stale/unknown verified不得降為unprotected；rename/alias變更需保留並驗legacy endpoint字串，不改Link解套。
5. issue severity、可解除blocking的exclude/keep、父排除但子accept的矛盾要固定唯一判準，不能一面完整決策一面暗略過。

PM已核PLAN-R1 snapshot方向並條件授權：DSG落盤R1.1後，由DEV逐項核五項與PLAN-01–08、記契約hash/精確scope；全數符合即可轉產品IN_PROGRESS，不需再問一般工程細節。不符合只升該部分。只允許新增 `app/lib/trusted-network-change-plan.ts` 與 `tests/dev-ntm-003-change-plan.test.mjs` 及自身紀錄；沒有合成假actor建構器，verify/protected修改全拒絕。本文先行建議中可能的actor adapter與API形狀均以R1.1為準。

截至此段：preflight完成，等待R1.1對照；產品/測試實作NOT RUN。先前嘗試更新三份DEV文件時register本列被另一組補充，apply_patch校驗失敗且未套用；已重讀最新內容，只追加本次結果，不覆寫他組變更。
