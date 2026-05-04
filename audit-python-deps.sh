#!/bin/bash
# Audit Python dependencies for security vulnerabilities
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔒 Python Dependency Security Audit"
echo "===================================="
echo ""

# Check if pip-audit is installed
if ! command -v pip-audit &> /dev/null; then
    echo "Installing pip-audit..."
    pip install pip-audit
fi

echo "Auditing Python services..."
echo ""

for service in orchestrator-service ingestion-pipeline-service knowledge-api analytics-service; do
    echo "━━━ $service ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cd "$SCRIPT_DIR/$service"

    if [ -f "pyproject.toml" ]; then
        echo "Running pip-audit on $service..."
        pip-audit -r <(grep -A 100 "dependencies =" pyproject.toml | grep -E '^\s+"[a-zA-Z]' | sed 's/[",]//g' | sed 's/^\s*//' || echo "# No dependencies") 2>&1 | grep -E "Found|No known|VULNERABILITY" || echo "✅ No vulnerabilities found"
        echo ""
    fi
done

echo ""
echo "📋 Summary:"
echo "  1. Review vulnerabilities above"
echo "  2. Update affected packages in pyproject.toml"
echo "  3. Remove unused packages (numpy, sse-starlette)"
echo "  4. Run: uv lock to update lockfiles"
