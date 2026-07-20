param(
    [ValidateRange(1, 100)]
    [int]$Samples = 5,

    [ValidateRange(1, 60)]
    [int]$IntervalSeconds = 2,

    [ValidateRange(1, 65535)]
    [int]$FrontendPort = 3000,

    [ValidateRange(1, 65535)]
    [int]$BackendPort = 8001
)

$ErrorActionPreference = 'Stop'

function Get-ListeningProcessId {
    param([int]$Port)

    $matchingIds = @()
    foreach ($entry in (netstat -ano -p tcp | Select-String 'LISTENING')) {
        $line = $entry.Line.Trim()
        if ($line -match (':{0}\s+.*LISTENING\s+(\d+)$' -f $Port)) {
            $matchingIds += [int]$Matches[1]
        }
    }

    return $matchingIds | Select-Object -Unique
}

function Get-Median {
    param([double[]]$Values)

    if ($Values.Count -eq 0) {
        return 0
    }

    $sorted = @($Values | Sort-Object)
    $middle = [int]($sorted.Count / 2)
    if (($sorted.Count % 2) -eq 1) {
        return $sorted[$middle]
    }

    return ($sorted[$middle - 1] + $sorted[$middle]) / 2
}

function Get-NodeGroupRoot {
    param(
        [int]$ListenerId,
        [hashtable]$ParentById,
        [hashtable]$ProcessById
    )

    $currentId = $ListenerId
    $rootId = $ListenerId
    $visited = @{}

    while ($currentId -gt 0 -and -not $visited.ContainsKey($currentId)) {
        $visited[$currentId] = $true
        if ($ProcessById.ContainsKey($currentId) -and $ProcessById[$currentId].ProcessName -eq 'node') {
            $rootId = $currentId
        }
        if (-not $ParentById.ContainsKey($currentId)) {
            break
        }
        $currentId = $ParentById[$currentId]
    }

    return $rootId
}

function Test-IsDescendantOrSelf {
    param(
        [int]$ProcessId,
        [int]$RootId,
        [hashtable]$ParentById
    )

    $currentId = $ProcessId
    $visited = @{}
    while ($currentId -gt 0 -and -not $visited.ContainsKey($currentId)) {
        if ($currentId -eq $RootId) {
            return $true
        }
        $visited[$currentId] = $true
        if (-not $ParentById.ContainsKey($currentId)) {
            break
        }
        $currentId = $ParentById[$currentId]
    }

    return $false
}

$frontendIds = @(Get-ListeningProcessId -Port $FrontendPort)
$backendIds = @(Get-ListeningProcessId -Port $BackendPort)

if ($frontendIds.Count -ne 1) {
    throw "Expected one process listening on frontend port $FrontendPort; found $($frontendIds.Count)."
}

if ($backendIds.Count -ne 1) {
    throw "Expected one process listening on backend port $BackendPort; found $($backendIds.Count)."
}

$frontendWorkingSamples = @()
$frontendPrivateSamples = @()
$backendWorkingSamples = @()
$backendPrivateSamples = @()

Write-Output ('Frontend: port {0}, listener PID {1}' -f $FrontendPort, $frontendIds[0])
Write-Output ('Backend:  port {0}, listener PID {1}' -f $BackendPort, $backendIds[0])
Write-Output 'Grouping Node.js launchers, watchers, workers, and servers by process ancestry.'
Write-Output ''
Write-Output 'Sample,FrontendWorkingSetPrivateMiB,FrontendPrivateBytesMiB,BackendWorkingSetPrivateMiB,BackendPrivateBytesMiB,FrontendPids,BackendPids'

