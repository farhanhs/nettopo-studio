# QA_BTA_001 — A08 工具安全審閱與 QA channel runner 準備

日期：2026-10-20（Asia/Taipei）  
工作樹：`C:/Users/DUS/Desktop/project/nettopo-studio/.local/worktrees/public-beta-0.1`  
分支／HEAD：`codex/public-beta-0.1`／`b6d508caee148b0557f0c9370252c8d1b2fcf8ef`  
固定產品候選：R4 ZIP SHA-256 `4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`  
結果：`QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`。正式 A08 仍 `BLOCKED / NOT RUN`。

## QA-owned runner

新增 `scripts/qa-bta/a08-channel-runner.mjs`，CLI 固定為：

`--config --phase --run-id --evidence-root --playwright --fixture-root`

Runner 不接受呼叫者覆寫 external target、port、artifact 或 executable；均由受審 OPS config 解析。三階段均設計為執行 QA-owned loopback observer 正控制；只有 `during-deny` 執行既有 `r3-deep-runner.mjs` daily-flow oracle。`r3-deep-runner.mjs` 增加專用 Browser／Node executable 參數，不改產品。

固定 PM control 已寫入 QA matrix：`https://example.com:443/`、HEAD、無 credentials/body/cookie/redirect、每 exe 每階段一個有效嘗試、timeout ≤ 5 秒、非公開 DNS fail closed。formal runner 仍只輸出 `A08_EVIDENCE_SCHEMA_VALIDATED_NOT_ACCEPTANCE`，不能產生 A08 PASS。

QA runner hashes：

- `a08-channel-runner.mjs` 首版：`27b06c7e61b3a495d2a570a1e31ece0673a93fe9782ee589477be24a5a6e062c`（後續MIME／安全flag校正，現行hash見下節）
- `r3-deep-runner.mjs`：`07c07ce0199e4a645f6654f370368ad5b474ec96acc2fddac7380ce905738c0e`
- `a08-assertions.mjs`：`e918da4eb67d1a263d75b33744f43e12ac2ee58d744e9d81974e6bf40d906909`
- `a08-formal-runner.mjs`：`dd269b77f51ca01463e0fb08dd175ecd82e0a9d1d9215d502012e473b7af2ac4`
- matrix：`1e3f877fe1a569ed9bd132b26cfa3f456ac8f306ac7ac31e953fae6ef1d759f6`
- tests：`e31d26c46c6826f1c75cb6e113e99919c405fd8724868a8d717cfe5245659dee`

Syntax、QA tooling tests `5/5 PASS`、scoped `git diff --check` PASS（CRLF warning only）。

## 行為結果

在不連外、不套 Firewall 的範圍，以 OPS 專用 Chrome／Edge 副本及 fresh profile 執行 loopback observer 正控制。兩次新 evidence root 均在 Chrome 第一個 `http://127.0.0.1:<owned-port>/page` 失敗：`net::ERR_NETWORK_ACCESS_DENIED`，observer events 為空，observer server 都在 finally 關閉。第二次 runner 正確記錄 `QA_CHANNEL_RUNNER_FAIL`；daily flow 如實 `NOT_RUN`。

證據：

- `.local/qa-bta-a08-r4-20261020/qa-runner-prep-01/qa-channel-evidence.json`（保留首輪 runner 尚未記 FAIL 的歷史）
- `.local/qa-bta-a08-r4-20261020/qa-runner-prep-02/qa-channel-evidence.json`

這不能解讀為外部隔離成功；它表示 dedicated Browser fixture 尚未通過最基本 loopback observer positive control。

## OPS fixed candidate 獨立審閱缺陷

