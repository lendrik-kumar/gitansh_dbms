-- =============================================
-- Stored Procedures for Smart Society Management
-- =============================================

USE smart_society;

DELIMITER //

-- =============================================
-- 1. Add Resident with Validation
-- =============================================
CREATE PROCEDURE add_resident_safe(
    IN p_name VARCHAR(100),
    IN p_phone VARCHAR(20),
    IN p_email VARCHAR(100),
    IN p_flat_no INT,
    IN p_move_in_date DATE,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check if flat exists
    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Flat does not exist';
    END IF;

    -- Check if flat already has a resident (optional: allow multiple)
    -- IF EXISTS (SELECT 1 FROM residents WHERE flat_no = p_flat_no) THEN
    --     SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Flat already has a resident';
    -- END IF;

    INSERT INTO residents (name, phone, email, flat_no, move_in_date)
    VALUES (p_name, p_phone, p_email, p_flat_no, p_move_in_date);

    COMMIT;
    SET p_result = 'SUCCESS: Resident added';
END //

-- =============================================
-- 2. Add Payment with Validation
-- =============================================
CREATE PROCEDURE add_payment_safe(
    IN p_amount DECIMAL(10,2),
    IN p_payment_date DATE,
    IN p_due_date DATE,
    IN p_status VARCHAR(20),
    IN p_resident_id INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check if resident exists
    IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Resident does not exist';
    END IF;

    -- Validate amount
    IF p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Amount must be positive';
    END IF;

    -- Validate dates
    IF p_due_date < CURDATE() AND p_status = 'Pending' THEN
        SET p_status = 'Overdue';
    END IF;

    INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id)
    VALUES (p_amount, p_payment_date, p_due_date, p_status, p_resident_id);

    COMMIT;
    SET p_result = 'SUCCESS: Payment added';
END //

-- =============================================
-- 3. Get Block Occupancy Stats
-- =============================================
CREATE PROCEDURE get_block_occupancy()
BEGIN
    SELECT 
        f.block,
        COUNT(f.flat_no) AS total_flats,
        COUNT(r.flat_no) AS occupied_flats,
        ROUND(COUNT(r.flat_no) * 100.0 / COUNT(f.flat_no), 1) AS occupancy_percent
    FROM flats f
    LEFT JOIN residents r ON f.flat_no = r.flat_no
    GROUP BY f.block
    ORDER BY f.block;
END //

-- =============================================
-- 4. Get Monthly Collections Report
-- =============================================
CREATE PROCEDURE get_monthly_collections()
BEGIN
    SELECT 
        DATE_FORMAT(payment_date, '%Y-%m') AS month,
        COUNT(*) AS total_invoices,
        SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
        SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
    FROM maintenance_payments
    WHERE payment_date IS NOT NULL
    GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
    ORDER BY month DESC;
END //

-- =============================================
-- 5. Get Overdue Residents
-- =============================================
CREATE PROCEDURE get_overdue_residents()
BEGIN
    SELECT 
        r.resident_id,
        r.name,
        r.flat_no,
        r.phone,
        COUNT(p.payment_id) AS overdue_count,
        SUM(p.amount) AS overdue_amount
    FROM residents r
    JOIN maintenance_payments p ON r.resident_id = p.resident_id
    WHERE p.status IN ('Overdue', 'Pending') 
      AND p.due_date < CURDATE()
    GROUP BY r.resident_id, r.name, r.flat_no, r.phone
    ORDER BY overdue_amount DESC;
END //

-- =============================================
-- 6. Add Visitor with Validation
-- =============================================
CREATE PROCEDURE add_visitor_safe(
    IN p_visitor_name VARCHAR(100),
    IN p_entry_time DATETIME,
    IN p_purpose VARCHAR(255),
    IN p_flat_no INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check if flat exists
    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Flat does not exist';
    END IF;

    INSERT INTO visitors (visitor_name, entry_time, purpose, flat_no)
    VALUES (p_visitor_name, p_entry_time, p_purpose, p_flat_no);

    COMMIT;
    SET p_result = 'SUCCESS: Visitor logged';
END //

-- =============================================
-- 7. Check Out Visitor
-- =============================================
CREATE PROCEDURE check_out_visitor(
    IN p_visitor_id INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check if visitor exists and not already checked out
    IF NOT EXISTS (SELECT 1 FROM visitors WHERE visitor_id = p_visitor_id AND exit_time IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Visitor not found or already checked out';
    END IF;

    UPDATE visitors 
    SET exit_time = NOW() 
    WHERE visitor_id = p_visitor_id;

    COMMIT;
    SET p_result = 'SUCCESS: Visitor checked out';
END //

-- =============================================
-- 8. Add Parking with Validation
-- =============================================
CREATE PROCEDURE add_parking_safe(
    IN p_slot_number VARCHAR(20),
    IN p_vehicle_number VARCHAR(20),
    IN p_vehicle_type VARCHAR(20),
    IN p_resident_id INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check slot number uniqueness
    IF EXISTS (SELECT 1 FROM parking WHERE slot_number = p_slot_number) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Slot number already exists';
    END IF;

    -- Check resident exists if provided
    IF p_resident_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Resident does not exist';
    END IF;

    INSERT INTO parking (slot_number, vehicle_number, vehicle_type, resident_id)
    VALUES (p_slot_number, p_vehicle_number, p_vehicle_type, p_resident_id);

    COMMIT;
    SET p_result = 'SUCCESS: Parking slot added';
END //

-- =============================================
-- 9. Get Dashboard Stats
-- =============================================
CREATE PROCEDURE get_dashboard_stats()
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM flats) AS total_flats,
        (SELECT COUNT(*) FROM residents) AS total_residents,
        (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Pending') AS pending_payments,
        (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Overdue') AS overdue_payments,
        (SELECT COUNT(*) FROM complaints WHERE status NOT IN ('Resolved', 'Closed')) AS open_complaints,
        (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL) AS current_visitors,
        (SELECT COUNT(*) FROM parking) AS total_parking_slots;
END //

-- =============================================
-- 10. Transaction Demo: Transfer Resident
-- =============================================
CREATE PROCEDURE transfer_resident(
    IN p_resident_id INT,
    IN p_new_flat_no INT,
    OUT p_result VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 p_result = MESSAGE_TEXT;
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Check resident exists
    IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Resident does not exist';
    END IF;

    -- Check new flat exists
    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_new_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: New flat does not exist';
    END IF;

    -- Update resident's flat
    UPDATE residents 
    SET flat_no = p_new_flat_no 
    WHERE resident_id = p_resident_id;

    COMMIT;
    SET p_result = 'SUCCESS: Resident transferred';
END //

DELIMITER ;

-- =============================================
-- Show created procedures
-- =============================================
SHOW PROCEDURE STATUS WHERE Db = 'smart_society';