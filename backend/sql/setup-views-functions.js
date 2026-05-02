const mysql = require('mysql2/promise');

const views = [
  // Existing views
  `CREATE OR REPLACE VIEW v_block_occupancy AS
SELECT 
    f.block,
    COUNT(f.flat_no) AS total_flats,
    COUNT(r.flat_no) AS occupied_flats,
    ROUND(COUNT(r.flat_no) * 100.0 / NULLIF(COUNT(f.flat_no), 0), 1) AS occupancy_percent
FROM flats f
LEFT JOIN residents r ON f.flat_no = r.flat_no
GROUP BY f.block`,

  `CREATE OR REPLACE VIEW v_monthly_collections AS
SELECT 
    DATE_FORMAT(payment_date, '%Y-%m') AS month,
    COUNT(*) AS total_invoices,
    SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
    SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
FROM maintenance_payments
WHERE payment_date IS NOT NULL
GROUP BY DATE_FORMAT(payment_date, '%Y-%m')`,

  `CREATE OR REPLACE VIEW v_overdue_residents AS
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
GROUP BY r.resident_id, r.name, r.flat_no, r.phone`,

  `CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM flats) AS total_flats,
    (SELECT COUNT(*) FROM residents) AS total_residents,
    (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Pending') AS pending_payments,
    (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Overdue') AS overdue_payments,
    (SELECT COUNT(*) FROM complaints WHERE status NOT IN ('Resolved', 'Closed')) AS open_complaints,
    (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL) AS current_visitors,
    (SELECT COUNT(*) FROM parking) AS total_parking_slots`,

  `CREATE OR REPLACE VIEW v_resident_flats AS
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
JOIN flats f ON r.flat_no = f.flat_no`,

  `CREATE OR REPLACE VIEW v_visitor_details AS
SELECT 
    v.visitor_id,
    v.visitor_name,
    v.purpose,
    v.entry_time,
    v.exit_time,
    v.flat_no,
    f.block
FROM visitors v
JOIN flats f ON v.flat_no = f.flat_no`,

  `CREATE OR REPLACE VIEW v_payment_details AS
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
JOIN residents r ON p.resident_id = r.resident_id`,

  // NEW VIEWS - Phase 1
  `CREATE OR REPLACE VIEW v_flat_details AS
SELECT 
    f.flat_no,
    f.block,
    f.floor,
    f.type,
    COUNT(r.resident_id) AS resident_count,
    GROUP_CONCAT(r.name SEPARATOR ', ') AS resident_names
FROM flats f
LEFT JOIN residents r ON f.flat_no = r.flat_no
GROUP BY f.flat_no, f.block, f.floor, f.type
ORDER BY f.block, f.flat_no`,

  `CREATE OR REPLACE VIEW v_complaint_summary AS
SELECT 
    complaint_type,
    status,
    COUNT(*) AS count,
    MIN(complaint_date) AS earliest_date,
    MAX(complaint_date) AS latest_date
FROM complaints
GROUP BY complaint_type, status
ORDER BY complaint_type, status`,

  `CREATE OR REPLACE VIEW v_payment_history AS
SELECT 
    p.payment_id,
    p.amount,
    p.payment_date,
    p.due_date,
    p.status,
    p.resident_id,
    r.name AS resident_name,
    r.flat_no,
    r.email AS resident_email,
    f.block,
    DATEDIFF(CURDATE(), p.due_date) AS days_overdue
FROM maintenance_payments p
JOIN residents r ON p.resident_id = r.resident_id
JOIN flats f ON r.flat_no = f.flat_no
ORDER BY p.due_date ASC`,

  `CREATE OR REPLACE VIEW v_parking_summary AS
SELECT 
    p.parking_id,
    p.slot_number,
    p.vehicle_number,
    p.vehicle_type,
    p.resident_id,
    r.name AS resident_name,
    r.flat_no,
    f.block
FROM parking p
LEFT JOIN residents r ON p.resident_id = r.resident_id
LEFT JOIN flats f ON r.flat_no = f.flat_no
ORDER BY p.slot_number`,

  `CREATE OR REPLACE VIEW v_resident_payment_summary AS
SELECT 
    r.resident_id,
    r.name,
    r.flat_no,
    r.phone,
    f.block,
    COUNT(p.payment_id) AS total_payments,
    SUM(p.amount) AS total_amount,
    SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END) AS paid_amount,
    SUM(CASE WHEN p.status IN ('Pending', 'Overdue') THEN p.amount ELSE 0 END) AS pending_amount,
    MAX(p.due_date) AS last_due_date
FROM residents r
JOIN flats f ON r.flat_no = f.flat_no
LEFT JOIN maintenance_payments p ON r.resident_id = p.resident_id
GROUP BY r.resident_id, r.name, r.flat_no, r.phone, f.block
ORDER BY pending_amount DESC`,

  `CREATE OR REPLACE VIEW v_active_visitors AS
SELECT 
    v.visitor_id,
    v.visitor_name,
    v.purpose,
    v.entry_time,
    TIMESTAMPDIFF(HOUR, v.entry_time, NOW()) AS hours_stayed,
    v.flat_no,
    f.block
FROM visitors v
JOIN flats f ON v.flat_no = f.flat_no
WHERE v.exit_time IS NULL
ORDER BY v.entry_time DESC`,

  `CREATE OR REPLACE VIEW v_complaint_by_resident AS
SELECT 
    c.complaint_id,
    c.complaint_type,
    c.description,
    c.status,
    c.complaint_date,
    c.resident_id,
    r.name AS resident_name,
    r.flat_no,
    f.block
FROM complaints c
JOIN residents r ON c.resident_id = r.resident_id
JOIN flats f ON r.flat_no = f.flat_no
ORDER BY c.complaint_date DESC`
];