1. `selftest.ps1` 自建 `Mock-NewRule`／`Mock-RemoveOwnedRules`，未載入正式工具 seam；其 PASS 不能證明正式 partial-create、timeout 或 cleanup 行為。
2. `manifest.json` 宣告的 `selftest-evidence.json` 不存在；manifest 仍標 `externalControl=NOT_CONFIGURED`，與已核准 config 不一致。
3. 本機正常 PowerShell execution policy 直接拒絕 `selftest.ps1` 與 `ops-bta-a08.ps1`；依契約不得要求 `ExecutionPolicy Bypass`，所以目前無可交使用者的正常執行入口。
4. preflight 只驗 closure manifest 本身 hash，未逐一驗 manifest 所列 1227 檔；`opsFiles` 亦未逐一在 preflight 綁定，TCP probe 未綁定 hash。
5. executable control 以 Browser `--dump-dom` exit code 判成功，無 HTTP status／TLS／錯誤頁／redirect／background request 的可稽核結果；timeout 後未立即終止 child tree。
6. DNS 實作把 private address 過濾後再接受 public，未依契約對 public+private/link-local mixed result fail closed；且要求恰一 public IP，未提供安全的多 public IP 固定策略。
7. Firewall readback 從 rule 物件取 `Protocol`，未查 port filter；RemoteAddress 僅 contains，不能拒絕多餘範圍或證明 effective policy。
8. 4317 loopback 只呼叫 PowerShell TCP，不啟動／核對 owned R4 service 與 PID/starttime/exe；QA runner CLI 尚未依固定契約接線。
9. 未見 Enforce 前的明確 administrator precheck。partial create 與最外層 failure cleanup 尚不能由正式 seam 行為證明。

## 退修與停止點

工具候選解除 QA 鎖定並 `RELEASE_FOR_REPAIR` 給 OPS_ENV_001。OPS 需整批修正、接入上述 QA runner、更新 config／manifest／全部 hashes、提供正式 seam 的 mock/negative/partial cleanup 行為證據並 writer-stop，再交新候選。QA 不提供管理員命令；不執行真 Firewall、external control、stage、commit 或 push。

## QA runner fixture correction

PM指出首版 observer 的 `/page`、`/worker.js`、`/sw.js` MIME 不完整。QA 已修正為 `text/html`／`application/javascript`，並移除 `--disable-features=BlockInsecurePrivateNetworkRequests`；不以關閉 Browser 安全功能繞過。新增 Browser 前的 Node loopback sanity check，用來區分 fixture 與環境拒絕。更新後 runner SHA-256：`b36ce86b0e61aa5bb9965307f9134fe2ec71383396233f636e097f030b7d90c9`。

只再執行一次 `.local/qa-bta-a08-r4-20261020/qa-runner-prep-03`：Node 在 Browser 啟動前連自己的 `127.0.0.1:<owned-port>` 即回 `EACCES`，`nodeFixtureSanity=false`、events空、observer finally關閉、daily flow `NOT_RUN`。因此目前是執行環境 loopback socket blocker；不等同產品或專用Browser缺陷，QA依停止點不再重試或改安全設定。

唯讀 PowerShell 證據：Windows PowerShell `5.1.26100.9711`／`ConsoleHost`，五個 scope均 `Undefined`（有效預設會拒絕未允許script）；bundled pwsh `7.6.5`／`ConsoleHost`，Machine/User/Process/CurrentUser `Undefined`、LocalMachine `RemoteSigned`。QA未改 policy、未用 Bypass。

### 平台核准的單次 loopback 重驗

PM 明確區分既有 Firewall/CIM AccessDenied 與 Codex sandbox loopback 限制，允許只針對現行固定 runner 的本機正控制使用一次平台正式提升。QA確認 `pre-success` 不會執行 external control、Firewall、daily flow、env/DB讀取或共用profile後，以原精確CLI執行一次；平台核准，exit 0。

結果 `QA_CHANNEL_RUNNER_PASS_NOT_A08_ACCEPTANCE`：Node fixture sanity、Chrome、Edge均true；兩個fresh profile都觀測到page、subresource、dedicated worker、service worker、WebSocket；observer在finally關閉。daily flow依設計仍 `NOT_RUN`。證據：`.local/qa-bta-a08-r4-20261020/qa-runner-prep-escalated-01/qa-channel-evidence.json`。

因此 runner observer 能力已證明；先前 `EACCES` 確認為預設sandbox限制，不是fixture、Browser或產品缺陷。這項PASS只解除QA runner正控制疑義，不改變OPS工具審閱失敗，也不代表A08 enforce／產品驗收通過。

## OPS 第三批固定候選重驗

