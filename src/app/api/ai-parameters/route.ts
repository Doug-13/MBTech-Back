import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { created, handleError, ok } from "@/lib/http";

const schema = z.object({
  parameter_key: z.string().min(2).transform((v) => v.trim().replace(/\s+/g, "_").toLowerCase()),
  parameter_value: z.string().min(1),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

    const { rows } = await query(
      `select *
         from ai_parameters
        where company_id = $1
          and ($2::boolean = false or is_active = true)
        order by parameter_key asc`,
      [session.companyId, activeOnly],
    );

    return ok({ params: rows, ai_parameters: rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const data = schema.parse(await req.json());

    const { rows } = await query(
      `insert into ai_parameters (
          company_id,
          parameter_key,
          parameter_value,
          description,
          is_active
        ) values ($1,$2,$3,$4,$5)
        on conflict (company_id, parameter_key) do update set
          parameter_value = excluded.parameter_value,
          description = excluded.description,
          is_active = excluded.is_active,
          updated_at = now()
        returning *`,
      [session.companyId, data.parameter_key, data.parameter_value, data.description || null, data.is_active],
    );

    return created({ param: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
