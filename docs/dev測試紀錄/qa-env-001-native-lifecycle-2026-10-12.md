# QA_ENV_001 — OPS native lifecycle candidate independent QA — 2026-10-12

## Outcome

- Ticket：`QA_ENV_001@dustool`
- Candidate：`OPS_ENV_001 / B1-native-lifecycle-R1`
- Native phase result：`QA_PASSED`
- Whole ticket result：`BLOCKED`（Docker cold-start／container B3／Browser／CI remain separate）
- Worktree：`C:/Users/DUS/Desktop/project/nettopo-studio`
- Branch / HEAD：`dustool` / `72783636a8b22f353e8c25fe68b859ad62e3c237`
- Final OPS manifest：`docs/engineerticket/contracts/OPS_ENV_001-B1-MANIFEST-R1.json`
- Manifest raw SHA-256：`2b7dcf35efc0bf20421fa2a28be2b7bcb70257e76a46430acae417e514ad8e8f`
- QA runner：`tests/qa-env-001-native-lifecycle.test.mjs`
- QA runner raw SHA-256：`01901cf2560b7b36b62da1fc32c531bbede37ca5acc70430d869197189ec1cf8`

This batch follows root R3 and `HARNESS-AUTHORIZATION.md`. It independently accepts only the native disposable lifecycle tooling. It does not claim the Docker engine/harness, container lifecycle, Browser, CI/rulesets, Auth product or deployment is ready.

## Handoff correction and candidate lock

The initial OPS handoff supplied a doctor fingerprint that covered package/lock plus all app/db/scripts/tests. QA correctly treated it as a broad source observation, not the exact tool closure, and stopped before starting PostgreSQL.

OPS then supplied an 11-entry manifest covering CLI, lifecycle implementation, environment/policy, OPS tests, package/lock and the exact native PostgreSQL `initdb`, `postgres` and `pg_ctl` binaries. QA found one pre-formal drift: `native-lifecycle.mjs` changed from raw `37ffedd7075d764952e2d780d601822cfdadb6cd65ec2bf5640fb3ef4bd3c6b7` to `8f01b2f56effa90dcaf801a5842f756d54763b47c5aaa22995dfaad9beb57ed2`. OPS identified the exact change as removal of an unused `catch (error)` binding, reran 7/7 self-tests and issued the final manifest. The older freeze claim was not reused.

QA independently verified the final manifest: 11 entries, 0 byte/hash mismatch, 0 path outside the approved root and 0 reparse point; `writerStopped=true`. Candidate and QA runner are recorded separately. The final broad doctor observation changed after QA edited its own runner; this is an expected QA-layer delta, not an OPS candidate mutation. Exact manifest hashes remained unchanged.

## Independent acceptance

| Acceptance | Evidence | Result |
|---|---|---|
| ENV-01 | OS allowlist removes DB, migration, Auth, preload, proxy, Docker, Compose, home/profile and arbitrary sentinel variables | PASS |
| ENV-02 | isolated environment construction leaves the parent source object unchanged | PASS |
| ENV-03 | approved paths are contained regular files; no symlink/reparse traversal; arbitrary case/command values remain rejected by guardrail regression | PASS |
| ENV-04 | exact manifest detects candidate byte drift; QA runner is separately hashed | PASS |
| ENV-05 | Node 24.18.0, PostgreSQL 17.10, direct dependency parity MATCH, native toolchain READY, pre/post fixture directory count 0 | PASS for native phase |
| ENV-06 normal | run `ops-env-001-1791795857193-0744c7e3`, port 57132, PID 42796; PASS; PID stopped, port closed, directory removed | PASS |
| ENV-06 controlled failure | run `ops-env-001-1791795875981-5f7690de`, port 57139, PID 22924; failure occurred after PostgreSQL ready with `CONTROLLED_INIT_FAILURE`; cleanup complete | PASS |
| ENV-06 readiness timeout | run `ops-env-001-1791795894853-ad6b6efd`, port 57144, PID 53740; `READINESS_TIMEOUT`; cleanup complete | PASS |
| CLI entrypoint | run `ops-env-001-1791795925395-ac914b91`, port 61744, PID 57056; normal CLI exit successful and cleanup complete | PASS |

