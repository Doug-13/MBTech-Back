import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { handleError } from "@/lib/http";
import { comparePassword } from "@/lib/password";
import { signToken } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    const { rows } = await query<{
      id: string;
      company_id: string;
      name: string;
      email: string;
      password_hash: string;
      role: string;
      permissions: Record<string, unknown>;
      company_name: string;
      company_slug: string;
      whatsapp_number: string | null;
      timezone: string | null;
      branding: Record<string, unknown>;
    }>(
      `select
          u.id,
          u.company_id,
          u.name,
          u.email,
          u.password_hash,
          u.role,
          coalesce(u.permissions, '{}'::jsonb) as permissions,
          c.name as company_name,
          c.slug as company_slug,
          c.whatsapp_number,
          c.timezone,
          coalesce(c.branding, '{}'::jsonb) as branding
        from company_users u
        join companies c on c.id = u.company_id
       where lower(u.email) = lower($1)
         and u.is_active = true
         and c.is_active = true
       limit 1`,
      [body.email.trim()],
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const valid = await comparePassword(body.password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const token = signToken({
      sub: user.id,
      companyId: user.company_id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      token,
      user: {
        id: user.id,
        company_id: user.company_id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      company: {
        id: user.company_id,
        name: user.company_name,
        slug: user.company_slug,
        whatsapp_number: user.whatsapp_number,
        timezone: user.timezone || "America/Sao_Paulo",
        branding: user.branding,
      },
    });

    response.cookies.set("mb_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return handleError(error);
  }
}
