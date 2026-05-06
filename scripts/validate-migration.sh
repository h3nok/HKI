#!/bin/bash
# ============================================================================
# Migration File Validator
# ============================================================================
# Validate SQL migration files for syntax and potential issues

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
MIGRATION_DIR="apps/agentic/drizzle"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

validate_migration_file() {
    local file="$1"
    local filename=$(basename "$file")

    echo "📄 Validating $filename"

    # Check if file exists and is readable
    if [[ ! -r "$file" ]]; then
        log_error "Cannot read file: $file"
        return 1
    fi

    # Check if file is non-empty
    if [[ ! -s "$file" ]]; then
        log_warn "File is empty: $filename"
        return 1
    fi

    # Basic syntax checks
    local issues=0

    # Check for dangerous operations (should be rare in migrations)
    if grep -i "drop\s\+database\|truncate\s\+table" "$file" >/dev/null 2>&1; then
        log_warn "$filename contains potentially dangerous operations (DROP DATABASE or TRUNCATE TABLE)"
        ((issues++))
    fi

    # Check for proper SQL statement termination
    if ! grep -q ";\s*$" "$file"; then
        log_warn "$filename may be missing statement terminators (;)"
        ((issues++))
    fi

    # Check for common MySQL syntax patterns
    if grep -i "create\s\+table\|alter\s\+table\|insert\s\+into" "$file" >/dev/null 2>&1; then
        log_info "$filename contains valid DDL/DML operations"
    else
        log_warn "$filename doesn't contain recognizable SQL operations"
        ((issues++))
    fi

    # Check for IF NOT EXISTS patterns (good practice)
    if grep -i "create.*if\s\+not\s\+exists" "$file" >/dev/null 2>&1; then
        log_success "$filename uses IF NOT EXISTS (idempotent)"
    fi

    # Check encoding
    if ! file "$file" | grep -q "UTF-8"; then
        log_warn "$filename may not be UTF-8 encoded"
        ((issues++))
    fi

    if [[ $issues -eq 0 ]]; then
        log_success "$filename validation passed"
        return 0
    else
        log_warn "$filename has $issues potential issues"
        return 1
    fi
}

validate_migration_sequence() {
    log_info "Checking migration file sequence..."

    local migration_files=($(ls "${MIGRATION_DIR}"/0*.sql 2>/dev/null | sort || true))

    if [[ ${#migration_files[@]} -eq 0 ]]; then
        log_warn "No migration files found"
        return 1
    fi

    local expected_num=0
    local sequence_issues=0

    for file in "${migration_files[@]}"; do
        filename=$(basename "$file")

        # Extract number from filename (e.g., 0001_initial.sql -> 0001)
        if [[ $filename =~ ^([0-9]+)_ ]]; then
            file_num="${BASH_REMATCH[1]}"
            file_num=$((10#$file_num))  # Convert to decimal

            if [[ $file_num -ne $expected_num ]]; then
                log_warn "Migration sequence gap: expected ${expected_num}, found ${file_num} in $filename"
                ((sequence_issues++))
            fi

            ((expected_num++))
        else
            log_warn "Migration file doesn't follow naming convention (NNNN_name.sql): $filename"
            ((sequence_issues++))
        fi
    done

    if [[ $sequence_issues -eq 0 ]]; then
        log_success "Migration sequence is valid (${#migration_files[@]} files)"
    else
        log_warn "Migration sequence has $sequence_issues issues"
    fi

    return $sequence_issues
}

main() {
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        echo "Migration File Validator"
        echo ""
        echo "Usage: $0 [migration_file]"
        echo ""
        echo "Without arguments: validates all migration files in ${MIGRATION_DIR}/"
        echo "With file argument: validates specific migration file"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Validate all migrations"
        echo "  $0 ${MIGRATION_DIR}/0001_initial.sql  # Validate specific file"
        exit 0
    fi

    echo "========================================="
    echo "MIGRATION FILE VALIDATOR"
    echo "========================================="

    # Check we're in the right directory
    if [[ ! -d "${MIGRATION_DIR}" ]]; then
        log_error "Migration directory ${MIGRATION_DIR} not found. Run from the repository root."
        exit 1
    fi

    if [[ -n "${1:-}" ]]; then
        # Validate specific file
        if [[ -f "$1" ]]; then
            validate_migration_file "$1"
        else
            log_error "File not found: $1"
            exit 1
        fi
    else
        # Validate all migration files
        migration_files=($(ls "${MIGRATION_DIR}"/0*.sql 2>/dev/null | sort || true))

        if [[ ${#migration_files[@]} -eq 0 ]]; then
            log_warn "No migration files found in ${MIGRATION_DIR}/"
            exit 1
        fi

        log_info "Found ${#migration_files[@]} migration files to validate"
        echo ""

        local validation_failures=0

        for file in "${migration_files[@]}"; do
            if ! validate_migration_file "$file"; then
                ((validation_failures++))
            fi
            echo ""
        done

        echo "========================================="

        # Validate sequence
        if ! validate_migration_sequence; then
            ((validation_failures++))
        fi

        echo "========================================="
        echo "VALIDATION SUMMARY"
        echo "========================================="

        if [[ $validation_failures -eq 0 ]]; then
            log_success "All migration files passed validation!"
        else
            log_warn "$validation_failures validation issues found"
            echo ""
            echo "Consider reviewing the warnings above before running migrations."
        fi
    fi
}

main "$@"