OPS 以 manifest SHA-256 `e90a925b819092d9297db82c38d618da091a429bd4500b3379adc3835edc429a`、`writerStop=true` 重交。QA 鎖定後核對八個 `opsFiles` 全部 hash 相符；fixture closure 1227/1227 逐檔 hash 相符；四個 QA tools、channel runner、deep runner及Playwright binding全部相符。正常 bundled `pwsh 7.6.5`、未使用Bypass執行 `selftest.ps1`，shared lifecycle seam success／baseline／pre／create／readback／during／runner／timeout／cleanup案例回報PASS；Node syntax與QA tooling `5/5 PASS`。

本輪仍 `QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`，不建立attestation，原因：

1. `Resolve-ControlAddress` 仍要求 DNS 恰一位址，與「全部結果先確認public，再固定選一個」契約不符；`$ip.IsLoopback` 仍非 `[IPAddress]::IsLoopback($ip)`。
2. `browser-control.mjs` 仍直接 `page.goto()`；Playwright會跟redirect後才比較final URL，無法證明「不跟redirect」。
3. `Invoke-A08Lifecycle` 的故障保存不精確：body、cleanup、post同時失敗時，後一個finally例外會覆蓋原始錯誤；selftest也未包含post failure與多重失敗聚合。
4. 服務生命週期尚未整合：OPS只 `Assert-OwnedBetaService`，不啟動／停止owned R4。另一方面 `during-deny` QA runner會呼叫既有deep oracle自行start/stop；若依OPS要求預先已有4317 owned listener，deep start會與已執行服務衝突，結束後也會停止服務，使post-control前置失敗。
5. 管理 host 範圍校正：不要求 Windows PowerShell 5.1 相容。既有 pwsh `7.6.5`／`RemoteSigned` 可作正常入口，完整路徑 `C:/Users/DUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe`，SHA-256 `362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139`。未來管理員步驟須先核此host hash／版本／權限，再以完整路徑 `-NoProfile -File` 執行；不得加 ExecutionPolicy Bypass或改policy。此項不再列產品工具缺陷，也不要求安裝或為PS5重寫。
6. Review binding雖已移除修改config的循環，但README仍寫「QA changed reviewStatus」；attestation lifecycle、建立位置與manifest hash固定後如何避免自我批准仍缺可執行runbook。QA不會修改OPS config自批。
7. `selftest-evidence.json` 仍不存在；若已不列為交付應同步移除交接宣稱，若為必要證據則應以固定hash列manifest。現有manifest只宣告 `PASS_MOCK_ONLY`，未提供machine-readable trace evidence。

上述均屬同票既有安全／整合範圍，已直接退OPS。未執行Firewall、example.com、管理員模式或Git。

## OPS 第四批固定候選重驗

新 manifest SHA-256 `fdaafbbac95aeba6c5782701482c0dab0ff8c71898b0b4b8c96638e070c70a18`；11個OPS檔案hash全部吻合，新增 lifecycle seam、normal-host wrapper、selftest evidence與attestation schema。正常 `pwsh 7.6.5 -NoProfile -File` selftest PASS，QA tooling `5/5 PASS`。負向 normal-host preflight在約79秒逐檔驗證後，因獨立QA attestation不存在而 exit 2／fail closed，未連外、未套規則、4317 listener=0。

Redirect-before-request 另以QA fake Playwright行為測試：exact `https://example.com:443/` route為CONTINUE，redirect destination `https://redirect.invalid/` 在wrapper route callback被ABORT，wrapper exit 1，證明不是只看事後final URL。DNS全部public後排序選一、`[IPAddress]::IsLoopback`、phase-specific profiles、multi-error lifecycle aggregation、QA fixture path、independent attestation fields均已修正。

必要整合首輪回 `BTA_RUNTIME_NOT_SETUP`。QA一度將`setup`加入deep runner，第二輪因during環境不含npm而回`BTA_NPM_VERSION_UNSUPPORTED`；PM依LOCAL-FEEDBACK-BETA-V1 §0/§4.2/§5/A08校正：契約是「成功setup一次後」離線日常使用，不要求封鎖期間重跑npm setup。上述第二輪是QA oracle reuse錯誤，不是要求during納入npm。

