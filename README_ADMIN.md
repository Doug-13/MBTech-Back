# Endpoints administrativos MB Tech

Execute o SQL `mb-tech-seed-platform-admin.sql` no Supabase para criar o primeiro admin da plataforma.

Login administrativo:

```txt
POST /api/admin/auth/login
```

Payload:

```json
{
  "email": "admin@mbtech.com.br",
  "password": "123456"
}
```

Rotas criadas:

```txt
GET    /api/admin/me
GET    /api/admin/companies
POST   /api/admin/companies
PATCH  /api/admin/companies/:id
GET    /api/admin/company-users?companyId=UUID_DA_EMPRESA
POST   /api/admin/company-users
PATCH  /api/admin/company-users/:id
```

As rotas exigem token JWT administrativo, gerado a partir da tabela `platform_admins`.
