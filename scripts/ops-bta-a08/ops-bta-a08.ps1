[CmdletBinding()]
param(
    [ValidateSet('Preflight', 'Enforce')]
    [string] $Mode = 'Preflight',
    [string] $RunId = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$toolRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$worktree = [IO.Path]::GetFullPath((Join-Path $toolRoot '..\..'))
$configPath = Join-Path $toolRoot 'control-config.json'
$lifecyclePath = Join-Path $toolRoot 'lifecycle-seam.ps1'
. $lifecyclePath
. (Join-Path $toolRoot 'journal-seam.ps1')
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$runId = if ($RunId) { $RunId } else { [guid]::NewGuid().ToString('N') }
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $worktree $config.fixture.relativeRoot))
$packageRoot = [IO.Path]::GetFullPath((Join-Path $fixtureRoot $config.fixture.packageRelativeRoot))
$ownedRules = @()
$ownedProcesses = [Collections.ArrayList]::new()
$ownedProfiles = [Collections.ArrayList]::new()
$processCleanupErrors = [Collections.ArrayList]::new()
$journalPath = Join-Path $fixtureRoot "evidence\$runId\run-journal.json"
$journalReservation = Reserve-A08Journal $journalPath
$journal = [ordered]@{ schemaVersion = 1; ticket = 'OPS_ENV_001'; runId = $runId; candidate = $config.candidate; toolHashes = [ordered]@{ opsManifest = (Get-FileHash (Join-Path $toolRoot 'manifest.json') -Algorithm SHA256).Hash.ToLower(); config = (Get-FileHash $configPath -Algorithm SHA256).Hash.ToLower() }; resolvedIp = $null; events = [Collections.ArrayList]::new(); status = 'RUNNING'; evidencePaths = [Collections.ArrayList]::new() }

function Add-JournalEvent([string] $Kind, [object] $Data) { [void]$journal.events.Add([ordered]@{ kind = $Kind; data = $Data }) }
function Save-RunJournal {
    Write-A08Journal $journalPath $journal
}

