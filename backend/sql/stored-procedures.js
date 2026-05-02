const mysql = require('mysql2/promise');

const procedures = `
-- 1. Add Resident with Validation
CREATE PROCEDURE add_resident_safe(
    IN p_name VARCHAR(100),
    IN p_phone VARCHAR(20),
    IN p_email VARCHAR(100),
    IN p_flat_no INT,
    IN p_move_in_date DATE
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat does not exist';
    END IF;

    INSERT INTO residents (name, phone, email, flat_no, move_in_date)
    VALUES (p_name, p_phone, p_email, p_flat_no, p_move_in_date);
END

-- 2. Add Payment with Validation
CREATE PROCEDURE add_payment_safe(
    IN p_amount DECIMAL(10,2),
    IN p_payment_date DATE,
    IN p_due_date DATE,
    IN p_status VARCHAR(20),
    IN p_resident_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident does not exist';
    END IF;

    IF p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be positive';
    END IF;

    INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id)
    VALUES (p_amount, p_payment_date, p_due_date, p_status, p_resident_id);
END

-- 3. Get Block Occupancy Stats
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
END

-- 4. Get Monthly Collections Report
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
END

-- 5. Get Overdue Residents
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
END

-- 6. Add Visitor with Validation
CREATE PROCEDURE add_visitor_safe(
    IN p_visitor_name VARCHAR(100),
    IN p_entry_time DATETIME,
    IN p_purpose VARCHAR(255),
    IN p_flat_no INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Flat does not exist';
    END IF;

    INSERT INTO visitors (visitor_name, entry_time, purpose, flat_no)
    VALUES (p_visitor_name, p_entry_time, p_purpose, p_flat_no);
END

-- 7. Check Out Visitor
CREATE PROCEDURE check_out_visitor(IN p_visitor_id INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM visitors WHERE visitor_id = p_visitor_id AND exit_time IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Visitor not found or already checked out';
    END IF;

    UPDATE visitors SET exit_time = NOW() WHERE visitor_id = p_visitor_id;
END

-- 8. Add Parking with Validation
CREATE PROCEDURE add_parking_safe(
    IN p_slot_number VARCHAR(20),
    IN p_vehicle_number VARCHAR(20),
    IN p_vehicle_type VARCHAR(20),
    IN p_resident_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF EXISTS (SELECT 1 FROM parking WHERE slot_number = p_slot_number) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot number already exists';
    END IF;

    IF p_resident_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident does not exist';
    END IF;

    INSERT INTO parking (slot_number, vehicle_number, vehicle_type, resident_id)
    VALUES (p_slot_number, p_vehicle_number, p_vehicle_type, p_resident_id);
END

-- 9. Get Dashboard Stats
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
END

-- 10. Transfer Resident
CREATE PROCEDURE transfer_resident(IN p_resident_id INT, IN p_new_flat_no INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        RESIGNAL;
    END;

    IF NOT EXISTS (SELECT 1 FROM residents WHERE resident_id = p_resident_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resident does not exist';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM flats WHERE flat_no = p_new_flat_no) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'New flat does not exist';
    END IF;

    UPDATE residents SET flat_no = p_new_flat_no WHERE resident_id = p_resident_id;
END
`;

async function setupStoredProcedures() {
  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "root",
    database: "smart_society"
  });

  try {
    console.log("📝 Creating stored procedures...");
    
    // Split by procedure definition and create each one
    const procList = procedures.split(/CREATE PROCEDURE /).filter(Boolean);
    
    for (const proc of procList) {
      const match = proc.match(/^(\w+)/);
      if (match) {
        const name = match[1];
        const fullProc = 'CREATE PROCEDURE ' + proc;
        try {
          await connection.query('DROP PROCEDURE IF EXISTS ' + name);
          await connection.query(fullProc);
          console.log(`  ✅ Created: ${name}`);
        } catch (e) {
          console.log(`  ❌ Failed: ${name} - ${e.message}`);
        }
      }
    }
    
    console.log("\n📋 Verifying procedures:");
    const [rows] = await connection.query(
      "SHOW PROCEDURE STATUS WHERE Db = 'smart_society'"
    );
    rows.forEach(p => console.log(`  - ${p.name}`));
    
    console.log("\n✅ Setup complete!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.end();
  }
}

setupStoredProcedures();