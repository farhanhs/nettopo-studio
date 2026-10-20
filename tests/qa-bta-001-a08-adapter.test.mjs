import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pwsh = "C:\\Users\\DUS\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe";

test("OPS lifecycle creation intent cleans partial-create even when ownership readback throws", () => {
  const seam = path.resolve("scripts/ops-bta-a08/lifecycle-seam.ps1");
  const script = `
    . '${seam.replaceAll("'", "''")}'
    $rule = [pscustomobject]@{ name = 'qa-partial-create' }
    $owned = [Collections.ArrayList]::new(); $osRules = [Collections.ArrayList]::new()
    try {
      Invoke-A08Lifecycle -Rules @($rule) -OwnedRules $owned -Baseline {} -PreControl {} -Create {
        param($r) [void]$osRules.Add($r); throw 'OS_CREATE_RETURNED_RULE_THEN_THROW'
      } -RecoverOwned {
        param($r) throw 'OS_RULE_READBACK_UNAVAILABLE'
      } -DuringControl {} -Runner {} -Cleanup {
        param($items,$registered) foreach($r in @($registered)){ [void]$osRules.Remove($r) }
      } -PostControl {} -FinalCleanup {}
    } catch {}
    if ($owned.Count -ne 1 -or $osRules.Count -ne 0) { exit 9 }
    exit 0
  `;
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("OPS lifecycle final cleanup removes resources created by post-control", () => {
  const seam = path.resolve("scripts/ops-bta-a08/lifecycle-seam.ps1");
  const script = `
    . '${seam.replaceAll("'", "''")}'
    $owned = [Collections.ArrayList]::new(); $profiles = [Collections.ArrayList]::new()
    $rule = [pscustomobject]@{ name = 'qa-post-control' }
    Invoke-A08Lifecycle -Rules @($rule) -OwnedRules $owned -Baseline {} -PreControl {} -Create {
      param($r) [void]$owned.Add($r)
    } -RecoverOwned { $false } -DuringControl {} -Runner {} -Cleanup {
      $profiles.Clear()
    } -PostControl {
      [void]$profiles.Add('post-profile')
    } -FinalCleanup {
      $profiles.Clear()
    }
    if ($profiles.Count -ne 0) { exit 9 }
    exit 0
  `;
  const result = spawnSync(pwsh, ["-NoProfile", "-Command", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("OPS Node probe separates program/TLS errors and pins the approved Host header", () => {
  const source = fs.readFileSync(new URL("../scripts/ops-bta-a08/ops-bta-a08.ps1", import.meta.url), "utf8");
  const probe = fs.readFileSync(new URL("../scripts/ops-bta-a08/tcp-control-probe.mjs", import.meta.url), "utf8");
  assert.match(source, /elseif \(\$Spec\.kind -eq 'node'\) \{ \$record\.Process\.ExitCode -in @\(1,3,4\) \}/);
  assert.match(probe, /return 5;/);
  assert.match(probe, /headers: \{ Host: serverName \}/);
  assert.match(probe, /ECONNREFUSED.*ECONNRESET.*ENETUNREACH.*EHOSTUNREACH.*return 1/);
});

test("OPS Browser control canonicalizes default ports and uses CDP request-stage redirect blocking", () => {
  const source = fs.readFileSync(new URL("../scripts/ops-bta-a08/browser-control.mjs", import.meta.url), "utf8");
  assert.equal(new URL("https://example.com:443/").href, "https://example.com/");
  assert.match(source, /const canonical = value =>/);
  assert.match(source, /Fetch\.enable.*requestStage: 'Request'/s);
  assert.match(source, /Fetch\.failRequest/);
  assert.doesNotMatch(source, /context\.route\(/);
});
