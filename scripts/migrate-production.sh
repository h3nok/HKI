#!/bin/bash
# ============================================================================
# Production Database Migration Script
# ============================================================================
# Safe database migration for production environments with backup and rollback
# capabilities. Integrates with Cloud SQL proxy and includes safety checks.

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
PROJECT_ID=${GCP_PROJECT_ID:-"p-642-cilab-demo"}
REGION=${GCP_REGION:-"us-west1"}
INSTANCE_NAME=${DB_INSTANCE_NAME:-"agentic-db"}
DATABASE_NAME=${DB_NAME:-"retail_agentic"}
PROXY_PORT=${PROXY_PORT:-13306}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# ── Functions ──────────────────────────────────────────────────────────────
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check required tools
    for cmd in gcloud mysql cloud_sql_proxy; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd is not installed or not in PATH"
            exit 1
        fi
    done

    # Check gcloud authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        log_error "Not authenticated with gcloud. Run: gcloud auth login"
        exit 1
    fi

    # Check project access
    if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
        log_error "Cannot access project $PROJECT_ID. Check project ID and permissions."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

start_cloud_sql_proxy() {
    log_info "Starting Cloud SQL Proxy..."

    # Check if proxy is already running
    if lsof -i :$PROXY_PORT &>/dev/null; then
        log_warn "Port $PROXY_PORT is already in use. Assuming Cloud SQL Proxy is running."
        return 0
    fi

    # Start proxy in background
    cloud_sql_proxy "$PROJECT_ID:$REGION:$INSTANCE_NAME" -p $PROXY_PORT &
    PROXY_PID=$!

    # Wait for proxy to be ready
    log_info "Waiting for Cloud SQL Proxy to be ready..."
    for i in {1..30}; do
        if mysql -h 127.0.0.1 -P $PROXY_PORT -u root -e "SELECT 1" &>/dev/null; then
            log_success "Cloud SQL Proxy is ready"
            return 0
        fi
        sleep 1
    done

    log_error "Cloud SQL Proxy failed to start or become ready"
    kill $PROXY_PID 2>/dev/null || true
    exit 1
}

create_backup() {
    log_info "Creating database backup..."

    BACKUP_NAME="pre-migration-$(date +%Y%m%d-%H%M%S)"

    if gcloud sql backups create \
        --instance="$INSTANCE_NAME" \
        --project="$PROJECT_ID" \
        --description="Pre-migration backup - $(date)" \
        --async; then
        log_success "Backup '$BACKUP_NAME' initiated"

        # Wait for backup to complete (optional)
        read -p "Wait for backup to complete before proceeding? [Y/n]: " -r
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            log_info "Waiting for backup to complete..."
            gcloud sql operations wait $(gcloud sql operations list \
                --instance="$INSTANCE_NAME" \
                --project="$PROJECT_ID" \
                --filter="status:RUNNING" \
                --format="value(name)" \
                --limit=1) \
                --project="$PROJECT_ID"
            log_success "Backup completed"
        fi
    else
        log_error "Failed to create backup"
        return 1
    fi
}

run_migrations() {
    log_info "Running database migrations..."

    # Get database password securely
    read -s -p "Enter database root password: " DB_PASSWORD
    echo

    export DATABASE_URL="mysql://root:$DB_PASSWORD@127.0.0.1:$PROXY_PORT/$DATABASE_NAME"

    # Test connection
    if ! mysql -h 127.0.0.1 -P $PROXY_PORT -u root -p"$DB_PASSWORD" -e "USE $DATABASE_NAME; SELECT 1" &>/dev/null; then
        log_error "Cannot connect to database. Check credentials and database existence."
        return 1
    fi

    # Run migrations using Makefile
    if make db-migrate; then
        log_success "Migrations completed successfully"
        return 0
    else
        log_error "Migrations failed"
        return 1
    fi
}

cleanup() {
    if [[ -n ${PROXY_PID:-} ]]; then
        log_info "Stopping Cloud SQL Proxy..."
        kill $PROXY_PID 2>/dev/null || true
    fi
}

main() {
    log_info "Starting production database migration"
    log_info "Project: $PROJECT_ID"
    log_info "Instance: $INSTANCE_NAME"
    log_info "Database: $DATABASE_NAME"
    echo

    # Set up cleanup trap
    trap cleanup EXIT

    # Check prerequisites
    check_prerequisites

    # Confirm production migration
    echo -e "${RED}⚠️  WARNING: This will run migrations on PRODUCTION database${NC}"
    read -p "Are you sure you want to proceed? [y/N]: " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Migration cancelled"
        exit 0
    fi

    # Create backup
    if ! create_backup; then
        log_error "Backup failed. Aborting migration."
        exit 1
    fi

    # Start Cloud SQL Proxy
    start_cloud_sql_proxy

    # Run migrations
    if run_migrations; then
        log_success "Production migration completed successfully"
        log_info "Don't forget to test the application to ensure everything works correctly"
    else
        log_error "Migration failed. Check the error messages above."
        log_warn "Consider restoring from the backup if needed:"
        log_warn "  gcloud sql backups restore --restore-instance=$INSTANCE_NAME --backup-instance=$INSTANCE_NAME --project=$PROJECT_ID"
        exit 1
    fi
}

# Show help if requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Production Database Migration Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Environment Variables:"
    echo "  GCP_PROJECT_ID     Project ID (default: p-642-cilab-demo)"
    echo "  GCP_REGION         Region (default: us-west1)"
    echo "  DB_INSTANCE_NAME   Instance name (default: agentic-db)"
    echo "  DB_NAME            Database name (default: retail_agentic)"
    echo "  PROXY_PORT         Proxy port (default: 13306)"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  GCP_PROJECT_ID=my-project $0"
    exit 0
fi

main "$@"
