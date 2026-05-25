import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { mapAppointment, type AppointmentRow } from "@/lib/mappers";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const today = req.nextUrl.searchParams.get("date") || todayIso();

    const [appointments, totals, weekly, recent] = await Promise.all([
      query<AppointmentRow>(
        `select *
           from vw_appointments_list
          where company_id = $1
            and appointment_date between ($2::date - interval '3 days') and ($2::date + interval '10 days')
          order by appointment_date asc, start_time asc nulls last`,
        [session.companyId, today],
      ),
      query<{
        total_chats: string;
        new_leads: string;
        contracts_requested: string;
        events_created: string;
        pending_human_review: string;
        avg_response_time_seconds: string | null;
      }>(
        `select
            count(distinct cv.id)::int as total_chats,
            count(distinct cv.customer_id)::int as new_leads,
            count(distinct cv.id) filter (where cv.status = 'contrato_solicitado')::int as contracts_requested,
            (select count(*)::int from appointments a where a.company_id = $1 and a.created_at::date = $2::date) as events_created,
            count(distinct cv.id) filter (where cv.human_review_required = true)::int as pending_human_review,
            null::text as avg_response_time_seconds
           from conversations cv
          where cv.company_id = $1
            and cv.created_at::date = $2::date`,
        [session.companyId, today],
      ),
      query<{ day: string; total: number }>(
        `select to_char(d.day, 'YYYY-MM-DD') as day,
                coalesce(count(m.id), 0)::int as total
           from generate_series(($2::date - interval '6 days'), $2::date, interval '1 day') d(day)
           left join messages m
             on m.company_id = $1
            and m.created_at::date = d.day::date
          group by d.day
          order by d.day`,
        [session.companyId, today],
      ),
      query(
        `select *
           from vw_conversation_list
          where company_id = $1
          order by coalesce(last_message_at, created_at) desc
          limit 8`,
        [session.companyId],
      ),
    ]);

    const t = totals.rows[0] || {
      total_chats: 0,
      new_leads: 0,
      contracts_requested: 0,
      events_created: 0,
      pending_human_review: 0,
    };

    const totalChats = Number(t.total_chats || 0);
    const eventsCreated = Number(t.events_created || 0);

    return ok({
      today,
      stats: {
        total_chats: totalChats,
        new_leads: Number(t.new_leads || 0),
        contracts_requested: Number(t.contracts_requested || 0),
        events_created: eventsCreated,
        pending_human_review: Number(t.pending_human_review || 0),
        conversion_rate: totalChats > 0 ? Math.round((eventsCreated / totalChats) * 100) : 0,
        avg_response_time_seconds: Number(t.avg_response_time_seconds || 0),
        weekly: weekly.rows.map((r) => Number(r.total || 0)),
        recent: recent.rows.map((r) => ({
          id: r.id,
          customer_name: r.customer_name || r.customer_name_from_table || "Cliente sem nome",
          customer_phone: r.customer_phone || r.customer_phone_from_table || "",
          last_message: r.last_message || "",
          status: r.status || "open",
          ai_summary: r.ai_summary || "",
          human_review_required: Boolean(r.human_review_required),
          created_at: r.last_message_at || r.created_at,
        })),
      },
      events: appointments.rows.map(mapAppointment),
    });
  } catch (error) {
    return handleError(error);
  }
}
