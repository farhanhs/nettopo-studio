# PM_GOV_004 — CSV Bundle v2 QA 退件與修正鏈決議

| 欄位 | 值 |
|---|---|
| Group | PM |
| Feature | GOV |
| Priority | P0 |
| Status | READY |
| Planned Order | 025 |
| Checkpoint | Transfer Governance |
| Dependencies | QA_IMP_001 QA_FAILED |
| Created／Updated | 2026-08-26 |

## PM Conclusion

`QA_IMP_001` 退件成立並維持 `QA_FAILED`。四個失敗都違反已核准的 `PM_GOV_001-D22`，其中 duplicate filename 會 silent last-wins、size limit 又發生在 `file.text()` 之後，屬於交換協定入口與資源耗用邊界，不是單純 UI 缺字或單一 parser edge case。

## Evidence

- `app/page.tsx` 的 `prepareImport()` 目前先執行 `file.text()`，無法證明 10 MiB／25 MiB 是 parser 前 gate。
- `app/lib/topology-transfer.ts` 的 `parseCsvBundle()` 目前直接以 filename 建立 `Map`，同名後檔會覆蓋前檔。
- QA probe 證明缺少 `credentials.masked.csv`、duplicate `devices.csv`、mixed safe/full 均仍可產生 `canApply=true`。
- 既有 19/19 transfer／validation／crypto 測試通過，只能證明基礎護欄未回歸，不能抵銷 D22 新合約失敗。

## Approved Decision

採用 `PM_GOV_001-D23`：Import 必須只有一條不可繞過的驗證管線：

```text
Browser File metadata
  → File Gate（count／extension／10 MiB each／25 MiB batch）
  → Manifest Gate（mode／canonical names／unique／required members）
  → Envelope & Row Gate（headers／schemaVersion／sharing／Zod）
  → Relation & Missing Info Gate
  → Preview（blocking 時 Apply disabled）
  → Zustand importProject
  → sanitized Dexie／PostgreSQL persistence
```

v1 legacy 三檔相容路徑必須與 v2 模式辨識清楚分離；不得因相容性而允許 v2 缺檔、混版或混 sharing。

## Corrective Order and Release Gate

1. `DSG_IMP_002`：先完成 strict contract、資料型別、錯誤模型與測試地圖，停在 PM review。
2. `DEV_IMP_002`：實作 pre-read file gate、manifest、模式辨識與 blocking preview。
3. `DEV_EXP_002`：收斂五檔 canonical export 與 Full／Safe round-trip contract。
4. `DEV_SEC_002`：在 IMP／EXP 固定後補 persistence／DOM／network／bundle secret hardening 與 developer regression。
5. `QA_IMP_001`：使用原票同票 re-test，保留首輪失敗，重跑全部 IMP／EXP／SEC Browser acceptance。

`PM_REL_001`、checkpoint commit 與 Pilot deploy 在 `QA_IMP_001 = QA_PASSED` 前持續 blocked。

## Non-decisions

- 不新增 ZIP import；Browser 仍須先解壓後選五個 CSV。
- 不把 masked credential 還原進 Project、Zustand、Dexie、PostgreSQL credential store。
- 不藉此擴張 OIDC、MFA、正式 RBAC 或文件格式範圍。

