import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);

    const { rows } = await query(
      `select
          u.id,
          u.company_id,
          u.name,
          u.email,
          u.role,
          coalesce(u.permissions, '{}'::jsonb) as permissions,
          c.name as company_name,
          c.slug as company_slug,
          c.whatsapp_number,
          c.timezone,
          coalesce(c.branding, '{}'::jsonb) as branding
        from company_users u
        join companies c on c.id = u.company_id
       where u.id = $1 and u.company_id = $2
       limit 1`,
      [session.userId, session.companyId],
    );

    const row = rows[0];
    if (!row) throw new Error("UNAUTHORIZED");

    return ok({
      user: {
        id: row.id,
        company_id: row.company_id,
        name: row.name,
        email: row.email,
        role: row.role,
        permissions: row.permissions,
      },
      company: {
        id: row.company_id,
        name: row.company_name,
        slug: row.company_slug,
        whatsapp_number: row.whatsapp_number,
        timezone: row.timezone || "America/Sao_Paulo",
        branding: row.branding,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
