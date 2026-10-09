# UIX_006-008 A-REV-03 Local Checkpoint

## Candidate

- Branch: `codex/dev-rel-001-checkpoint`
- Base: `1b0b084518886cda347f175bfc959401fd1d18ed`
- Packet: `A-WP-20261005-UIX-006-008-A-REV-03`
- Manifest SHA-256: `eb032e4622707943fb7a0623c64aaacca2c8e22740ae2fd4af5d6e38e078fa64`
- User authorization: tested and accepted for this local checkpoint on 2026-10-09.

## Commits

1. `5ee0e11b605979f39fc9e4aeba43ffffb798946c` — `[DEV_UIX_006] fix(ui): remount inspector fields by selection`
2. `c481ab43a059e4d6eac782e01ba82c9b774928f1` — `[DEV_UIX_007] fix(ui): prevent responsive topbar overlap`
3. `cb485ea5f25106e1653762bbe391f57703249aab` — `[DEV_UIX_008] fix(canvas): synchronize initial viewport sizing`

Each patch was applied to the index in packet order. No `git add .`, reset, checkout, stash, or worktree overwrite was used.

## Committed-tree Verification

- UIX_006 commit: 3/3 focused tests PASS.
- UIX_007 commit: 8/8 cumulative focused tests PASS.
- UIX_008 commit: 16/16 cumulative focused tests PASS.
- Final manifest paths: 6/6 match between `HEAD`, working tree, and `expectedFinal` after LF normalization.
- Git index returned empty after every engineering commit.
- Port 4490 had no listener before staging began; cleanup was owned by PM and was not repeated by DEV.

## Boundary

- This is a local engineering checkpoint only.
- No push, cross-branch integration, merge, deployment, A09 sign-off, or release sign-off occurred.
- Existing dirty governance, QA evidence, AST/MED/AIL, and other ticket scopes remain uncommitted and were not staged.
- Next owner: QA_PIL_006 for independent A09 committed-tree verification. A04/A05/A07 remain PARTIAL and the broader release remains incomplete.
