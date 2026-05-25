import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const channel = req.nextUrl.searchParams.get("channel")?.trim();
    const humanReview = req.nextUrl.searchParams.get("humanReview");
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 100);

    const params: unknown[] = [session.companyId];
    const where = ["company_id = $1"];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(customer_name ilike $${params.length} or customer_phone ilike $${params.length} or last_message ilike $${params.length} or ai_summary ilike $${params.length})`);
    }

    if (channel) {
      params.push(channel);
      where.push(`channel = $${params.length}`);
    }

    if (humanReview === "true") {
      where.push("human_review_required = true");
    }

    params.push(limit);

    const { rows } = await query(
      `select *
         from vw_conversation_list
        where ${where.join(" and ")}
        order by coalesce(last_message_at, created_at) desc
        limit $${params.length}`,
      params,
    );

    return ok({
      conversations: rows.map((r) => ({
        id: r.id,
        company_id: r.company_id,
        channel_id: r.channel_id,
        customer_id: r.customer_id,
        provider: r.provider,
        channel: r.channel,
        customer_name: r.customer_name || r.customer_name_from_table || "Cliente sem nome",
        customer_phone: r.customer_phone || r.customer_phone_from_table || "",
        customer_username: r.customer_username || r.customer_username_from_table || "",
        status: r.status,
        last_message: r.last_message,
        ai_summary: r.ai_summary,
        human_review_required: Boolean(r.human_review_required),
        last_message_at: r.last_message_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
