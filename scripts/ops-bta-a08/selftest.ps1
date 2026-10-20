[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lifecycle-seam.ps1')

function Invoke-SeamCase([string] $FailurePoint, [string] $ExpectedError) {
    $global:a08FailurePoint = $FailurePoint
    $owned = [Collections.ArrayList]::new()
    $trace = [Collections.ArrayList]::new()
    $resources = @{ 'unknown-resource' = 'preserve' }
    $rules = @([pscustomobject]@{ name = 'owned-rule' })
    $body = {
        Invoke-A08Lifecycle -Rules $rules -OwnedRules $owned -Trace $trace -Baseline {
            param($items) if ($global:a08FailurePoint -eq 'baseline') { throw 'A08_SEAM_BASELINE_FAIL' }
        } -PreControl {
            param($items) if ($global:a08FailurePoint -eq 'pre-control') { throw 'A08_SEAM_PRE_CONTROL_FAIL' }
        } -Create {
            param($rule)
            if ($global:a08FailurePoint -eq 'create' -or $global:a08FailurePoint -eq 'recover-unavailable') { throw 'A08_SEAM_CREATE_FAIL' }
            if ($global:a08FailurePoint -eq 'readback') { [void]$owned.Add($rule); throw 'A08_SEAM_READBACK_FAIL' }
            [void]$owned.Add($rule)
        } -RecoverOwned {
            param($rule) if ($global:a08FailurePoint -eq 'recover-unavailable') { throw 'A08_SEAM_RECOVER_READBACK_UNAVAILABLE' }; return ($global:a08FailurePoint -eq 'create' -or $global:a08FailurePoint -eq 'readback')
        } -DuringControl {
            param($items)
            if ($global:a08FailurePoint -eq 'during') { throw 'A08_SEAM_DURING_FAIL' }
        } -Runner {
            if ($global:a08FailurePoint -eq 'runner') { throw 'A08_SEAM_RUNNER_FAIL' }
            if ($global:a08FailurePoint -eq 'timeout') { throw 'A08_SEAM_TIMEOUT_FAIL' }
        } -Cleanup {
            param($items, $ownedRules)
            foreach ($rule in @($ownedRules)) { [void]$ownedRules.Remove($rule) }
            if ($global:a08FailurePoint -eq 'cleanup' -or $global:a08FailurePoint -eq 'cleanup-post') { throw 'A08_SEAM_CLEANUP_FAIL' }
        } -PostControl {
            param($items)
            if ($global:a08FailurePoint -eq 'post' -or $global:a08FailurePoint -eq 'cleanup-post') { throw 'A08_SEAM_POST_FAIL' }
        } -FinalCleanup {
            param($items, $ownedRules)
            if ($ownedRules.Count -ne 0) { throw 'A08_SEAM_FINAL_CLEANUP_RESIDUE' }
        }
    }
    $thrown = $false
    try { & $body } catch {
        $thrown = $true
        foreach ($expected in @($ExpectedError -split '\|')) { if ($_.Exception.Message -notlike "*$($expected.Trim())*") { throw "Unexpected $FailurePoint error: $($_.Exception.Message)" } }
    }
    if ($ExpectedError -and -not $thrown) { throw "$FailurePoint did not throw $ExpectedError" }
    if (-not $ExpectedError -and $thrown) { throw "success unexpectedly threw: $($_.Exception.Message)" }
    if ($owned.Count -ne 0) { throw "$FailurePoint left owned resources: $($owned.Count)" }
    if ($resources['unknown-resource'] -ne 'preserve') { throw "$FailurePoint removed unknown resource" }
    $expectedTrace = switch ($FailurePoint) {
        'baseline' { @('baseline','cleanup','post-control','final-cleanup') }
        'pre-control' { @('baseline','pre-control','cleanup','post-control','final-cleanup') }
        'create' { @('baseline','pre-control','create:owned-rule','cleanup','post-control','final-cleanup') }
        'recover-unavailable' { @('baseline','pre-control','create:owned-rule','cleanup','post-control','final-cleanup') }
        'readback' { @('baseline','pre-control','create:owned-rule','cleanup','post-control','final-cleanup') }
        'during' { @('baseline','pre-control','create:owned-rule','during-control','cleanup','post-control','final-cleanup') }
        default { @('baseline','pre-control','create:owned-rule','during-control','runner','cleanup','post-control','final-cleanup') }
    }
    if (($trace -join '|') -ne ($expectedTrace -join '|')) { throw "$FailurePoint trace mismatch: $($trace -join '|')" }
}

try {
    Invoke-SeamCase 'success' $null
    $cases = @(
        @('baseline','A08_SEAM_BASELINE_FAIL'), @('pre-control','A08_SEAM_PRE_CONTROL_FAIL'), @('create','A08_SEAM_CREATE_FAIL'),
        @('readback','A08_SEAM_READBACK_FAIL'), @('during','A08_SEAM_DURING_FAIL'), @('runner','A08_SEAM_RUNNER_FAIL'),
        @('timeout','A08_SEAM_TIMEOUT_FAIL'), @('cleanup','A08_SEAM_CLEANUP_FAIL'), @('post','A08_SEAM_POST_FAIL'), @('cleanup-post','A08_SEAM_CLEANUP_FAIL|A08_SEAM_POST_FAIL'), @('recover-unavailable','A08_SEAM_RECOVER_READBACK_UNAVAILABLE|A08_SEAM_CREATE_FAIL')
    )
    foreach ($case in $cases) { Invoke-SeamCase $case[0] $case[1] }
    'OPS_A08_SELFTEST=PASS (shared lifecycle seam, exact trace/error/cleanup assertions; injected adapters only; no Windows Firewall, external target, Browser, Beta, or 4317)'
} catch {
    [Console]::Error.WriteLine("OPS_A08_SELFTEST=FAIL: $($_.Exception.Message)")
    exit 1
}
