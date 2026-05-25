import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { created, handleError, ok, parseSearchParams } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2),
  trade_name: z.string().optional().nullable(),
  slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Use apenas letras, números e hífen."),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  segment_code: z.string().optional().default("events"),
  primary_color: z.string().optional().nullable(),
  secondary_color: z.string().optional().nullable(),
  accent_color: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const params = parseSearchParams(req);
    const q = params.get("q")?.trim();

    const values: unknown[] = [];
    let where = "where 1=1";
    if (q) {
      values.push(`%${q}%`);
      where += ` and (c.name ilike $${values.length} or c.slug ilike $${values.length} or c.email ilike $${values.length})`;
    }

    const { rows } = await query(
      `select
          c.id,
          c.segment_id,
          bs.name as segment_name,
          bs.code as segment_code,
          c.name,
          c.trade_name,
          c.slug,
          c.whatsapp_number,
          c.phone,
          c.email,
          c.timezone,
          c.primary_color,
          c.secondary_color,
          c.accent_color,
          c.is_active,
          c.created_at,
          c.updated_at,
          count(cu.id)::int as users_count
        from companies c
        left join business_segments bs on bs.id = c.segment_id
        left join company_users cu on cu.company_id = c.id
        ${where}
        group by c.id, bs.id
        order by c.created_at desc`,
      values,
    );

    return ok({ companies: rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const body = createSchema.parse(await req.json());

    const segment = await query<{ id: string }>(
      `select id from business_segments where code = $1 limit 1`,
      [body.segment_code || "events"],
    );

    if (!segment.rows[0]) {
      throw new Error("Segmento informado não encontrado.");
    }

    const { rows } = await query(
      `insert into companies (
          segment_id,
          name,
          trade_name,
          slug,
          whatsapp_number,
          phone,
          email,
          timezone,
          primary_color,
          secondary_color,
          accent_color,
          is_active,
          branding,
          settings
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        returning *`,
      [
        segment.rows[0].id,
        body.name.trim(),
        body.trade_name?.trim() || body.name.trim(),
        body.slug.trim().toLowerCase(),
        body.whatsapp_number?.trim() || null,
        body.phone?.trim() || null,
        body.email?.trim() || null,
        body.timezone?.trim() || "America/Sao_Paulo",
        body.primary_color || "#d97706",
        body.secondary_color || "#111827",
        body.accent_color || "#f59e0b",
        body.is_active,
        { platform: "MB Agenda IA", powered_by: "MB Tech", logo_mode: "text" },
        { timezone: body.timezone || "America/Sao_Paulo" },
      ],
    );

    return created({ company: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
