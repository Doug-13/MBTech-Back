import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);
    const { rows } = await query(
      `select
          c.*,
          bs.code as segment_code,
          bs.name as segment_name,
          bs.default_labels
        from companies c
        left join business_segments bs on bs.id = c.segment_id
       where c.id = $1
       limit 1`,
      [session.companyId],
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ company: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
