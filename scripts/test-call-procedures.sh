#!/bin/bash
# Test script for calling stored procedures via SQL Runner

BASE_URL="http://localhost:3001"

echo "=== Stored Procedures Test via API ==="
echo ""

# Test 1: Get Block Occupancy
echo "1. CALL get_block_occupancy();"
echo "   Returns: Block-wise occupancy stats"
echo ""
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_block_occupancy()"}' | jq .
echo ""

# Test 2: Get Monthly Collections
echo "2. CALL get_monthly_collections();"
echo "   Returns: Monthly payment collections"
echo ""
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_monthly_collections()"}' | jq .
echo ""

# Test 3: Get Dashboard Stats
echo "3. CALL get_dashboard_stats();"
echo "   Returns: Overview stats"
echo ""
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_dashboard_stats()"}' | jq .
echo ""

# Test 4: Get Overdue Residents
echo "4. CALL get_overdue_residents();"
echo "   Returns: Residents with overdue payments"
echo ""
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_overdue_residents()"}' | jq .
echo ""

# Test 5: Add resident with procedure
echo "5. CALL add_resident_safe('Test User', '9999999999', 'test@test.com', 101, '2024-01-01', @result);"
echo "   Returns: Result message"
echo ""
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL add_resident_safe('\''Test User'\'', '\''9999999999'\'', '\''test@test.com'\'', 101, '\''2024-01-01'\'', @result); SELECT @result;"}' | jq .
echo ""

echo "=== Tests Complete ==="
echo ""
echo "You can also test these in the SQL Runner UI with:"
echo "  CALL get_block_occupancy();"