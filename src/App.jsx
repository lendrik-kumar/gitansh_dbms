import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Database, Home, Pencil, Play, RefreshCcw, ShieldCheck, TerminalSquare, Trash2 } from 'lucide-react'

import SectionTable from './components/section-table'
import StatsGrid from './components/stats-grid'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Textarea } from './components/ui/textarea'
import { database } from './lib/database'
import { formatCurrency, formatDate, formatDateTime } from './lib/utils'

const initialForm = {
  flat_no: '',
  block: '',
  floor: '',
  type: '2BHK',
  name: '',
  phone: '',
  email: '',
  move_in_date: '',
  resident_id: '',
  amount: '',
  payment_date: '',
  due_date: '',
  status: 'Pending',
  complaint_type: 'Water',
  description: '',
  complaint_date: '',
  visitor_name: '',
  entry_time: '',
  exit_time: '',
  purpose: '',
  slot_number: '',
  vehicle_number: '',
  vehicle_type: 'Car',
}

const SQL_EXAMPLES = [
  {
    title: 'Residents with pending/overdue dues',
    sql: `SELECT r.name, r.flat_no, p.status, p.amount
FROM residents r
JOIN maintenance_payments p ON p.resident_id = r.resident_id
WHERE p.status IN ('Pending', 'Overdue')
ORDER BY p.amount DESC;`,
  },
  {
    title: 'Complaint count by type',
    sql: `SELECT complaint_type, COUNT(*) AS total
FROM complaints
GROUP BY complaint_type
ORDER BY total DESC;`,
  },
  {
    title: 'Occupancy percentage by block',
    sql: `SELECT f.block,
COUNT(DISTINCT f.flat_no) AS total_flats,
COUNT(DISTINCT r.flat_no) AS occupied_flats,
ROUND(COUNT(DISTINCT r.flat_no) * 100.0 / COUNT(DISTINCT f.flat_no), 2) AS occupancy_percent
FROM flats f
LEFT JOIN residents r ON r.flat_no = f.flat_no
GROUP BY f.block
ORDER BY f.block;`,
  },
  {
    title: 'Mark all old pending payments as overdue',
    sql: `UPDATE maintenance_payments
SET status = 'Overdue'
WHERE status = 'Pending' AND due_date < DATE('now');`,
  },
]

function statusBadge(status) {
  if (status === 'Paid' || status === 'Resolved' || status === 'Closed') return 'success'
  if (status === 'Pending' || status === 'In Progress') return 'warning'
  if (status === 'Overdue' || status === 'Open') return 'danger'
  return 'info'
}

function mapRowToForm(type, row) {
  if (type === 'flat') {
    return { ...initialForm, flat_no: String(row.flat_no), block: row.block, floor: String(row.floor), type: row.type }
  }
  if (type === 'resident') {
    return {
      ...initialForm,
      name: row.name,
      phone: row.phone,
      email: row.email || '',
      flat_no: String(row.flat_no),
      move_in_date: row.move_in_date || '',
    }
  }
  if (type === 'payment') {
    return {
      ...initialForm,
      resident_id: String(row.resident_id),
      amount: String(row.amount),
      payment_date: row.payment_date || '',
      due_date: row.due_date || '',
      status: row.status,
    }
  }
  if (type === 'complaint') {
    return {
      ...initialForm,
      resident_id: String(row.resident_id),
      complaint_type: row.complaint_type,
      description: row.description,
      status: row.status,
      complaint_date: row.complaint_date,
    }
  }
  if (type === 'visitor') {
    return {
      ...initialForm,
      visitor_name: row.visitor_name,
      entry_time: row.entry_time || '',
      exit_time: row.exit_time || '',
      purpose: row.purpose || '',
      flat_no: String(row.flat_no),
    }
  }
  return {
    ...initialForm,
    slot_number: row.slot_number,
    vehicle_number: row.vehicle_number || '',
    vehicle_type: row.vehicle_type || 'Car',
    resident_id: row.resident_id ? String(row.resident_id) : '',
  }
}

