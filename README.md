# MB Tech Next Backend

Backend Next.js/API Routes para a tela **MB Agenda IA** usando PostgreSQL/Supabase.

## O que este backend cobre

- Login de usuários da empresa (`company_users`).
- Sessão via JWT em cookie HTTP-only e retorno de token para uso no front.
- Dashboard com métricas de conversas, eventos e atendimentos recentes.
- Agenda/eventos usando `appointments`, `customers` e `vw_appointments_list`.
- Conversas WhatsApp/Instagram/Facebook usando `conversations`, `messages` e `vw_conversation_list`.
- Parâmetros da IA usando `ai_parameters`.
- Endpoints para N8N consultar contexto da empresa e registrar mensagens normalizadas.

## Pré-requisitos

1. Executar no Supabase o arquivo SQL do banco: `mb_tech_ajuste_banco_atual_supabase.sql`.
2. Ter Node.js 20+ instalado.
3. Ter a string de conexão PostgreSQL do Supabase.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

A API sobe em:

```txt
http://localhost:3001
```

## Variáveis de ambiente

Crie `.env.local`:

```env
DATABASE_URL="postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="troque-este-segredo-em-producao"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"
```

## Endpoints principais para o front

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@danonagourmet.com",
  "password": "123456"
}
```

### Sessão atual

```http
GET /api/auth/me
Authorization: Bearer TOKEN
```

### Dashboard

```http
GET /api/dashboard
Authorization: Bearer TOKEN
```

Retorna:

```json
{
  "today": "2026-05-09",
  "stats": {
    "total_chats": 0,
    "new_leads": 0,
    "contracts_requested": 0,
    "events_created": 0,
    "pending_human_review": 0,
    "conversion_rate": 0,
    "avg_response_time_seconds": 0,
    "weekly": [0, 0, 0, 0, 0, 0, 0],
    "recent": []
  },
  "events": []
}
```

### Agenda/eventos

```http
GET /api/appointments
POST /api/appointments
GET /api/appointments/:id
PATCH /api/appointments/:id
DELETE /api/appointments/:id
```

Body para criar evento:

```json
{
  "customer_name": "Mariana Souza",
  "customer_phone": "51999999999",
  "document": "123.456.789-10",
  "event_type": "Casamento",
  "event_date": "2026-05-09",
  "event_time": "19:00",
  "guests": 120,
  "status": "confirmado",
  "room_name": "Espaço Jardim das Flores",
  "room_address": "Av. Central, 900 - Porto Alegre/RS",
  "ceremonial_contact": "Ana Cerimonial - 51988887777",
  "street": "Rua das Palmeiras",
  "number": "145",
  "district": "Centro",
  "city": "Porto Alegre",
  "zip_code": "90000-000",
  "notes": "Cascata de chocolate meio amargo. Montagem às 16h."
}
```

### Parâmetros IA

```http
GET /api/ai-parameters
POST /api/ai-parameters
PATCH /api/ai-parameters/:id
DELETE /api/ai-parameters/:id
```

Body:

```json
{
  "parameter_key": "servicos_oferecidos",
  "parameter_value": "Cascata de chocolate, fondue e buffet quente completo.",
  "description": "Serviços que a IA pode informar ao cliente.",
  "is_active": true
}
```

### Conversas

```http
GET /api/conversations
GET /api/conversations?humanReview=true
GET /api/conversations?channel=whatsapp&q=contrato
```

## Endpoints para N8N

### Contexto da empresa para IA

```http
GET /api/n8n/company-context?slug=danona-gourmet
GET /api/n8n/company-context?whatsappNumber=555192883720
GET /api/n8n/company-context?companyId=UUID
```

### Registrar mensagem normalizada

```http
POST /api/n8n/messages/register
Content-Type: application/json

{
  "provider": "meta",
  "channel": "whatsapp",
  "resolver_key": "555192883720",
  "external_user_id": "5551999999999@s.whatsapp.net",
  "phone": "5551999999999",
  "customer_name": "Ana Paula",
  "direction": "inbound",
  "message_type": "text",
  "message_text": "Olá! Gostaria de saber sobre buffet para casamento.",
  "external_message_id": "wamid.xxxxx",
  "ai_summary": "Interesse em casamento.",
  "human_review_required": false,
  "raw_payload": {},
  "metadata": {}
}
```

> `resolver_key` deve bater com `messaging_channels.phone_number_id`, `display_phone_number`, `instagram_business_account_id` ou `facebook_page_id`.

## Ajuste no front

Depois de fazer login, salve o token retornado e envie nas chamadas:

```js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function api(path, options = {}) {
  const token = localStorage.getItem("mb_token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Erro na API");
  return data;
}
```
