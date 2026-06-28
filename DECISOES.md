# Decisões de Implementação — Radar iKasa Backend

Este documento registra adaptações feitas durante a implementação quando a especificação original e a API real da CNPJÁ divergiram.

## 1. Endpoint de busca da CNPJÁ

**Especificação:** `GET /office/search` com parâmetros `municipio`, `uf`, `porte`, `situacao`, `limit`, `offset`.

**Realidade:** A API CNPJÁ expõe `GET /office` com parâmetros de filtro diferentes:
- `address.state.in` para UF (ex: `MA`).
- `address.municipality.in` para **código IBGE** do município (ex: `2111300`), não nome.
- `company.size.id.in` para porte (`1` = ME, `3` = EPP, `5` = Demais).
- `status.id.in` para situação cadastral (`2` = Ativa).
- `company.simples.optant.eq` para Simples Nacional.
- `founded.gte` / `founded.lte` para data de fundação.
- Paginação por `limit` + `token` (não `offset`).

**Decisão:** O cliente (`src/services/cnpja.client.ts`) foi adaptado para usar `/office` com os parâmetros reais. Foi adicionado um mapeamento interno de nome de município para código IBGE (`CITY_CODE_MAP`) e de siglas de porte para IDs da CNPJÁ. Quando o município não está no mapa, o código tenta interpretar o valor como código IBGE numérico.

## 2. Formato da resposta de `/office`

**Especificação:** Resposta simples array de empresas com `taxId`, `company`, `status`, `address`, etc.

**Realidade:** A resposta vem como `{ records: [...], next: "..." }`, onde cada registro já contém os campos completos (`taxId`, `alias`, `company`, `status`, `address`, `phones`, `emails`, `mainActivity`, etc.), no mesmo formato enriquecido de `/office/{cnpj}`.

**Decisão:** O parser foi ajustado para ler `records` e `next`. Como a resposta já traz dados enriquecidos (contatos, CNAE, sócios), o job utiliza esses dados diretamente para aplicar o pré-filtro ICP e persistir `raw_data` completo, **sem chamar `/office/{cnpj}` para cada CNPJ**.

Isso reduz drasticamente o consumo de créditos da API e evita o erro 429 observado em testes (`not enough credits`). O delay de `CNPJA_ENRICHMENT_DELAY_MS` (default 500ms) entre registros foi mantido para respeitar o espírito da regra de rate limiting.

## 3. Case da situação cadastral

**Especificação:** `company.status.text === 'ATIVA'`.

**Realidade:** A API retorna `"Ativa"` (title case).

**Decisão:** O filtro ICP normaliza o texto para maiúsculas antes de comparar.

## 4. Município no endereço

**Realidade:** `address.municipality` vem como código IBGE numérico (ex: `2111300`), enquanto `address.city` contém o nome (`São Luís`).

**Decisão:** O repositório utiliza `address.city ?? address.municipality` ao persistir o nome do município.

## 5. Créditos da API CNPJÁ

Durante os testes locais, a conta associada ao token esgotou os créditos (`HTTP 429 — not enough credits`). Por isso, o teste final de `POST /jobs/fetch` registrou o job em `job_runs` com status `error` e a mensagem de créditos insuficientes. O fluxo foi validado com sucesso em execução anterior (job run com `totalFetched: 50`, `status: success`), antes do esgotamento dos créditos.

### 5.1 Endpoint de consulta de saldo

**Investigação:** A documentação pública da CNPJÁ (`https://cnpja.com/api`) menciona apenas que o uso é controlado por créditos e limite de uso, mas não expõe o endpoint de saldo de forma explícita. Através do SDK oficial publicado no GitHub (`cnpja/sdk-nodejs`), identificou-se o endpoint:

- **URL:** `GET {CNPJA_BASE_URL}/credit`
- **Autenticação:** Header `Authorization: <cnpja_token>` (igual aos demais endpoints)
- **Contrato da resposta (`CreditoDto`):**

```typescript
export interface CreditoDto {
  perpetual: number  // Créditos acumulados de meses anteriores
  transient: number  // Créditos do mês atual
}
```

**Decisão:** O saldo total disponível será calculado como `perpetual + transient`. O campo `transient` representa os créditos do ciclo mensal atual (o plano do cliente menciona 50 créditos mensais). O campo `perpetual` representa créditos remanescentes de meses anteriores, se houver.

Essa descoberta foi feita a partir do código-fonte do SDK oficial: `source/credit/credit.service.ts` chama `this.httpService.get('credit')` e retorna `CreditoDto` definido em `source/cnpja/cnpja.dto.ts`.

**Teste com token ativo (27/06/2026):** `GET https://api.cnpja.com/credit` com o header `Authorization` retornou `HTTP 200` e payload `{"transient":0,"perpetual":7}`. O contrato do SDK foi confirmado sem divergências.

## 6. Validação de rotas

A especificação indica uso de Zod nos schemas do Fastify. O Fastify 5 nativamente espera JSON Schema; passar schemas Zod diretamente causou erro de build (`schema is invalid`).