QA已撤回deep runner無條件setup，A08 channel runner改為呼叫R4自身`runtime/lib/integrity.mjs::verifySetup(packageRoot)`，核真實setup marker、artifact/lock、Node版本及installed runtime tree；只驗不寫，不造marker、不連npm。現行hash：channel runner `d1807e8f201ccac689dfaf88b630ff7381351b5a11ec131e309ce1e7ef7954e7`，deep runner `a58c6744da9c657dd2744ba90fac1e98dff590a67c4f2f587867aae409a0315d`，tooling仍`5/5 PASS`。

結果維持 `QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`，但精確blocker校正為：OPS需交付「合法準備階段已成功setup」的同R4 owned fixture與完整marker/runtime closure hash；during只做verifySetup→start/daily/stop，不得setup或連外npm。只有現有合法材料不足且必須新連外install時才回PM列真正環境前置。QA不建立attestation、不提供管理員Enforce命令。

## OPS 第五批收尾重驗：正式 adapter 安全缺陷

QA 對相同固定 R4 候選及 OPS manifest SHA-256 `486a85d20600ff4607dd3effceae971473c4ab97f417da60bf4a028013fcf3f4` 完成 channel runner 三階段正控制：

- `qa-final-pre-01`：`QA_CHANNEL_RUNNER_PASS_NOT_A08_ACCEPTANCE`，observer 17 events，cleanup closed。
- `qa-final-during-01`：同狀態，`dailyFlow=PASS`，Chrome／Edge daily oracle均PASS。
- `qa-final-post-01`：同狀態，observer 17 events，cleanup closed。

三份 evidence SHA-256 分別為 `26c9a481168da04176a40817237fff48c226be55b1abbceef95224db9a25d878`、`53c9b25bb8f5f62eede341d12c1a8092f68dfd0e377a77af2a6d5654480856b9`、`7cd03dc48bb2c73a8b471f82bed8ebb763ddafdf7a327414284a77ca47216a03`。測後 R4 ZIP SHA仍為 `4c04dc3de0efb121932ff601ab2afb03a6b2b82e60958643e388fe807bd9195a`、HEAD仍為 `b6d508caee148b0557f0c9370252c8d1b2fcf8ef`、4317 listener 0、staged 0。

但在建立獨立 attestation 前，QA 以正式 `lifecycle-seam.ps1` 搭配 mock OS resource 重新檢查實際 adapter 邊界，確認三個必要安全缺陷：

1. 正式 `-Create` 於 `New-NetFirewallRule` 成功返回後才將規則加入 `ownedRules`。若 OS 已建立規則但 cmdlet 接著拋錯，seam catch 因 ownership 尚未登記而直接退出，cleanup 只迭代 registered owned list，該規則可殘留。
2. lifecycle 順序只有 `Cleanup → PostControl`。正式 post-control 會再次啟動 QA runner及 Browser external controls，新增 process/profile；之後沒有 final cleanup，故 post phase 新資源不受清理保證。
3. Node during-deny 以任何 `ExitCode != 0` 判定封鎖成功；而 TCP probe 的一般 request error也是exit 1。語法、檔案或一般TLS／網路錯誤可被誤報為 `DENIED_BY_OWNED_RULE`。

QA 將上述三項加入 `tests/qa-bta-001-a08-tooling.test.mjs`，結果 `8/8 PASS`；新增三個 PASS 代表缺陷被確實重現，而不是工具安全通過。先前短暫建立、尚未交付的attestation已撤回；normal-host preflight未完成，未執行Firewall、external target或管理員模式。

最終結論：`QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`。OPS需：(a) 建立前／後以精確owned name做finally readback與清理；(b) 增加post-control後final cleanup並驗證process/profile/rule零殘留；(c) 為Node probe定義獨立的expected-deny exit code，只接受該code；並更新正式seam selftest、manifest及hash後重新writer-stop交QA。正式A08維持`BLOCKED / NOT RUN`，不得提供或執行管理員Enforce命令。

## OPS 第五批修正版重驗

