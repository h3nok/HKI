#!/usr/bin/env pwsh
# AI Platform - Daily Start Script

$projectRoot = $PSScriptRoot

Write-Host "Starting AI Platform Services..." -ForegroundColor Cyan

# 1. Clean up any stale processes from yesterday
Write-Host "Cleaning up ports..." -ForegroundColor Yellow
$ports = @(9509, 9501, 9508, 9510, 9001)
foreach ($port in $ports) {
    $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($proc) {
        $pids = $proc | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    }
}

# 2. Ensure Docker is running and healthy
Write-Host "Checking Docker infrastructure..." -ForegroundColor Yellow
Push-Location "$projectRoot\docker-compose"

# Start the containers
docker-compose up -d

# --- NEW: Health Check Loop ---
Write-Host "Waiting for databases to be ready..." -ForegroundColor Cyan
$maxAttempts = 20
$attempt = 0
$isHealthy = $false

while ($attempt -lt $maxAttempts -and -not $isHealthy) {
    $status = docker-compose ps --format json | ConvertFrom-Json

    # Check if all containers are 'running' (and 'healthy' if defined in docker-compose)
    $unready = $status | Where-Object { $_.State -ne "running" }

    if ($null -eq $unready) {
        $isHealthy = $true
        Write-Host "All Docker containers are online!" -ForegroundColor Green
    } else {
        $attempt++
        Write-Progress -Activity "Initializing Databases" -Status "Waiting for: $($unready.Name)" -PercentComplete (($attempt / $maxAttempts) * 100)
        Start-Sleep -Seconds 2
    }
}

if (-not $isHealthy) {
    Write-Error "Docker containers failed to start in time. Please check Docker Desktop."
    Pop-Location
    exit 1
}
Pop-Location

# 3. Launch the 5 services (Re-using your logic)
# function Launch-Service {
#     param([string]$Title, [string]$Dir, [string]$Command, [hashtable]$EnvVars)
#     $EnvString = ""
#     foreach ($Key in $EnvVars.Keys) { $EnvString += "`$env:$Key='$($EnvVars[$Key])'; " }
#     Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$Title'; cd '$Dir'; $EnvString $Command"
# }

# function Launch-Service {
#     param([string]$Title, [string]$Dir, [string]$Command, [hashtable]$EnvVars)

#     # Construct the environment variable string for PowerShell
#     $EnvString = ""
#     foreach ($Key in $EnvVars.Keys) {
#         $EnvString += "`$env:$Key='$($EnvVars[$Key])'; "
#     }

#     # wt -w 0: Use the existing Windows Terminal window
#     # nt: Create a new tab
#     # --title: Set the tab name
#     # -d: Set the starting directory
#     Write-Host "Launching $Title in new tab..." -ForegroundColor Gray

#     wt -w 0 nt --title "$Title" -d "$Dir" pwsh -NoExit -Command "$EnvString $Command"
# }

function Launch-Service {
    param([string]$Title, [string]$Dir, [string]$Command, [hashtable]$EnvVars)

    Write-Host "Launching $Title in VS Code Terminal..." -ForegroundColor Gray

    # 1. Prepare environment variables
    $EnvString = ""
    foreach ($Key in $EnvVars.Keys) {
        $EnvString += "`$env:$Key='$($EnvVars[$Key])'; "
    }

    # 2. Use VS Code's internal terminal
    # This creates a new terminal named $Title, changes directory, sets envs, and runs the command
    $FullCommand = "cd '$Dir'; $EnvString $Command"

    # 'code --terminal' isn't a direct CLI command, so we use the 'code' command
    # to execute a task or simply use the underlying PowerShell logic if running INSIDE VS Code:
    if ($env:TERM_PROGRAM -eq "vscode") {
        # Create a new terminal tab inside VS Code
        # We use a small trick: starting a new pwsh instance inside the integrated terminal
        Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$Title'; $FullCommand"
    } else {
        # Fallback to the original behavior if not in VS Code
        Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$Title'; $FullCommand"
    }
}

Write-Host "Launching service windows..." -ForegroundColor Green

Launch-Service "Knowledge API" "$projectRoot\knowledge-api" "uv run uvicorn src.api.app:app --reload --port 9509 --reload-dir src" @{
    ALLOYDB_URL="postgresql://postgres:postgres@localhost:9432/knowledge"; ENVIRONMENT="development"; KB_HERMETIC_ISOLATION="true"
}

Launch-Service "Orchestrator" "$projectRoot\orchestrator-service" "uv run uvicorn src.api.app:app --reload --port 9501 --reload-dir src" @{
    REDIS_URL="redis://localhost:9379/0"; AUTH_ENABLED="false"
}

Launch-Service "Ingestion Pipeline" "$projectRoot\ingestion-pipeline-service" "uv run uvicorn src.api.app:app --reload --port 9508 --reload-dir src" @{
    KNOWLEDGE_API_URL="http://localhost:9509"; AUTH_ENABLED="false"; ENVIRONMENT="development"; KB_HERMETIC_ISOLATION="true"
}

Launch-Service "Analytics" "$projectRoot\analytics-service" "uv run uvicorn src.api.app:app --reload --port 9510 --reload-dir src" @{
    ENVIRONMENT="development"
}

Launch-Service "Agentic Frontend" "$projectRoot\agentic" "npx tsx watch --ignore './client/**' server/_core/index.ts" @{
    NODE_ENV="development"; PORT="9001"; KB_HERMETIC_ISOLATION="true"; DB_AUTO_MIGRATE="false"
}

# 4. Open Browser
Start-Sleep -Seconds 5
Start-Process "http://localhost:9001"
Write-Host "All systems started!" -ForegroundColor Green