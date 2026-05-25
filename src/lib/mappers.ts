export type AppointmentRow = {
  id: string;
  company_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_username?: string | null;
  conversation_id?: string | null;
  channel_id?: string | null;
  channel?: string | null;
  title?: string | null;
  appointment_type?: string | null;
  appointment_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  responsible_name?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
};

function timeToHHMM(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

export function mapAppointment(row: AppointmentRow) {
  const meta = row.metadata || {};

  return {
    id: row.id,
    company_id: row.company_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name || meta.customer_name || "Cliente sem nome",
    customer_phone: row.customer_phone || meta.customer_phone || "",
    customer_username: row.customer_username || "",
    document: meta.document || "",
    event_type: row.appointment_type || meta.event_type || "",
    event_date: row.appointment_date || "",
    event_time: timeToHHMM(row.start_time),
    end_time: timeToHHMM(row.end_time),
    guests: Number(meta.guests || 0),
    status: row.status || "pendente",
    room_name: row.location_name || meta.room_name || "",
    room_address: row.location_address || meta.room_address || "",
    ceremonial_contact: row.responsible_name || meta.ceremonial_contact || "",
    street: meta.street || "",
    number: meta.number || "",
    district: meta.district || "",
    city: meta.city || "",
    zip_code: meta.zip_code || "",
    notes: row.notes || "",
    channel: row.channel || "",
    conversation_id: row.conversation_id || null,
    source: row.source || "manual",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeStatus(status?: string) {
  const value = String(status || "pendente").trim().toLowerCase();
  if (["confirmado", "confirmed", "confirmada"].includes(value)) return "confirmado";
  if (["cancelado", "cancelled", "canceled", "cancelada"].includes(value)) return "cancelado";
  return "pendente";
}