function Get-Canonical([string] $Path) {
    (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath
}

function Assert-NoReparsePath([string] $Path, [string] $Root) {
    $canonicalRoot = Get-Canonical $Root
    $canonical = Get-Canonical $Path
    if (-not ($canonical.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase) -or $canonical.StartsWith($canonicalRoot + '\', [StringComparison]::OrdinalIgnoreCase))) {
        throw "Path escapes owned root: $canonical"
    }
    $current = Get-Item -LiteralPath $canonical -Force -ErrorAction Stop
    while ($null -ne $current) {
        if (($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point rejected: $($current.FullName)" }
        if ($current.FullName.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) { break }
        $parent = if ($current.PSIsContainer) { $current.Parent } else { $current.Directory }
        if ($null -eq $parent) { throw "Owned root was not reached: $canonical" }
        $current = Get-Item -LiteralPath $parent.FullName -Force -ErrorAction Stop
    }
    $ancestor = Get-Item -LiteralPath $canonicalRoot -Force -ErrorAction Stop
    while ($null -ne $ancestor) {
        if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse ancestor rejected: $($ancestor.FullName)" }
        $parent = if ($ancestor.PSIsContainer) { $ancestor.Parent } else { $ancestor.Directory }
        if ($null -eq $parent) { break }
        $ancestor = Get-Item -LiteralPath $parent.FullName -Force -ErrorAction Stop
    }
    return $canonical
}

function Assert-Hash([string] $Path, [string] $Expected) {
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) { throw "Hash mismatch: $Path expected $Expected got $actual" }
    return $actual
}

function Assert-QaTools {
    $reviewPath = Join-Path $worktree $config.qaTools.reviewRelativePath
    Assert-NoReparsePath $reviewPath $worktree | Out-Null
    $review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
    if ($review.status -ne 'QA_TOOL_REVIEW_PASS' -or $review.actualRulesApplied -ne $false) { throw 'QA review is not a no-mutation security PASS' }
    if ($review.candidate.zipSha256 -ne $config.candidate.zipSha256 -or $review.candidate.head -ne $config.candidate.head) { throw 'QA review candidate binding mismatch' }
    if (-not $review.opsManifestSha256 -or -not $review.attestationId -or $review.attestationId -notmatch '^QA-A08-') { throw 'QA independent attestation fields missing' }
    $opsManifest = Join-Path $toolRoot 'manifest.json'
    if ((Get-FileHash -LiteralPath $opsManifest -Algorithm SHA256).Hash.ToLowerInvariant() -ne $review.opsManifestSha256) { throw 'QA review OPS manifest binding mismatch' }
    if ($review.PSObject.Properties.Name -contains 'configSha256') { throw 'QA review must not bind mutable OPS config; use independent attestation fields' }
    foreach ($entry in $config.qaTools.files) {
        $path = Join-Path $worktree $entry.relativePath
        Assert-NoReparsePath $path $worktree | Out-Null
        Assert-Hash $path $entry.sha256 | Out-Null
    }
}

function Assert-QaRunner {
    if ($config.qaChannelRunner.status -ne 'CONFIGURED') { throw "QA channel runner not configured: $($config.qaChannelRunner.status)" }
    $path = Join-Path $worktree $config.qaChannelRunner.relativePath
    Assert-NoReparsePath $path $worktree | Out-Null
    Assert-Hash $path $config.qaChannelRunner.sha256 | Out-Null
    $deep = Join-Path $worktree $config.qaChannelRunner.deepRunnerRelativePath
    Assert-NoReparsePath $deep $worktree | Out-Null
    Assert-Hash $deep $config.qaChannelRunner.deepRunnerSha256 | Out-Null
    $playwright = Join-Path $worktree $config.qaTools.playwright.relativePath
    Assert-NoReparsePath $playwright $worktree | Out-Null
    Assert-Hash $playwright $config.qaTools.playwright.sha256 | Out-Null
}

function Get-SafeEnvironment {
    $allow = 'SystemRoot','WINDIR','TEMP','TMP'
    $envMap = @{}
    foreach ($name in $allow) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($value) { $envMap[$name] = $value }
    }
    return $envMap
}

function Start-SafeProcess([string] $Executable, [string[]] $Arguments, [string] $Cwd) {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $Executable
    $psi.WorkingDirectory = $Cwd
    $psi.UseShellExecute = $false
    foreach ($arg in $Arguments) { [void]$psi.ArgumentList.Add($arg) }
    $psi.Environment.Clear()
    foreach ($item in (Get-SafeEnvironment).GetEnumerator()) { $psi.Environment[$item.Key] = $item.Value }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $psi
    if (-not $process.Start()) { throw "Unable to start owned process: $Executable" }
    $record = [pscustomobject]@{ Process = $process; Pid = $process.Id; Start = $process.StartTime; Executable = [IO.Path]::GetFullPath($Executable) }
    [void]$ownedProcesses.Add($record)
    return $record
}

function Assert-Preflight {
    if (-not (Test-Path -LiteralPath $fixtureRoot -PathType Container)) { throw "Fixture missing: $fixtureRoot" }
    Assert-NoReparsePath $fixtureRoot $fixtureRoot | Out-Null
    if (-not (Test-Path -LiteralPath $packageRoot -PathType Container)) { throw "Package root missing: $packageRoot" }
    Assert-NoReparsePath $packageRoot $fixtureRoot | Out-Null
    foreach ($entry in $config.fixture.executables.psobject.Properties) {
        $path = Join-Path $fixtureRoot $entry.Value.relativePath
        Assert-NoReparsePath $path $fixtureRoot | Out-Null
        Assert-Hash $path $entry.Value.sha256 | Out-Null
    }
    $manifest = Join-Path $packageRoot 'beta-manifest.json'
    Assert-NoReparsePath $manifest $fixtureRoot | Out-Null
    Assert-Hash $manifest $config.candidate.manifestSha256 | Out-Null
    $closure = Join-Path $fixtureRoot $config.fixture.closureManifest.relativePath
    Assert-NoReparsePath $closure $fixtureRoot | Out-Null
    Assert-Hash $closure $config.fixture.closureManifest.sha256 | Out-Null
    $closureObject = Get-Content -LiteralPath $closure -Raw | ConvertFrom-Json
    if (@($closureObject.files).Count -ne [int]$config.fixture.closureManifest.fileCount) { throw 'Fixture closure file count mismatch' }
    foreach ($item in $closureObject.files) {
        $file = Join-Path $fixtureRoot ($item.path.Replace('/','\'))
        Assert-NoReparsePath $file $fixtureRoot | Out-Null
        Assert-Hash $file $item.sha256 | Out-Null
    }
    $opsManifest = Get-Content -LiteralPath (Join-Path $toolRoot 'manifest.json') -Raw | ConvertFrom-Json
    if ($opsManifest.candidate.zipSha256 -ne $config.candidate.zipSha256) { throw 'OPS manifest candidate mismatch' }
    foreach ($item in $opsManifest.opsFiles) {
        $file = Join-Path $worktree $item.path
        Assert-NoReparsePath $file $worktree | Out-Null
        Assert-Hash $file $item.sha256 | Out-Null
    }
    Assert-QaTools
    Assert-QaRunner
    $safe = Get-SafeEnvironment
    if ($safe.Keys | Where-Object { $_ -match 'SECRET|TOKEN|PASSWORD|DSN|DATABASE|API_KEY' }) { throw 'Unsafe environment key in child allowlist' }
    if ($config.externalControl.status -ne 'CONFIGURED') { throw "External control not configured: $($config.externalControl.status)" }
    if (-not $config.externalControl.host -or [int]$config.externalControl.port -lt 1) { throw 'External control host/port missing' }
}

function Assert-AdministratorPreflight {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'ADMIN_PRECHECK_BLOCKED: elevated administrator token required' }
    Get-NetFirewallProfile -ErrorAction Stop | Out-Null
}

function Get-FirewallRuleOrFail([string] $Name) {
    $err = $null
    $rule = Get-NetFirewallRule -Name $Name -ErrorAction SilentlyContinue -ErrorVariable err
    if ($err) { throw "Firewall baseline/readback error for ${Name}: $($err[0].Exception.Message)" }
    return $rule
}

function Assert-RuleAbsent([string] $Name) {
    try { $rule = Get-FirewallRuleOrFail $Name } catch { if ($_.Exception.Message -match 'No MSFT|NotFound') { return }; throw }
    if ($rule) { throw "Rule already exists or survived cleanup: ${Name}" }
}

function Test-Tcp([string] $TargetHost, [int] $Port, [bool] $ExpectedSuccess) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync($TargetHost, $Port)
        if (-not $task.Wait(2000)) { $success = $false } else { $success = $client.Connected }
    } catch { $success = $false } finally { $client.Dispose() }
    if ($success -ne $ExpectedSuccess) { throw "TCP control mismatch ${TargetHost}:$Port expected=$ExpectedSuccess actual=$success" }
    return $success
}

function Resolve-ControlAddress {
    $addresses = [Net.Dns]::GetHostAddresses($config.externalControl.host)
    if (@($addresses).Count -eq 0) { throw 'Control DNS returned no addresses' }
    foreach ($ip in $addresses) {
        $bytes = $ip.GetAddressBytes()
        $private = [Net.IPAddress]::IsLoopback($ip) -or $ip.IsIPv6LinkLocal -or $ip.IsIPv6SiteLocal -or $ip.IsIPv6UniqueLocal
        if ($ip.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) { $private = $private -or $bytes[0] -eq 0 -or $bytes[0] -eq 10 -or $bytes[0] -eq 127 -or ($bytes[0] -eq 169 -and $bytes[1] -eq 254) -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168) }
        if ($private) { throw "Control DNS returned a private, loopback, or link-local address: $ip" }
    }
    return [string](@($addresses | Sort-Object { [string]$_ })[0])
}

