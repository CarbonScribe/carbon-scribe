#!/bin/bash

# Portfolio API Integration Verification Script
# This script verifies that all portfolio components are properly integrated

echo "🔍 Portfolio API Integration Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - File not found: $1"
        ((FAILED++))
    fi
}

# Function to check if directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2 - Directory not found: $1"
        ((FAILED++))
    fi
}

echo "📁 Checking File Structure..."
echo "----------------------------"

# API Layer
check_file "src/api/client.ts" "API Client"
check_file "src/api/portfolio.ts" "Portfolio API"
check_file "src/api/types.ts" "API Types"

# Hooks
check_file "src/hooks/usePortfolio.ts" "Portfolio Hook"

# Context
check_file "src/contexts/CorporateContext.tsx" "Corporate Context"

# Components
check_dir "src/components/portfolio" "Portfolio Components Directory"
check_file "src/components/portfolio/PortfolioSummary.tsx" "Portfolio Summary Component"
check_file "src/components/portfolio/PortfolioHoldings.tsx" "Portfolio Holdings Component"
check_file "src/components/portfolio/PerformanceChart.tsx" "Performance Chart Component"
check_file "src/components/portfolio/CompositionBreakdown.tsx" "Composition Breakdown Component"
check_file "src/components/portfolio/RiskMetrics.tsx" "Risk Metrics Component"
check_file "src/components/portfolio/TimelineChart.tsx" "Timeline Chart Component"
check_file "src/components/portfolio/TransactionHistory.tsx" "Transaction History Component"

# Pages
check_file "src/app/portfolio/page.tsx" "Portfolio Page"

# Tests
check_file "src/api/__tests__/portfolio.spec.ts" "Portfolio API Tests"

# Documentation
check_file "docs/PORTFOLIO_API_INTEGRATION.md" "API Integration Documentation"
check_file "docs/PORTFOLIO_INTEGRATION_COMPLETE.md" "Implementation Summary"

echo ""
echo "🧪 Running Tests..."
echo "-------------------"

# Run tests
if npm test -- src/api/__tests__/portfolio.spec.ts --passWithNoTests --silent 2>&1 | grep -q "PASS"; then
    echo -e "${GREEN}✓${NC} All portfolio tests passing"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Some tests failing"
    ((FAILED++))
fi

echo ""
echo "🔧 Checking TypeScript Compilation..."
echo "--------------------------------------"

# Check TypeScript compilation (just check, don't build)
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗${NC} TypeScript compilation errors found"
    ((FAILED++))
else
    echo -e "${GREEN}✓${NC} No TypeScript errors"
    ((PASSED++))
fi

echo ""
echo "📊 Verification Summary"
echo "======================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Portfolio integration is complete.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
