# OPS_ENV_001 A08 tool

This is a QA-review candidate for the fixed R4 ZIP. The default mode is read-only preflight. `Enforce` is fail-closed until all of these are true:

- the fixture and every executable path pass realpath/ancestor reparse checks and fixed SHA256 checks;
- the QA tool hashes match the fixed bindings and an independent QA attestation file is present; QA never edits `control-config.json`;
- a PM/IT-approved disposable external control host and port are configured;
- the process and listener preconditions are captured;
- normal Windows Firewall administration is available.

The tool never accepts caller-supplied executable paths, profiles, or external destinations. It creates one exact outbound rule per dedicated executable only after baseline checks. A partial create rolls back only rules created by the current run. Cleanup matches the owned rule name and process PID/starttime/executable; unknown resources are preserved.

The executable control is per program: Node runs the fixed `tcp-control-probe.mjs`; Chrome and Edge use the fixed `browser-control.mjs` wrapper, their copied executable, and a phase-specific fresh profile with Playwright response/page checks. QA's fixed runner owns the seven product-channel observations, the `tests/fixtures/qa-bta-001` daily oracle, and the 4317 Beta service lifecycle; OPS only verifies loopback-only binding and never starts or stops that service.

The external control is configured only as the PM-approved public `https://example.com:443/` HEAD control. The real mode remains blocked until the independent QA attestation, normal administrator/firewall preflight, and QA-owned loopback service evidence are present. On normal Windows hosts use `run-preflight.cmd`, which requires installed `pwsh.exe` and never uses ExecutionPolicy Bypass. No external control or firewall mutation has been run in this handoff.
