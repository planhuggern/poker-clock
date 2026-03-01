# PowerShell script for å finne og stoppe prosess som bruker en gitt port (f.eks. 8081)
param(
    [int]$Port = 8081
)

Write-Host "Søker etter prosess på port $Port ..."

# Finn PID til prosess som bruker porten
$netstat = netstat -ano | Select-String ":$Port "
if ($netstat) {
    $lines = $netstat | ForEach-Object { $_.ToString() }
    $pids = $lines | ForEach-Object {
        $parts = $_ -split '\s+'
        $parts[-1]
    } | Select-Object -Unique
    foreach ($procId in $pids) {
        if ($procId -match '^\d+$') {
            Write-Host "Stopper prosess med PID $procId ..."
            Stop-Process -Id $procId -Force
        }
    }
    Write-Host "Ferdig. Port $Port er nå frigjort."
} else {
    Write-Host "Fant ingen prosess som bruker port $Port."
}