function Assert-RuleReadback([pscustomobject] $Rule, [string[]] $ExpectedRemoteAddresses) {
    $stored = Get-NetFirewallRule -Name $Rule.name -ErrorAction Stop
    $app = Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $stored -ErrorAction Stop
    $addr = Get-NetFirewallAddressFilter -AssociatedNetFirewallRule $stored -ErrorAction Stop
    $port = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $stored -ErrorAction Stop
    if ($stored.Name -ne $Rule.name -or [string]$stored.Enabled -ne 'True' -or $stored.Direction -ne 'Outbound' -or $stored.Action -ne 'Block' -or $stored.Profile -ne 'Any') { throw "Rule policy readback mismatch: $($Rule.name)" }
    if ($app.Program -ne $Rule.program) { throw "Rule application readback mismatch: $($Rule.name)" }
    if ([string]$port.Protocol -ne 'Any' -or [string]$port.LocalPort -ne 'Any' -or [string]$port.RemotePort -ne 'Any') { throw "Rule port filter readback mismatch: $($Rule.name)" }
    $actual = @($addr.RemoteAddress | ForEach-Object { [string]$_ } | Sort-Object)
    $expected = @($ExpectedRemoteAddresses | ForEach-Object { [string]$_ } | Sort-Object)
    if (($actual -join '|') -ne ($expected -join '|')) { throw "Rule address readback mismatch: $($Rule.name)" }
    return [ordered]@{ name = $stored.Name; enabled = [string]$stored.Enabled; direction = [string]$stored.Direction; action = [string]$stored.Action; profile = [string]$stored.Profile; program = $app.Program; protocol = [string]$port.Protocol; localPort = [string]$port.LocalPort; remotePort = [string]$port.RemotePort; remoteAddress = $actual }
}

