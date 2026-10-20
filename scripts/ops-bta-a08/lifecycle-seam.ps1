Set-StrictMode -Version Latest

function Invoke-A08Lifecycle {
    param(
        [Parameter(Mandatory)] [object[]] $Rules,
        [Parameter(Mandatory)] [scriptblock] $Baseline,
        [Parameter(Mandatory)] [scriptblock] $PreControl,
        [Parameter(Mandatory)] [scriptblock] $Create,
        [Parameter(Mandatory)] [scriptblock] $RecoverOwned,
        [Parameter(Mandatory)] [scriptblock] $DuringControl,
        [Parameter(Mandatory)] [scriptblock] $Runner,
        [Parameter(Mandatory)] [scriptblock] $Cleanup,
        [Parameter(Mandatory)] [scriptblock] $PostControl,
        [Parameter(Mandatory)] [scriptblock] $FinalCleanup,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [Collections.ArrayList] $OwnedRules,
        [Collections.ArrayList] $Trace
    )
    $failures = [Collections.ArrayList]::new()
    try {
        try {
            if ($null -ne $Trace) { [void]$Trace.Add('baseline') }; & $Baseline $Rules
            if ($null -ne $Trace) { [void]$Trace.Add('pre-control') }; & $PreControl $Rules
            foreach ($rule in $Rules) {
                if ($null -ne $Trace) { [void]$Trace.Add("create:$($rule.name)") }
                if (-not $OwnedRules.Contains($rule)) { [void]$OwnedRules.Add($rule) }
                try { & $Create $rule } catch { try { & $RecoverOwned $rule | Out-Null } catch { [void]$failures.Add($_.Exception.Message) }; throw }
            }
            if ($null -ne $Trace) { [void]$Trace.Add('during-control') }; & $DuringControl $Rules
            if ($null -ne $Trace) { [void]$Trace.Add('runner') }; & $Runner
        } catch { [void]$failures.Add($_.Exception.Message) }
    } finally {
        try { if ($null -ne $Trace) { [void]$Trace.Add('cleanup') }; & $Cleanup $Rules $OwnedRules } catch { [void]$failures.Add($_.Exception.Message) }
        try { if ($null -ne $Trace) { [void]$Trace.Add('post-control') }; & $PostControl $Rules } catch { [void]$failures.Add($_.Exception.Message) }
        try { if ($null -ne $Trace) { [void]$Trace.Add('final-cleanup') }; & $FinalCleanup $Rules $OwnedRules } catch { [void]$failures.Add($_.Exception.Message) }
    }
    if ($failures.Count) { throw (($failures | ForEach-Object { "A08_LIFECYCLE_FAILURE: $_" }) -join ' | ') }
}