OPS以manifest SHA-256 `97cfcfa65a5b09d5b60861d7abc465755956162f707777950893f196225a6fb6`重交，writer-stop與固定R4 identity未變。11個OPS檔案依manifest核對；主要新hash為OPS script `76f50ff5…1360`、lifecycle seam `6c11aad3…6572`、TCP probe `d45f0080…a67e`、selftest `9f669919…9840`。正常pwsh `-NoProfile -File selftest.ps1`回PASS。

QA按影響重跑正式seam／adapter負向探針，結果`10/10 PASS`。FinalCleanup已實作且QA證明能清除PostControl新增資源；但四項必要缺陷仍成立：

1. `RecoverOwned`在實際`Get-NetFirewallRule` readback拋錯時會把例外傳出，未以baseline已證明不存在且run-id唯一的精確rule name做finally removal；已建立但readback unavailable的rule仍可能不在owned list而殘留。OPS selftest只讓mock `RecoverOwned`回true，沒有覆蓋真adapter readback-error。
2. Node雖新增exit 4，但timeout、`ECONNREFUSED`、`ECONNRESET`、`ENETUNREACH`、`EHOSTUNREACH`都映射同一exit 4；一般網路錯誤仍可被during分類為Firewall deny。
3. Browser wrapper以字串`https://example.com:443/`比較Browser request/final URL；標準URL canonicalization會省略預設443成`https://example.com/`，合法首次request可能在route層被自身abort。先前fake Playwright保留輸入字串，未覆蓋Browser canonical URL。
4. Node probe連固定IP並設定TLS `servername=example.com`，但未設定HTTP `Host: example.com`；預設Host會取connect IP，可能被不同vhost拒絕，使baseline失去與核准目的地一致性。

本輪未建立attestation，唯讀Preflight不再繼續；Firewall、external target、administrator Enforce、Git均NOT RUN。結論仍為`QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`。OPS須以真adapter mock覆蓋readback unavailable後exact-name cleanup、區分一般錯誤與rule-caused deny、對URL使用一致canonical比較並拒絕redirect chain、固定Host header後更新manifest/hash再交QA。

### PM 對 Node deny 語意的校正

PM釐清：timeout／refused／reset／unreachable可以記為`NETWORK_FAILURE_OBSERVED`，不要求Windows Firewall一定提供唯一錯誤碼；但單一error或exit code不得直接標示`DENIED_BY_OWNED_RULE`。正式QA enforcement結論必須合併同一executable與同一resolved IP的pre成功、有效精確rule readback、during沒有成功、cleanup完成及post成功。一般參數／程式／TLS／protocol錯誤必須與network-failure observation分離。現行adapter仍以Node exit 4直接滿足during expected-deny，因此缺陷與退修結論不變；OPS可依上述聚合證據修正，不必追求OS專屬唯一deny code。

RecoverOwned修正邊界亦同步明確：baseline已證明精確且唯一run rule name不存在後，Create前先登記owned creation intent；即使create/readback拋錯，finally仍按該exact name嘗試移除並驗零殘留。不得掃描或刪除未知既有規則。

### 真 Browser redirect negative control

依PM引用的Playwright redirect行為，QA新增`tests/qa-bta-001-a08-browser-redirect.test.mjs`，以固定Chrome及兩個QA-owned loopback HTTP endpoints執行真Browser 302→sink。測試沿用正式wrapper的`context.route('**/*')`／只允許初始URL／`route.continue()`模式，不用`route.fetch`或APIRequest、不連外、不關安全功能。結果`1/1 PASS`，且sink實際hits=`1`；亦即route handler未攔redirect continuation，Browser確實跟隨到第二端點。Browser/context/server均在finally關閉。

這項證據取代先前只靠fake Playwright的redirect判斷：現行Browser adapter不能證明`allowRedirects=false`。OPS須改用仍由目標Browser executable發出請求、且能在response stage拒絕3xx或Browser-native `fetch`設定`redirect:'error'`、`credentials:'omit'`與bounded abort的實作；修復後同一真Browser測試必須sink hits=`0`，並保留合法同目的地成功正控制。

## OPS CDP／adapter 修正版與 raw evidence 缺口