function Assert-LoopbackOnlyBetaService {
    $listeners = @(Get-NetTCPConnection -LocalPort $config.loopback.port -State Listen -ErrorAction Stop)
    if ($listeners.Count -eq 0) { return }
    if (@($listeners | Where-Object { $_.LocalAddress -ne $config.loopback.host }).Count) { throw 'Beta service has a non-loopback listener' }
}

function Get-OwnedProcessTree {
    $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $pids = [Collections.Generic.HashSet[int]]::new()
    foreach ($record in @($ownedProcesses)) { [void]$pids.Add([int]$record.Pid) }
    do {
        $changed = $false
        foreach ($item in $all) { if ($pids.Contains([int]$item.ParentProcessId) -and $pids.Add([int]$item.ProcessId)) { $changed = $true } }
    } while ($changed)
    $allowed = @($config.fixture.executables.psobject.Properties | ForEach-Object { (Get-Canonical (Join-Path $fixtureRoot $_.Value.relativePath)).ToLowerInvariant() })
    $oldest = (@($ownedProcesses | Sort-Object Start)[0]).Start
    return @($all | Where-Object { $pids.Contains([int]$_.ProcessId) -and $_.ExecutablePath -and $allowed -contains (Get-Canonical $_.ExecutablePath).ToLowerInvariant() -and $_.CreationDate -and ([Management.ManagementDateTimeConverter]::ToDateTime($_.CreationDate) -ge $oldest) } | Sort-Object @{ Expression = { $depth = 0; $parent = [int]$_.ParentProcessId; while ($pids.Contains($parent)) { $depth++; $parentItem = @($all | Where-Object ProcessId -eq $parent)[0]; $parent = [int]$parentItem.ParentProcessId }; $depth }; Descending = $true })
}

function Cleanup-OwnedProcesses {
    try {
        foreach ($child in @(Get-OwnedProcessTree)) { try { Stop-Process -Id ([int]$child.ProcessId) -Force -ErrorAction Stop } catch { [void]$processCleanupErrors.Add("child cleanup $($child.ProcessId): $($_.Exception.Message)") } }
    } catch { [void]$processCleanupErrors.Add("process tree inspection: $($_.Exception.Message)") }
    foreach ($p in @($ownedProcesses)) {
        try { if (Get-Process -Id $p.Pid -ErrorAction SilentlyContinue) { [void]$processCleanupErrors.Add("owned process remains: $($p.Pid)") } } catch { [void]$processCleanupErrors.Add("process cleanup $($p.Pid): $($_.Exception.Message)") }
    }
    foreach ($profile in @($ownedProfiles)) {
        try { Assert-NoReparsePath $profile $fixtureRoot | Out-Null; if (Test-Path -LiteralPath $profile) { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction Stop }; if (Test-Path -LiteralPath $profile) { [void]$processCleanupErrors.Add("owned profile remains: $profile") } } catch { [void]$processCleanupErrors.Add("profile cleanup $profile`: $($_.Exception.Message)") }
    }
}

