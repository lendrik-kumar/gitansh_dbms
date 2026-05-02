#!/bin/bash
# Script to run stored procedures test

BASE_URL="http://localhost:3001"

echo "=== Stored Procedures Test Suite ==="
echo ""

# Test via SQL Runner
echo "Test 1: Get Block Occupancy"
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_block_occupancy()"}'
echo ""
echo ""

echo "Test 2: Get Monthly Collections"
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_monthly_collections()"}'
echo ""
echo ""

echo "Test 3: Get Dashboard Stats"
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_dashboard_stats()"}'
echo ""
echo ""

echo "Test 4: Get Overdue Residents"
curl -s -X POST "$BASE_URL/api/execute-sql" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CALL get_overdue_residents()"}'
echo ""
echo ""

echo "=== Test Complete ==="