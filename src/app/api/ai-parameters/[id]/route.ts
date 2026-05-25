import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, noContent, ok } from "@/lib/http";

const schema = z.object({
  parameter_key: z.string().min(2).transform((v) => v.trim().replace(/\s+/g, "_").toLowerCase()).optional(),
  parameter_value: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const { rows } = await query(
      `update ai_parameters set
          parameter_key = coalesce($3, parameter_key),
          parameter_value = coalesce($4, parameter_value),
          description = $5,
          is_active = coalesce($6, is_active),
          updated_at = now()
        where id = $1 and company_id = $2
        returning *`,
      [id, session.companyId, data.parameter_key || null, data.parameter_value || null, data.description ?? null, data.is_active ?? null],
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ param: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { id } = await context.params;
    const { rowCount } = await query(`delete from ai_parameters where id = $1 and company_id = $2`, [id, session.companyId]);
    if (!rowCount) throw new Error("NOT_FOUND");
    return noContent();
  } catch (error) {
    return handleError(error);
  }
}
