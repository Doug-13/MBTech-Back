import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleError, ok } from "@/lib/http";
import { hashPassword } from "@/lib/password";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  permissions: z.record(z.unknown()).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin(req);
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      values.push(body.name.trim());
      fields.push(`name = $${values.length}`);
    }
    if (body.email !== undefined) {
      values.push(body.email.trim().toLowerCase());
      fields.push(`email = $${values.length}`);
    }
    if (body.role !== undefined) {
      values.push(body.role);
      fields.push(`role = $${values.length}`);
    }
    if (body.is_active !== undefined) {
      values.push(body.is_active);
      fields.push(`is_active = $${values.length}`);
    }
    if (body.permissions !== undefined) {
      values.push(body.permissions);
      fields.push(`permissions = $${values.length}`);
    }
    if (body.password && body.password.trim()) {
      values.push(await hashPassword(body.password));
      fields.push(`password_hash = $${values.length}`);
    }

    if (!fields.length) throw new Error("Nenhum campo para atualizar.");

    values.push(id);
    const { rows } = await query(
      `update company_users
          set ${fields.join(", ")}
        where id = $${values.length}
        returning id, company_id, name, email, role, permissions, is_active, created_at, updated_at`,
      values,
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ user: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
