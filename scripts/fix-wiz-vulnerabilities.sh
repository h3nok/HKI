#!/usr/bin/env bash
# Quick fix script for Wiz security vulnerabilities
# Run from apps/ai-platform directory

set -Eeuo pipefail
IFS=$'\n\t'

echo "🔒 Starting security vulnerability fixes..."
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. FIX NPM VULNERABILITIES (25 found: 14 high, 9 moderate, 2 low)
# ═══════════════════════════════════════════════════════════════════════════════

echo "📦 Updating vulnerable npm packages..."

# Update specific vulnerable packages identified in audit
echo "  → Updating minimatch (ReDoS vulnerabilities)..."
pnpm update minimatch --latest --recursive

echo "  → Updating rollup (Path traversal)..."
pnpm update rollup --latest --recursive

echo "  → Updating next (DoS vulnerabilities)..."
pnpm update next --latest --recursive

echo "  → Updating glob (ReDoS)..."
pnpm update glob --latest --recursive

echo "  → Updating fast-xml-parser (Stack overflow)..."
pnpm update fast-xml-parser --latest --recursive

echo "  → Running general dependency updates..."
pnpm update --latest

echo "  → Verifying fixes..."
pnpm audit --audit-level=high 2>&1 | tail -5

# ═══════════════════════════════════════════════════════════════════════════════
# 2. UPDATE DOCKER BASE IMAGES
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "🐳 Updating Docker base images to latest secure versions..."

# Update Python images
echo "  → Updating Python images to 3.13-alpine..."
find . -name "Dockerfile" -type f -print0 | while IFS= read -r -d '' file; do
    if grep -q "python:3.11-slim" "$file"; then
        echo "    Updating: $file"
        sed -i '' 's/FROM python:3.11-slim/FROM python:3.13-alpine/g' "$file"
    fi
    if grep -q "python:3.12-slim" "$file"; then
        echo "    Updating: $file"
        sed -i '' 's/FROM python:3.12-slim/FROM python:3.13-alpine/g' "$file"
    fi
done

# Update Node images
echo "  → Updating Node images to 20-alpine..."
find . -name "Dockerfile" -type f -print0 | while IFS= read -r -d '' file; do
    if grep -q "node:20-slim" "$file"; then
        echo "    Updating: $file"
        sed -i '' 's/FROM node:20-slim/FROM node:20-alpine/g' "$file"
    fi
done

echo ""
echo "✅ Security vulnerability fixes applied!"
echo ""
echo "📋 Next steps:"
echo "  1. Test builds: make deploy-knowledge-api DRY_RUN=true"
echo "  2. Run audit again: pnpm audit"
echo "  3. Commit changes: git add -A && git commit -m 'fix: Update dependencies and Docker images to address security vulnerabilities'"
echo "  4. Push and wait for Wiz scan in PR"
echo ""
