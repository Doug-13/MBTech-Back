import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handleError, ok } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePlatformAdmin(req);
    const { rows } = await query(
      `select id, name, email, role, is_active, created_at, updated_at
         from platform_admins
        where id = $1
        limit 1`,
      [session.userId],
    );
    return ok({ user: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
