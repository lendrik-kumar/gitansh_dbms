#!/bin/bash

# Run functions via docker mysql client

echo "Creating functions..."

docker exec -i scholarlink-mysql mysql -h localhost -uroot -proot smart_society << 'EOF'

DROP FUNCTION IF EXISTS fn_get_flat_count;
CREATE FUNCTION fn_get_flat_count(p_block VARCHAR(10))
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt FROM flats WHERE block = p_block;
    RETURN cnt;
END //

DROP FUNCTION IF EXISTS fn_get_resident_count;
CREATE FUNCTION fn_get_resident_count()
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt FROM residents;
    RETURN cnt;
END //

DROP FUNCTION IF EXISTS fn_is_flat_occupied;
CREATE FUNCTION fn_is_flat_occupied(p_flat_no INT)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE occ BOOLEAN;
    SELECT EXISTS(SELECT 1 FROM residents WHERE flat_no = p_flat_no) INTO occ;
    RETURN occ;
END //

DROP FUNCTION IF EXISTS fn_total_pending_amount;
CREATE FUNCTION fn_total_pending_amount()
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE amt DECIMAL(10,2);
    SELECT COALESCE(SUM(amount), 0) INTO amt FROM maintenance_payments WHERE status IN ('Pending', 'Overdue');
    RETURN amt;
END //

DROP FUNCTION IF EXISTS fn_active_visitors;
CREATE FUNCTION fn_active_visitors()
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt FROM visitors WHERE exit_time IS NULL;
    RETURN cnt;
END //

EOF

echo "Functions created!"
docker exec -i scholarlink-mysql mysql -h localhost -uroot -proot smart_society -e "SHOW FUNCTION STATUS WHERE Db = 'smart_society';"