function App() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [editing, setEditing] = useState({ open: false, type: '', id: null })
  const [editForm, setEditForm] = useState(initialForm)

  const [sqlText, setSqlText] = useState(SQL_EXAMPLES[0].sql)
  const [sqlHistory, setSqlHistory] = useState([])
  const [sqlResult, setSqlResult] = useState(null)

  const [flats, setFlats] = useState([])
  const [residents, setResidents] = useState([])
  const [payments, setPayments] = useState([])
  const [complaints, setComplaints] = useState([])
  const [visitors, setVisitors] = useState([])
  const [parking, setParking] = useState([])
  const [stats, setStats] = useState({})
  const [collections, setCollections] = useState([])
  const [occupancy, setOccupancy] = useState([])
  const [overdue, setOverdue] = useState([])

  const residentOptions = useMemo(
    () => residents.map((r) => ({ label: `${r.name} (Flat ${r.flat_no})`, value: String(r.resident_id) })),
    [residents],
  )

  async function loadData() {
    const [
      flatsData,
      residentsData,
      paymentsData,
      complaintsData,
      visitorsData,
      parkingData,
      statsData,
      collectionsData,
      occupancyData,
      overdueData,
    ] = await Promise.all([
      database.getFlats(),
      database.getResidents(),
      database.getPayments(),
      database.getComplaints(),
      database.getVisitors(),
      database.getParking(),
      database.getDashboardStats(),
      database.getCollectionsByMonth(),
      database.getOccupancyByBlock(),
      database.getOverdueResidents(),
    ])

    setFlats(flatsData)
    setResidents(residentsData)
    setPayments(paymentsData)
    setComplaints(complaintsData)
    setVisitors(visitorsData)
    setParking(parkingData)
    setStats(statsData)
    setCollections(collectionsData)
    setOccupancy(occupancyData)
    setOverdue(overdueData)
  }

  async function refresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  function notify(type, text) {
    setMessage({ type, text })
    window.clearTimeout(window.__smartSocietyTimer)
    window.__smartSocietyTimer = window.setTimeout(() => {
      setMessage({ type: '', text: '' })
    }, 3500)
  }

  useEffect(() => {
    async function bootstrap() {
      await database.initialize()
      await loadData()
      setLoading(false)
    }
    bootstrap()
  }, [])

  async function onSubmit(type) {
    try {
      if (type === 'flat') await database.addFlat(form)
      if (type === 'resident') await database.addResident(form)
      if (type === 'payment') await database.addPayment(form)
      if (type === 'complaint') await database.addComplaint(form)
      if (type === 'visitor') await database.addVisitor(form)
      if (type === 'parking') await database.addParking(form)
      setForm(initialForm)
      await refresh()
      notify('success', `${type} added successfully.`)
    } catch (error) {
      notify('error', error.message)
    }
  }

  function openEdit(type, row, idKey) {
    setEditing({ open: true, type, id: row[idKey] })
    setEditForm(mapRowToForm(type, row))
  }

  async function saveEdit() {
    try {
      if (editing.type === 'flat') await database.updateFlat(editing.id, editForm)
      if (editing.type === 'resident') await database.updateResident(editing.id, editForm)
      if (editing.type === 'payment') await database.updatePayment(editing.id, editForm)
      if (editing.type === 'complaint') await database.updateComplaint(editing.id, editForm)
      if (editing.type === 'visitor') await database.updateVisitor(editing.id, editForm)
      if (editing.type === 'parking') await database.updateParking(editing.id, editForm)
      setEditing({ open: false, type: '', id: null })
      await refresh()
      notify('success', `${editing.type} updated successfully.`)
    } catch (error) {
      notify('error', error.message)
    }
  }

  async function removeItem(type, id) {
    if (!window.confirm(`Delete this ${type} record?`)) return
    try {
      if (type === 'flat') await database.deleteFlat(id)
      if (type === 'resident') await database.deleteResident(id)
      if (type === 'payment') await database.deletePayment(id)
      if (type === 'complaint') await database.deleteComplaint(id)
      if (type === 'visitor') await database.deleteVisitor(id)
      if (type === 'parking') await database.deleteParking(id)
      await refresh()
      notify('success', `${type} deleted successfully.`)
    } catch (error) {
      notify('error', error.message)
    }
  }

  async function runTxDemo(forceError) {
    const result = await database.runTransactionDemo({
      amount: 3900,
      payment_date: new Date().toISOString().slice(0, 10),
      due_date: new Date().toISOString().slice(0, 10),
      status: 'Paid',
      resident_id: residents[0]?.resident_id,
      force_error: forceError,
    })
    await refresh()
    if (result.ok) notify('success', 'Transaction committed successfully.')
    else notify('error', result.error)
  }

  async function runSql() {
    const result = await database.executeSql(sqlText)
    setSqlResult(result)
    setSqlHistory((prev) => [{ sql: sqlText, at: new Date().toLocaleTimeString(), ok: result.ok }, ...prev].slice(0, 12))
    if (result.ok) {
      await refresh()
      notify('success', result.kind === 'query' ? `Query returned ${result.count} rows.` : `Mutation applied (${result.changes} rows).`)
    } else {
      notify('error', result.error)
    }
  }

  function ActionButtons({ onEditClick, onDeleteClick }) {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEditClick}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="destructive" onClick={onDeleteClick}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="mono text-slate-600">Connecting to MySQL database...</p>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-6 rounded-2xl border border-teal-100 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.22em] text-teal-700">Production Ready Demo</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Smart Society / Apartment Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              MySQL + React + Express + Tailwind + shadcn-style UI. Includes full CRUD, SQL console,
              constraint validation, analytical reports, and transaction demo.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={refresh} disabled={refreshing}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await database.reset()
                await refresh()
                notify('success', 'Demo database reset.')
              }}
            >
              Reset Demo Data
            </Button>
          </div>
        </div>
      </header>

      {message.text ? (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <StatsGrid stats={stats} parkingSlots={parking.length} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-xl bg-transparent p-0">
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="dashboard">
            <Home className="mr-2 h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="flats">
            Flats
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="residents">
            Residents
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="payments">
            Payments
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="complaints">
            Complaints
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="visitors">
            Visitors
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="parking">
            Parking
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="dbms">
            <Database className="mr-2 h-4 w-4" /> DBMS
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="sql-runner">
            <TerminalSquare className="mr-2 h-4 w-4" /> SQL Runner
          </TabsTrigger>
          <TabsTrigger className="rounded-lg border border-slate-200 bg-white" value="guide">
            <BookOpen className="mr-2 h-4 w-4" /> Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionTable
              title="Recent Maintenance Payments"
              columns={[
                { key: 'resident_name', label: 'Resident' },
                { key: 'flat_no', label: 'Flat' },
                { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={statusBadge(row.status)}>{row.status}</Badge> },
              ]}
              rows={payments.slice(0, 6).map((row) => ({ ...row, id: row.payment_id }))}
            />

            <SectionTable
              title="Active Complaints"
              columns={[
                { key: 'resident_name', label: 'Resident' },
                { key: 'complaint_type', label: 'Type' },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={statusBadge(row.status)}>{row.status}</Badge> },
                { key: 'complaint_date', label: 'Date', render: (row) => formatDate(row.complaint_date) },
              ]}
              rows={complaints.filter((c) => c.status === 'Open' || c.status === 'In Progress').map((row) => ({ ...row, id: row.complaint_id }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="flats">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Flat Records"
              columns={[
                { key: 'flat_no', label: 'Flat No' },
                { key: 'block', label: 'Block' },
                { key: 'floor', label: 'Floor' },
                { key: 'type', label: 'Type' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButtons
                      onEditClick={() => openEdit('flat', row, 'flat_no')}
                      onDeleteClick={() => removeItem('flat', row.flat_no)}
                    />
                  ),
                },
              ]}
              rows={flats.map((row) => ({ ...row, id: row.flat_no }))}
            />

            <Card>
              <CardHeader>
                <CardTitle>Add Flat</CardTitle>
                <CardDescription>PK uniqueness + type checks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Flat No</Label>
                <Input value={form.flat_no} onChange={(e) => setForm({ ...form, flat_no: e.target.value })} />
                <Label>Block</Label>
                <Input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} />
                <Label>Floor</Label>
                <Input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1BHK">1BHK</SelectItem>
                    <SelectItem value="2BHK">2BHK</SelectItem>
                    <SelectItem value="3BHK">3BHK</SelectItem>
                    <SelectItem value="Penthouse">Penthouse</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={() => onSubmit('flat')}>Save Flat</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="residents">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Resident Records"
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'flat_no', label: 'Flat' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'move_in_date', label: 'Move In', render: (row) => formatDate(row.move_in_date) },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButtons
                      onEditClick={() => openEdit('resident', row, 'resident_id')}
                      onDeleteClick={() => removeItem('resident', row.resident_id)}
                    />
                  ),
                },
              ]}
              rows={residents.map((row) => ({ ...row, id: row.resident_id }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Add Resident</CardTitle>
                <CardDescription>FK links resident to valid flat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Label>Flat No</Label>
                <Input value={form.flat_no} onChange={(e) => setForm({ ...form, flat_no: e.target.value })} />
                <Label>Move In Date</Label>
                <Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} />
                <Button className="w-full" onClick={() => onSubmit('resident')}>Save Resident</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Maintenance Payments"
              columns={[
                { key: 'resident_name', label: 'Resident' },
                { key: 'flat_no', label: 'Flat' },
                { key: 'amount', label: 'Amount', render: (row) => formatCurrency(row.amount) },
                { key: 'due_date', label: 'Due', render: (row) => formatDate(row.due_date) },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={statusBadge(row.status)}>{row.status}</Badge> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButtons
                      onEditClick={() => openEdit('payment', row, 'payment_id')}
                      onDeleteClick={() => removeItem('payment', row.payment_id)}
                    />
                  ),
                },
              ]}
              rows={payments.map((row) => ({ ...row, id: row.payment_id }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Add Payment</CardTitle>
                <CardDescription>Amount checks + resident FK.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Resident</Label>
                <Select value={form.resident_id} onValueChange={(value) => setForm({ ...form, resident_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <Label>Payment Date</Label>
                <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={() => onSubmit('payment')}>Save Payment</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="complaints">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Complaint Records"
              columns={[
                { key: 'resident_name', label: 'Resident' },
                { key: 'complaint_type', label: 'Type' },
                { key: 'description', label: 'Description' },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={statusBadge(row.status)}>{row.status}</Badge> },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButtons
                      onEditClick={() => openEdit('complaint', row, 'complaint_id')}
                      onDeleteClick={() => removeItem('complaint', row.complaint_id)}
                    />
                  ),
                },
              ]}
              rows={complaints.map((row) => ({ ...row, id: row.complaint_id }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Add Complaint</CardTitle>
                <CardDescription>Status lifecycle tracking.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Resident</Label>
                <Select value={form.resident_id} onValueChange={(value) => setForm({ ...form, resident_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Type</Label>
                <Input value={form.complaint_type} onChange={(e) => setForm({ ...form, complaint_type: e.target.value })} />
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Complaint Date</Label>
                <Input type="date" value={form.complaint_date} onChange={(e) => setForm({ ...form, complaint_date: e.target.value })} />
                <Button className="w-full" onClick={() => onSubmit('complaint')}>Save Complaint</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visitors">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Visitor Log"
              columns={[
                { key: 'visitor_name', label: 'Name' },
                { key: 'flat_no', label: 'Flat' },
                { key: 'purpose', label: 'Purpose' },
                { key: 'entry_time', label: 'Entry', render: (row) => formatDateTime(row.entry_time) },
                { key: 'exit_time', label: 'Exit', render: (row) => (row.exit_time ? formatDateTime(row.exit_time) : <Badge variant="warning">Inside</Badge>) },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      {!row.exit_time ? (
                        <Button size="sm" variant="secondary" onClick={() => database.checkOutVisitor(row.visitor_id).then(refresh)}>
                          Checkout
                        </Button>
                      ) : null}
                      <ActionButtons
                        onEditClick={() => openEdit('visitor', row, 'visitor_id')}
                        onDeleteClick={() => removeItem('visitor', row.visitor_id)}
                      />
                    </div>
                  ),
                },
              ]}
              rows={visitors.map((row) => ({ ...row, id: row.visitor_id }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Add Visitor</CardTitle>
                <CardDescription>Security entry/exit monitoring.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Name</Label>
                <Input value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} />
                <Label>Flat No</Label>
                <Input value={form.flat_no} onChange={(e) => setForm({ ...form, flat_no: e.target.value })} />
                <Label>Purpose</Label>
                <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                <Label>Entry Time</Label>
                <Input type="datetime-local" value={form.entry_time} onChange={(e) => setForm({ ...form, entry_time: e.target.value })} />
                <Button className="w-full" onClick={() => onSubmit('visitor')}>Save Entry</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="parking">
          <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionTable
              title="Parking Allocation"
              columns={[
                { key: 'slot_number', label: 'Slot' },
                { key: 'vehicle_number', label: 'Vehicle No' },
                { key: 'vehicle_type', label: 'Type' },
                { key: 'resident_name', label: 'Resident' },
                { key: 'flat_no', label: 'Flat' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <ActionButtons
                      onEditClick={() => openEdit('parking', row, 'parking_id')}
                      onDeleteClick={() => removeItem('parking', row.parking_id)}
                    />
                  ),
                },
              ]}
              rows={parking.map((row) => ({ ...row, id: row.parking_id }))}
            />
            <Card>
              <CardHeader>
                <CardTitle>Add Parking Slot</CardTitle>
                <CardDescription>Unique slot + optional resident mapping.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Slot Number</Label>
                <Input value={form.slot_number} onChange={(e) => setForm({ ...form, slot_number: e.target.value })} />
                <Label>Vehicle Number</Label>
                <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
                <Label>Vehicle Type</Label>
                <Select value={form.vehicle_type} onValueChange={(value) => setForm({ ...form, vehicle_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Cycle">Cycle</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Resident (optional)</Label>
                <Select value={form.resident_id} onValueChange={(value) => setForm({ ...form, resident_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={() => onSubmit('parking')}>Save Parking</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dbms">
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionTable
              title="Monthly Collections (GROUP BY + CASE)"
              columns={[
                { key: 'month', label: 'Month' },
                { key: 'total_invoices', label: 'Invoices' },
                { key: 'paid_amount', label: 'Collected', render: (row) => formatCurrency(row.paid_amount) },
                { key: 'pending_amount', label: 'Pending', render: (row) => formatCurrency(row.pending_amount) },
              ]}
              rows={collections.map((row, index) => ({ ...row, id: index }))}
            />

            <SectionTable
              title="Block Occupancy (LEFT JOIN + Aggregation)"
              columns={[
                { key: 'block', label: 'Block' },
                { key: 'total_flats', label: 'Total Flats' },
                { key: 'occupied_flats', label: 'Occupied' },
                { key: 'occupancy_percent', label: 'Occupancy %', render: (row) => <span className="mono">{row.occupancy_percent}%</span> },
              ]}
              rows={occupancy.map((row, index) => ({ ...row, id: index }))}
            />

            <SectionTable
              title="Overdue Residents (JOIN + Aggregation)"
              columns={[
                { key: 'name', label: 'Resident' },
                { key: 'flat_no', label: 'Flat' },
                { key: 'overdue_count', label: 'Overdues' },
                { key: 'overdue_amount', label: 'Amount', render: (row) => formatCurrency(row.overdue_amount) },
              ]}
              rows={overdue.map((row) => ({ ...row, id: row.resident_id }))}
            />

            <Card>
              <CardHeader>
                <CardTitle>Transaction + Rollback Demo</CardTitle>
                <CardDescription>BEGIN -&gt; INSERT -&gt; FAIL/COMMIT demonstrates ACID behavior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="mono text-xs text-slate-500">BEGIN TRANSACTION -&gt; INSERT PAYMENT -&gt; [OPTIONAL FAIL] -&gt; COMMIT/ROLLBACK</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => runTxDemo(false)}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Commit
                  </Button>
                  <Button variant="destructive" onClick={() => runTxDemo(true)}>
                    Force Rollback
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sql-runner">
          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Raw SQL Runner</CardTitle>
                <CardDescription>Run SELECT/INSERT/UPDATE/DELETE directly on MySQL database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea className="mono min-h-[220px]" value={sqlText} onChange={(e) => setSqlText(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={runSql}>
                    <Play className="mr-2 h-4 w-4" /> Execute SQL
                  </Button>
                  <Button variant="outline" onClick={() => setSqlText('SELECT * FROM residents ORDER BY resident_id DESC;')}>
                    Load Basic Query
                  </Button>
                </div>

                {sqlResult ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">
                      {sqlResult.ok
                        ? sqlResult.kind === 'query'
                          ? `Query OK: ${sqlResult.count} rows`
                          : `Mutation OK: ${sqlResult.changes} rows changed`
                        : `Error: ${sqlResult.error}`}
                    </p>
                  </div>
                ) : null}

                {sqlResult?.ok && sqlResult.kind === 'query' ? (
                  <div className="overflow-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          {sqlResult.columns.map((col) => (
                            <th key={col} className="px-3 py-2 text-left font-medium text-slate-700">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.rows.slice(0, 120).map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            {sqlResult.columns.map((col) => (
                              <td key={`${idx}-${col}`} className="px-3 py-2 text-slate-700">{String(row[col] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Example Queries</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {SQL_EXAMPLES.map((example) => (
                    <Button key={example.title} variant="outline" className="w-full justify-start" onClick={() => setSqlText(example.sql)}>
                      {example.title}
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Query History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sqlHistory.length === 0 ? (
                    <p className="text-sm text-slate-500">No query run yet.</p>
                  ) : (
                    sqlHistory.map((item, idx) => (
                      <button
                        type="button"
                        key={`${item.at}-${idx}`}
                        className="w-full rounded-md border border-slate-200 p-2 text-left text-xs hover:bg-slate-50"
                        onClick={() => setSqlText(item.sql)}
                      >
                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {item.at} - {item.sql.split('\n')[0]}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guide">
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>How to Use (Step-by-step)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p><strong>1.</strong> Start from <span className="mono">Dashboard</span> to view current records and society KPIs.</p>
                <p><strong>2.</strong> Use each module tab to <strong>Create, Read, Update, Delete</strong> data.</p>
                <p><strong>3.</strong> In every table, click <strong>Edit</strong> (pencil) or <strong>Delete</strong> (trash).</p>
                <p><strong>4.</strong> Go to <span className="mono">DBMS</span> tab for aggregate reports and transaction rollback demo.</p>
                <p><strong>5.</strong> Open <span className="mono">SQL Runner</span> to execute custom SQL queries directly.</p>
                <p><strong>6.</strong> Use <span className="mono">Reset Demo Data</span> to restore baseline dataset before a presentation.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Presentation / Viva Flow (10 min)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p><strong>1. Schema & Relationships</strong>: Explain flats-residents-payments/complaints/parking FKs.</p>
                <p><strong>2. CRUD Demo</strong>: Add resident, edit details, delete a complaint.</p>
                <p><strong>3. Constraint Demo</strong>: Try invalid operation (e.g., duplicate slot number) and show DB error.</p>
                <p><strong>4. Analytics Demo</strong>: Show occupancy and monthly collections in DBMS tab.</p>
                <p><strong>5. Transaction Demo</strong>: Run commit then force rollback.</p>
                <p><strong>6. SQL Demo</strong>: Run a JOIN query from SQL Runner and interpret results.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Why This Is More Than a Prototype</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>- Full CRUD on all six modules with relationship-safe deletes.</p>
                <p>- Direct SQL execution layer with query history and examples.</p>
                <p>- Indexed schema + check/unique/foreign key constraints.</p>
                <p>- Transaction behavior with real rollback path.</p>
                <p>- Persistent local storage DB for repeated demo sessions.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Important Demo Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>- SQL Runner blocks destructive commands like DROP and ALTER TABLE.</p>
                <p>- FK restrictions intentionally show integrity constraints.</p>
                <p>- Results persist in browser local storage until reset.</p>
                <p>- Works fully offline after first load.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={editing.open} onOpenChange={(open) => setEditing((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing.type}</DialogTitle>
            <DialogDescription>Update the selected record and save changes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {editing.type === 'flat' ? (
              <>
                <Label>Block</Label>
                <Input value={editForm.block} onChange={(e) => setEditForm({ ...editForm, block: e.target.value })} />
                <Label>Floor</Label>
                <Input type="number" value={editForm.floor} onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })} />
                <Label>Type</Label>
                <Select value={editForm.type} onValueChange={(value) => setEditForm({ ...editForm, type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1BHK">1BHK</SelectItem>
                    <SelectItem value="2BHK">2BHK</SelectItem>
                    <SelectItem value="3BHK">3BHK</SelectItem>
                    <SelectItem value="Penthouse">Penthouse</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : null}

            {editing.type === 'resident' ? (
              <>
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                <Label>Email</Label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                <Label>Flat No</Label>
                <Input value={editForm.flat_no} onChange={(e) => setEditForm({ ...editForm, flat_no: e.target.value })} />
                <Label>Move In Date</Label>
                <Input type="date" value={editForm.move_in_date} onChange={(e) => setEditForm({ ...editForm, move_in_date: e.target.value })} />
              </>
            ) : null}

            {editing.type === 'payment' ? (
              <>
                <Label>Resident</Label>
                <Select value={editForm.resident_id} onValueChange={(value) => setEditForm({ ...editForm, resident_id: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Amount</Label>
                <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
                <Label>Payment Date</Label>
                <Input type="date" value={editForm.payment_date} onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })} />
                <Label>Due Date</Label>
                <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : null}

            {editing.type === 'complaint' ? (
              <>
                <Label>Resident</Label>
                <Select value={editForm.resident_id} onValueChange={(value) => setEditForm({ ...editForm, resident_id: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Type</Label>
                <Input value={editForm.complaint_type} onChange={(e) => setEditForm({ ...editForm, complaint_type: e.target.value })} />
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Complaint Date</Label>
                <Input type="date" value={editForm.complaint_date} onChange={(e) => setEditForm({ ...editForm, complaint_date: e.target.value })} />
              </>
            ) : null}

            {editing.type === 'visitor' ? (
              <>
                <Label>Name</Label>
                <Input value={editForm.visitor_name} onChange={(e) => setEditForm({ ...editForm, visitor_name: e.target.value })} />
                <Label>Flat No</Label>
                <Input value={editForm.flat_no} onChange={(e) => setEditForm({ ...editForm, flat_no: e.target.value })} />
                <Label>Purpose</Label>
                <Input value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} />
                <Label>Entry Time</Label>
                <Input type="datetime-local" value={editForm.entry_time} onChange={(e) => setEditForm({ ...editForm, entry_time: e.target.value })} />
                <Label>Exit Time (optional)</Label>
                <Input type="datetime-local" value={editForm.exit_time} onChange={(e) => setEditForm({ ...editForm, exit_time: e.target.value })} />
              </>
            ) : null}

            {editing.type === 'parking' ? (
              <>
                <Label>Slot Number</Label>
                <Input value={editForm.slot_number} onChange={(e) => setEditForm({ ...editForm, slot_number: e.target.value })} />
                <Label>Vehicle Number</Label>
                <Input value={editForm.vehicle_number} onChange={(e) => setEditForm({ ...editForm, vehicle_number: e.target.value })} />
                <Label>Vehicle Type</Label>
                <Select value={editForm.vehicle_type} onValueChange={(value) => setEditForm({ ...editForm, vehicle_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Cycle">Cycle</SelectItem>
                  </SelectContent>
                </Select>
                <Label>Resident (optional)</Label>
                <Select value={editForm.resident_id} onValueChange={(value) => setEditForm({ ...editForm, resident_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                  <SelectContent>
                    {residentOptions.map((resident) => (
                      <SelectItem key={resident.value} value={resident.value}>{resident.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing({ open: false, type: '', id: null })}>Cancel</Button>
              <Button onClick={saveEdit}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default App
