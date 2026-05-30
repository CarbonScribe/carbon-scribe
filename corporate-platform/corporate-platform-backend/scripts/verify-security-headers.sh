#!/bin/bash

###############################################################################
# Security Headers Verification Script
#
# This script verifies that all required security headers are present
# and correctly configured in HTTP responses.
#
# Usage:
#   bash scripts/verify-security-headers.sh <base_url>
#
# Examples:
#   bash scripts/verify-security-headers.sh http://localhost:3001
#   bash scripts/verify-security-headers.sh https://staging-api.example.com
#   bash scripts/verify-security-headers.sh https://api.example.com
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3001}"
ENDPOINT="/health"
FULL_URL="${BASE_URL}${ENDPOINT}"

# Required headers
declare -A REQUIRED_HEADERS=(
  ["x-frame-options"]="SAMEORIGIN"
  ["x-content-type-options"]="nosniff"
  ["content-security-policy"]=""
  ["referrer-policy"]="strict-no-referrer"
  ["x-dns-prefetch-control"]="off"
  ["expect-ct"]=""
  ["cross-origin-resource-policy"]=""
  ["cross-origin-opener-policy"]=""
  ["permissions-policy"]=""
  ["x-xss-protection"]="1; mode=block"
)

# Production-only headers
declare -a PRODUCTION_HEADERS=(
  "strict-transport-security"
)

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

echo -e "${BLUE}=== Security Headers Verification ===${NC}"
echo -e "Testing URL: ${BLUE}${FULL_URL}${NC}\n"

# Fetch headers
RESPONSE=$(curl -sI "${FULL_URL}" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | head -1)

echo -e "HTTP Response: ${HTTP_CODE}\n"

if [[ ! "$HTTP_CODE" =~ "200" ]]; then
  echo -e "${YELLOW}Warning: Response code is not 200. Results may be incomplete.${NC}\n"
fi

# Function to check header
check_header() {
  local header_name="$1"
  local expected_value="$2"
  local is_required="${3:-true}"
  
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  
  # Extract header value (case-insensitive)
  local header_value=$(echo "$RESPONSE" | grep -i "^${header_name}:" | cut -d' ' -f2- | tr -d '\r')
  
  if [ -z "$header_value" ]; then
    if [ "$is_required" = "true" ]; then
      echo -e "${RED}✗${NC} ${header_name}: ${RED}MISSING${NC}"
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
    else
      echo -e "${YELLOW}⚠${NC} ${header_name}: ${YELLOW}NOT FOUND (Optional)${NC}"
      WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
    return 1
  fi
  
  if [ -n "$expected_value" ]; then
    if [[ "$header_value" == "$expected_value"* ]]; then
      echo -e "${GREEN}✓${NC} ${header_name}: ${GREEN}${header_value:0:50}${NC}"
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
      echo -e "${YELLOW}⚠${NC} ${header_name}: ${YELLOW}Present but value differs${NC}"
      echo -e "   Expected: ${expected_value}"
      echo -e "   Got: ${header_value:0:100}"
      WARNING_CHECKS=$((WARNING_CHECKS + 1))
    fi
  else
    echo -e "${GREEN}✓${NC} ${header_name}: ${GREEN}Present${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  fi
}

# Check required headers
echo -e "${BLUE}Required Headers:${NC}"
for header in "${!REQUIRED_HEADERS[@]}"; do
  check_header "$header" "${REQUIRED_HEADERS[$header]}" "true"
done

echo ""

# Check production headers
echo -e "${BLUE}Production-Only Headers:${NC}"
for header in "${PRODUCTION_HEADERS[@]}"; do
  check_header "$header" "" "false"
done

echo ""

# Additional validation checks
echo -e "${BLUE}Additional Validation:${NC}"

# Check CSP directives
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
CSP=$(echo "$RESPONSE" | grep -i "^content-security-policy:" | cut -d' ' -f2-)
if [[ "$CSP" == *"default-src 'self'"* ]]; then
  echo -e "${GREEN}✓${NC} CSP includes default-src 'self'"
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
  echo -e "${RED}✗${NC} CSP missing default-src 'self'"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check for unsafe-inline in production
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [[ "$CSP" == *"unsafe-inline"* ]] && [[ "$BASE_URL" =~ "production\|prod\|api\.example\.com" ]]; then
  echo -e "${YELLOW}⚠${NC} CSP contains 'unsafe-inline' (not recommended for production)"
  WARNING_CHECKS=$((WARNING_CHECKS + 1))
else
  echo -e "${GREEN}✓${NC} CSP inline script restriction verified"
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Check HSTS preload
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
HSTS=$(echo "$RESPONSE" | grep -i "^strict-transport-security:" | cut -d' ' -f2-)
if [[ "$HSTS" == *"preload"* ]]; then
  echo -e "${GREEN}✓${NC} HSTS preload enabled"
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
elif [[ -n "$HSTS" ]]; then
  echo -e "${YELLOW}⚠${NC} HSTS present but preload not enabled"
  WARNING_CHECKS=$((WARNING_CHECKS + 1))
fi

# Summary
echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo -e "Total Checks: ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
if [ $FAILED_CHECKS -gt 0 ]; then
  echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"
fi
if [ $WARNING_CHECKS -gt 0 ]; then
  echo -e "${YELLOW}Warnings: ${WARNING_CHECKS}${NC}"
fi

# Determine exit code
if [ $FAILED_CHECKS -eq 0 ]; then
  if [ $WARNING_CHECKS -eq 0 ]; then
    echo -e "\n${GREEN}✓ All security headers verified successfully!${NC}"
    exit 0
  else
    echo -e "\n${YELLOW}⚠ Verification completed with warnings. Review above.${NC}"
    exit 1
  fi
else
  echo -e "\n${RED}✗ Security header verification failed. See errors above.${NC}"
  exit 2
fi
