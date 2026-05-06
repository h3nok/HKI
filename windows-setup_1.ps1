#!/usr/bin/env pwsh
# AI Platform - Automated Windows Setup Script
# Run with: powershell -ExecutionPolicy Bypass -File windows-setup.ps1

$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

# Colors for output
function Write-Step {
    param([string]$Message)
    Write-Host "`n$Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Yellow
}

# Banner
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║   AI Platform — Windows Automated Setup                       ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Get project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir
Write-Info "Project root: $projectRoot"

# Step 0: Pre-flight Port Cleanup
Write-Step "Step 0: Checking for existing services..."
$ports = @(9509, 9501, 9508, 9510, 9001)
foreach ($port in $ports) {
    $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($proc) {
        # Get unique PIDs in case multiple connections share a process
        $pids = $proc | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($id in $pids) {
            Write-Info "Closing existing process (PID: $id) on port $port..."
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        }
    }
}

# Step 1: Configure npm/pnpm for corporate proxy
Write-Step "Step 1: Configuring npm/pnpm for corporate proxy..."
try {
    npm config set strict-ssl false
    pnpm config set strict-ssl false
    Write-Success "SSL configuration updated"
} catch {
    Write-Error "Failed to configure npm/pnpm: $_"
    exit 1
}

# Step 1.5: Create .env files from examples
Write-Step "Step 1.5: Creating .env files from examples..."
$exampleFiles = @(
    "$projectRoot\docker-compose\.env.example",
    "$projectRoot\agentic\.env.example",
    "$projectRoot\orchestrator-service\.env.example",
    "$projectRoot\ingestion-pipeline-service\.env.example",
    "$projectRoot\analytics-service\.env.example"
)

foreach ($exampleFile in $exampleFiles) {
    $envFile = $exampleFile.Replace(".env.example", ".env")
    if (-not (Test-Path $envFile)) {
        if (Test-Path $exampleFile) {
            Copy-Item -Path $exampleFile -Destination $envFile
            Write-Success "Created $envFile"
        } else {
            Write-Error "$exampleFile not found, cannot create .env file."
        }
    } else {
        Write-Info "$envFile already exists, skipping creation."
    }
}

# Step 2: Fix CORS_ORIGINS in .env files
Write-Step "Step 2: Fixing CORS_ORIGINS format in .env files..."
$envFiles = @(
    @{
        Path = "$projectRoot\orchestrator-service\.env"
        Old = 'CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:3000'
        New = 'CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:3000"]'
    },
    @{
        Path = "$projectRoot\ingestion-pipeline-service\.env"
        Old = 'CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:9501'
        New = 'CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:9501"]'
    },
    @{
        Path = "$projectRoot\analytics-service\.env"
        Old = 'CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:3000'
        New = 'CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:3000"]'
    }
)

foreach ($file in $envFiles) {
    if (Test-Path $file.Path) {
        $content = Get-Content $file.Path -Raw
        if ($content -match [regex]::Escape($file.Old)) {
            $content = $content -replace [regex]::Escape($file.Old), $file.New
            Set-Content -Path $file.Path -Value $content -NoNewline
            Write-Success "Fixed $(Split-Path -Leaf $file.Path)"
        } else {
            Write-Info "$(Split-Path -Leaf $file.Path) already fixed or not found"
        }
    } else {
        Write-Info "$(Split-Path -Leaf $file.Path) not found - skipping"
    }
}

# Step 3: Fix MySQL password in agentic/.env
Write-Step "Step 3: Fixing MySQL password in agentic/.env..."
$agenticEnvPath = "$projectRoot\agentic\.env"
if (Test-Path $agenticEnvPath) {
    $content = Get-Content $agenticEnvPath -Raw
    $content = $content -replace 'DATABASE_URL=mysql://root:password@', 'DATABASE_URL=mysql://root:root@'
    Set-Content -Path $agenticEnvPath -Value $content -NoNewline
    Write-Success "Fixed agentic/.env MySQL password"
} else {
    Write-Info "agentic/.env not found - you'll need to create it from .env.example"
}

# Step 4: Fix knowledge-api UTF-8 encoding
Write-Step "Step 4: Fixing knowledge-api UTF-8 encoding..."
$alloydbStorePath = "$projectRoot\knowledge-api\src\adapters\alloydb_store.py"
if (Test-Path $alloydbStorePath) {
    $content = Get-Content $alloydbStorePath -Raw
    if ($content -match 'schema_sql = schema_path\.read_text\(\)') {
        $content = $content -replace 'schema_sql = schema_path\.read_text\(\)', 'schema_sql = schema_path.read_text(encoding="utf-8")'
        Set-Content -Path $alloydbStorePath -Value $content -NoNewline
        Write-Success "Fixed knowledge-api UTF-8 encoding"
    } else {
        Write-Info "knowledge-api already fixed or pattern not found"
    }
} else {
    Write-Error "knowledge-api/src/adapters/alloydb_store.py not found"
}