function Invoke-QaRunner([string] $Phase) {
    Assert-QaRunner
    $runner = Join-Path $worktree $config.qaChannelRunner.relativePath
    $evidenceRoot = Join-Path $fixtureRoot "evidence\$runId-$Phase"
    if (Test-Path -LiteralPath $evidenceRoot) { throw "QA evidence root already exists: $evidenceRoot" }
    $node = Get-Canonical (Join-Path $fixtureRoot $config.fixture.executables.node.relativePath)
    $playwright = Join-Path $worktree $config.qaTools.playwright.relativePath
    $qaFixture = Get-Canonical (Join-Path $worktree $config.qaChannelRunner.qaFixtureRootRelativePath)
    $record = Start-SafeProcess $node @($runner,'--config',$configPath,'--phase',$Phase,'--run-id',"$runId-$Phase",'--evidence-root',$evidenceRoot,'--playwright',$playwright,'--fixture-root',$qaFixture) $worktree
    if (-not $record.Process.WaitForExit(120000)) { Cleanup-OwnedProcesses; throw 'QA channel runner timed out' }
    if ($record.Process.ExitCode -ne 0) { throw 'QA channel runner failed' }
}

function Invoke-ExecutableControl([pscustomobject] $Spec, [string] $TargetHost, [string] $TargetIp, [int] $TargetPort, [bool] $ExpectedSuccess, [string] $Phase) {
    if ($Spec.kind -eq 'node') {
        $probe = Join-Path $toolRoot 'tcp-control-probe.mjs'
        $record = Start-SafeProcess $Spec.program @($probe, $TargetIp, "$TargetPort", [string]$config.externalControl.path, $TargetHost) $toolRoot
    } else {
        $profile = Join-Path $fixtureRoot "profiles\$($Spec.kind)-$runId-$Phase"
        $canonicalFixture = Get-Canonical $fixtureRoot
        if (-not $profile.StartsWith($canonicalFixture + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Profile escapes fixture root: $profile" }
        [void]$ownedProfiles.Add($profile)
        $browserProbe = Join-Path $toolRoot 'browser-control.mjs'
        $playwright = Join-Path $worktree $config.qaTools.playwright.relativePath
        $node = Get-Canonical (Join-Path $fixtureRoot $config.fixture.executables.node.relativePath)
        $record = Start-SafeProcess $node @($browserProbe,$playwright,$Spec.program,$TargetHost,$TargetIp,"$TargetPort",[string]$config.externalControl.path,$profile,[string]$ExpectedSuccess) $toolRoot
    }
    $exited = $record.Process.WaitForExit(30000)
    if (-not $exited) { Cleanup-OwnedProcesses; throw "Executable control timed out kind=$($Spec.kind)" }
    $success = $record.Process.ExitCode -eq 0
    $valid = if ($ExpectedSuccess) { $record.Process.ExitCode -eq 0 } elseif ($Spec.kind -eq 'node') { $record.Process.ExitCode -in @(1,3,4) } else { $record.Process.ExitCode -eq 2 }
    if (-not $valid) { throw "Executable control mismatch kind=$($Spec.kind) expected=$ExpectedSuccess exit=$($record.Process.ExitCode)" }
    Add-JournalEvent 'executable-control' ([ordered]@{ phase = $Phase; kind = $Spec.kind; executable = $Spec.program; executableSha256 = (Get-FileHash $Spec.program -Algorithm SHA256).Hash.ToLower(); expectedSuccess = $ExpectedSuccess; exitCode = $record.Process.ExitCode; classification = if ($record.Process.ExitCode -eq 0) { 'SUCCESS' } elseif ($record.Process.ExitCode -eq 4) { 'EXPECTED_DENY' } elseif ($record.Process.ExitCode -in @(1,3)) { 'NETWORK_FAILURE_OBSERVED' } else { 'PROGRAM_OR_TLS_FAILURE' } })
    return $record
}

try {
    $preflight = [ordered]@{ schemaVersion = 1; ticket = 'OPS_ENV_001'; mode = $Mode; runId = $runId; status = 'PRECHECK' }
    Assert-Preflight
    $preflight.status = 'READY_FOR_QA_REVIEW'
    $preflight | ConvertTo-Json -Depth 8
    if ($Mode -eq 'Preflight') { exit 0 }

    Assert-AdministratorPreflight
    $targetHost = [string]$config.externalControl.host
    $targetIp = Resolve-ControlAddress
    $journal.resolvedIp = $targetIp
    $targetPort = [int]$config.externalControl.port
    $rules = foreach ($entry in $config.fixture.executables.psobject.Properties) {
        [pscustomobject]@{ kind = $entry.Name; program = (Get-Canonical (Join-Path $fixtureRoot $entry.Value.relativePath)); name = "NetTopo-QA-BTA-A08-$runId-$($entry.Name)" }
    }
    $addressSet = @($config.ruleAddressPolicy.ipv4 + $config.ruleAddressPolicy.ipv6)
    Invoke-A08Lifecycle -Rules $rules -OwnedRules $ownedRules -Baseline {
        param($items) foreach ($r in $items) { Assert-RuleAbsent $r.name }
    } -PreControl {
        param($items) Assert-LoopbackOnlyBetaService; Invoke-QaRunner 'pre-success'; foreach ($r in $items) { Invoke-ExecutableControl $r $targetHost $targetIp $targetPort $true 'pre-success' | Out-Null }
    } -Create {
        param($r) New-NetFirewallRule -Name $r.name -DisplayName $r.name -Direction Outbound -Action Block -Program $r.program -Profile Any -Protocol Any -RemoteAddress $addressSet -Description "OPS_ENV_001 owned run $runId" | Out-Null; [void]$ownedRules.Add($r); $rb=Assert-RuleReadback $r $addressSet; Add-JournalEvent 'rule-readback' $rb
    } -RecoverOwned {
        param($r) try { return [bool](Get-NetFirewallRule -Name $r.name -ErrorAction Stop) } catch { throw "Owned rule readback unavailable for $($r.name): $($_.Exception.Message)" }
    } -DuringControl {
        param($items) foreach ($r in $items) { Invoke-ExecutableControl $r $targetHost $targetIp $targetPort $false 'during-deny' | Out-Null }; Assert-LoopbackOnlyBetaService
    } -Runner {
        Invoke-QaRunner 'during-deny'
    } -Cleanup {
        param($items, $owned)
        $ruleResults = [Collections.ArrayList]::new()
        foreach ($r in @($owned | Sort-Object -Property name -Descending)) {
            $removed = $false; $absent = $false
            try { Remove-NetFirewallRule -Name $r.name -ErrorAction Stop; $removed = $true } catch { [void]$processCleanupErrors.Add("rule cleanup $($r.name): $($_.Exception.Message)") }
            try { Assert-RuleAbsent $r.name; $absent = $true } catch { [void]$processCleanupErrors.Add("rule residue $($r.name): $($_.Exception.Message)") }
            [void]$ruleResults.Add([ordered]@{ name = $r.name; removed = $removed; absentAfter = $absent })
        }
        Add-JournalEvent 'cleanup' ([ordered]@{ rules = @($ruleResults) })
    } -PostControl {
        param($items) Assert-LoopbackOnlyBetaService; Invoke-QaRunner 'post-success'; foreach ($r in $items) { Invoke-ExecutableControl $r $targetHost $targetIp $targetPort $true 'post-success' | Out-Null }
    } -FinalCleanup {
        param($items, $owned)
        Cleanup-OwnedProcesses
        $remainingProcesses = @($ownedProcesses | Where-Object { Get-Process -Id $_.Pid -ErrorAction SilentlyContinue } | ForEach-Object { [ordered]@{ pid = $_.Pid; path = $_.Executable } })
        $remainingProfiles = @($ownedProfiles | Where-Object { Test-Path -LiteralPath $_ } )
        Add-JournalEvent 'final-cleanup' ([ordered]@{ errors = @($processCleanupErrors); remainingProcesses = $remainingProcesses; remainingProfiles = $remainingProfiles; remainingRuleNames = @($owned | ForEach-Object name) })
        if ($processCleanupErrors.Count -or $remainingProcesses.Count -or $remainingProfiles.Count) { throw (($processCleanupErrors | ForEach-Object { "A08_FINAL_CLEANUP: $_" }) -join '; ') }
    }
    $journal.status = if ($processCleanupErrors.Count) { 'COMPLETED_WITH_CLEANUP_ERRORS' } else { 'COMPLETED_PASS' }
} catch {
    $journal.status = 'BLOCKED'
    Add-JournalEvent 'failure' ([ordered]@{ message = $_.Exception.Message })
    [Console]::Error.WriteLine("A08_$Mode`_BLOCKED: $($_.Exception.Message)")
    exit 2
} finally {
    [void]$journal.evidencePaths.Add($journalPath)
    if ($journal.status -eq 'RUNNING' -and $Mode -eq 'Preflight') { $journal.status = 'PRECHECK_BLOCKED_OR_READY' }
    Save-RunJournal
}