const functions = [
  `DROP FUNCTION IF EXISTS fn_get_resident_count; CREATE FUNCTION fn_get_resident_count() RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM residents; RETURN cnt; END`,

  `DROP FUNCTION IF EXISTS fn_get_flat_count; CREATE FUNCTION fn_get_flat_count(p_block VARCHAR(10)) RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM flats WHERE block = p_block; RETURN cnt; END`,

  `DROP FUNCTION IF EXISTS fn_is_flat_occupied; CREATE FUNCTION fn_is_flat_occupied(p_flat_no INT) RETURNS BOOLEAN DETERMINISTIC BEGIN DECLARE occ BOOLEAN; SELECT EXISTS(SELECT 1 FROM residents WHERE flat_no = p_flat_no) INTO occ; RETURN occ; END`,

  `DROP FUNCTION IF EXISTS fn_total_pending_amount; CREATE FUNCTION fn_total_pending_amount() RETURNS DECIMAL(10,2) DETERMINISTIC BEGIN DECLARE amt DECIMAL(10,2); SELECT COALESCE(SUM(amount), 0) INTO amt FROM maintenance_payments WHERE status IN ('Pending', 'Overdue'); RETURN amt; END`,

  `DROP FUNCTION IF EXISTS fn_active_visitors; CREATE FUNCTION fn_active_visitors() RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM visitors WHERE exit_time IS NULL; RETURN cnt; END`,

  // NEW FUNCTIONS - Phase 2
  `DROP FUNCTION IF EXISTS fn_get_complaint_count; CREATE FUNCTION fn_get_complaint_count(p_status VARCHAR(20)) RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM complaints WHERE status = p_status; RETURN cnt; END`,

  `DROP FUNCTION IF EXISTS fn_get_visitor_count_today; CREATE FUNCTION fn_get_visitor_count_today() RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM visitors WHERE DATE(entry_time) = CURDATE(); RETURN cnt; END`,

  `DROP FUNCTION IF EXISTS fn_calculate_late_fee; CREATE FUNCTION fn_calculate_late_fee(p_payment_id INT) RETURNS DECIMAL(10,2) DETERMINISTIC BEGIN DECLARE days INT; DECLARE amt DECIMAL(10,2); DECLARE late_fee DECIMAL(10,2); SELECT DATEDIFF(CURDATE(), due_date), amount INTO days, amt FROM maintenance_payments WHERE payment_id = p_payment_id; IF days > 0 THEN SET late_fee = amt * 0.01 * days; IF late_fee > amt * 0.5 THEN SET late_fee = amt * 0.5; END IF; ELSE SET late_fee = 0; END IF; RETURN late_fee; END`,

  `DROP FUNCTION IF EXISTS fn_get_payment_count_by_status; CREATE FUNCTION fn_get_payment_count_by_status(p_status VARCHAR(20)) RETURNS INT DETERMINISTIC BEGIN DECLARE cnt INT; SELECT COUNT(*) INTO cnt FROM maintenance_payments WHERE status = p_status; RETURN cnt; END`,

  `DROP FUNCTION IF EXISTS fn_get_total_revenue; CREATE FUNCTION fn_get_total_revenue() RETURNS DECIMAL(12,2) DETERMINISTIC BEGIN DECLARE amt DECIMAL(12,2); SELECT COALESCE(SUM(amount), 0) INTO amt FROM maintenance_payments WHERE status = 'Paid'; RETURN amt; END`
];

