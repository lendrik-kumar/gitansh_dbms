const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "root",
  database: "smart_society",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

// ==================== FLATS ====================
app.get("/api/flats", async (req, res) => {
  try {
    const flats = await query("SELECT * FROM flats ORDER BY flat_no");
    res.json(flats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/flats", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { flat_no, block, floor, type } = req.body;
    if (!flat_no || !block || floor === undefined || !type) {
      return res.status(400).json({ error: "Missing required fields: flat_no, block, floor, type" });
    }
    await run(
      "INSERT INTO flats (flat_no, block, floor, type) VALUES (?, ?, ?, ?)",
      [flat_no, block, floor, type]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/flats/:flatNo", async (req, res) => {
  try {
    const { flatNo } = req.params;
    const { block, floor, type } = req.body;
    await run("UPDATE flats SET block = ?, floor = ?, type = ? WHERE flat_no = ?", [
      block,
      floor,
      type,
      flatNo,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/flats/:flatNo", async (req, res) => {
  try {
    const { flatNo } = req.params;
    await run("DELETE FROM flats WHERE flat_no = ?", [flatNo]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== RESIDENTS ====================
app.get("/api/residents", async (req, res) => {
  try {
    const residents = await query(`
      SELECT r.*, f.block, f.floor
      FROM residents r
      JOIN flats f ON f.flat_no = r.flat_no
      ORDER BY r.resident_id DESC
    `);
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/residents", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { name, phone, email, flat_no, move_in_date } = req.body;
    if (!name || !phone || !flat_no) {
      return res.status(400).json({ error: "Missing required fields: name, phone, flat_no" });
    }
    await run(
      "INSERT INTO residents (name, phone, email, flat_no, move_in_date) VALUES (?, ?, ?, ?, ?)",
      [name, phone, email || null, flat_no, move_in_date || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/residents/:residentId", async (req, res) => {
  try {
    const { residentId } = req.params;
    const { name, phone, email, flat_no, move_in_date } = req.body;
    await run(
      "UPDATE residents SET name = ?, phone = ?, email = ?, flat_no = ?, move_in_date = ? WHERE resident_id = ?",
      [name, phone, email || null, flat_no, move_in_date || null, residentId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/residents/:residentId", async (req, res) => {
  try {
    const { residentId } = req.params;
    await run("DELETE FROM residents WHERE resident_id = ?", [residentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PAYMENTS ====================
app.get("/api/payments", async (req, res) => {
  try {
    const payments = await query(`
      SELECT p.*, r.name AS resident_name, r.flat_no
      FROM maintenance_payments p
      JOIN residents r ON r.resident_id = p.resident_id
      ORDER BY p.due_date DESC
    `);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { amount, payment_date, due_date, status, resident_id } = req.body;
    if (!amount || !due_date || !status || !resident_id) {
      return res.status(400).json({ error: "Missing required fields: amount, due_date, status, resident_id" });
    }
    await run(
      "INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id) VALUES (?, ?, ?, ?, ?)",
      [amount, payment_date || null, due_date, status, resident_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/payments/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, payment_date, due_date, status, resident_id } = req.body;
    await run(
      "UPDATE maintenance_payments SET amount = ?, payment_date = ?, due_date = ?, status = ?, resident_id = ? WHERE payment_id = ?",
      [amount, payment_date || null, due_date, status, resident_id, paymentId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/payments/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    await run("DELETE FROM maintenance_payments WHERE payment_id = ?", [paymentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== COMPLAINTS ====================
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await query(`
      SELECT c.*, r.name AS resident_name, r.flat_no
      FROM complaints c
      JOIN residents r ON r.resident_id = c.resident_id
      ORDER BY c.complaint_date DESC
    `);
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complaints", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { complaint_type, description, status, complaint_date, resident_id } = req.body;
    if (!complaint_type || !description || !status || !complaint_date || !resident_id) {
      return res.status(400).json({ error: "Missing required fields: complaint_type, description, status, complaint_date, resident_id" });
    }
    await run(
      "INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (?, ?, ?, ?, ?)",
      [complaint_type, description, status, complaint_date, resident_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/complaints/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { complaint_type, description, status, complaint_date, resident_id } = req.body;
    await run(
      "UPDATE complaints SET complaint_type = ?, description = ?, status = ?, complaint_date = ?, resident_id = ? WHERE complaint_id = ?",
      [complaint_type, description, status, complaint_date, resident_id, complaintId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/complaints/:complaintId", async (req, res) => {
  try {
    const { complaintId } = req.params;
    await run("DELETE FROM complaints WHERE complaint_id = ?", [complaintId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== VISITORS ====================
app.get("/api/visitors", async (req, res) => {
  try {
    const visitors = await query("SELECT * FROM visitors ORDER BY entry_time DESC");
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/visitors", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { visitor_name, entry_time, purpose, flat_no } = req.body;
    if (!visitor_name || !entry_time || !purpose || !flat_no) {
      return res.status(400).json({ error: "Missing required fields: visitor_name, entry_time, purpose, flat_no" });
    }
    await run(
      "INSERT INTO visitors (visitor_name, entry_time, purpose, flat_no) VALUES (?, ?, ?, ?)",
      [visitor_name, entry_time, purpose, flat_no]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/visitors/:visitorId", async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { visitor_name, entry_time, exit_time, purpose, flat_no } = req.body;
    await run(
      "UPDATE visitors SET visitor_name = ?, entry_time = ?, exit_time = ?, purpose = ?, flat_no = ? WHERE visitor_id = ?",
      [visitor_name, entry_time, exit_time || null, purpose, flat_no, visitorId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/visitors/:visitorId", async (req, res) => {
  try {
    const { visitorId } = req.params;
    await run("DELETE FROM visitors WHERE visitor_id = ?", [visitorId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/visitors/:visitorId/checkout", async (req, res) => {
  try {
    const { visitorId } = req.params;
    await run("UPDATE visitors SET exit_time = NOW() WHERE visitor_id = ?", [visitorId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PARKING ====================
app.get("/api/parking", async (req, res) => {
  try {
    const parking = await query(`
      SELECT p.*, r.name AS resident_name, r.flat_no
      FROM parking p
      LEFT JOIN residents r ON r.resident_id = p.resident_id
      ORDER BY p.slot_number
    `);
    res.json(parking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/parking", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }
    const { slot_number, vehicle_number, vehicle_type, resident_id } = req.body;
    if (!slot_number || !vehicle_number || !vehicle_type) {
      return res.status(400).json({ error: "Missing required fields: slot_number, vehicle_number, vehicle_type" });
    }
    await run(
      "INSERT INTO parking (slot_number, vehicle_number, vehicle_type, resident_id) VALUES (?, ?, ?, ?)",
      [slot_number, vehicle_number, vehicle_type, resident_id || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/parking/:parkingId", async (req, res) => {
  try {
    const { parkingId } = req.params;
    const { slot_number, vehicle_number, vehicle_type, resident_id } = req.body;
    await run(
      "UPDATE parking SET slot_number = ?, vehicle_number = ?, vehicle_type = ?, resident_id = ? WHERE parking_id = ?",
      [slot_number, vehicle_number, vehicle_type, resident_id || null, parkingId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/parking/:parkingId", async (req, res) => {
  try {
    const { parkingId } = req.params;
    await run("DELETE FROM parking WHERE parking_id = ?", [parkingId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ANALYTICS (Using PL/SQL Views & Functions) ====================
app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const stats = await query(`SELECT * FROM v_dashboard_stats`);
    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/collections-by-month", async (req, res) => {
  try {
    const collections = await query(`SELECT * FROM v_monthly_collections`);
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/occupancy-by-block", async (req, res) => {
  try {
    const occupancy = await query(`SELECT * FROM v_block_occupancy`);
    res.json(occupancy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/overdue-residents", async (req, res) => {
  try {
    const overdue = await query(`SELECT * FROM v_overdue_residents`);
    res.json(overdue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/collections-by-month", async (req, res) => {
  try {
    const collections = await query(`
      SELECT DATE_FORMAT(due_date, '%Y-%m') AS month,
             COUNT(*) AS total_invoices,
             SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
             SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
      FROM maintenance_payments
      GROUP BY DATE_FORMAT(due_date, '%Y-%m')
      ORDER BY month DESC
    `);
    res.json(collections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/occupancy-by-block", async (req, res) => {
  try {
    const occupancy = await query(`
      SELECT f.block,
             COUNT(DISTINCT f.flat_no) AS total_flats,
             COUNT(DISTINCT r.flat_no) AS occupied_flats,
             ROUND((COUNT(DISTINCT r.flat_no) * 100.0) / COUNT(DISTINCT f.flat_no), 1) AS occupancy_percent
      FROM flats f
      LEFT JOIN residents r ON r.flat_no = f.flat_no
      GROUP BY f.block
      ORDER BY f.block
    `);
    res.json(occupancy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/overdue-residents", async (req, res) => {
  try {
    const overdue = await query(`
      SELECT r.resident_id, r.name, r.flat_no, COUNT(p.payment_id) AS overdue_count,
             SUM(p.amount) AS overdue_amount
      FROM residents r
      JOIN maintenance_payments p ON p.resident_id = r.resident_id
      WHERE p.status = 'Overdue'
      GROUP BY r.resident_id, r.name, r.flat_no
      ORDER BY overdue_amount DESC
    `);
    res.json(overdue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TRANSACTION DEMO ====================
app.post("/api/transaction-demo", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { amount, due_date, resident_id, complaint_type, description, force_error } = req.body;
    await connection.beginTransaction();
    
    await connection.execute(
      "INSERT INTO maintenance_payments (amount, due_date, status, resident_id) VALUES (?, ?, 'Pending', ?)",
      [amount, due_date, resident_id]
    );
    
    if (force_error) {
      await connection.execute(
        "INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (?, ?, 'Open', CURDATE(), 99999)",
        [complaint_type, description]
      );
    } else {
      await connection.execute(
        "INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (?, ?, 'Open', CURDATE(), ?)",
        [complaint_type, description, resident_id]
      );
    }
    
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    connection.release();
  }
});

// ==================== RAW SQL EXECUTION ====================
app.post("/api/execute-sql", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || !sql.trim()) {
      return res.status(400).json({ ok: false, error: "SQL query cannot be empty." });
    }
    
    const lowered = sql.toLowerCase().trim();
    const blocked = ["drop ", "alter ", "attach ", "detach ", "pragma writable_schema", "vacuum "];
    if (blocked.some((word) => lowered.includes(word))) {
      return res.status(400).json({ ok: false, error: "This SQL operation is blocked." });
    }
    
    if (lowered.startsWith("select") || lowered.startsWith("with")) {
      const rows = await query(sql);
      const columns = rows.length ? Object.keys(rows[0]) : [];
      return res.json({ ok: true, kind: "query", columns, rows, count: rows.length });
    } else {
      const result = await run(sql);
      return res.json({ ok: true, kind: "mutation", changes: result.affectedRows });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});