import type { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { created, handleError, ok, parseSearchParams } from "@/lib/http";
import { hashPassword } from "@/lib/password";

const createSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional().default("admin"),
  is_active: z.boolean().optional().default(true),
  permissions: z.record(z.unknown()).optional(),
});

function defaultPermissions(role: string) {
  if (role === "viewer") {
    return {
      can_manage_company: false,
      can_manage_channels: false,
      can_manage_ai: false,
      can_manage_appointments: false,
      can_manage_customers: false,
    };
  }

  if (role === "manager") {
    return {
      can_manage_company: false,
      can_manage_channels: false,
      can_manage_ai: true,
      can_manage_appointments: true,
      can_manage_customers: true,
    };
  }

  return {
    can_manage_company: true,
    can_manage_channels: true,
    can_manage_ai: true,
    can_manage_appointments: true,
    can_manage_customers: true,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const params = parseSearchParams(req);
    const companyId = params.get("companyId");

    const values: unknown[] = [];
    let where = "where 1=1";
    if (companyId) {
      values.push(companyId);
      where += ` and u.company_id = $${values.length}`;
    }

    const { rows } = await query(
      `select
          u.id,
          u.company_id,
          c.name as company_name,
          u.name,
          u.email,
          u.role,
          coalesce(u.permissions, '{}'::jsonb) as permissions,
          u.is_active,
          u.created_at,
          u.updated_at
        from company_users u
        join companies c on c.id = u.company_id
        ${where}
        order by c.name asc, u.name asc`,
      values,
    );

    return ok({ users: rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);
    const body = createSchema.parse(await req.json());

    const company = await query(`select id from companies where id = $1 limit 1`, [body.company_id]);
    if (!company.rows[0]) throw new Error("Empresa não encontrada.");

    const passwordHash = await hashPassword(body.password);
    const permissions = body.permissions || defaultPermissions(body.role);

    const { rows } = await query(
      `insert into company_users (
          company_id,
          name,
          email,
          password_hash,
          role,
          permissions,
          is_active
        ) values ($1,$2,$3,$4,$5,$6,$7)
        returning id, company_id, name, email, role, permissions, is_active, created_at, updated_at`,
      [
        body.company_id,
        body.name.trim(),
        body.email.trim().toLowerCase(),
        passwordHash,
        body.role,
        permissions,
        body.is_active,
      ],
    );

    return created({ user: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
