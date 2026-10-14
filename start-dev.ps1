<#
.SYNOPSIS
    College AI Knowledge Assistant - Development Environment Startup Script
.DESCRIPTION
    Reliably starts the FastAPI backend (127.0.0.1:8000) and Vite React frontend (localhost:5173)
    in dedicated terminal windows, validates port availability, reuses healthy processes,
    and probes the backend health endpoint before confirming readiness.
#>

[CmdletBinding()]
param (
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspaceRoot

$backendPort = 8000
$frontendPort = 5173
$backendHost = "127.0.0.1"
$healthUrl = "http://${backendHost}:${backendPort}/api/health"
$frontendUrl = "http://localhost:${frontendPort}"
$pidsFile = Join-Path $workspaceRoot ".dev-pids.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " College AI Knowledge Assistant - Development Startup    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Workspace: $workspaceRoot" -ForegroundColor DarkGray

# 1. Validate Python Virtual Environment
$pythonExe = Join-Path $workspaceRoot "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "[ERROR] Virtual environment python not found at: $pythonExe" -ForegroundColor Red
    Write-Host "Please create a virtual environment first: python -m venv venv" -ForegroundColor Yellow
    exit 1
}

# 2. Check Port 8000 (FastAPI Backend)
Write-Host "`n[1/3] Checking Backend status on port ${backendPort}..." -ForegroundColor Yellow
$backendConnection = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

$backendAlreadyHealthy = $false
if ($backendConnection) {
    $owningPid = $backendConnection.OwningProcess
    Write-Host "Port ${backendPort} is in use by PID ${owningPid}. Probing health..." -ForegroundColor DarkGray
    try {
        $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($healthResponse.status -eq "healthy") {
            Write-Host "[OK] Backend is already running and healthy (PID: ${owningPid}). Reusing existing instance." -ForegroundColor Green
            $backendAlreadyHealthy = $true
        }
    } catch {
        Write-Host "[ERROR] Port ${backendPort} is occupied by PID ${owningPid}, but health check failed." -ForegroundColor Red
        Write-Host "An unresponsive process is holding port ${backendPort}. Run .\stop-dev.ps1 or terminate PID ${owningPid}." -ForegroundColor Yellow
        exit 1
    }
}

$backendStartedPid = $null
if (-not $backendAlreadyHealthy) {
    # Clean up any orphaned backend processes from this workspace to ensure embedded Qdrant lock is released
    $orphanedProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*backend.app.main:app*"
    }
    if ($orphanedProcs) {
        foreach ($op in $orphanedProcs) {
            Write-Host "Releasing embedded Qdrant lock held by orphaned backend PID $($op.ProcessId)..." -ForegroundColor Yellow
            & taskkill /PID $op.ProcessId /F 2>$null
        }
        Start-Sleep -Milliseconds 500
    }

    Write-Host "Starting FastAPI backend in a dedicated terminal window..." -ForegroundColor Cyan
    # Launch in a new PowerShell window, using single worker without reload to safeguard embedded Qdrant locks
    $backendProcess = Start-Process powershell.exe -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'College AI - Backend Server (Port 8000)'; " +
        "Set-Location '$workspaceRoot'; " +
        "Write-Host '==================================================' -ForegroundColor Cyan; " +
        "Write-Host ' College AI Backend - FastAPI / Uvicorn Server    ' -ForegroundColor Cyan; " +
        "Write-Host ' Host: 127.0.0.1:8000                             ' -ForegroundColor Cyan; " +
        "Write-Host ' Embedded Qdrant & BM25 Active                     ' -ForegroundColor Cyan; " +
        "Write-Host '==================================================' -ForegroundColor Cyan; " +
        "& '$pythonExe' -m uvicorn backend.app.main:app --host $backendHost --port $backendPort --workers 1"
    ) -PassThru

    $backendStartedPid = $backendProcess.Id
    Write-Host "Backend launcher process launched with PID: $backendStartedPid" -ForegroundColor DarkGray

    # Wait for backend health probe (up to 30s)
    Write-Host "Waiting for backend health probe ($healthUrl)..." -ForegroundColor Yellow -NoNewline
    $backendReady = $false
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        try {
            $resp = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($resp.status -eq "healthy") {
                $backendReady = $true
                break
            }
        } catch {
            # Still starting
        }
    }
    Write-Host ""

    if (-not $backendReady) {
        Write-Host "[ERROR] Backend did not respond healthy within 30 seconds." -ForegroundColor Red
        Write-Host "Check the 'College AI - Backend Server' window for error details or tracebacks." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] Backend is online, healthy, and ready!" -ForegroundColor Green
}