for ($sampleIndex = 1; $sampleIndex -le $Samples; $sampleIndex++) {
    $allProcesses = @(Get-Process -ErrorAction SilentlyContinue)
    $processById = @{}
    foreach ($process in $allProcesses) {
        $processById[$process.Id] = $process
    }

    $ancestryCounters = (Get-Counter `
        '\Process(*)\ID Process', `
        '\Process(*)\Creating Process ID' `
        -ErrorAction SilentlyContinue).CounterSamples | Where-Object { $_.Status -eq 0 }
    if ($ancestryCounters.Count -eq 0) {
        throw 'Windows returned no valid process ancestry counters.'
    }
    $parentById = @{}
    foreach ($idCounter in ($ancestryCounters | Where-Object { $_.Path -like '*\ID Process' })) {
        $processId = [int]$idCounter.CookedValue
        $instance = $idCounter.Path -replace '^.*\\process\(([^)]+)\)\\.*$', '$1'
        $parentCounter = $ancestryCounters | Where-Object {
            ($_.Path -replace '^.*\\process\(([^)]+)\)\\.*$', '$1') -eq $instance -and
            $_.Path -like '*\Creating Process ID'
        } | Select-Object -First 1
        if ($null -ne $parentCounter) {
            $parentById[$processId] = [int]$parentCounter.CookedValue
        }
    }

    $frontendRoot = Get-NodeGroupRoot -ListenerId $frontendIds[0] -ParentById $parentById -ProcessById $processById
    $backendRoot = Get-NodeGroupRoot -ListenerId $backendIds[0] -ParentById $parentById -ProcessById $processById
    $frontendGroup = @()
    $backendGroup = @()

    foreach ($process in ($allProcesses | Where-Object { $_.ProcessName -eq 'node' })) {
        if (Test-IsDescendantOrSelf -ProcessId $process.Id -RootId $frontendRoot -ParentById $parentById) {
            $frontendGroup += $process.Id
        }
        if (Test-IsDescendantOrSelf -ProcessId $process.Id -RootId $backendRoot -ParentById $parentById) {
            $backendGroup += $process.Id
        }
    }

    $counterSamples = (Get-Counter `
        '\Process(node*)\ID Process', `
        '\Process(node*)\Working Set - Private', `
        '\Process(node*)\Private Bytes' `
        -ErrorAction SilentlyContinue).CounterSamples | Where-Object { $_.Status -eq 0 }
    if ($counterSamples.Count -eq 0) {
        throw 'Windows returned no valid Node.js memory counters.'
    }

    $frontendWorking = 0.0
    $frontendPrivate = 0.0
    $backendWorking = 0.0
    $backendPrivate = 0.0

    foreach ($idCounter in ($counterSamples | Where-Object { $_.Path -like '*\ID Process' })) {
        $processId = [int]$idCounter.CookedValue
        # CounterSamples.InstanceName collapses every node#N instance to "node"
        # on Windows, so extract the unique performance-counter instance path.
        $instance = $idCounter.Path -replace '^.*\\process\(([^)]+)\)\\.*$', '$1'
        $workingCounter = $counterSamples | Where-Object {
            ($_.Path -replace '^.*\\process\(([^)]+)\)\\.*$', '$1') -eq $instance -and
            $_.Path -like '*\Working Set - Private'
        } | Select-Object -First 1
        $privateCounter = $counterSamples | Where-Object {
            ($_.Path -replace '^.*\\process\(([^)]+)\)\\.*$', '$1') -eq $instance -and
            $_.Path -like '*\Private Bytes'
        } | Select-Object -First 1

        if ($null -eq $workingCounter -or $null -eq $privateCounter) {
            continue
        }

        if ($frontendGroup -contains $processId) {
            $frontendWorking += $workingCounter.CookedValue
            $frontendPrivate += $privateCounter.CookedValue
        }
        if ($backendGroup -contains $processId) {
            $backendWorking += $workingCounter.CookedValue
            $backendPrivate += $privateCounter.CookedValue
        }
    }

    $frontendWorkingMiB = $frontendWorking / 1MB
    $frontendPrivateMiB = $frontendPrivate / 1MB
    $backendWorkingMiB = $backendWorking / 1MB
    $backendPrivateMiB = $backendPrivate / 1MB
    $frontendWorkingSamples += $frontendWorkingMiB
    $frontendPrivateSamples += $frontendPrivateMiB
    $backendWorkingSamples += $backendWorkingMiB
    $backendPrivateSamples += $backendPrivateMiB

    Write-Output ('{0},{1:F1},{2:F1},{3:F1},{4:F1},"{5}","{6}"' -f `
        $sampleIndex, `
        $frontendWorkingMiB, `
        $frontendPrivateMiB, `
        $backendWorkingMiB, `
        $backendPrivateMiB, `
        (($frontendGroup | Sort-Object) -join ';'), `
        (($backendGroup | Sort-Object) -join ';'))

    if ($sampleIndex -lt $Samples) {
        Start-Sleep -Seconds $IntervalSeconds
    }
}

$frontendWorkingMedian = Get-Median -Values $frontendWorkingSamples
$frontendPrivateMedian = Get-Median -Values $frontendPrivateSamples
$backendWorkingMedian = Get-Median -Values $backendWorkingSamples
$backendPrivateMedian = Get-Median -Values $backendPrivateSamples
$totalWorkingMedian = $frontendWorkingMedian + $backendWorkingMedian
$totalPrivateMedian = $frontendPrivateMedian + $backendPrivateMedian

Write-Output ''
Write-Output 'Median summary (MiB)'
Write-Output ('Frontend working set private: {0:N1}' -f $frontendWorkingMedian)
Write-Output ('Frontend private bytes:       {0:N1}' -f $frontendPrivateMedian)
Write-Output ('Backend working set private:  {0:N1}' -f $backendWorkingMedian)
Write-Output ('Backend private bytes:        {0:N1}' -f $backendPrivateMedian)
Write-Output ('Total working set private:    {0:N1}' -f $totalWorkingMedian)
Write-Output ('Total private bytes:          {0:N1}' -f $totalPrivateMedian)