const procedures = [
  // Existing procedures (partial)
  
  // FLAT CRUD - Phase 3
  `DROP PROCEDURE IF EXISTS add_flat_safe; CREATE PROCEDURE add_flat_safe(IN p_flat_no INT, IN p_block VARCHAR(10), IN p_floor INT, IN p_type VARCHAR(20)) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF p_flat_no IS NULL OR p_block IS NULL OR p_floor IS NULL OR p_type IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'All fields required'; END IF; INSERT INTO flats (flat_no, block, floor, type) VALUES (p_flat_no, p_block, p_floor, p_type); END`,

  `DROP PROCEDURE IF EXISTS update_flat_safe; CREATE PROCEDURE update_flat_safe(IN p_flat_no INT, IN p_block VARCHAR(10), IN p_floor INT, IN p_type VARCHAR(20)) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat not found'; END IF; UPDATE flats SET block = p_block, floor = p_floor, type = p_type WHERE flat_no = p_flat_no; END`,

  `DROP PROCEDURE IF EXISTS delete_flat_safe; CREATE PROCEDURE delete_flat_safe(IN p_flat_no INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF EXISTS (SELECT 1 FROM residents WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete flat with residents'; END IF; DELETE FROM flats WHERE flat_no = p_flat_no; END`,

  // RESIDENT CRUD
  `DROP PROCEDURE IF EXISTS update_resident_safe; CREATE PROCEDURE update_resident_safe(IN p_resident_id INT, IN p_name VARCHAR(100), IN p_phone VARCHAR(20), IN p_email VARCHAR(100), IN p_flat_no INT, IN p_move_in_date DATE) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF; IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat not found'; END IF; UPDATE residents SET name = p_name, phone = p_phone, email = p_email, flat_no = p_flat_no, move_in_date = p_move_in_date WHERE resident_id = p_resident_id; END`,

  `DROP PROCEDURE IF EXISTS delete_resident_safe; CREATE PROCEDURE delete_resident_safe(IN p_resident_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF EXISTS (SELECT 1 FROM maintenance_payments WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete resident with payments'; END IF; DELETE FROM residents WHERE resident_id = p_resident_id; END`,

  // PAYMENT CRUD
  `DROP PROCEDURE IF EXISTS update_payment_safe; CREATE PROCEDURE update_payment_safe(IN p_payment_id INT, IN p_amount DECIMAL(10,2), IN p_payment_date DATE, IN p_due_date DATE, IN p_status VARCHAR(20), IN p_resident_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM maintenance_payments WHERE payment_id = p_payment_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment not found'; END IF; IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF; UPDATE maintenance_payments SET amount = p_amount, payment_date = p_payment_date, due_date = p_due_date, status = p_status, resident_id = p_resident_id WHERE payment_id = p_payment_id; END`,

  `DROP PROCEDURE IF EXISTS delete_payment_safe; CREATE PROCEDURE delete_payment_safe(IN p_payment_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; DELETE FROM maintenance_payments WHERE payment_id = p_payment_id; END`,

  // COMPLAINT CRUD
  `DROP PROCEDURE IF EXISTS add_complaint_safe; CREATE PROCEDURE add_complaint_safe(IN p_complaint_type VARCHAR(50), IN p_description TEXT, IN p_status VARCHAR(20), IN p_complaint_date DATE, IN p_resident_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF; INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (p_complaint_type, p_description, p_status, p_complaint_date, p_resident_id); END`,

  `DROP PROCEDURE IF EXISTS update_complaint_safe; CREATE PROCEDURE update_complaint_safe(IN p_complaint_id INT, IN p_complaint_type VARCHAR(50), IN p_description TEXT, IN p_status VARCHAR(20), IN p_complaint_date DATE, IN p_resident_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM complaints WHERE complaint_id = p_complaint_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Complaint not found'; END IF; UPDATE complaints SET complaint_type = p_complaint_type, description = p_description, status = p_status, complaint_date = p_complaint_date, resident_id = p_resident_id WHERE complaint_id = p_complaint_id; END`,

  `DROP PROCEDURE IF EXISTS delete_complaint_safe; CREATE PROCEDURE delete_complaint_safe(IN p_complaint_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; DELETE FROM complaints WHERE complaint_id = p_complaint_id; END`,

  // VISITOR CRUD
  `DROP PROCEDURE IF EXISTS update_visitor_safe; CREATE PROCEDURE update_visitor_safe(IN p_visitor_id INT, IN p_visitor_name VARCHAR(100), IN p_entry_time DATETIME, IN p_exit_time DATETIME, IN p_purpose VARCHAR(255), IN p_flat_no INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM visitors WHERE visitor_id = p_visitor_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Visitor not found'; END IF; UPDATE visitors SET visitor_name = p_visitor_name, entry_time = p_entry_time, exit_time = p_exit_time, purpose = p_purpose, flat_no = p_flat_no WHERE visitor_id = p_visitor_id; END`,

  `DROP PROCEDURE IF EXISTS delete_visitor_safe; CREATE PROCEDURE delete_visitor_safe(IN p_visitor_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; DELETE FROM visitors WHERE visitor_id = p_visitor_id; END`,

  // PARKING CRUD
  `DROP PROCEDURE IF EXISTS update_parking_safe; CREATE PROCEDURE update_parking_safe(IN p_parking_id INT, IN p_slot_number VARCHAR(20), IN p_vehicle_number VARCHAR(20), IN p_vehicle_type VARCHAR(20), IN p_resident_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; IF NOT EXISTS (SELECT 1 FROM parking WHERE parking_id = p_parking_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Parking not found'; END IF; IF p_resident_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident not found'; END IF; UPDATE parking SET slot_number = p_slot_number, vehicle_number = p_vehicle_number, vehicle_type = p_vehicle_type, resident_id = p_resident_id WHERE parking_id = p_parking_id; END`,

  `DROP PROCEDURE IF EXISTS delete_parking_safe; CREATE PROCEDURE delete_parking_safe(IN p_parking_id INT) BEGIN DECLARE EXIT HANDLER FOR SQLEXCEPTION RESIGNAL; DELETE FROM parking WHERE parking_id = p_parking_id; END`
];

