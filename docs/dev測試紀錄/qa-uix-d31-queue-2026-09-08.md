# QA UIX D31 Queue Alignment — 2026-09-08

| 欄位 | 內容 |
|---|---|
| Source | `PM_GOV_001-D31` |
| Scope | Queue alignment only |
| Result | Recorded; no QA execution started |
| Product changes | None |
| Browser tests | Not run |
| Commit / push / deploy | Not performed |

## Queue

| Order | QA Ticket | Dependency | Status | Future verification focus |
|---:|---|---|---|---|
| 1 | `QA_UIX_002` | `DEV_UIX_006 READY_FOR_QA` | `BLOCKED` | Inspector selection/save/reload、read-only guard、credential boundary |
| 2 | `QA_UIX_003` | `DEV_UIX_007 READY_FOR_QA` | `BLOCKED` | Topbar 768/1024/1280、200% zoom、長身分、bounding boxes、pointer/keyboard |
| 3 | `QA_UIX_004` | `DEV_UIX_008 READY_FOR_QA` | `BLOCKED` | Login first frame Canvas/resize、panel restore、pan/zoom 不被 selection reset |
| 4 | `QA_UIX_005` | `DEV_UIX_009 READY_FOR_QA` and `DEV_UIX_003 READY_FOR_QA` | `BLOCKED` | 多成本路由幾何、deterministic、drag stability、performance、no-path |

## Active Ticket Readback

- `DEV_UIX_006` currently `READY`; corresponding `QA_UIX_002` remains `BLOCKED` until `READY_FOR_QA`.
- `DEV_UIX_007` currently `READY`; corresponding `QA_UIX_003` remains `BLOCKED` until `READY_FOR_QA`.
- `DEV_UIX_008` currently `READY`; corresponding `QA_UIX_004` remains `BLOCKED` until `READY_FOR_QA`.
- `DEV_UIX_009` currently `BLOCKED`; `DEV_UIX_003` currently `BLOCKED`; corresponding `QA_UIX_005` remains `BLOCKED`.

## Notes

- This record only aligns the queue and dependencies requested by PM.
- No product files, Browser evidence, QA execution status, Register status, staging, commit, push, or deploy were changed in this step.
