# Radar API

API REST do **Radar iKasa** — módulo de aquisição e enriquecimento de CNPJs.

Responsável por:

- Autenticar operadores via JWT em cookie `httpOnly`.
- Gerenciar configurações de busca (`search_configs`).
- Buscar e enriquecer CNPJs via **API CNPJÁ** (`/office`, `/credit`).
- Aplicar pré-filtro ICP e persistir resultados no PostgreSQL.
- Disparar jobs manuais/agendados com guard de concorrência e cooldown por fingerprint.
- Expor SSE (`/api/v1/jobs/stream`) para notificações em tempo real.
- Consultar saldo de créditos CNPJÁ (`/api/v1/quota`).

---

## Stack

- **Node.js** ≥ 22 (LTS)
- **Fastify** 5.8.5
- **TypeScript** 5.x
- **PostgreSQL** 16
- **Drizzle ORM** + `postgres.js`
- **Zod** para validação
- **node-cron** para agendamento
- **bcryptjs** para hash de senhas
- **Docker + Docker Compose**

---

## Estrutura de Pastas

```
radar-api/
├── src/
│   ├── server.ts                 # Entry point — Fastify + logger + start
│   ├── app.ts                    # Registro de plugins, rotas e hooks
│   ├── config/env.ts             # Variáveis de ambiente validadas com Zod
│   ├── db/
│   │   ├── client.ts             # Conexão PostgreSQL via drizzle-orm
│   │   ├── schema.ts             # Definição das tabelas
│   │   └── migrate.ts            # Runner de migrations
│   ├── modules/
│   │   ├── auth/                 # Login, logout, /me, cookie JWT
│   │   ├── cnpj/                 # Companies, jobs/fetch, SSE stream, ICP filter
│   │   ├── config/               # CRUD de search_configs
│   │   └── quota/                # Consulta e cache de créditos CNPJÁ
│   ├── services/
│   │   └── cnpja.client.ts       # Client HTTP para api.cnpja.com
│   └── jobs/
│       ├── fetch-cnpjs.job.ts    # Job de busca e enriquecimento
│       ├── scheduler.ts          # Agendador dinâmico via node-cron
│       └── job-events.ts         # EventEmitter para SSE
├── migrations/                   # SQL versionado do Drizzle Kit
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste os valores reais.

```dotenv
# API CNPJÁ
CNPJA_TOKEN=seu_token_aqui
CNPJA_BASE_URL=https://api.cnpja.com
CNPJA_USER_AGENT=Radar-Ikasa-Automation/2.2
CNPJA_MAX_AGE=7
CNPJA_STRATEGY=CACHE_IF_FRESH
CNPJA_LIMIT_PER_PAGE=50
CNPJA_MAX_PAGES=20
CNPJA_ENRICHMENT_DELAY_MS=500
CNPJA_COOLDOWN_MINUTES=60

# PostgreSQL
DATABASE_URL=postgresql://radar:radar@db:5432/radar_ikasa

# Servidor
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Autenticação
JWT_SECRET=substitua_por_chave_forte_minimo_32_caracteres
JWT_EXPIRES_IN=24h
COOKIE_NAME=radar_session
# sameSite: 'none' é obrigatório quando frontend e API estão em domínios distintos.
# sameSite='none' exige COOKIE_SECURE=true e HTTPS no backend.
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false
ADMIN_EMAIL=admin@ikasa.com.br
ADMIN_PASSWORD=substitua_por_senha_forte
```

### Autenticação em produção cross-origin

Quando a API e o frontend ficam em domínios distintos (ex: Railway + Cloudflare Pages):

```dotenv
NODE_ENV=production
CORS_ORIGIN=https://<domínio-do-frontend>
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
```

O navegador rejeita cookies `sameSite='none'` sem `secure=true`. O backend precisa estar exposto via HTTPS.

---

## Comandos

### Desenvolvimento local

```bash
cd radar-api
npm install
npm run dev                  # tsx watch em localhost:3000
```

### Build e lint

```bash
npm run build                # compila TypeScript para dist/
npm run lint                 # ESLint
```

### Banco de dados

```bash
npm run migrate:dev          # aplica migrations via drizzle-kit
npm run db:generate          # gera novo SQL de migration
```

### Docker

```bash
# Stack completa (api + db + web)
cd ..
docker compose up -d --build

# Apenas API + DB
cd radar-api
docker compose up -d --build
```

---

## Rotas Principais

Base path: `/api/v1`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Healthcheck público |
| `POST` | `/auth/login` | Login, emite cookie JWT |
| `POST` | `/auth/logout` | Limpa cookie de sessão |
| `GET` | `/auth/me` | Usuário autenticado |
| `GET` | `/configs` | Lista configurações de busca |
| `GET` | `/configs/default` | Config padrão |
| `POST` | `/configs` | Cria configuração |
| `PUT` | `/configs/:id` | Atualiza configuração |
| `DELETE` | `/configs/:id` | Remove configuração |
| `PUT` | `/configs/:id/default` | Define config padrão |
| `GET` | `/companies` | Lista empresas (paginado/filtrado) |
| `GET` | `/companies/:cnpj` | Detalhe de uma empresa |
| `POST` | `/jobs/fetch` | Dispara job manual |
| `GET` | `/jobs` | Histórico de execuções |
| `GET` | `/jobs/stream` | SSE de eventos de job |
| `GET` | `/quota` | Saldo de créditos CNPJÁ |

Todas as rotas exceto `/health` e `/auth/login` exigem cookie JWT válido.

---

## Decisões Arquiteturais

- **Camadas:** `routes → service → repository`. Sem controllers extras.
- **Config padrão:** única no banco (`is_default = TRUE`).
- **Job agendado:** lê a config padrão e é re-agendado quando ela muda.
- **Cooldown:** buscas idênticas dentro de `CNPJA_COOLDOWN_MINUTES` retornam `409 Conflict`.
- **Guard de concorrência:** apenas um job `running` por vez; segundo disparo retorna `409`.
- **SSE:** notifica o frontend em tempo real sobre início/fim de jobs.
- **Quota:** snapshot dos créditos CNPJÁ é atualizado no `finally` de cada job.

---

## Links

- [AGENTS.md](../AGENTS.md) — instruções para agentes de código
- [UML-DIAGRAMAS.md](../UML-DIAGRAMAS.md) — diagramas da arquitetura
