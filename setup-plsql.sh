#!/bin/bash

# Smart Society - PL/SQL Setup Script
# This script sets up views, functions, and stored procedures

set -e

echo "=== Smart Society - Views & Functions Setup ==="
echo ""

# Find MySQL container
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'mysql|mariadb' | head -1)

if [ -z "$CONTAINER" ]; then
    echo "❌ No MySQL container found!"
    echo "   Run: docker-compose up -d"
    exit 1
fi

echo "✅ Found MySQL container: $CONTAINER"

# Create Views
echo ""
echo "📝 Creating Views..."
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society --delimiter='//' -e "
CREATE OR REPLACE VIEW v_block_occupancy AS
SELECT f.block, COUNT(f.flat_no) AS total_flats, COUNT(r.flat_no) AS occupied_flats,
       ROUND(COUNT(r.flat_no) * 100.0 / NULLIF(COUNT(f.flat_no), 0), 1) AS occupancy_percent
FROM flats f LEFT JOIN residents r ON f.flat_no = r.flat_no GROUP BY f.block;//

CREATE OR REPLACE VIEW v_monthly_collections AS
SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, COUNT(*) AS total_invoices,
       SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
       SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
FROM maintenance_payments WHERE payment_date IS NOT NULL
GROUP BY DATE_FORMAT(payment_date, '%Y-%m');//

CREATE OR REPLACE VIEW v_overdue_residents AS
SELECT r.resident_id, r.name, r.flat_no, r.phone, COUNT(p.payment_id) AS overdue_count, SUM(p.amount) AS overdue_amount
FROM residents r JOIN maintenance_payments p ON r.resident_id = p.resident_id
WHERE p.status IN ('Overdue', 'Pending') AND p.due_date < CURDATE()
GROUP BY r.resident_id, r.name, r.flat_no, r.phone;//

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT (SELECT COUNT(*) FROM flats) AS total_flats,
       (SELECT COUNT(*) FROM residents) AS total_residents,
       (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Pending') AS pending_payments,
       (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Overdue') AS overdue_payments,
       (SELECT COUNT(*) FROM complaints WHERE status NOT IN ('Resolved', 'Closed')) AS open_complaints,
       (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL) AS current_visitors,
       (SELECT COUNT(*) FROM parking) AS total_parking_slots;//

CREATE OR REPLACE VIEW v_resident_flats AS
SELECT r.resident_id, r.name, r.phone, r.email, r.flat_no, f.block, f.floor, f.type, r.move_in_date
FROM residents r JOIN flats f ON r.flat_no = f.flat_no;//

CREATE OR REPLACE VIEW v_visitor_details AS
SELECT v.visitor_id, v.visitor_name, v.purpose, v.entry_time, v.exit_time, v.flat_no, f.block
FROM visitors v JOIN flats f ON v.flat_no = f.flat_no;//

CREATE OR REPLACE VIEW v_payment_details AS
SELECT p.payment_id, p.amount, p.payment_date, p.due_date, p.status, p.resident_id, r.name AS resident_name, r.flat_no
FROM maintenance_payments p JOIN residents r ON p.resident_id = r.resident_id;//
" 2>/dev/null || true

echo "  ✅ Views created"

# Create Functions
echo ""
echo "📝 Creating Functions..."
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society --delimiter='//' -e "
DROP FUNCTION IF EXISTS fn_get_resident_count;
CREATE FUNCTION fn_get_resident_count() RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM residents; RETURN cnt; END//

DROP FUNCTION IF EXISTS fn_get_flat_count;
CREATE FUNCTION fn_get_flat_count(p_block VARCHAR(10)) RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM flats WHERE block = p_block; RETURN cnt; END//

DROP FUNCTION IF EXISTS fn_is_flat_occupied;
CREATE FUNCTION fn_is_flat_occupied(p_flat_no INT) RETURNS BOOLEAN DETERMINISTIC
BEGIN DECLARE occ BOOLEAN; SELECT EXISTS(SELECT 1 FROM residents WHERE flat_no = p_flat_no) INTO occ; RETURN occ; END//

DROP FUNCTION IF EXISTS fn_total_pending_amount;
CREATE FUNCTION fn_total_pending_amount() RETURNS DECIMAL(10,2) DETERMINISTIC
BEGIN DECLARE amt DECIMAL(10,2); SELECT COALESCE(SUM(amount), 0) INTO amt FROM maintenance_payments WHERE status IN ('Pending', 'Overdue'); RETURN amt; END//

DROP FUNCTION IF EXISTS fn_active_visitors;
CREATE FUNCTION fn_active_visitors() RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM visitors WHERE exit_time IS NULL; RETURN cnt; END//
" 2>/dev/null || true

echo "  ✅ Functions created"

# Verify
echo ""
echo "📋 Created Views:"
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society -e "SHOW FULL TABLES WHERE Table_type = 'VIEW';" 2>/dev/null | grep -v "Tables_in" | awk '{print "  - " $1}'

echo ""
echo "📋 Created Functions:"
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society -e "SHOW FUNCTION STATUS WHERE Db = 'smart_society';" 2>/dev/null | grep -v "Db\|Name\|body" | awk '{print "  - " $2}'

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Test in SQL Runner:"
echo "  SELECT * FROM v_block_occupancy"
echo "  SELECT fn_get_resident_count()"