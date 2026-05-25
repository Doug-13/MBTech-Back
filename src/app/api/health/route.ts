import { ok, handleError } from "@/lib/http";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await query<{ now: string }>("select now() as now");
    return ok({ status: "ok", database: "connected", now: rows[0].now });
  } catch (error) {
    return handleError(error);
  }
}