Every port was loopback and not 5432. QA independently rechecked each reported PID had stopped, each port was closed and each data directory no longer existed. Final `.local/ops-env-001-runs` directory count was 0. No unknown resource was stopped or deleted.

## Commands and history

- Initial QA runner: 5/5 PASS.
- Strengthened QA runner first attempt: 4/5; QA-only assertion incorrectly expected a timeout `failureMessage` even though the bounded contract exposes only `READINESS_TIMEOUT`. Cleanup assertions had already passed. This failure is retained as QA harness history, not classified as an OPS product/tool failure.
- Corrected QA assertion: full 5/5 PASS, 0 fail/skip.
- OPS guardrail regression: 4/4 PASS.
- Actual CLI normal scenario: PASS with cleanup complete.
- Node syntax checks: PASS.
- Scoped ESLint: PASS, 0 warnings.
- Scoped `git diff --check`: no content error; register has the existing CRLF warning only.
- Post-run OPS manifest: 11/11 MATCH.
- Staged index: empty; Git fsmonitor IPC emitted an existing query warning during status/diff checks, and no global setting was changed.

## Boundary and next owner

No `.env` file, existing DSN, current/shared database, Browser, Docker container, remote daemon, company API or live system was used. No package was installed and package/lock were unchanged. Owned native fixtures were disposable and cleaned.

The native B1 candidate is released from QA with phase `QA_PASSED`. Overall `QA_ENV_001` remains `BLOCKED`: Docker cold-start ×2, container B3, Browser and CI/rulesets are `BLOCKED/NOT RUN` and are not signed by this evidence. Next owner is PM/OPS for the remaining explicitly scoped environment phases; no stage, commit, push, merge or deploy is authorized.

## 2026-10-13 post-commit bounded rerun supplied by PM

This is supplemental evidence for the same Native B1 candidate, not a new QA phase or a replacement independent QA signature. Candidate HEAD was `e8088a989dfbde0b4f4451dc3dd9ee77fc2f4df4`; `scripts/qa-env/native-lifecycle.mjs` remained raw `8f01b2f56effa90dcaf801a5842f756d54763b47c5aaa22995dfaad9beb57ed2`, and the QA runner remained raw `01901cf2560b7b36b62da1fc32c531bbede37ca5acc70430d869197189ec1cf8`. PM reported the exact serial command `node --test --test-concurrency=1 tests/ops-env-001-guardrails.test.mjs tests/qa-env-001-native-lifecycle.test.mjs` passed 9/9 with 0 fail/skip under a platform-approved elevated execution context; no program, environment file or security setting was changed.

- Normal run `ops-env-001-1791877823162-c13f5509`: loopback port 62950, PID 48400, PASS.
- Controlled-failure run `ops-env-001-1791877841175-1ab1ba2f`: loopback port 62484, PID 53184, expected `CONTROLLED_INIT_FAILURE`.
- Readiness-timeout run `ops-env-001-1791877858782-d6490bf6`: loopback port 59922, PID 51456, expected `READINESS_TIMEOUT`.
- All three runs reported cleanup complete, port closed, directory removed and owned PID stopped; final fixture directory count was 0.

The earlier managed-sandbox failure is retained: `initdb` failed before producing an owned PID and emitted restricted-token error code 87 plus a safe directory-creation error; cleanup still left fixture directories at 0. Raw committed bytes and working-tree bytes had already been checked equal, so line-ending or commit conversion is not supported as the cause. The elevated rerun shows an execution-permission/context difference, but it does not by itself establish the exact Windows root cause. Therefore the same Native B1 phase remains `QA_PASSED` with an explicit execution-context limitation, while the overall ticket remains `BLOCKED` for the unchanged Docker cold-start, B3, Browser and CI/rulesets scope.
