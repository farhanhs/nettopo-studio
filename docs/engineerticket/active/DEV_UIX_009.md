# DEV_UIX_009 — 多成本自動繞線實作

| 欄位 | 值 |
|---|---|
| Group | DEV |
| Feature | UIX |
| Priority | P1 |
| Status | BLOCKED |
| Planned Order | 077 |
| Change Type | EXTEND |
| Dependency | DSG_UIX_003 approved READY |
| QA | QA_UIX_005 |

## Scope

- 依核准契約在 `topology-routing.ts` 實作 deterministic bounded candidate search/cost。
- 設備避障保持硬限制；crossing/overlap/label/bend/length/stability 作軟成本。
- drag-stop 重算且互動不凍結；route 仍是 view derivation，不改 durable schema。
- 失敗後交 DEV_UIX_003 顯示具體 fallback 原因；禁止以移除警告或放寬碰撞規則通過。

