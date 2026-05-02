# SQL Runner - Complete Test Guide

## Test Commands (run via curl)

```bash
# Test SELECT query
curl -s -X POST http://localhost:3001/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM flats LIMIT 3"}'

# Test JOIN query
curl -s -X POST http://localhost:3001/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT r.name, f.flat_no, f.block FROM residents r JOIN flats f ON r.flat_no = f.flat_no LIMIT 5"}'

# Test GROUP BY aggregation
curl -s -X POST http://localhost:3001/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT block, COUNT(*) as total FROM flats GROUP BY block"}'

# Test Block DROP (should fail)
curl -s -X POST http://localhost:3001/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "DROP TABLE flats"}'
```

---

## PL/SQL Views (Use Instead of Complex Queries)

### Phase 1 - Analytics Views
```sql
-- Dashboard Stats (replaces /api/dashboard-stats)
SELECT * FROM v_dashboard_stats

-- Block Occupancy (replaces /api/occupancy-by-block)
SELECT * FROM v_block_occupancy

-- Monthly Collections (replaces /api/collections-by-month)
SELECT * FROM v_monthly_collections

-- Overdue Residents (replaces /api/overdue-residents)
SELECT * FROM v_overdue_residents
```

### Phase 2 - Detail Views
```sql
-- Flat Details with Residents
SELECT * FROM v_flat_details

-- Resident with Flat Info
SELECT * FROM v_resident_flats

-- Payment History
SELECT * FROM v_payment_history

-- Payment Details with Resident
SELECT * FROM v_payment_details

-- Complaint Summary
SELECT * FROM v_complaint_summary

-- Complaint by Resident
SELECT * FROM v_complaint_by_resident

-- Parking Summary
SELECT * FROM v_parking_summary

-- Resident Payment Summary
SELECT * FROM v_resident_payment_summary

-- Visitor Details
SELECT * FROM v_visitor_details

-- Active Visitors (currently inside)
SELECT * FROM v_active_visitors
```

---

## PL/SQL Functions

### Basic Functions
```sql
-- Total residents
SELECT fn_get_resident_count()

-- Flats in a block
SELECT fn_get_flat_count('A')

-- Is flat occupied?
SELECT fn_is_flat_occupied(101)

-- Total pending amount
SELECT fn_total_pending_amount()

-- Current visitors count
SELECT fn_active_visitors()
```

### Advanced Functions
```sql
-- Complaints by status
SELECT fn_get_complaint_count('Open')
SELECT fn_get_complaint_count('Resolved')

-- Today's visitors
SELECT fn_get_visitor_count_today()

-- Payment count by status
SELECT fn_get_payment_count_by_status('Paid')
SELECT fn_get_payment_count_by_status('Overdue')

-- Total revenue
SELECT fn_get_total_revenue()

-- Calculate late fee
SELECT fn_calculate_late_fee(1)
```

---

## Stored Procedures (CRUD Operations)

### Flat Operations
```sql
-- Add flat
CALL add_flat_safe(999, 'Z', 9, '3BHK')

-- Update flat
CALL update_flat_safe(999, 'Z', 10, 'Penthouse')

-- Delete flat (fails if has residents)
CALL delete_flat_safe(999)
```

### Resident Operations
```sql
-- Update resident
CALL update_resident_safe(1, 'New Name', '1234567890', 'email@test.com', 101, '2024-01-01')

-- Delete resident
CALL delete_resident_safe(1)
```

### Payment Operations
```sql
-- Update payment
CALL update_payment_safe(1, 5000, '2024-01-15', '2024-02-01', 'Paid', 1)

-- Delete payment
CALL delete_payment_safe(1)
```

### Complaint Operations
```sql
-- Add complaint
CALL add_complaint_safe('Water', 'Leaking tap', 'Open', '2024-01-20', 1)

-- Update complaint
CALL update_complaint_safe(1, 'Water', 'Fixed', 'Resolved', '2024-01-25', 1)

-- Delete complaint
CALL delete_complaint_safe(1)
```

