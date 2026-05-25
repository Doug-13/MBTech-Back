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
      name: string;
      email: string;
      password_hash: string;
      role: string;
    }>(
      `select id, name, email, password_hash, role
         from platform_admins
        where lower(email) = lower($1)
          and is_active = true
        limit 1`,
      [body.email.trim()],
    );

    const admin = rows[0];
    if (!admin) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const valid = await comparePassword(body.password, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const token = signToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      kind: "platform",
      companyId: null,
    });

    const response = NextResponse.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        kind: "platform",
      },
      company: null,
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
