# Decisões de Implementação — Radar iKasa Backend

Este documento registra adaptações feitas durante a implementação quando a especificação (`SPEC-BACK.md`) e a API real da CNPJÁ divergiram.

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

## 6. Validação de rotas

A especificação indica uso de Zod nos schemas do Fastify. O Fastify 5 nativamente espera JSON Schema; passar schemas Zod diretamente causou erro de build (`schema is invalid`).

**Decisão:** A validação é feita manualmente com `zod.safeParse` dentro dos handlers. Isso mantém a validação centralizada em Zod, sem adicionar dependências extras como `@fastify/zod`.

## 7. Variáveis de ambiente

O `.env` real do projeto (`/media/neo/files/projetos/ikasa/radar/.env`) possui `CNPJA_BASE_URL` duplicado e nomes de variáveis legados (`CNPJA_LIMIT`, `CNPJA_CITY_FILTER`).

**Decisão:** O arquivo `.env.example` do backend usa apenas as variáveis necessárias e atualizadas. O código lê `CNPJA_BASE_URL` e `CNPJA_TOKEN` do `.env`; demais valores têm defaults seguros em `src/config/env.ts`.