### Visitor Operations
```sql
-- Update visitor
CALL update_visitor_safe(1, 'John', '2024-01-20 10:00:00', '2024-01-20 12:00:00', 'Meeting', 101)

-- Delete visitor
CALL delete_visitor_safe(1)
```

### Parking Operations
```sql
-- Update parking
CALL update_parking_safe(1, 'P1', 'ABC123', 'Car', 1)

-- Delete parking
CALL delete_parking_safe(1)
```

---

## Triggers (Auto-Execution)

Triggers run automatically - no manual invocation needed:

| Trigger | Action |
|---------|--------|
| `trg_after_resident_insert` | Logs new resident to audit_log |
| `trg_after_resident_update` | Logs resident changes |
| `trg_after_resident_delete` | Logs resident deletion |
| `trg_check_overdue_payment` | Auto-sets status to 'Overdue' when past due |
| `trg_after_complaint_insert` | Logs new complaint |
| `trg_after_complaint_update` | Logs complaint status changes |
| `trg_after_visitor_insert` | Logs new visitor |

### View Audit Log
```sql
SELECT * FROM audit_log ORDER BY changed_at DESC
```

---

## Manual SQL Queries (Before PL/SQL)

### 1. Resident with Payments
```sql
SELECT r.name, r.flat_no, p.amount, p.status 
FROM residents r 
JOIN maintenance_payments p ON r.resident_id = p.resident_id 
WHERE p.status = 'Pending'
```

### 2. Block-wise Occupancy
```sql
SELECT f.block, COUNT(f.flat_no) as total_flats, 
       COUNT(r.flat_no) as occupied, 
       ROUND(COUNT(r.flat_no) * 100.0 / COUNT(f.flat_no), 1) as occupancy_pct
FROM flats f
LEFT JOIN residents r ON f.flat_no = r.flat_no
GROUP BY f.block
```

### 3. Monthly Collections
```sql
SELECT DATE_FORMAT(payment_date, '%Y-%m') as month,
       COUNT(*) as invoices,
       SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) as collected,
       SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as pending
FROM maintenance_payments
GROUP BY month
ORDER BY month DESC
```

### 4. Visitor Log
```sql
SELECT v.visitor_name, v.purpose, v.entry_time, f.flat_no, f.block
FROM visitors v
JOIN flats f ON v.flat_no = f.flat_no
WHERE v.exit_time IS NULL
```

### 5. Parking with Resident
```sql
SELECT p.slot_number, p.vehicle_number, p.vehicle_type, r.name, r.flat_no
FROM parking p
LEFT JOIN residents r ON p.resident_id = r.resident_id
```

### 6. Overdue Payments
```sql
SELECT r.name, r.flat_no, r.phone, p.amount, p.due_date
FROM residents r
JOIN maintenance_payments p ON r.resident_id = p.resident_id
WHERE p.status = 'Overdue' OR (p.status = 'Pending' AND p.due_date < CURDATE())
```

### 7. Flat Details
```sql
SELECT f.flat_no, f.block, f.floor, f.type, 
       COUNT(r.resident_id) as resident_count
FROM flats f
LEFT JOIN residents r ON f.flat_no = r.flat_no
GROUP BY f.flat_no
ORDER BY f.block, f.flat_no
```

### 8. Complaints by Type
```sql
SELECT complaint_type, status, COUNT(*) as count
FROM complaints
GROUP BY complaint_type, status
ORDER BY complaint_type
```

### 9. Vehicles by Type
```sql
SELECT vehicle_type, COUNT(*) as count
FROM parking
GROUP BY vehicle_type
```

### 10. Recent Visitors
```sql
SELECT v.visitor_name, v.purpose, v.entry_time, f.flat_no, f.block
FROM visitors v
JOIN flats f ON v.flat_no = f.flat_no
WHERE v.entry_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY v.entry_time DESC
```