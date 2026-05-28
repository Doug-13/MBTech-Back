import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireActiveCompanyUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

function normalizeDirection(direction: unknown) {
  const value = String(direction || "").toLowerCase().trim();

  if (
    value === "outbound" ||
    value === "sent" ||
    value === "send" ||
    value === "saida" ||
    value === "enviada" ||
    value === "ia" ||
    value === "ai" ||
    value === "assistant" ||
    value === "bot"
  ) {
    return "outbound";
  }

  return "inbound";
}

function normalizeMessage(row: any) {
  const direction = normalizeDirection(row.direction);
  const fromMe = direction === "outbound";

  const messageText = String(row.message_text || "").trim();
  const aiResponse = String(row.ai_response || "").trim();

  const message = fromMe
    ? aiResponse || messageText
    : messageText || aiResponse;

  return {
    id: row.id,
    company_id: row.company_id,
    conversation_id: row.conversation_id,
    customer_id: row.customer_id,
    channel_id: row.channel_id,

    provider: row.provider,
    channel: row.channel,

    phone: row.phone,
    external_user_id: row.external_user_id,

    direction,
    from_me: fromMe,
    is_from_me: fromMe,
    role: fromMe ? "assistant" : "user",

    message_type: row.message_type || "text",

    message,
    text: message,
    message_text: row.message_text || "",
    ai_response: row.ai_response || "",

    media_url: row.media_url || null,
    external_message_id: row.external_message_id || null,
    sent_by: row.sent_by || null,

    raw_payload: row.raw_payload || {},
    metadata: row.metadata || {},

    created_at: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveCompanyUser(req);

    const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim();

    if (!conversationId) {
      return NextResponse.json(
        {
          error: "ID da conversa não informado.",
          messages: [],
        },
        { status: 400 }
      );
    }

    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 300),
      500
    );

    console.log("[BACK][CONVERSATION_MESSAGES] request =>", {
      companyId: session.companyId,
      conversationId,
      limit,
    });

    const conversationResult = await query(
      `
      select *
        from vw_conversation_list
       where company_id = $1
         and id = $2
       limit 1
      `,
      [session.companyId, conversationId]
    );

    if (conversationResult.rows.length === 0) {
      console.warn("[BACK][CONVERSATION_MESSAGES] conversa não encontrada =>", {
        companyId: session.companyId,
        conversationId,
      });

      return NextResponse.json(
        {
          error: "Conversa não encontrada para esta empresa.",
          conversation: null,
          messages: [],
        },
        { status: 404 }
      );
    }

    const conversationRow = conversationResult.rows[0];

    const messagesResult = await query(
      `
      select
        id,
        company_id,
        conversation_id,
        customer_id,
        channel_id,
        provider,
        channel,
        phone,
        external_user_id,
        direction,
        message_type,
        message_text,
        ai_response,
        media_url,
        external_message_id,
        sent_by,
        raw_payload,
        metadata,
        created_at
      from messages
      where company_id = $1
        and conversation_id = $2
      order by created_at asc
      limit $3
      `,
      [session.companyId, conversationId, limit]
    );

    const messages = messagesResult.rows
      .map(normalizeMessage)
      .filter((item) => String(item.message || "").trim() !== "");

    console.log("[BACK][CONVERSATION_MESSAGES] response =>", {
      companyId: session.companyId,
      conversationId,
      totalRows: messagesResult.rows.length,
      messageCount: messages.length,
    });

    return ok({
      conversation: {
        id: conversationRow.id,
        company_id: conversationRow.company_id,
        company_name: conversationRow.company_name,

        channel_id: conversationRow.channel_id,
        channel_name: conversationRow.channel_name,

        customer_id: conversationRow.customer_id,

        provider: conversationRow.provider,
        channel: conversationRow.channel,
        external_user_id: conversationRow.external_user_id,

        customer_name:
          conversationRow.customer_name ||
          conversationRow.customer_name_from_table ||
          "Cliente sem nome",

        customer_phone:
          conversationRow.customer_phone ||
          conversationRow.customer_phone_from_table ||
          "",

        customer_username:
          conversationRow.customer_username ||
          conversationRow.customer_username_from_table ||
          "",

        status: conversationRow.status,
        last_message: conversationRow.last_message,
        ai_summary: conversationRow.ai_summary,
        human_review_required: Boolean(conversationRow.human_review_required),

        last_message_at: conversationRow.last_message_at,
        created_at: conversationRow.created_at,
        updated_at: conversationRow.updated_at,
      },

      messages,
    });
  } catch (error) {
    return handleError(error);
  }
}