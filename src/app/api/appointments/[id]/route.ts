import type { NextRequest } from "next/server";
import { z } from "zod";
import { query, tx } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, noContent, ok } from "@/lib/http";
import { mapAppointment, normalizeStatus, type AppointmentRow } from "@/lib/mappers";

const schema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_phone: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  event_type: z.string().min(1).optional(),
  event_date: z.string().min(8).optional(),
  event_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  guests: z.coerce.number().int().nonnegative().optional(),
  status: z.string().optional(),
  room_name: z.string().optional().nullable(),
  room_address: z.string().optional().nullable(),
  ceremonial_contact: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function mergeMetadata(current: Record<string, unknown>, data: z.infer<typeof schema>) {
  return {
    ...current,
    ...(data.customer_name !== undefined ? { customer_name: data.customer_name } : {}),
    ...(data.customer_phone !== undefined ? { customer_phone: data.customer_phone || "" } : {}),
    ...(data.document !== undefined ? { document: data.document || "" } : {}),
    ...(data.event_type !== undefined ? { event_type: data.event_type } : {}),
    ...(data.guests !== undefined ? { guests: data.guests || 0 } : {}),
    ...(data.room_name !== undefined ? { room_name: data.room_name || "" } : {}),
    ...(data.room_address !== undefined ? { room_address: data.room_address || "" } : {}),
    ...(data.ceremonial_contact !== undefined ? { ceremonial_contact: data.ceremonial_contact || "" } : {}),
    ...(data.street !== undefined ? { street: data.street || "" } : {}),
    ...(data.number !== undefined ? { number: data.number || "" } : {}),
    ...(data.district !== undefined ? { district: data.district || "" } : {}),
    ...(data.city !== undefined ? { city: data.city || "" } : {}),
    ...(data.zip_code !== undefined ? { zip_code: data.zip_code || "" } : {}),
  };
}

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { id } = await context.params;
    const { rows } = await query<AppointmentRow>(
      `select * from vw_appointments_list where id = $1 and company_id = $2 limit 1`,
      [id, session.companyId],
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ event: mapAppointment(rows[0]) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const updated = await tx(async (client) => {
      const current = await client.query<AppointmentRow>(
        `select * from appointments where id = $1 and company_id = $2 limit 1`,
        [id, session.companyId],
      );
      if (!current.rows[0]) throw new Error("NOT_FOUND");

      const row = current.rows[0];
      const metadata = mergeMetadata((row.metadata || {}) as Record<string, unknown>, data);
      const customerName = data.customer_name || String(metadata.customer_name || "Cliente sem nome");
      const eventType = data.event_type || row.appointment_type || String(metadata.event_type || "Evento");

      await client.query(
        `update appointments set
            title = $3,
            appointment_type = coalesce($4, appointment_type),
            appointment_date = coalesce($5::date, appointment_date),
            start_time = $6::time,
            end_time = $7::time,
            status = coalesce($8, status),
            location_name = $9,
            location_address = $10,
            responsible_name = $11,
            notes = $12,
            metadata = $13::jsonb,
            updated_at = now()
          where id = $1 and company_id = $2`,
        [
          id,
          session.companyId,
          `${eventType} - ${customerName}`,
          data.event_type || null,
          data.event_date || null,
          data.event_time || null,
          data.end_time || null,
          data.status ? normalizeStatus(data.status) : null,
          data.room_name ?? row.location_name,
          data.room_address ?? row.location_address,
          data.ceremonial_contact ?? row.responsible_name,
          data.notes ?? row.notes,
          JSON.stringify(metadata),
        ],
      );

      if (row.customer_id && (data.customer_name || data.customer_phone)) {
        await client.query(
          `update customers set
              name = coalesce($3, name),
              phone = coalesce($4, phone),
              metadata = coalesce(metadata, '{}'::jsonb) || $5::jsonb,
              updated_at = now()
            where id = $1 and company_id = $2`,
          [row.customer_id, session.companyId, data.customer_name || null, data.customer_phone || null, JSON.stringify({ document: data.document || metadata.document || "" })],
        );
      }

      const view = await client.query<AppointmentRow>(`select * from vw_appointments_list where id = $1`, [id]);
      return view.rows[0];
    });

    return ok({ event: mapAppointment(updated) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { id } = await context.params;
    const { rowCount } = await query(`delete from appointments where id = $1 and company_id = $2`, [id, session.companyId]);
    if (!rowCount) throw new Error("NOT_FOUND");
    return noContent();
  } catch (error) {
    return handleError(error);
  }
}
