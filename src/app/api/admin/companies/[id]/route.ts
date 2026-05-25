import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleError, ok } from "@/lib/http";
import { query } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  trade_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  primary_color: z.string().optional().nullable(),
  secondary_color: z.string().optional().nullable(),
  accent_color: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());

    const fields: string[] = [];
    const values: unknown[] = [];

    Object.entries(body).forEach(([key, value]) => {
      values.push(value === "" ? null : value);
      fields.push(`${key} = $${values.length}`);
    });

    if (!fields.length) throw new Error("Nenhum campo para atualizar.");

    values.push(id);
    const { rows } = await query(
      `update companies set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ company: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
