import { sql } from 'drizzle-orm'
import { pgTable, serial, text, boolean, date, timestamp, integer, char, jsonb, index, uniqueIndex, doublePrecision } from 'drizzle-orm/pg-core'

export const searchConfigs = pgTable(
  'search_configs',
  {
    id: serial('id').primaryKey(),
    nome: text('nome').notNull(),
    municipio: text('municipio').notNull().default('São Luís'),
    uf: char('uf', { length: 2 }).notNull().default('MA'),
    portes: text('portes').notNull().default('ME,EPP,MEI'),
    situacao: text('situacao').notNull().default('ATIVA'),
    simplesNacional: boolean('simples_nacional'),
    fundacaoDe: date('fundacao_de'),
    fundacaoAte: date('fundacao_ate'),
    cronSchedule: text('cron_schedule').notNull().default('0 8 * * 1-5'),
    agendamentoAtivo: boolean('agendamento_ativo').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    defaultUnique: uniqueIndex('idx_search_configs_default').on(table.isDefault).where(sql`${table.isDefault} = true`),
  }),
)

export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    cnpj: char('cnpj', { length: 14 }).notNull().unique(),
    razaoSocial: text('razao_social'),
    nomeFantasia: text('nome_fantasia'),
    situacao: text('situacao').notNull(),
    porte: text('porte'),
    regime: text('regime'),
    simplesOptante: boolean('simples_optante'),
    dataAbertura: date('data_abertura'),
    cnaePrincipal: text('cnae_principal'),
    cnaeDescricao: text('cnae_descricao'),
    municipio: text('municipio'),
    uf: char('uf', { length: 2 }),
    telefone: text('telefone'),
    email: text('email'),
    socios: jsonb('socios'),
    rawData: jsonb('raw_data').notNull(),
    icpAprovado: boolean('icp_aprovado').notNull().default(false),
    icpMotivo: text('icp_motivo'),
    score: integer('score'),
    tier: text('tier'),
    statusPipeline: text('status_pipeline').notNull().default('novo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    situacaoIdx: index('idx_companies_situacao').on(table.situacao),
    porteIdx: index('idx_companies_porte').on(table.porte),
    icpIdx: index('idx_companies_icp').on(table.icpAprovado),
    tierIdx: index('idx_companies_tier').on(table.tier),
    municipioIdx: index('idx_companies_municipio').on(table.municipio),
    createdAtIdx: index('idx_companies_created_at').on(table.createdAt),
  }),
)

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    nome: text('nome').notNull(),
    role: text('role').notNull().default('admin'),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  }),
)

export const jobRuns = pgTable('job_runs', {
  id: serial('id').primaryKey(),
  jobName: text('job_name').notNull(),
  configId: integer('config_id').references(() => searchConfigs.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  configFingerprint: text('config_fingerprint'),
  configSnapshot: jsonb('config_snapshot'),
  triggerType: text('trigger_type').notNull().default('scheduled'),
  status: text('status').notNull(),
  totalFetched: integer('total_fetched').default(0),
  totalApproved: integer('total_approved').default(0),
  totalRejected: integer('total_rejected').default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const cnpjaQuota = pgTable('cnpja_quota', {
  id: serial('id').primaryKey(),
  perpetual: doublePrecision('perpetual').notNull(),
  transient: doublePrecision('transient').notNull(),
  total: doublePrecision('total').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})
