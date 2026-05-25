import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { query } from "./db";

export type SessionKind = "company" | "platform";

type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  kind?: SessionKind;
  companyId?: string | null;
};

export type AuthSession = {
  userId: string;
  email: string;
  role: string;
  kind: SessionKind;
  companyId: string | null;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET não configurado.");
  return value;
}

export function signToken(payload: TokenPayload) {
  return jwt.sign(
    {
      ...payload,
      kind: payload.kind || "company",
      companyId: payload.companyId || null,
    },
    secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

export function verifyToken(token: string): AuthSession {
  const decoded = jwt.verify(token, secret()) as TokenPayload;
  return {
    userId: decoded.sub,
    companyId: decoded.companyId || null,
    email: decoded.email,
    role: decoded.role,
    kind: decoded.kind || "company",
  };
}

export async function getSession(req?: NextRequest): Promise<AuthSession | null> {
  const authorization = req?.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const cookieStore = await cookies();
  const token = bearer || cookieStore.get("mb_session")?.value;

  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(req?: NextRequest): Promise<AuthSession> {
  const session = await getSession(req);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireActiveCompanyUser(req?: NextRequest): Promise<AuthSession> {
  const session = await requireSession(req);
  if (session.kind !== "company" || !session.companyId) throw new Error("UNAUTHORIZED");

  const { rows } = await query(
    `select id from company_users where id = $1 and company_id = $2 and is_active = true limit 1`,
    [session.userId, session.companyId],
  );

  if (!rows[0]) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requirePlatformAdmin(req?: NextRequest): Promise<AuthSession> {
  const session = await requireSession(req);
  if (session.kind !== "platform") throw new Error("FORBIDDEN");

  const { rows } = await query(
    `select id from platform_admins where id = $1 and is_active = true limit 1`,
    [session.userId],
  );

  if (!rows[0]) throw new Error("UNAUTHORIZED");
  return session;
}