// Triggers - Phase 4
const triggers = [
  // Audit log table and trigger
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50),
    action VARCHAR(10),
    record_id INT,
    old_data JSON,
    new_data JSON,
    changed_by VARCHAR(100) DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Trigger for residents
  `DROP TRIGGER IF EXISTS trg_after_resident_insert; CREATE TRIGGER trg_after_resident_insert AFTER INSERT ON residents FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('residents', 'INSERT', NEW.resident_id, JSON_OBJECT('name', NEW.name, 'phone', NEW.phone, 'flat_no', NEW.flat_no))`,

  `DROP TRIGGER IF EXISTS trg_after_resident_update; CREATE TRIGGER trg_after_resident_update AFTER UPDATE ON residents FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, old_data, new_data) VALUES ('residents', 'UPDATE', NEW.resident_id, JSON_OBJECT('name', OLD.name, 'phone', OLD.phone), JSON_OBJECT('name', NEW.name, 'phone', NEW.phone))`,

  `DROP TRIGGER IF EXISTS trg_after_resident_delete; CREATE TRIGGER trg_after_resident_delete AFTER DELETE ON residents FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, old_data) VALUES ('residents', 'DELETE', OLD.resident_id, JSON_OBJECT('name', OLD.name, 'phone', OLD.phone))`,

  // Auto-update overdue payments
  `DROP TRIGGER IF EXISTS trg_check_overdue_payment; CREATE TRIGGER trg_check_overdue_payment BEFORE UPDATE ON maintenance_payments FOR EACH ROW BEGIN IF NEW.due_date < CURDATE() AND NEW.status = 'Pending' THEN SET NEW.status = 'Overdue'; END IF; END`,

  // Trigger for complaints
  `DROP TRIGGER IF EXISTS trg_after_complaint_insert; CREATE TRIGGER trg_after_complaint_insert AFTER INSERT ON complaints FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('complaints', 'INSERT', NEW.complaint_id, JSON_OBJECT('complaint_type', NEW.complaint_type, 'status', NEW.status))`,

  `DROP TRIGGER IF EXISTS trg_after_complaint_update; CREATE TRIGGER trg_after_complaint_update AFTER UPDATE ON complaints FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, old_data, new_data) VALUES ('complaints', 'UPDATE', NEW.complaint_id, JSON_OBJECT('status', OLD.status), JSON_OBJECT('status', NEW.status))`,

  // Trigger for visitors
  `DROP TRIGGER IF EXISTS trg_after_visitor_insert; CREATE TRIGGER trg_after_visitor_insert AFTER INSERT ON visitors FOR EACH ROW INSERT INTO audit_log (table_name, action, record_id, new_data) VALUES ('visitors', 'INSERT', NEW.visitor_id, JSON_OBJECT('visitor_name', NEW.visitor_name, 'flat_no', NEW.flat_no))`
];

