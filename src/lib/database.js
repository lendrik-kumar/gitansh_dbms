import initSqlJs from 'sql.js'

const STORAGE_KEY = 'smart-society-db-v1'

let SQL
let db

function toBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function persist() {
  const bytes = db.export()
  localStorage.setItem(STORAGE_KEY, toBase64(bytes))
}

function query(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

function run(sql, params = []) {
  db.run(sql, params)
  persist()
}

function mutate(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.run(params)
  stmt.free()
  const result = query('SELECT changes() AS changes, last_insert_rowid() AS last_id')[0]
  persist()
  return result
}

function seed() {
  db.run(`
    INSERT INTO flats (flat_no, block, floor, type) VALUES
    (101, 'A', 1, '2BHK'), (102, 'A', 1, '2BHK'), (201, 'A', 2, '3BHK'),
    (202, 'A', 2, '3BHK'), (301, 'B', 3, '1BHK'), (302, 'B', 3, '2BHK'),
    (401, 'C', 4, '2BHK'), (402, 'C', 4, '3BHK'), (501, 'D', 5, '2BHK'),
    (502, 'D', 5, 'Penthouse');

    INSERT INTO residents (name, phone, email, flat_no, move_in_date) VALUES
    ('Aarav Sharma', '9876543210', 'aarav@example.com', 101, '2024-01-15'),
    ('Neha Verma', '9876543211', 'neha@example.com', 102, '2024-02-01'),
    ('Rohan Gupta', '9876543212', 'rohan@example.com', 201, '2023-11-03'),
    ('Meera Nair', '9876543213', 'meera@example.com', 301, '2024-03-10'),
    ('Kabir Singh', '9876543214', 'kabir@example.com', 402, '2024-01-22');

    INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id) VALUES
    (3500, '2026-01-03', '2026-01-05', 'Paid', 1),
    (3500, '2026-02-04', '2026-02-05', 'Paid', 1),
    (3500, NULL, '2026-03-05', 'Pending', 1),
    (3600, '2026-01-06', '2026-01-05', 'Paid', 2),
    (3600, NULL, '2026-02-05', 'Overdue', 2),
    (4300, '2026-01-02', '2026-01-05', 'Paid', 3),
    (4300, '2026-02-01', '2026-02-05', 'Paid', 3),
    (4300, NULL, '2026-03-05', 'Pending', 3),
    (2800, '2026-01-07', '2026-01-05', 'Paid', 4),
    (2800, NULL, '2026-02-05', 'Overdue', 4),
    (4500, '2026-01-03', '2026-01-05', 'Paid', 5);

    INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES
    ('Water', 'Low pressure in kitchen tap', 'Open', '2026-03-03', 1),
    ('Lift', 'Lift making unusual sound', 'In Progress', '2026-03-01', 2),
    ('Security', 'Main gate camera offline', 'Resolved', '2026-02-20', 3),
    ('Cleaning', 'Floor lobby not cleaned', 'Closed', '2026-02-10', 4);

    INSERT INTO visitors (visitor_name, entry_time, exit_time, purpose, flat_no) VALUES
    ('Raj Malhotra', '2026-03-18T10:05:00', '2026-03-18T11:20:00', 'Personal', 101),
    ('Courier Agent', '2026-03-18T12:10:00', '2026-03-18T12:18:00', 'Delivery', 201),
    ('Electrician', '2026-03-18T14:00:00', NULL, 'Maintenance', 301);

    INSERT INTO parking (slot_number, vehicle_number, vehicle_type, resident_id) VALUES
    ('A-01', 'DL01AB1234', 'Car', 1),
    ('A-02', 'DL03CD7777', 'Car', 2),
    ('B-05', 'DL06EF6767', 'Bike', 4),
    ('C-09', 'DL08GH9090', 'Car', 5);
  `)
}

function createSchema() {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS flats (
      flat_no INTEGER PRIMARY KEY,
      block TEXT NOT NULL,
      floor INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('1BHK', '2BHK', '3BHK', 'Penthouse'))
    );

    CREATE TABLE IF NOT EXISTS residents (
      resident_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      flat_no INTEGER NOT NULL,
      move_in_date TEXT,
      FOREIGN KEY (flat_no) REFERENCES flats(flat_no)
    );

    CREATE TABLE IF NOT EXISTS maintenance_payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL CHECK(amount >= 0),
      payment_date TEXT,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Overdue')),
      resident_id INTEGER NOT NULL,
      FOREIGN KEY (resident_id) REFERENCES residents(resident_id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
      complaint_date TEXT NOT NULL,
      resident_id INTEGER NOT NULL,
      FOREIGN KEY (resident_id) REFERENCES residents(resident_id)
    );

    CREATE TABLE IF NOT EXISTS visitors (
      visitor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      purpose TEXT,
      flat_no INTEGER NOT NULL,
      FOREIGN KEY (flat_no) REFERENCES flats(flat_no)
    );

    CREATE TABLE IF NOT EXISTS parking (
      parking_id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_number TEXT UNIQUE NOT NULL,
      vehicle_number TEXT,
      vehicle_type TEXT CHECK(vehicle_type IN ('Car', 'Bike', 'Cycle')),
      resident_id INTEGER,
      FOREIGN KEY (resident_id) REFERENCES residents(resident_id)
    );

    CREATE INDEX IF NOT EXISTS idx_resident_flat ON residents(flat_no);
    CREATE INDEX IF NOT EXISTS idx_payment_resident ON maintenance_payments(resident_id);
    CREATE INDEX IF NOT EXISTS idx_payment_status ON maintenance_payments(status);
    CREATE INDEX IF NOT EXISTS idx_complaint_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_visitor_flat ON visitors(flat_no);
  `)
}

async function init() {
  if (db) return
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    })
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database()
  createSchema()
  const hasFlats = query('SELECT COUNT(*) AS total FROM flats')[0]?.total ?? 0
  if (hasFlats === 0) {
    seed()
    persist()
  }
}

export const database = {
  async initialize() {
    await init()
  },
  async reset() {
    localStorage.removeItem(STORAGE_KEY)
    db = null
    await init()
  },
  async getFlats() {
    return query('SELECT * FROM flats ORDER BY flat_no')
  },
  async getResidents() {
    return query(`
      SELECT r.*, f.block, f.floor
      FROM residents r
      JOIN flats f ON f.flat_no = r.flat_no
      ORDER BY r.resident_id DESC
    `)
  },
  async getPayments() {
    return query(`
      SELECT p.*, r.name AS resident_name, r.flat_no
      FROM maintenance_payments p
      JOIN residents r ON r.resident_id = p.resident_id
      ORDER BY p.due_date DESC
    `)
  },
  async getComplaints() {
    return query(`
      SELECT c.*, r.name AS resident_name, r.flat_no
      FROM complaints c
      JOIN residents r ON r.resident_id = c.resident_id
      ORDER BY c.complaint_date DESC
    `)
  },
  async getVisitors() {
    return query('SELECT * FROM visitors ORDER BY entry_time DESC')
  },
  async getParking() {
    return query(`
      SELECT p.*, r.name AS resident_name, r.flat_no
      FROM parking p
      LEFT JOIN residents r ON r.resident_id = p.resident_id
      ORDER BY p.slot_number
    `)
  },
  async addFlat(payload) {
    run('INSERT INTO flats (flat_no, block, floor, type) VALUES (?, ?, ?, ?)', [
      Number(payload.flat_no),
      payload.block,
      Number(payload.floor),
      payload.type,
    ])
  },
  async updateFlat(flatNo, payload) {
    mutate('UPDATE flats SET block = ?, floor = ?, type = ? WHERE flat_no = ?', [
      payload.block,
      Number(payload.floor),
      payload.type,
      Number(flatNo),
    ])
  },
  async deleteFlat(flatNo) {
    return mutate('DELETE FROM flats WHERE flat_no = ?', [Number(flatNo)])
  },
  async addResident(payload) {
    run('INSERT INTO residents (name, phone, email, flat_no, move_in_date) VALUES (?, ?, ?, ?, ?)', [
      payload.name,
      payload.phone,
      payload.email || null,
      Number(payload.flat_no),
      payload.move_in_date || null,
    ])
  },
  async updateResident(residentId, payload) {
    mutate('UPDATE residents SET name = ?, phone = ?, email = ?, flat_no = ?, move_in_date = ? WHERE resident_id = ?', [
      payload.name,
      payload.phone,
      payload.email || null,
      Number(payload.flat_no),
      payload.move_in_date || null,
      Number(residentId),
    ])
  },
  async deleteResident(residentId) {
    return mutate('DELETE FROM residents WHERE resident_id = ?', [Number(residentId)])
  },
  async addPayment(payload) {
    run(
      'INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id) VALUES (?, ?, ?, ?, ?)',
      [
        Number(payload.amount),
        payload.payment_date || null,
        payload.due_date,
        payload.status,
        Number(payload.resident_id),
      ],
    )
  },
  async updatePayment(paymentId, payload) {
    mutate(
      'UPDATE maintenance_payments SET amount = ?, payment_date = ?, due_date = ?, status = ?, resident_id = ? WHERE payment_id = ?',
      [
        Number(payload.amount),
        payload.payment_date || null,
        payload.due_date,
        payload.status,
        Number(payload.resident_id),
        Number(paymentId),
      ],
    )
  },
  async deletePayment(paymentId) {
    return mutate('DELETE FROM maintenance_payments WHERE payment_id = ?', [Number(paymentId)])
  },
  async addComplaint(payload) {
    run(
      'INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (?, ?, ?, ?, ?)',
      [
        payload.complaint_type,
        payload.description,
        payload.status,
        payload.complaint_date,
        Number(payload.resident_id),
      ],
    )
  },
  async updateComplaint(complaintId, payload) {
    mutate(
      'UPDATE complaints SET complaint_type = ?, description = ?, status = ?, complaint_date = ?, resident_id = ? WHERE complaint_id = ?',
      [
        payload.complaint_type,
        payload.description,
        payload.status,
        payload.complaint_date,
        Number(payload.resident_id),
        Number(complaintId),
      ],
    )
  },
  async deleteComplaint(complaintId) {
    return mutate('DELETE FROM complaints WHERE complaint_id = ?', [Number(complaintId)])
  },
  async addVisitor(payload) {
    run('INSERT INTO visitors (visitor_name, entry_time, purpose, flat_no) VALUES (?, ?, ?, ?)', [
      payload.visitor_name,
      payload.entry_time,
      payload.purpose,
      Number(payload.flat_no),
    ])
  },
  async updateVisitor(visitorId, payload) {
    mutate('UPDATE visitors SET visitor_name = ?, entry_time = ?, exit_time = ?, purpose = ?, flat_no = ? WHERE visitor_id = ?', [
      payload.visitor_name,
      payload.entry_time,
      payload.exit_time || null,
      payload.purpose,
      Number(payload.flat_no),
      Number(visitorId),
    ])
  },
  async deleteVisitor(visitorId) {
    return mutate('DELETE FROM visitors WHERE visitor_id = ?', [Number(visitorId)])
  },
  async checkOutVisitor(visitorId) {
    run('UPDATE visitors SET exit_time = ? WHERE visitor_id = ?', [new Date().toISOString(), visitorId])
  },
  async addParking(payload) {
    run('INSERT INTO parking (slot_number, vehicle_number, vehicle_type, resident_id) VALUES (?, ?, ?, ?)', [
      payload.slot_number,
      payload.vehicle_number,
      payload.vehicle_type,
      payload.resident_id ? Number(payload.resident_id) : null,
    ])
  },
  async updateParking(parkingId, payload) {
    mutate('UPDATE parking SET slot_number = ?, vehicle_number = ?, vehicle_type = ?, resident_id = ? WHERE parking_id = ?', [
      payload.slot_number,
      payload.vehicle_number,
      payload.vehicle_type,
      payload.resident_id ? Number(payload.resident_id) : null,
      Number(parkingId),
    ])
  },
  async deleteParking(parkingId) {
    return mutate('DELETE FROM parking WHERE parking_id = ?', [Number(parkingId)])
  },
  async getDashboardStats() {
    const totals = query(`
      SELECT
        (SELECT COUNT(*) FROM flats) AS flats,
        (SELECT COUNT(*) FROM residents) AS residents,
        (SELECT COUNT(*) FROM maintenance_payments WHERE status = 'Overdue') AS overdue_payments,
        (SELECT COUNT(*) FROM complaints WHERE status IN ('Open', 'In Progress')) AS active_complaints,
        (SELECT COUNT(*) FROM visitors WHERE exit_time IS NULL) AS active_visitors
    `)[0]
    return totals
  },
  async getCollectionsByMonth() {
    return query(`
      SELECT strftime('%Y-%m', due_date) AS month,
             COUNT(*) AS total_invoices,
             SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS paid_amount,
             SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN amount ELSE 0 END) AS pending_amount
      FROM maintenance_payments
      GROUP BY strftime('%Y-%m', due_date)
      ORDER BY month DESC
    `)
  },
  async getOccupancyByBlock() {
    return query(`
      SELECT f.block,
             COUNT(DISTINCT f.flat_no) AS total_flats,
             COUNT(DISTINCT r.flat_no) AS occupied_flats,
             ROUND((COUNT(DISTINCT r.flat_no) * 100.0) / COUNT(DISTINCT f.flat_no), 1) AS occupancy_percent
      FROM flats f
      LEFT JOIN residents r ON r.flat_no = f.flat_no
      GROUP BY f.block
      ORDER BY f.block
    `)
  },
  async getOverdueResidents() {
    return query(`
      SELECT r.resident_id, r.name, r.flat_no, COUNT(p.payment_id) AS overdue_count,
             SUM(p.amount) AS overdue_amount
      FROM residents r
      JOIN maintenance_payments p ON p.resident_id = r.resident_id
      WHERE p.status = 'Overdue'
      GROUP BY r.resident_id, r.name, r.flat_no
      ORDER BY overdue_amount DESC
    `)
  },
  async runTransactionDemo(payload) {
    db.run('BEGIN TRANSACTION')
    try {
      db.run(
        'INSERT INTO maintenance_payments (amount, payment_date, due_date, status, resident_id) VALUES (?, ?, ?, ?, ?)',
        [payload.amount, payload.payment_date, payload.due_date, payload.status, payload.resident_id],
      )

      if (payload.force_error) {
        db.run('INSERT INTO complaints (complaint_type, description, status, complaint_date, resident_id) VALUES (?, ?, ?, ?, ?)', [
          'Transaction Test',
          'This will fail intentionally',
          'Open',
          payload.payment_date,
          99999,
        ])
      }

      db.run('COMMIT')
      persist()
      return { ok: true }
    } catch (error) {
      db.run('ROLLBACK')
      return { ok: false, error: error.message }
    }
  },
  async executeSql(rawSql) {
    const text = rawSql.trim()
    if (!text) {
      return { ok: false, error: 'SQL query cannot be empty.' }
    }

    const lowered = text.toLowerCase()
    const blocked = ['drop ', 'alter table', 'attach ', 'detach ', 'pragma writable_schema', 'vacuum into']
    if (blocked.some((word) => lowered.includes(word))) {
      return { ok: false, error: 'This SQL operation is blocked in demo mode.' }
    }

    try {
      if (lowered.startsWith('select') || lowered.startsWith('with') || lowered.startsWith('pragma')) {
        const rows = query(text)
        const columns = rows.length ? Object.keys(rows[0]) : []
        return { ok: true, kind: 'query', columns, rows, count: rows.length }
      }
      db.run('BEGIN TRANSACTION')
      db.run(text)
      db.run('COMMIT')
      const change = query('SELECT changes() AS changes')[0]
      persist()
      return { ok: true, kind: 'mutation', changes: change?.changes ?? 0 }
    } catch (error) {
      try {
        db.run('ROLLBACK')
      } catch {
      }
      return { ok: false, error: error.message }
    }
  },
}
