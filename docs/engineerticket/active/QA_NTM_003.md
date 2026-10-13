# QA_NTM_003 — 差異預覽與衝突套用獨立驗收

| 欄位 | 值 |
|---|---|
| Status / Planned Order | QA_PASSED（PLAN-R1 pure snapshot） / 164 |
| Owner | 測試組 019fac8e-94dc-79c1-b156-7f242cf82967 |
| Development Branch | codex/dev-rel-001-checkpoint |
| Worktree | C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/dev-rel-001-checkpoint |
| Base Commit | a9abe637f0ad419aced6d31faf30a127ce5b81e6 |
| Integration Target | 同分支，不跨線、不Git |
| Authority / Dependency | 2026-10-10 使用者接續；DEV_NTM_003／DSG focused addendum／PM scope check |

先獨立整理 [DEV_NTM_003](DEV_NTM_003.md) PLAN-01–08 的行為案例與真值，對齊§4局部契約。不得猜API/actor方案/上限後寫不符契約的adapter；語意fixture可先準備，正式呼叫待公開interface。沿用前票工具經驗，驗fixture本身不要先觸發getter或依賴不存在欄位。

允許 `tests/qa-ntm-003*.test.mjs`、`tests/fixtures/qa-ntm-003/**`、自身票/日誌/manifest/register本列。QA不修改產品、DEV測試或DSG契約。準備PASS≠產品PASS；正式QA待scope、固定候選+相依/工具manifest、writer停止及hash鎖定。

重點：取消／keep/exclude零副作用，protected field不默改，changed value不能借舊verified標記，stale/tampered/wrong scope/unknown decision拒絕，可信actor與user-supplied metadata分離，相依排除／完整性重驗，all-or-none與safe typed error。純函式、真儲存、Browser與Auth核實整合分開報告。CORE/GEN精確回歸，不搬舊PASS。

僅no-env合成資料與既有本樹工具；無新安裝、現用env/DB/Browser/live/Git權限。保留首敗與工具校正歷史；集中完成可測批次，cleanup+release後直接同票退DEV。必要QA後PM PRE-COMMIT，不自行下一票。

## Preparation — 2026-10-10

QA 已在指定 checkpoint worktree 接單並核 branch／HEAD `codex/dev-rel-001-checkpoint`／`a9abe637f0ad419aced6d31faf30a127ce5b81e6`，保留所有既有dirty變更。新增QA-owned PLAN-01–08 semantic vectors、synthetic secret/actor boundary fixture與preparation guard；不猜尚未發布的prepare/resolve/apply API、actor adapter或上限。正式產品仍 `NOT RUN`，待focused addendum＋PM scope check＋fixed manifest／writer stop／hash lock。未讀env，未碰DB／Browser／live／安裝／Git，Beta證據未混用。

Preparation self-check 6/6 PASS，syntax與scoped ESLint PASS。QA-only hashes：runner `87881de9086c56975d7045cfb79d9b6c7ecddd89dcd5ea01a3bba59ac125746d`、plan vectors `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`、secret/actor fixture `90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`。狀態維持 `READY` 等固定候選；PLAN-01–08產品全數 `NOT RUN`，cleanup=0、index empty。

2026-10-10 DSG addendum alignment：QA 唯讀核對 `TRUSTED-NETWORK-TOPOLOGY-V1-SECTION4-ADDENDUM.md` raw SHA-256 `258d5d7c9ec27125648aef71e865b65a368f09adb3fd3fbee0fb00584a10c157` MATCH。自有fixture補公開三操作、add/replace與有限field paths、resolution actions、error precedence及pure phase actor真值；`accept-and-verify`與protected change在無adapter時固定 `TRUSTED_ACTOR_REQUIRED`，persistence receipt固定`not-performed`。actor-backed verification／persistence／Browser／DB仍 `NOT RUN`，正式QA仍等PM scope與固定DEV候選。

Addendum-aligned preparation self-check 7/7、syntax、scoped ESLint均PASS。更新QA-only hashes：runner `a6470a51d5011d073da1cc9f6ea88295bd285536e2352700bfba4d622eba7b70`、contract alignment `81d582f209c17676125687aadf274949d993f76cba9ac32104591933f97f2456`；原plan vectors與secret/actor fixture hashes維持 `e61baf9b...`／`90136509...`。舊preparation hash保留歷史，不作正式候選證據。

