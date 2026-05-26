import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://mb-tech.vercel.app",
];

function getCorsOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (!origin) {
    return "*";
  }

  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0];
}

function corsHeaders(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

async function readRequestBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  const text = await req.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawTextBody: text,
    };
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const n8nWebhookUrl = process.env.N8N_TEST_CHAT_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error("[CHAT_WIDGET_PROXY] N8N_TEST_CHAT_WEBHOOK_URL não configurada.");

      return NextResponse.json(
        {
          success: false,
          error: "N8N_TEST_CHAT_WEBHOOK_URL não configurada no backend.",
        },
        {
          status: 500,
          headers: corsHeaders(req),
        }
      );
    }

    const payload = await readRequestBody(req);

    console.log("[CHAT_WIDGET_PROXY] Payload recebido do front:", {
      channel: payload?._channel || payload?.channel,
      clientId: payload?.clientId,
      clientName: payload?.clientName,
      name: payload?.name || payload?.nome,
      phone: payload?.phone || payload?.number,
      message: payload?.message || payload?.text || payload?.mensagem,
      n8nWebhookUrl,
    });

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await n8nResponse.text();

    let responseJson: any = null;

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = {
        rawResponse: responseText,
      };
    }

    console.log("[CHAT_WIDGET_PROXY] Resposta do n8n:", {
      ok: n8nResponse.ok,
      status: n8nResponse.status,
      elapsedMs: Date.now() - startedAt,
      responseJson,
    });

    if (!n8nResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao chamar o workflow n8n.",
          status: n8nResponse.status,
          details: responseJson,
        },
        {
          status: n8nResponse.status,
          headers: corsHeaders(req),
        }
      );
    }

    const reply =
      responseJson?.reply ||
      responseJson?.response ||
      responseJson?.message ||
      responseJson?.text ||
      responseJson?.output ||
      responseJson?.resposta ||
      responseJson?.responseText ||
      responseJson?.rawResponse ||
      "Recebi sua mensagem, mas o n8n não retornou uma resposta reconhecida.";

    return NextResponse.json(
      {
        success: true,
        reply,
        response: reply,
        message: reply,
        channel: responseJson?.channel || "web-widget-test",
        n8n: responseJson,
      },
      {
        status: 200,
        headers: corsHeaders(req),
      }
    );
  } catch (error: any) {
    console.error("[CHAT_WIDGET_PROXY] Erro inesperado:", {
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Erro inesperado ao processar chat widget.",
        message: error?.message || "Erro desconhecido.",
      },
      {
        status: 500,
        headers: corsHeaders(req),
      }
    );
  }
}