**Decisão:** A validação é feita manualmente com `zod.safeParse` dentro dos handlers. Isso mantém a validação centralizada em Zod, sem adicionar dependências extras como `@fastify/zod`.

## 7. Tabela `cnpja_quota` — Snapshot de Créditos

**Decisão:** A coluna `total` é materializada no banco (calculada na inserção como `perpetual + transient`), em vez de ser computada em cada leitura. Isso evita recalcular a cada request e permite queries diretas sem joins ou cálculos.

O snapshot de quota é atualizado ao final de cada job (`executarFetchCnpjs`) em um bloco `finally`, garantindo que mesmo jobs com erro persistam o saldo de créditos mais recente. Falhas na atualização da quota são logadas mas não alteram o status do job.

## 8. Variáveis de ambiente

O `.env` real do projeto (`/media/neo/files/projetos/ikasa/radar/.env`) possui `CNPJA_BASE_URL` duplicado e nomes de variáveis legados (`CNPJA_LIMIT`, `CNPJA_CITY_FILTER`).

**Decisão:** O arquivo `.env.example` do backend usa apenas as variáveis necessárias e atualizadas. O código lê `CNPJA_BASE_URL` e `CNPJA_TOKEN` do `.env`; demais valores têm defaults seguros em `src/config/env.ts`.

## 9. Notificações internas — EventEmitter local

**Especificação original:** Sem especificação anterior; introduzido pelo planejamento da Story S2.

**Decisão:** Notificações de mudança de status do job são emitidas via `EventEmitter` nativo do Node.js (`node:events`), sem fila externa, mensageria ou banco de dados. O `JobEventEmitter` (em `src/jobs/job-events.ts`) é um singleton que estende `EventEmitter<JobEvents>` com tipagem forte TypeScript. Cada emissão (`job:started`, `job:status`) loga payload estruturado via Pino.

**Motivação:** Simplicidade máxima para o MVP — zero dependências, zero infraestrutura extra, operação síncrona em memória. O endpoint SSE (Story S1) consumirá estes eventos no futuro. Se houver necessidade de múltiplos processos ou escalabilidade horizontal, aí sim será avaliada uma fila externa (Redis Pub/Sub ou similar).

## 10. Notificações em tempo real — SSE vs WebSockets

**Especificação original:** Polling adaptativo (5s/30s) no frontend.

**Decisão:** Adotar Server-Sent Events (SSE) via `GET /api/v1/jobs/stream` com `Content-Type: text/event-stream` para notificações de mudança de status do job. Implementado com `reply.raw.write` do Fastify, sem bibliotecas externas.

**Motivação:** SSE é unidirecional (servidor → cliente), suficiente para notificações de job; usa HTTP puro sem necessidade de upgrade de protocolo; tem suporte nativo a reconnect via `EventSource` no navegador; não requer dependências externas. WebSockets seriam over-engineering para o caso de uso (bidirecional, exige biblioteca, mais complexidade operacional). Polling foi mantido como fallback com intervalo longo (30s).

## 11. Configurações de proxy para SSE

Para que o SSE funcione corretamente em todos os ambientes, as seguintes configurações de proxy foram aplicadas:

### 11.1 Produção — nginx (`radar-web/nginx.conf`)

Foi criado um bloco `location /api/v1/jobs/stream` dedicado, separado do proxy REST genérico `/api`:

- `proxy_http_version 1.1` — HTTP/1.1 é obrigatório para chunked transfer encoding.
- `proxy_buffering off` — impede que o nginx acumule a resposta antes de enviá-la ao cliente.
- `proxy_cache off` + `proxy_no_cache 1` — desabilitam cache de respostas SSE.
- `proxy_read_timeout 3600s` — permite conexões ociosas de até 1h sem keepalive ping.
- `proxy_set_header Connection ''` — evita `Connection: close` forçado.
- `add_header X-Accel-Buffering no` — header adicional para proxies intermediários.

O bloco `/api` REST permanece inalterado, garantindo que outras rotas não sejam afetadas.

### 11.2 Desenvolvimento — Vite proxy (`radar-web/vite.config.ts`)

O proxy do Vite para `/api` recebeu `timeout: 0`, evitando que o `http-proxy` do Node.js feche conexões SSE ociosas durante o desenvolvimento.

### 11.3 Docker Compose

Nenhuma alteração foi necessária em `docker-compose.yml`. O Docker não força fechamento de conexões TCP idle na rede bridge padrão. O healthcheck existente (`/health`) continua suficiente.

### 11.4 Load balancers e proxies cloud

Em ambientes cloud (ALB, ELB, Cloudflare, Traefik, etc.), é necessário garantir que:

- O idle timeout do load balancer seja maior ou igual ao `proxy_read_timeout` (≥ 3600s).
- O buffering esteja desabilitado no proxy intermediário.
- A CSP (`connect-src 'self' https:`) já é suficiente porque o SSE usa o mesmo domínio.
