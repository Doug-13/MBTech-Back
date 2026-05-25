import { z } from "zod";
import { tx } from "@/lib/db";
import { created, handleError } from "@/lib/http";

const schema = z.object({
  provider: z.string().default("meta"),
  channel: z.enum(["whatsapp", "instagram", "facebook", "messenger", "webchat", "other"]).default("whatsapp"),
  resolver_key: z.string().min(1, "Informe phone_number_id, display_phone_number, instagram_business_account_id ou facebook_page_id."),

  external_user_id: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  push_name: z.string().optional().nullable(),
  username: z.string().optional().nullable(),

  direction: z.enum(["inbound", "outbound"]),
  message_type: z.string().default("text"),
  message_text: z.string().optional().nullable(),
  ai_response: z.string().optional().nullable(),
  media_url: z.string().optional().nullable(),
  external_message_id: z.string().optional().nullable(),
  sent_by: z.string().optional().nullable(),

  human_review_required: z.boolean().optional(),
  ai_summary: z.string().optional().nullable(),
  raw_payload: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
});

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());

    const result = await tx(async (client) => {
      const channelResult = await client.query(
        `select * from resolve_messaging_channel($1,$2,$3)`,
        [data.provider, data.channel, data.resolver_key],
      );

      const channel = channelResult.rows[0];
      if (!channel) {
        throw new Error("Canal não encontrado. Verifique phone_number_id/display_phone_number/instagram_business_account_id/facebook_page_id em messaging_channels.");
      }

      const customerResult = await client.query(
        `select * from get_or_create_customer($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          channel.company_id,
          channel.channel_id,
          data.provider,
          data.channel,
          data.external_user_id || null,
          data.phone || null,
          data.customer_name || null,
          data.push_name || null,
          data.username || null,
          data.direction === "inbound" ? "mensagem_recebida" : "mensagem_enviada",
          JSON.stringify(data.metadata),
        ],
      );
      const customer = customerResult.rows[0];

      const conversationResult = await client.query(
        `select * from get_or_create_conversation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          channel.company_id,
          channel.channel_id,
          customer.id,
          data.provider,
          data.channel,
          data.external_user_id || null,
          data.customer_name || customer.name || null,
          data.phone || customer.phone || null,
          data.username || null,
          JSON.stringify(data.metadata),
        ],
      );
      const conversation = conversationResult.rows[0];

      const messageResult = await client.query(
        `select * from register_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb)`,
        [
          channel.company_id,
          conversation.id,
          customer.id,
          channel.channel_id,
          data.provider,
          data.channel,
          data.phone || customer.phone || null,
          data.external_user_id || null,
          data.direction,
          data.message_type,
          data.message_text || null,
          data.ai_response || null,
          data.media_url || null,
          data.external_message_id || null,
          data.sent_by || null,
          JSON.stringify(data.raw_payload),
          JSON.stringify(data.metadata),
        ],
      );
      const message = messageResult.rows[0];

      if (data.human_review_required !== undefined || data.ai_summary) {
        await client.query(
          `update conversations set
              human_review_required = coalesce($3, human_review_required),
              ai_summary = coalesce($4, ai_summary),
              updated_at = now()
            where id = $1 and company_id = $2`,
          [conversation.id, channel.company_id, data.human_review_required ?? null, data.ai_summary || null],
        );
      }

      await client.query(
        `insert into integration_logs (
          company_id, channel_id, conversation_id, provider, channel, workflow_name, event_type, status, message, payload, response
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
        [
          channel.company_id,
          channel.channel_id,
          conversation.id,
          data.provider,
          data.channel,
          "n8n_message_register",
          "message_registered",
          "success",
          "Mensagem registrada com sucesso via API Next.js.",
          JSON.stringify(data.raw_payload),
          JSON.stringify({ message_id: message.id, conversation_id: conversation.id, customer_id: customer.id }),
        ],
      );

      return { channel, customer, conversation, message };
    });

    return created(result);
  } catch (error) {
    return handleError(error);
  }
}
