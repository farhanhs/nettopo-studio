[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'journal-seam.ps1')
$root = Join-Path $env:TEMP "a08-journal-selftest-$([guid]::NewGuid().ToString('N'))"
try {
    $path = Join-Path $root 'run-journal.json'
    [void](Reserve-A08Journal $path)
    $duplicate = $false
    try { Reserve-A08Journal $path } catch { $duplicate = $true }
    if (-not $duplicate -or -not (Test-Path -LiteralPath "$path.reserve")) { throw 'duplicate reservation was not fail-closed' }
    $journal = [ordered]@{ status = 'COMPLETED_PASS'; events = @(
        [ordered]@{ kind = 'success'; data = @{ final = 'PASS' } },
        [ordered]@{ kind = 'primary-failure'; data = @{ message = 'primary' } },
        [ordered]@{ kind = 'cleanup-failure'; data = @{ message = 'cleanup' } },
        [ordered]@{ kind = 'post-failure'; data = @{ message = 'post' } },
        [ordered]@{ kind = 'final-cleanup'; data = @{ remainingProcesses = @(); remainingProfiles = @(); remainingRuleNames = @() } },
        [ordered]@{ kind = 'recovery'; data = @{ exactRuleName = 'owned-run-rule'; absentAfter = $true } }
    ) }
    Write-A08Journal $path $journal
    $read = Get-Content $path -Raw | ConvertFrom-Json
    if ($read.status -ne 'COMPLETED_PASS' -or @($read.events).Count -ne 6 -or @($read.events | Where-Object kind -eq 'final-cleanup').Count -ne 1) { throw 'journal content verification failed' }
    'OPS_A08_JOURNAL_SELFTEST=PASS'
} catch {
    [Console]::Error.WriteLine("OPS_A08_JOURNAL_SELFTEST=FAIL: $($_.Exception.Message)")
    exit 1
} finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue }
}
