#!/bin/bash
# Create functions and stored procedures via docker MySQL

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'mysql|mariadb' | head -1)
echo "Using container: $CONTAINER"

# Create Functions
echo "Creating Functions..."
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

DROP FUNCTION IF EXISTS fn_get_complaint_count;
CREATE FUNCTION fn_get_complaint_count(p_status VARCHAR(20)) RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM complaints WHERE status = p_status; RETURN cnt; END//

DROP FUNCTION IF EXISTS fn_get_visitor_count_today;
CREATE FUNCTION fn_get_visitor_count_today() RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM visitors WHERE DATE(entry_time) = CURDATE(); RETURN cnt; END//

DROP FUNCTION IF EXISTS fn_calculate_late_fee;
CREATE FUNCTION fn_calculate_late_fee(p_payment_id INT) RETURNS DECIMAL(10,2) DETERMINISTIC
BEGIN DECLARE days INT; DECLARE amt DECIMAL(10,2); DECLARE late_fee DECIMAL(10,2);
SELECT DATEDIFF(CURDATE(), due_date), amount INTO days, amt FROM maintenance_payments WHERE payment_id = p_payment_id;
IF days > 0 THEN SET late_fee = amt * 0.01 * days; IF late_fee > amt * 0.5 THEN SET late_fee = amt * 0.5; END IF; ELSE SET late_fee = 0; END IF;
RETURN late_fee; END//

DROP FUNCTION IF EXISTS fn_get_payment_count_by_status;
CREATE FUNCTION fn_get_payment_count_by_status(p_status VARCHAR(20)) RETURNS INT DETERMINISTIC
BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM maintenance_payments WHERE status = p_status; RETURN cnt; END//

DROP FUNCTION IF EXISTS fn_get_total_revenue;
CREATE FUNCTION fn_get_total_revenue() RETURNS DECIMAL(12,2) DETERMINISTIC
BEGIN DECLARE amt DECIMAL(12,2); SELECT COALESCE(SUM(amount), 0) INTO amt FROM maintenance_payments WHERE status = 'Paid'; RETURN amt; END//
" 2>/dev/null

echo "Functions created!"

# Create Stored Procedures
echo "Creating Stored Procedures..."
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society --delimiter='//' -e "
-- FLAT CRUD
DROP PROCEDURE IF EXISTS add_flat_safe;
CREATE PROCEDURE add_flat_safe(IN p_flat_no INT, IN p_block VARCHAR(10), IN p_floor INT, IN p_type VARCHAR(20))
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
IF p_flat_no IS NULL OR p_block IS NULL OR p_floor IS NULL OR p_type IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'All fields required'; END IF;
INSERT INTO flats (flat_no, block, floor, type) VALUES (p_flat_no, p_block, p_floor, p_type); END//

DROP PROCEDURE IF EXISTS update_flat_safe;
CREATE PROCEDURE update_flat_safe(IN p_flat_no INT, IN p_block VARCHAR(10), IN p_floor INT, IN p_type VARCHAR(20))
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat not found'; END IF;
UPDATE flats SET block = p_block, floor = p_floor, type = p_type WHERE flat_no = p_flat_no; END//

