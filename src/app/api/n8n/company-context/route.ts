import { query } from "@/lib/db";
import { handleError, ok } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const companyId = params.get("companyId");
    const slug = params.get("slug");
    const whatsappNumber = params.get("whatsappNumber") || params.get("phone");

    if (!companyId && !slug && !whatsappNumber) {
      return ok({ error: "Informe companyId, slug ou whatsappNumber." }, 400);
    }

    const { rows } = await query(
      `select *
         from vw_company_context_for_ai
        where ($1::uuid is null or company_id = $1::uuid)
          and ($2::text is null or company_slug = $2)
          and ($3::text is null or whatsapp_number = $3)
        limit 1`,
      [companyId || null, slug || null, whatsappNumber || null],
    );

    if (!rows[0]) throw new Error("NOT_FOUND");
    return ok({ context: rows[0] });
  } catch (error) {
    return handleError(error);
  }
}
