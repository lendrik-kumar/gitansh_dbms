const API_BASE = "/api";

async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API Error");
  }
  return response.json();
}

export const database = {
  async initialize() {
    return true;
  },

  async reset() {
    const { result } = await fetch("/execute-sql", {
      method: "POST",
      body: JSON.stringify({ sql: "DELETE FROM maintenance_payments; DELETE FROM complaints; DELETE FROM visitors; DELETE FROM residents; DELETE FROM parking; DELETE FROM flats;" }),
    });
    return result;
  },

  async getFlats() {
    return fetchApi("/flats");
  },

  async getResidents() {
    return fetchApi("/residents");
  },

  async getPayments() {
    return fetchApi("/payments");
  },

  async getComplaints() {
    return fetchApi("/complaints");
  },

  async getVisitors() {
    return fetchApi("/visitors");
  },

  async getParking() {
    return fetchApi("/parking");
  },

  async addFlat(payload) {
    return fetchApi("/flats", {
      method: "POST",
      body: JSON.stringify({
        flat_no: Number(payload.flat_no),
        block: payload.block,
        floor: Number(payload.floor),
        type: payload.type,
      }),
    });
  },

  async updateFlat(flatNo, payload) {
    return fetchApi(`/flats/${flatNo}`, {
      method: "PUT",
      body: JSON.stringify({
        block: payload.block,
        floor: Number(payload.floor),
        type: payload.type,
      }),
    });
  },

  async deleteFlat(flatNo) {
    return fetchApi(`/flats/${flatNo}`, { method: "DELETE" });
  },

  async addResident(payload) {
    return fetchApi("/residents", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email || null,
        flat_no: Number(payload.flat_no),
        move_in_date: payload.move_in_date || null,
      }),
    });
  },

  async updateResident(residentId, payload) {
    return fetchApi(`/residents/${residentId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: payload.name,
        phone: payload.phone,
        email: payload.email || null,
        flat_no: Number(payload.flat_no),
        move_in_date: payload.move_in_date || null,
      }),
    });
  },

  async deleteResident(residentId) {
    return fetchApi(`/residents/${residentId}`, { method: "DELETE" });
  },

  async addPayment(payload) {
    return fetchApi("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: Number(payload.amount),
        payment_date: payload.payment_date || null,
        due_date: payload.due_date,
        status: payload.status,
        resident_id: Number(payload.resident_id),
      }),
    });
  },

  async updatePayment(paymentId, payload) {
    return fetchApi(`/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({
        amount: Number(payload.amount),
        payment_date: payload.payment_date || null,
        due_date: payload.due_date,
        status: payload.status,
        resident_id: Number(payload.resident_id),
      }),
    });
  },

  async deletePayment(paymentId) {
    return fetchApi(`/payments/${paymentId}`, { method: "DELETE" });
  },

  async addComplaint(payload) {
    return fetchApi("/complaints", {
      method: "POST",
      body: JSON.stringify({
        complaint_type: payload.complaint_type,
        description: payload.description,
        status: payload.status,
        complaint_date: payload.complaint_date,
        resident_id: Number(payload.resident_id),
      }),
    });
  },

  async updateComplaint(complaintId, payload) {
    return fetchApi(`/complaints/${complaintId}`, {
      method: "PUT",
      body: JSON.stringify({
        complaint_type: payload.complaint_type,
        description: payload.description,
        status: payload.status,
        complaint_date: payload.complaint_date,
        resident_id: Number(payload.resident_id),
      }),
    });
  },

  async deleteComplaint(complaintId) {
    return fetchApi(`/complaints/${complaintId}`, { method: "DELETE" });
  },

  async addVisitor(payload) {
    return fetchApi("/visitors", {
      method: "POST",
      body: JSON.stringify({
        visitor_name: payload.visitor_name,
        entry_time: payload.entry_time,
        purpose: payload.purpose,
        flat_no: Number(payload.flat_no),
      }),
    });
  },

  async updateVisitor(visitorId, payload) {
    return fetchApi(`/visitors/${visitorId}`, {
      method: "PUT",
      body: JSON.stringify({
        visitor_name: payload.visitor_name,
        entry_time: payload.entry_time,
        exit_time: payload.exit_time || null,
        purpose: payload.purpose,
        flat_no: Number(payload.flat_no),
      }),
    });
  },

  async deleteVisitor(visitorId) {
    return fetchApi(`/visitors/${visitorId}`, { method: "DELETE" });
  },

  async checkOutVisitor(visitorId) {
    return fetchApi(`/visitors/${visitorId}/checkout`, { method: "POST" });
  },

  async addParking(payload) {
    return fetchApi("/parking", {
      method: "POST",
      body: JSON.stringify({
        slot_number: payload.slot_number,
        vehicle_number: payload.vehicle_number,
        vehicle_type: payload.vehicle_type,
        resident_id: payload.resident_id ? Number(payload.resident_id) : null,
      }),
    });
  },

  async updateParking(parkingId, payload) {
    return fetchApi(`/parking/${parkingId}`, {
      method: "PUT",
      body: JSON.stringify({
        slot_number: payload.slot_number,
        vehicle_number: payload.vehicle_number,
        vehicle_type: payload.vehicle_type,
        resident_id: payload.resident_id ? Number(payload.resident_id) : null,
      }),
    });
  },

  async deleteParking(parkingId) {
    return fetchApi(`/parking/${parkingId}`, { method: "DELETE" });
  },

  async getDashboardStats() {
    return fetchApi("/dashboard-stats");
  },

  async getCollectionsByMonth() {
    return fetchApi("/collections-by-month");
  },

  async getOccupancyByBlock() {
    return fetchApi("/occupancy-by-block");
  },

  async getOverdueResidents() {
    return fetchApi("/overdue-residents");
  },

  async runTransactionDemo(payload) {
    return fetchApi("/transaction-demo", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async executeSql(rawSql) {
    return fetchApi("/execute-sql", {
      method: "POST",
      body: JSON.stringify({ sql: rawSql }),
    });
  },
};