DROP PROCEDURE IF EXISTS delete_flat_safe;
CREATE PROCEDURE delete_flat_safe(IN p_flat_no INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
IF EXISTS (SELECT 1 FROM residents WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete flat with residents'; END IF;
DELETE FROM flats WHERE flat_no = p_flat_no; END//

-- RESIDENT CRUD
DROP PROCEDURE IF EXISTS update_resident_safe;
CREATE PROCEDURE update_resident_safe(IN p_resident_id INT, IN p_name VARCHAR(100), IN p_phone VARCHAR(20), IN p_email VARCHAR(100), IN p_flat_no INT, IN p_move_in_date DATE)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF;
IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat not found'; END IF;
UPDATE residents SET name = p_name, phone = p_phone, email = p_email, flat_no = p_flat_no, move_in_date = p_move_in_date WHERE resident_id = p_resident_id; END//

DROP PROCEDURE IF EXISTS delete_resident_safe;
CREATE PROCEDURE delete_resident_safe(IN p_resident_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
DELETE FROM residents WHERE resident_id = p_resident_id; END//

-- PAYMENT CRUD
DROP PROCEDURE IF EXISTS update_payment_safe;
CREATE PROCEDURE update_payment_safe(IN p_payment_id INT, IN p_amount DECIMAL(10,2), IN p_payment_date DATE, IN p_due_date DATE, IN p_status VARCHAR(20), IN p_resident_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
UPDATE maintenance_payments SET amount = p_amount, payment_date = p_payment_date, due_date = p_due_date, status = p_status, resident_id = p_resident_id WHERE payment_id = p_payment_id; END//

DROP PROCEDURE IF EXISTS delete_payment_safe;
CREATE PROCEDURE delete_payment_safe(IN p_payment_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
DELETE FROM maintenance_payments WHERE payment_id = p_payment_id; END//

-- COMPLAINT CRUD
DROP PROCEDURE IF EXISTS add_complaint_safe;
CREATE PROCEDURE add_complaint_safe(IN p_complaint_type VARCHAR(50), IN p_description TEXT, IN p_status VARCHAR(20), IN p_complaint_date DATE, IN p_resident_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF;
INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (p_complaint_type, p_description, p_status, p_complaint_date, p_resident_id); END//

DROP PROCEDURE IF EXISTS update_complaint_safe;
CREATE PROCEDURE update_complaint_safe(IN p_complaint_id INT, IN p_complaint_type VARCHAR(50), IN p_description TEXT, IN p_status VARCHAR(20), IN p_complaint_date DATE, IN p_resident_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
UPDATE complaints SET complaint_type = p_complaint_type, description = p_description, status = p_status, complaint_date = p_complaint_date, resident_id = p_resident_id WHERE complaint_id = p_complaint_id; END//

DROP PROCEDURE IF EXISTS delete_complaint_safe;
CREATE PROCEDURE delete_complaint_safe(IN p_complaint_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
DELETE FROM complaints WHERE complaint_id = p_complaint_id; END//

-- VISITOR CRUD
DROP PROCEDURE IF EXISTS update_visitor_safe;
CREATE PROCEDURE update_visitor_safe(IN p_visitor_id INT, IN p_visitor_name VARCHAR(100), IN p_entry_time DATETIME, IN p_exit_time DATETIME, IN p_purpose VARCHAR(255), IN p_flat_no INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
UPDATE visitors SET visitor_name = p_visitor_name, entry_time = p_entry_time, exit_time = p_exit_time, purpose = p_purpose, flat_no = p_flat_no WHERE visitor_id = p_visitor_id; END//

DROP PROCEDURE IF EXISTS delete_visitor_safe;
CREATE PROCEDURE delete_visitor_safe(IN p_visitor_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
DELETE FROM visitors WHERE visitor_id = p_visitor_id; END//

-- PARKING CRUD
DROP PROCEDURE IF EXISTS update_parking_safe;
CREATE PROCEDURE update_parking_safe(IN p_parking_id INT, IN p_slot_number VARCHAR(20), IN p_vehicle_number VARCHAR(20), IN p_vehicle_type VARCHAR(20), IN p_resident_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
UPDATE parking SET slot_number = p_slot_number, vehicle_number = p_vehicle_number, vehicle_type = p_vehicle_type, resident_id = p_resident_id WHERE parking_id = p_parking_id; END//

DROP PROCEDURE IF EXISTS delete_parking_safe;
CREATE PROCEDURE delete_parking_safe(IN p_parking_id INT)
BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL;
DELETE FROM parking WHERE parking_id = p_parking_id; END//
" 2>/dev/null

echo "Stored Procedures created!"

# Create Triggers
echo "Creating Triggers..."
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society --delimiter='//' -e "
-- Audit triggers for residents
DROP TRIGGER IF EXISTS trg_after_resident_insert;
CREATE TRIGGER trg_after_resident_insert AFTER INSERT ON residents FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('residents', 'INSERT', NEW.resident_id, JSON_OBJECT('name', NEW.name, 'phone', NEW.phone, 'flat_no', NEW.flat_no))//

DROP TRIGGER IF EXISTS trg_after_resident_update;
CREATE TRIGGER trg_after_resident_update AFTER UPDATE ON residents FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, old_data, new_data) VALUES ('residents', 'UPDATE', NEW.resident_id, JSON_OBJECT('name', OLD.name, 'phone', OLD.phone), JSON_OBJECT('name', NEW.name, 'phone', NEW.phone))//

DROP TRIGGER IF EXISTS trg_after_resident_delete;
CREATE TRIGGER trg_after_resident_delete AFTER DELETE ON residents FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, old_data) VALUES ('residents', 'DELETE', OLD.resident_id, JSON_OBJECT('name', OLD.name, 'phone', OLD.phone))//

-- Auto-overdue trigger
DROP TRIGGER IF EXISTS trg_check_overdue_payment;
CREATE TRIGGER trg_check_overdue_payment BEFORE UPDATE ON maintenance_payments FOR EACH ROW
BEGIN IF NEW.due_date < CURDATE() AND NEW.status = 'Pending' THEN SET NEW.status = 'Overdue'; END IF; END//

-- Complaint triggers
DROP TRIGGER IF EXISTS trg_after_complaint_insert;
CREATE TRIGGER trg_after_complaint_insert AFTER INSERT ON complaints FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('complaints', 'INSERT', NEW.complaint_id, JSON_OBJECT('complaint_type', NEW.complaint_type, 'status', NEW.status))//

DROP TRIGGER IF EXISTS trg_after_complaint_update;
CREATE TRIGGER trg_after_complaint_update AFTER UPDATE ON complaints FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, old_data, new_data) VALUES ('complaints', 'UPDATE', NEW.complaint_id, JSON_OBJECT('status', OLD.status), JSON_OBJECT('status', NEW.status))//

-- Visitor triggers
DROP TRIGGER IF EXISTS trg_after_visitor_insert;
CREATE TRIGGER trg_after_visitor_insert AFTER INSERT ON visitors FOR EACH ROW
INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('visitors', 'INSERT', NEW.visitor_id, JSON_OBJECT('visitor_name', NEW.visitor_name, 'flat_no', NEW.flat_no))//
" 2>/dev/null

echo "Triggers created!"

# Verify
echo ""
echo "=== VERIFICATION ==="
echo "Functions:"
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society -e "SHOW FUNCTION STATUS WHERE Db = 'smart_society';" 2>/dev/null | grep -v "Warning" | grep -v "Db\|Name" | wc -l

echo "Stored Procedures:"
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society -e "SHOW PROCEDURE STATUS WHERE Db = 'smart_society';" 2>/dev/null | grep -v "Warning" | grep -v "Db\|Name" | wc -l

echo "Triggers:"
docker exec -i $CONTAINER mysql -h localhost -uroot -proot smart_society -e "SHOW TRIGGERS WHERE Db = 'smart_society';" 2>/dev/null | grep -v "Warning" | grep -v "Trigger" | wc -l

echo ""
echo "✅ All PL/SQL objects created!"