-- =============================================
-- Views for Smart Society (easier to query)
-- =============================================

USE smart_society;

-- View 1: Block Occupancy
DROP VIEW IF EXISTS v_block_occupancy;
CREATE VIEW v_block_occupancy AS
SELECT 
    f.block,
    COUNT(f.flat_no) AS total_flats,
    COUNT(r.flat_no) AS occupied_flats,
    ROUND(COUNT(r.flat_no) * 100.0 / NULLIF(COUNT(f.flat_no), 0), 1) AS occupancy_percent
FROM flats f
LEFT JOIN residents r ON f.flat_no = r.flat_no
GROUP BY f.block;

-- View 2: Monthly Collections
DROP VIEW IF EXISTS v_monthly_collections;
CREATE VIEW v_monthly_collections AS
SELECT 
    DATE_FORMAT(payment_date, '%Y-%m') AS month,
    COUNT(*) AS total_invoices,
    SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
    SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
FROM maintenance_payments
WHERE payment_date IS NOT NULL
GROUP BY DATE_FORMAT(payment_date, '%Y-%m');

-- View 3: Overdue Residents
DROP VIEW IF EXISTS v_overdue_residents;
CREATE VIEW v_overdue_residents AS
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
GROUP BY r.resident_id, r.name, r.flat_no, r.phone;

-- View 4: Dashboard Stats
DROP VIEW IF EXISTS v_dashboard_stats;
CREATE VIEW v_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM flats) AS total_flats,
    (SELECT COUNT(*) FROM residents) AS total_residents,
    (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Pending') AS pending_payments,
    (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Overdue') AS overdue_payments,
    (SELECT COUNT(*) FROM complaints WHERE status NOT IN ('Resolved', 'Closed')) AS open_complaints,
    (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL) AS current_visitors,
    (SELECT COUNT(*) FROM parking) AS total_parking_slots;

-- View 5: Resident with Flat Details
DROP VIEW IF EXISTS v_resident_flats;
CREATE VIEW v_resident_flats AS
SELECT 
    r.resident_id,
    r.name,
    r.phone,
    r.email,
    r.flat_no,
    f.block,
    f.floor,
    f.type,
    r.move_in_date
FROM residents r
JOIN flats f ON r.flat_no = f.flat_no;

-- View 6: Visitor with Flat Details
DROP VIEW IF EXISTS v_visitor_details;
CREATE VIEW v_visitor_details AS
SELECT 
    v.visitor_id,
    v.visitor_name,
    v.purpose,
    v.entry_time,
    v.exit_time,
    v.flat_no,
    f.block
FROM visitors v
JOIN flats f ON v.flat_no = f.flat_no;

-- View 7: Payment Details
DROP VIEW IF EXISTS v_payment_details;
CREATE VIEW v_payment_details AS
SELECT 
    p.payment_id,
    p.amount,
    p.payment_date,
    p.due_date,
    p.status,
    p.resident_id,
    r.name AS resident_name,
    r.flat_no
FROM maintenance_payments p
JOIN residents r ON p.resident_id = r.resident_id;

-- =============================================
-- Functions
-- =============================================

-- Function 1: Get flat count by block
DROP FUNCTION IF EXISTS fn_get_flat_count;
CREATE FUNCTION fn_get_flat_count(p_block VARCHAR(10))
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN (SELECT COUNT(*) FROM flats WHERE block = p_block);
END

-- Function 2: Get resident count
DROP FUNCTION IF EXISTS fn_get_resident_count;
CREATE FUNCTION fn_get_resident_count()
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN (SELECT COUNT(*) FROM residents);
END

-- Function 3: Check if flat is occupied
DROP FUNCTION IF EXISTS fn_is_flat_occupied;
CREATE FUNCTION fn_is_flat_occupied(p_flat_no INT)
RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    RETURN EXISTS (SELECT 1 FROM residents WHERE flat_no = p_flat_no);
END

-- Function 4: Calculate total pending amount
DROP FUNCTION IF EXISTS fn_total_pending_amount;
CREATE FUNCTION fn_total_pending_amount()
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    RETURN COALESCE((SELECT SUM(amount) FROM maintenance_payments WHERE status IN ('Pending', 'Overdue')), 0);
END

-- Function 5: Get active visitor count
DROP FUNCTION IF EXISTS fn_active_visitors;
CREATE FUNCTION fn_active_visitors()
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL);
END

SELECT '✅ Views and Functions created successfully!' AS message;