# Step 5: Start Docker infrastructure
Write-Step "Step 5: Starting Docker infrastructure..."
try {
    Push-Location "$projectRoot\docker-compose"
    docker-compose up -d
    Write-Success "Docker containers started"
    Write-Info "Waiting 30 seconds for containers to initialize..."
    Start-Sleep -Seconds 30

    # Check status
    Write-Info "Container status:"
    docker-compose ps
    Pop-Location
} catch {
    Write-Error "Failed to start Docker: $_"
    Pop-Location
    exit 1
}

# Step 6: Install dependencies
Write-Step "Step 6: Installing workspace dependencies..."
try {
    Push-Location $projectRoot
    pnpm install
    Write-Success "Dependencies installed"
    Pop-Location
} catch {
    Write-Error "Failed to install dependencies: $_"
    Pop-Location
    exit 1
}

# Step 7: Build workspace packages
Write-Step "Step 7: Building workspace packages..."
try {
    Push-Location $projectRoot
    pnpm build
    Write-Success "Workspace packages built"
    Pop-Location
} catch {
    Write-Error "Failed to build packages: $_"
    Pop-Location
    exit 1
}

# Step 8: Run database migrations
Write-Step "Step 8: Running database migrations..."
try {
    Push-Location "$projectRoot\agentic"
    $env:DATABASE_URL = 'mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4'
    pnpm db:migrate
    Write-Success "Database migrations completed"
    Pop-Location
} catch {
    Write-Error "Failed to run migrations: $_"
    Pop-Location
    exit 1
}

# Step 9: Launch Services in separate windows
Write-Step "Step 9: Launching services in separate windows..."

# Function to launch a service in a new window
function Launch-Service {
    param([string]$Title, [string]$Dir, [string]$Command, [hashtable]$EnvVars)

    $EnvString = ""
    foreach ($Key in $EnvVars.Keys) {
        $EnvString += "`$env:$Key='$($EnvVars[$Key])'; "
    }

    # Use -NoExit so the window stays open to show logs
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$Title'; cd '$Dir'; $EnvString $Command"
    Write-Success "Started $Title"
}

# 1. Knowledge API
Launch-Service "Knowledge API" "$projectRoot\knowledge-api" "uv run uvicorn src.api.app:app --reload --port 9509 --reload-dir src" @{
    ALLOYDB_URL="postgresql://postgres:postgres@localhost:9432/knowledge";
    ENVIRONMENT="development";
    KB_HERMETIC_ISOLATION="true"
}

# 2. Orchestrator
Launch-Service "Orchestrator" "$projectRoot\orchestrator-service" "uv run uvicorn src.api.app:app --reload --port 9501 --reload-dir src" @{
    REDIS_URL="redis://localhost:9379/0";
    AUTH_ENABLED="false"
}

# 3. Ingestion Pipeline
Launch-Service "Ingestion Pipeline" "$projectRoot\ingestion-pipeline-service" "uv run uvicorn src.api.app:app --reload --port 9508 --reload-dir src" @{
    KNOWLEDGE_API_URL="http://localhost:9509";
    AUTH_ENABLED="false";
    ENVIRONMENT="development";
    KB_HERMETIC_ISOLATION="true"
}

# 4. Analytics
Launch-Service "Analytics" "$projectRoot\analytics-service" "uv run uvicorn src.api.app:app --reload --port 9510 --reload-dir src" @{
    ENVIRONMENT="development"
}

# 5. Agentic Frontend
Launch-Service "Agentic Frontend" "$projectRoot\agentic" "npx tsx watch --ignore './client/**' server/_core/index.ts" @{
    NODE_ENV="development";
    PORT="9001";
    KB_HERMETIC_ISOLATION="true";
    DB_AUTO_MIGRATE="false"
}

# Step 10: Launch Browser
Write-Step "Step 10: Launching the application..."
Write-Info "Waiting 8 seconds for servers to bind ports and start up..."
Start-Sleep -Seconds 8
Start-Process "http://localhost:9001"

Write-Host @"

╔═══════════════════════════════════════════════════════════════╗
║   Setup Complete! All services have been launched.            ║
║   Check the newly opened PowerShell windows for service logs. ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green