# 3. Check Port 5173 (Vite React Frontend)
Write-Host "`n[2/3] Checking Frontend status on port ${frontendPort}..." -ForegroundColor Yellow
$frontendConnection = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

$frontendAlreadyRunning = $false
if ($frontendConnection) {
    $owningPid = $frontendConnection.OwningProcess
    Write-Host "[OK] Frontend is already running on port ${frontendPort} (PID: ${owningPid}). Reusing existing instance." -ForegroundColor Green
    $frontendAlreadyRunning = $true
}

$frontendStartedPid = $null
if (-not $frontendAlreadyRunning) {
    Write-Host "Starting Vite React frontend in a dedicated terminal window..." -ForegroundColor Cyan
    $frontendDir = Join-Path $workspaceRoot "frontend"

    $frontendProcess = Start-Process powershell.exe -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'College AI - Frontend Client (Port 5173)'; " +
        "Set-Location '$frontendDir'; " +
        "Write-Host '==================================================' -ForegroundColor Cyan; " +
        "Write-Host ' College AI Frontend - Vite Dev Server            ' -ForegroundColor Cyan; " +
        "Write-Host ' URL: http://localhost:5173                       ' -ForegroundColor Cyan; " +
        "Write-Host ' Proxy: /api -> http://127.0.0.1:8000            ' -ForegroundColor Cyan; " +
        "Write-Host '==================================================' -ForegroundColor Cyan; " +
        "npm run dev"
    ) -PassThru

    $frontendStartedPid = $frontendProcess.Id
    Write-Host "Frontend launcher process launched with PID: $frontendStartedPid" -ForegroundColor DarkGray

    # Wait up to 15 seconds for frontend port
    Write-Host "Waiting for Vite frontend to bind to port ${frontendPort}..." -ForegroundColor Yellow -NoNewline
    $frontendReady = $false
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        $testConn = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($testConn) {
            $frontendReady = $true
            break
        }
    }
    Write-Host ""

    if ($frontendReady) {
        Write-Host "[OK] Frontend is online and listening on port ${frontendPort}!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Frontend launched but port ${frontendPort} not detected yet. Check the Frontend terminal window." -ForegroundColor Yellow
    }
}

# 4. Save PID State
$pidsData = @{
    createdAt = (Get-Date).ToString("o")
    backendLauncherPid = $backendStartedPid
    frontendLauncherPid = $frontendStartedPid
    backendPort = $backendPort
    frontendPort = $frontendPort
}

# Read existing pids file if we reused one
if (Test-Path $pidsFile) {
    try {
        $existing = Get-Content $pidsFile -Raw | ConvertFrom-Json
        if (-not $backendStartedPid -and $existing.backendLauncherPid) {
            $pidsData.backendLauncherPid = $existing.backendLauncherPid
        }
        if (-not $frontendStartedPid -and $existing.frontendLauncherPid) {
            $pidsData.frontendLauncherPid = $existing.frontendLauncherPid
        }
    } catch {}
}

$pidsData | ConvertTo-Json | Set-Content -Path $pidsFile -Encoding UTF8

# 5. Output Summary
Write-Host "`n[3/3] Application Startup Complete!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Frontend URL : $frontendUrl" -ForegroundColor Cyan
Write-Host "  Backend API  : http://${backendHost}:${backendPort}" -ForegroundColor Cyan
Write-Host "  Swagger Docs : http://${backendHost}:${backendPort}/docs" -ForegroundColor Cyan
Write-Host "  Health Check : $healthUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "To stop both servers cleanly, run:" -ForegroundColor White
Write-Host "  .\stop-dev.ps1" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green

if (-not $NoBrowser) {
    try {
        Start-Process $frontendUrl
    } catch {}
}

