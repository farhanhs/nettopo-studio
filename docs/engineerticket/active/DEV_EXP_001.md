# DEV_EXP_001 — CSV Bundle v2 Safe／Full、ZIP 與 Round-trip

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | EXP |
| Priority | P1 |
| Status | QA_RETURNED |
| Planned Order | 041 |
| Checkpoint | Transfer Export |
| Dependencies | DEV_SEC_001 READY_FOR_QA |
| Created／Updated | 2026-08-10／2026-08-26 |

## Objective

一鍵輸出固定五檔 ZIP，Safe 預設、Full 受權限 gate，並以自動化證明 CSV round-trip。

## Contract

- 五檔：`devices.csv`、`links.csv`、`groups.csv`、`credentials.masked.csv`、`missing-info.csv`。
- Safe default；Pilot Full default off；Engineer 永遠不可 Full。
- Full 也不得輸出 plaintext credential、ciphertext 或 nonce。
- 無 masked-read 權限時 credentials file 為 header-only並顯示摘要。
- 所有 CSV cell formula-neutralized；ZIP 不得有額外檔、路徑或重複 member。
- Full round-trip 比較完整 canonical Project。
- Safe round-trip 比較 `safeCanonical(original)`，不要求還原已刻意移除欄位。
- masked credential 與 checklist UI state 不屬可寫回 Project 的 round-trip 資料。

## Verification Gate

Browser download、解壓、五檔選取再匯入、Apply、reload、再匯出 canonical equality 與 secret/formula scan。

## QA Return — 2026-08-26

`QA_IMP_001` 尚未能進入完整 Browser round-trip；共同 v2 manifest／sharing contract 先於 `DSG_IMP_002` 重整，後續 export 修正歸 `DEV_EXP_002`。本票保留原始交付歷史，不再作為 Release-ready 狀態。
