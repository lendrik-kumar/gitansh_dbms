# Smart Society DBMS System

A frontend-only Apartment/Society Management System built with React + Tailwind + shadcn-style components, using SQLite in-browser through `sql.js` (WASM).

This is no longer just a basic prototype. It now supports full CRUD for all modules, raw SQL execution, transaction demonstrations, and a guided presentation flow for DBMS evaluation/viva.

## Core capabilities

- Full CRUD across all modules:
  - Flats
  - Residents
  - Maintenance Payments
  - Complaints
  - Visitors
  - Parking
- SQL Runner tab for direct query execution
- DBMS analytical reports using JOIN/GROUP BY/CASE
- ACID transaction demo (commit and rollback)
- Constraint-driven behavior:
  - Primary keys
  - Foreign keys
  - Unique constraints
  - Check constraints
- Persistent browser-side storage via `localStorage`

## Technology stack

- React + Vite
- Tailwind CSS
- Radix primitives + shadcn-style component architecture
- SQLite (WASM) via `sql.js`

## Project structure

- `src/lib/database.js` - schema, seed data, CRUD, transaction, SQL runner backend
- `src/App.jsx` - complete application UI and module workflows
- `src/components/ui/*` - reusable UI primitives
- `src/components/section-table.jsx` - reusable data table section
- `src/components/stats-grid.jsx` - dashboard KPI cards
- `public/sql-wasm.wasm` - SQLite WASM binary

## Run locally

```bash
npm install
npm run dev
```

For production build check:

```bash
npm run build
```

## How to use (user guide)

### 1) Dashboard

- Open `Dashboard` tab to view:
  - total flats
  - residents
  - overdue payments
  - active complaints
  - active visitors
- This gives a quick overview before drilling into modules.

### 2) CRUD in each module

Each module tab has:

- left: data table
- right: add form
- row actions: edit (pencil) and delete (trash)

Modules:

1. `Flats`
2. `Residents`
3. `Payments`
4. `Complaints`
5. `Visitors`
6. `Parking`

### 3) DBMS tab (reports + transaction)

- View built-in analytical reports:
  - monthly collections
  - occupancy by block
  - overdue residents
- Use transaction demo buttons:
  - `Commit` inserts successfully
  - `Force Rollback` triggers failure path and rolls back

### 4) SQL Runner tab

- Write SQL in the editor and click `Execute SQL`
- Supported categories:
  - SELECT / WITH
  - INSERT / UPDATE / DELETE
- Built-in examples can be loaded using one click
- Query history stores recent executed statements

Safety rules in demo mode:

- blocked operations include `DROP`, `ALTER TABLE`, and a few other destructive schema commands

### 5) Guide tab

- Contains in-app usage steps
- Includes a 10-minute viva/presentation script
- Explains why the project demonstrates real DBMS behavior

## DBMS concept mapping

### Entities

- `flats`
- `residents`
- `maintenance_payments`
- `complaints`
- `visitors`
- `parking`

### Relationships

- One flat -> many residents
- One resident -> many maintenance payments
- One resident -> many complaints
- One flat -> many visitors
- One resident -> one or more parking assignments (optional mapping)

### Normalization

- Schema is designed in 3NF style:
  - atomic attributes
  - no partial dependencies
  - no transitive dependencies in entity tables

### Integrity and consistency

- PK ensures uniqueness
- FK ensures valid references
- UNIQUE prevents duplicate values where needed
- CHECK controls allowed categorical values

## Demo scenarios (recommended)

### Scenario A: Resident onboarding

1. Add flat
2. Add resident mapped to flat
3. Add parking slot mapped to resident
4. Add first maintenance payment

### Scenario B: Complaint lifecycle

1. Add complaint as `Open`
2. Edit to `In Progress`
3. Edit to `Resolved`
4. Optionally close/delete as admin cleanup

### Scenario C: SQL proof of DBMS

1. Run JOIN query in SQL Runner
2. Run GROUP BY aggregate query
3. Run UPDATE statement
4. Verify changes immediately in module tables

### Scenario D: Transaction proof

1. Run `Commit`
2. Validate new payment entry
3. Run `Force Rollback`
4. Show that failed transaction does not persist

## Sample SQL queries for viva

```sql
-- Residents with pending/overdue dues
SELECT r.name, r.flat_no, p.status, p.amount
FROM residents r
JOIN maintenance_payments p ON p.resident_id = r.resident_id
WHERE p.status IN ('Pending', 'Overdue')
ORDER BY p.amount DESC;
```

```sql
-- Complaint count by type
SELECT complaint_type, COUNT(*) AS total
FROM complaints
GROUP BY complaint_type
ORDER BY total DESC;
```

```sql
-- Occupancy by block
SELECT f.block,
       COUNT(DISTINCT f.flat_no) AS total_flats,
       COUNT(DISTINCT r.flat_no) AS occupied_flats,
       ROUND(COUNT(DISTINCT r.flat_no) * 100.0 / COUNT(DISTINCT f.flat_no), 2) AS occupancy_percent
FROM flats f
LEFT JOIN residents r ON r.flat_no = f.flat_no
GROUP BY f.block
ORDER BY f.block;
```

## Reset and persistence

- Data persists in browser local storage.
- Use `Reset Demo Data` before live presentations for a clean baseline.

## Limitations (intentional)

- No backend server
- No authentication/authorization layer
- Minimal security by design for academic DBMS demonstration

For your use case, this keeps setup simple while still demonstrating strong database concepts in a practical way.
