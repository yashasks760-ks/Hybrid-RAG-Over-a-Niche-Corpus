<#
.SYNOPSIS
    College AI Knowledge Assistant - Development Environment Shutdown Script
.DESCRIPTION
    Safely and cleanly terminates the backend and frontend development processes
    started by start-dev.ps1, releasing port 8000 and port 5173 and Qdrant storage locks.
#>

[CmdletBinding()]
param ()

$ErrorActionPreference = "SilentlyContinue"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspaceRoot

$backendPort = 8000
$frontendPort = 5173
$pidsFile = Join-Path $workspaceRoot ".dev-pids.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " College AI Knowledge Assistant - Shutdown Process        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Kill tracked launcher processes from PID file
if (Test-Path $pidsFile) {
    try {
        $pidsData = Get-Content $pidsFile -Raw | ConvertFrom-Json
        if ($pidsData.backendLauncherPid) {
            Write-Host "Stopping backend launcher process tree (PID $($pidsData.backendLauncherPid))..." -ForegroundColor DarkGray
            & taskkill /PID $pidsData.backendLauncherPid /T /F 2>$null
        }
        if ($pidsData.frontendLauncherPid) {
            Write-Host "Stopping frontend launcher process tree (PID $($pidsData.frontendLauncherPid))..." -ForegroundColor DarkGray
            & taskkill /PID $pidsData.frontendLauncherPid /T /F 2>$null
        }
    } catch {
        Write-Warning "Could not parse $($pidsFile): $_"
    }
    Remove-Item -Path $pidsFile -Force -ErrorAction SilentlyContinue
}

# 2. Check Port 8000 for any lingering Python process
$conns8000 = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
if ($conns8000) {
    foreach ($conn in $conns8000) {
        $procId = $conn.OwningProcess
        if ($procId -gt 0) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and ($proc.ProcessName -like "*python*" -or $proc.ProcessName -like "*uvicorn*" -or $proc.ProcessName -like "*powershell*")) {
                Write-Host "Releasing port $backendPort held by $($proc.ProcessName) (PID $procId)..." -ForegroundColor Yellow
                & taskkill /PID $procId /T /F 2>$null
            }
        }
    }
}

# 3. Check Port 5173 for any lingering Node process
$conns5173 = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue
if ($conns5173) {
    foreach ($conn in $conns5173) {
        $procId = $conn.OwningProcess
        if ($procId -gt 0) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc -and ($proc.ProcessName -like "*node*" -or $proc.ProcessName -like "*vite*" -or $proc.ProcessName -like "*powershell*")) {
                Write-Host "Releasing port $frontendPort held by $($proc.ProcessName) (PID $procId)..." -ForegroundColor Yellow
                & taskkill /PID $procId /T /F 2>$null
            }
        }
    }
}

# 4. Terminate any lingering project backend processes holding Qdrant storage locks
$lingeringBackend = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*backend.app.main:app*"
}
if ($lingeringBackend) {
    foreach ($proc in $lingeringBackend) {
        Write-Host "Releasing embedded Qdrant lock held by project process (PID $($proc.ProcessId))..." -ForegroundColor Yellow
        & taskkill /PID $proc.ProcessId /F 2>$null
    }
}

Start-Sleep -Seconds 1

# 4. Verification
$remaining8000 = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$remaining5173 = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($remaining8000) {
    Write-Host "[WARNING] Port $backendPort is still occupied by PID $($remaining8000.OwningProcess)." -ForegroundColor Red
} else {
    Write-Host "[OK] Port $backendPort (Backend) is successfully free." -ForegroundColor Green
}

if ($remaining5173) {
    Write-Host "[WARNING] Port $frontendPort (Frontend) is still occupied by PID $($remaining5173.OwningProcess)." -ForegroundColor Red
} else {
    Write-Host "[OK] Port $frontendPort (Frontend) is successfully free." -ForegroundColor Green
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " All development servers stopped cleanly." -ForegroundColor Green
Write-Host " To start again, run: .\start-dev.ps1" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