2026-10-10 PM scope review alignment：已讀 root `2026-10-10-pm-ntm-plan-scope-review.md`。QA 新增 `r1-1-pending-vectors.json`，涵蓋不可偽造 executable plan／私有 evidence closure、NFC 等價但 raw 不同仍 stale、缺欄位與 aliases 預設不得視為 clear、stale verified trust 不得降級、interface rename 必須重驗 legacy Link port reference、GEN severity／排除重算與 parent-child 衝突必須只有一個契約真值。以上全部標記 `PENDING_DSG_R1_1`；QA 不用舊 addendum 的歧義自行決定正式斷言。正式 PLAN-01–08 仍 `NOT RUN`，等待 R1.1、固定 DEV manifest、writer stop 與 hash lock。

R1.1 pending preparation self-check 8/8 PASS；syntax與scoped ESLint PASS；`git diff --check` 無content error（shared register僅CRLF提醒），staged index empty。QA-only hashes：runner `d8e29b8d13b9526607cb52d13188af5359397767c8cacb50884c74592cc678e4`、pending vectors `986352711c06a83abbe1c52cc546d3b259bd4df52385d878847a25212207873b`、contract alignment `81d582f209c17676125687aadf274949d993f76cba9ac32104591933f97f2456`、plan vectors `e61baf9bd1b52a7075efda3529f620c1b397dd9a8f0fc9fd0ca94e73cda0dd7f`、secret/actor fixture `90136509948c6797776fe484b8191671f90a5481f745d9b70957905a8dceca5c`。cleanup=0；未執行產品、env、DB、Browser、live、安裝或Git寫入。

2026-10-10 R1.1 final alignment：QA 獨立驗證 final addendum SHA-256 `e612bc77309a64b7b12326a5e11e82b2197462dc42fa1cd4403d6dc141ab5255` 與通知一致，parent hash `0bb2145fb2b1844d576449e55c6f3e040ce9ae14175891c21716d963334dbf63`。原 pending vectors 已由 fixed `r1-1-contract-vectors.json` 取代；固定 same-instance private handle/evidence、clone/JSON/cross-instance invalid、raw NFC/NFD stale、no implicit clear、stale verified hard-block、legacy port coupled alias、GEN severity/recompute、parent excluded + child accepted 回 `TRUSTED_DECISION_DEPENDENCY_CONFLICT`，以及 safe snapshot receipt。準備 8/8 PASS，syntax與scoped ESLint PASS，diff check無content error，index empty。新 hashes：runner `d218fe30cd05dadf1b80e08de2c91d5d73d42bced833b17da8a312b200414650`、contract alignment `a82f13dc44a7711f4f0dae072d01b80055beaf49c65521bc177e8e60702f9758`、R1.1 vectors `4a3491f64c37ae1e385cbc716b943debf34e4ae235f4e0f4d825064666fa9c72`。正式產品仍 `NOT RUN`，等固定 DEV candidate／manifest／writer release。

## Formal acceptance — 2026-10-12

依 PM 正式派單與 root R3／`HARNESS-AUTHORIZATION.md`，QA 已鎖定 DEV PLAN-R1 候選。manifest raw `b75045ead054d01906adfdb3dbd77f32e78938afa0f8724ac30da718a3641585`；獨立核對 28 entries 為 0 mismatch／0 worktree 外路徑／0 reparse point，並確認產品 raw `e403bd8be3a448870158353e2fa0cbb30e90af59c79ed85fd385b2a73933d6fb`。測後 hashes 不變、index empty。

QA 新增正式 runner `tests/qa-ntm-003-formal.test.mjs`（raw `5c9480733b53ab891918675f15820ef5c644cc41ad3b9efb05ce1dc0582f783e`），直接走公開 planner interface 驗 PLAN-01–08：10/10 PASS。CORE／GEN／PLAN serial affected batch 122/122 PASS，0 fail/skip；TypeScript、scoped ESLint、syntax、diff check均PASS。無產品缺陷或退修項。

本次只核准 pure snapshot；actor-backed verification、persistence、Browser、DB、Auth、CSV仍 `NOT RUN`。未載入env，未建立程序／port／container／DB／Browser資源，cleanup=0。QA 已 release candidate lock；next owner PM PRE-COMMIT。無stage/commit/push/merge/deploy。

完整證據：[qa-ntm-003-plan-r1-2026-10-12.md](../../dev測試紀錄/qa-ntm-003-plan-r1-2026-10-12.md)。
