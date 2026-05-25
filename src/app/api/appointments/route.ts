import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, tx } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { created, handleError, ok } from "@/lib/http";
import { mapAppointment, normalizeStatus, type AppointmentRow } from "@/lib/mappers";

const schema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  event_type: z.string().min(1),
  event_date: z.string().min(8),
  event_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  guests: z.coerce.number().int().nonnegative().optional().default(0),
  status: z.string().optional().default("pendente"),
  room_name: z.string().optional().nullable(),
  room_address: z.string().optional().nullable(),
  ceremonial_contact: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
  channel_id: z.string().uuid().optional().nullable(),
});

function buildMetadata(data: z.infer<typeof schema>) {
  return {
    customer_name: data.customer_name,
    customer_phone: data.customer_phone || "",
    document: data.document || "",
    event_type: data.event_type,
    guests: data.guests || 0,
    room_name: data.room_name || "",
    room_address: data.room_address || "",
    ceremonial_contact: data.ceremonial_contact || "",
    street: data.street || "",
    number: data.number || "",
    district: data.district || "",
    city: data.city || "",
    zip_code: data.zip_code || "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const dateFrom = req.nextUrl.searchParams.get("dateFrom") || req.nextUrl.searchParams.get("from");
    const dateTo = req.nextUrl.searchParams.get("dateTo") || req.nextUrl.searchParams.get("to");

    const params: unknown[] = [session.companyId];
    const where = ["company_id = $1"];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        customer_name ilike $${params.length}
        or appointment_type ilike $${params.length}
        or location_name ilike $${params.length}
        or location_address ilike $${params.length}
        or notes ilike $${params.length}
        or metadata::text ilike $${params.length}
      )`);
    }

    if (status) {
      params.push(normalizeStatus(status));
      where.push(`status = $${params.length}`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      where.push(`appointment_date >= $${params.length}::date`);
    }

    if (dateTo) {
      params.push(dateTo);
      where.push(`appointment_date <= $${params.length}::date`);
    }

    const { rows } = await query<AppointmentRow>(
      `select * from vw_appointments_list where ${where.join(" and ")} order by appointment_date asc, start_time asc nulls last`,
      params,
    );

    return ok({ events: rows.map(mapAppointment) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const data = schema.parse(await req.json());

    const result = await tx(async (client) => {
      const customerResult = await client.query(
        `select * from get_or_create_customer($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          session.companyId,
          data.channel_id || null,
          "meta",
          data.channel || "whatsapp",
          null,
          data.customer_phone || null,
          data.customer_name,
          data.customer_name,
          null,
          "agenda_manual",
          JSON.stringify({ document: data.document || "" }),
        ],
      );

      const customer = customerResult.rows[0];
      const metadata = buildMetadata(data);

      const insert = await client.query<AppointmentRow>(
        `insert into appointments (
            company_id,
            customer_id,
            conversation_id,
            channel_id,
            channel,
            title,
            appointment_type,
            appointment_date,
            start_time,
            end_time,
            status,
            location_name,
            location_address,
            responsible_name,
            notes,
            metadata,
            source
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9::time,$10::time,$11,$12,$13,$14,$15,$16::jsonb,$17
          ) returning *`,
        [
          session.companyId,
          customer.id,
          data.conversation_id || null,
          data.channel_id || null,
          data.channel || "manual",
          `${data.event_type} - ${data.customer_name}`,
          data.event_type,
          data.event_date,
          data.event_time || null,
          data.end_time || null,
          normalizeStatus(data.status),
          data.room_name || null,
          data.room_address || null,
          data.ceremonial_contact || null,
          data.notes || null,
          JSON.stringify(metadata),
          "manual",
        ],
      );

      const view = await client.query<AppointmentRow>(`select * from vw_appointments_list where id = $1`, [insert.rows[0].id]);
      return view.rows[0] || insert.rows[0];
    });

    return created({ event: mapAppointment(result) });
  } catch (error) {
    return handleError(error);
  }
}