async function setupAll() {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "root",
    database: "smart_society"
  });

  try {
    console.log("📝 Phase 1: Creating Views...");
    for (const sql of views) {
      try {
        await connection.query(sql);
        console.log("  ✅ View created");
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.split('\n')[0]}`);
      }
    }

    console.log("\n📝 Phase 2: Creating Functions...");
    for (const sql of functions) {
      try {
        await connection.query(sql);
        console.log("  ✅ Function created");
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.split('\n')[0]}`);
      }
    }

    console.log("\n📝 Phase 3: Creating Stored Procedures...");
    for (const sql of procedures) {
      try {
        await connection.query(sql);
        console.log("  ✅ Procedure created");
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.split('\n')[0]}`);
      }
    }

    console.log("\n📝 Phase 4: Creating Triggers...");
    for (const sql of triggers) {
      try {
        await connection.query(sql);
        console.log("  ✅ Trigger created");
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.split('\n')[0]}`);
      }
    }

    console.log("\n📋 Verifying all created...");
    
    const [viewsList] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    console.log("\nViews:", viewsList.length);
    
    const [funcsList] = await connection.query("SHOW FUNCTION STATUS WHERE Db = 'smart_society'");
    console.log("Functions:", funcsList.length);
    
    const [procsList] = await connection.query("SHOW PROCEDURE STATUS WHERE Db = 'smart_society'");
    console.log("Stored Procedures:", procsList.length);
    
    const [trigs] = await connection.query("SHOW TRIGERS WHERE Db = 'smart_society'");
    console.log("Triggers:", trigs.length);

    console.log("\n✅ Migration Complete!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.end();
  }
}

setupAll();