OPS以manifest SHA-256 `f469511fe156addf70fe524c33aefa1a46325bf6f42ab56b7700dba67b13ae8a`重交。QA恢復受config綁定的原tooling test SHA `e31d26c…9dee`，另以獨立`qa-bta-001-a08-adapter.test.mjs`保存新增probe。tooling＋adapter合計`9/9 PASS`，OPS selftest與probe classification selftest均PASS。Creation intent、readback unavailable後exact-name cleanup、FinalCleanup、Node error分類、Host header、canonical URL及CDP request-stage策略均通過檢查。

真Browser loopback測試已改用與正式wrapper相同的CDP `Fetch.enable` Request-stage策略；固定Chrome執行302→sink為`1/1 PASS`且sink hits=`0`，證明redirect continuation在抵達sink前被阻擋。未使用`context.route`、`route.fetch`、APIRequest、外連或安全停用flag。

但簽署attestation前核出既有formal evidence缺口：`ops-bta-a08.ps1`只將preflight物件輸出JSON；pre／during／post各executable的`Invoke-ExecutableControl`結果全部pipe到`Out-Null`，`Assert-RuleReadback`也不保存實際rule identity/filter/readback，沒有run-level success/failure/final cleanup journal。QA runner三份JSON只證明loopback channels與daily flow，不能替代外部control或Firewall rule raw evidence。故人類即使得到exit 0，QA仍無法驗證同exe／同resolved IP的pre成功、精確rule readback、during network failure observation、cleanup及post成功因果。

結論仍`QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`，不建立attestation或admin步驟。OPS只需補最小machine-readable run journal：固定run-id與candidate/tool hashes、resolved IP、各phase每exe executable hash／probe classification／exit、exact rule name及effective readback、cleanup/final-cleanup零殘留、全部錯誤聚合與證據路徑；不得保存秘密或response body。journal須在failure/recovery也落盤且不可覆寫既有run。修正後更新manifest/hash、writer-stop再交QA；未受影響daily flow不重跑。

## OPS run journal 修正版實測

OPS以manifest SHA-256 `08175c1d61bfae7351e0ba7fd17b181f915f1e72acfb9528b6eae79d698db21c`重交。未變的adapter、CDP與daily flow證據沿用；QA tooling受綁定SHA仍為`e31d26c…9dee`，獨立adapter加tooling`9/9 PASS`。

QA以正常pwsh、無attestation、無管理員／Firewall／外連執行唯一run-id `qa-journal-failure-probe-01`。約50秒後如預期fail closed，並產生failure journal：`.local/qa-bta-a08-r4-20261020/evidence/qa-journal-failure-probe-01/run-journal.json`，SHA-256 `898ef839a329b07bec7b21e4562396ce4f863a4a03281caf46e434a5c3f84d22`。內容含candidate、OPS manifest/config hashes、BLOCKED status、failure與evidence path，未連外或套rule。

以相同run-id第二次執行，原journal未被覆寫；但工具先重新執行完整約50秒preflight，最後進`finally/Save-RunJournal`才因`Run journal already exists`失敗。這證明no-overwrite存在，卻不是run前reservation；若為Enforce，同run-id可能先重做Firewall／external probes，最後才發現journal不可寫，違反unique/no-overwrite及一次有效attempt gate。

另有三項journal內容仍不足：

1. Enforce成功路徑沒有把`journal.status`由`RUNNING`改為明確成功狀態。
2. `cleanup`只記將要刪除的rule names，未記刪除後逐一`Assert-RuleAbsent`的實際零殘留結果。
3. `final-cleanup`的`ownedProcessCount/ownedProfileCount`取追蹤collection count；collection未清空，因此不是實際剩餘process/profile count，也沒有實際path/PID absence結果。

Manifest也未包含可執行journal success/failure/recovery selftest；故尚無成功journal實際內容可驗。結論仍`QA_TOOL_REVIEW_FAILED / RELEASE_FOR_REPAIR`：OPS須在任何preflight/Enforce動作前以atomic create/reservation拒絕重複run-id；補明確final status與post-cleanup actual absence events；以adapter mock產生並驗證成功、primary failure、cleanup failure、recovery與duplicate-run案例後綁入manifest。未建立attestation/admin runbook，正式A08仍BLOCKED。
