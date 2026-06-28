import { eq, sql, and, ilike, or, gte, desc } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { companies, jobRuns, searchConfigs, users } from '../../db/schema.js'
import type { CnpjaCompany } from '../../services/cnpja.client.js'
import type { CompanyDetail, CompanyListItem, JobRun, TriggeredBy, UpsertCompanyInput } from './cnpj.types.js'
import type { SearchConfig } from '../config/config.types.js'

function normalizePhone(phones: CnpjaCompany['phones']): string | null {
  if (phones.length === 0) return null
  const phone = phones[0]
  return `${phone.area}${phone.number}`
}

function buildRawInsert(input: UpsertCompanyInput) {
  const raw = input.rawData
  const company = raw.company
  const size = company.size
  const simples = company.simples
  const simei = company.simei

  return {
    cnpj: raw.taxId,
    razaoSocial: company.name,
    nomeFantasia: raw.alias,
    situacao: raw.status.text,
    porte: size?.acronym ?? null,
    regime: resolveRegime(simples, simei),
    simplesOptante: simples?.optant ?? null,
    dataAbertura: raw.founded ?? null,
    cnaePrincipal: raw.mainActivity ? String(raw.mainActivity.id) : null,
    cnaeDescricao: raw.mainActivity?.text ?? null,
    municipio: raw.address.city ?? raw.address.municipality,
    uf: raw.address.state,
    telefone: normalizePhone(raw.phones),
    email: raw.emails[0]?.address ?? null,
    socios: raw.partners,
    rawData: raw as unknown as Record<string, unknown>,
    icpAprovado: input.icp.aprovado,
    icpMotivo: input.icp.motivo ?? null,
    updatedAt: new Date(),
  }
}

function resolveRegime(simples: CnpjaCompany['company']['simples'], simei: CnpjaCompany['company']['simei']): string | null {
  if (simei?.optant) return 'MEI'
  if (simples?.optant) return 'SIMPLES'
  return null
}

export async function upsertCompany(input: UpsertCompanyInput): Promise<void> {
  const values = buildRawInsert(input)

  const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.cnpj, values.cnpj)).limit(1)

  if (existing.length > 0) {
    await db.update(companies).set(values).where(eq(companies.id, existing[0].id))
    return
  }

  await db.insert(companies).values({ ...values, createdAt: new Date() })
}

function mapCompanyList(row: typeof companies.$inferSelect): CompanyListItem {
  return {
    id: row.id,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    situacao: row.situacao,
    porte: row.porte,
    regime: row.regime,
    municipio: row.municipio,
    uf: row.uf,
    telefone: row.telefone,
    email: row.email,
    icpAprovado: row.icpAprovado,
    score: row.score,
    tier: row.tier,
    statusPipeline: row.statusPipeline,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapCompanyDetail(row: typeof companies.$inferSelect): CompanyDetail {
  return {
    ...mapCompanyList(row),
    simplesOptante: row.simplesOptante,
    dataAbertura: row.dataAbertura,
    cnaePrincipal: row.cnaePrincipal,
    cnaeDescricao: row.cnaeDescricao,
    socios: row.socios,
    rawData: row.rawData as unknown as CnpjaCompany,
    icpMotivo: row.icpMotivo,
  }
}

export async function listCompanies(options: {
  page: number
  limit: number
  icpAprovado?: boolean
  porte?: string
  tier?: string
  q?: string
}): Promise<{ data: CompanyListItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
  const filters = []

  if (options.icpAprovado !== undefined) filters.push(eq(companies.icpAprovado, options.icpAprovado))
  if (options.porte) filters.push(eq(companies.porte, options.porte))
  if (options.tier) filters.push(eq(companies.tier, options.tier))
  if (options.q) {
    const term = `%${options.q}%`
    filters.push(or(ilike(companies.razaoSocial, term), ilike(companies.cnpj, term), ilike(companies.nomeFantasia, term)))
  }

  const where = filters.length > 0 ? and(...filters) : undefined

  const countRows = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(companies).where(where)
  const total = countRows[0]?.count ?? 0

  const rows = await db
    .select()
    .from(companies)
    .where(where)
    .orderBy(sql`${companies.createdAt} DESC`)
    .limit(options.limit)
    .offset((options.page - 1) * options.limit)

  return {
    data: rows.map(mapCompanyList),
    meta: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    },
  }
}

export async function getCompanyByCnpj(cnpj: string): Promise<CompanyDetail | null> {
  const rows = await db.select().from(companies).where(eq(companies.cnpj, cnpj)).limit(1)
  if (rows.length === 0) return null
  return mapCompanyDetail(rows[0])
}

export async function createJobRun(payload: {
  jobName: string
  configId: number | null
  userId?: number
  configFingerprint?: string
  configSnapshot: SearchConfig
  triggerType: string
  status: string
}): Promise<number> {
  const rows = await db
    .insert(jobRuns)
    .values({
      jobName: payload.jobName,
      configId: payload.configId,
      userId: payload.userId ?? null,
      configFingerprint: payload.configFingerprint ?? null,
      configSnapshot: payload.configSnapshot as unknown as Record<string, unknown>,
      triggerType: payload.triggerType,
      status: payload.status,
    })
    .returning({ id: jobRuns.id })

  return rows[0].id
}

export async function createJobRunIfIdle(payload: {
  jobName: string
  configId: number | null
  userId?: number
  configFingerprint?: string
  configSnapshot: SearchConfig
  triggerType: string
  status: string
}): Promise<{ id: number } | null> {
  return db.transaction(async (tx) => {
    const [running] = await tx.execute(
      sql`SELECT id FROM job_runs WHERE status = 'running' LIMIT 1 FOR UPDATE`,
    )
    if (running) return null

    const rows = await tx
      .insert(jobRuns)
      .values({
        jobName: payload.jobName,
        configId: payload.configId,
        userId: payload.userId ?? null,
        configFingerprint: payload.configFingerprint ?? null,
        configSnapshot: payload.configSnapshot as unknown as Record<string, unknown>,
        triggerType: payload.triggerType,
        status: payload.status,
      })
      .returning({ id: jobRuns.id })

    return rows[0]
  })
}

export async function getRunningJob(): Promise<{ id: number; startedAt: string } | null> {
  const rows = await db
    .select({ id: jobRuns.id, startedAt: jobRuns.startedAt })
    .from(jobRuns)
    .where(eq(jobRuns.status, 'running'))
    .limit(1)

  if (rows.length === 0) return null
  return { id: rows[0].id, startedAt: rows[0].startedAt.toISOString() }
}

export async function finalizarJobRun(
  id: number,
  status: 'success' | 'error',
  metrics: { totalFetched: number; totalApproved: number; totalRejected: number; error?: string },
): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      status,
      totalFetched: metrics.totalFetched,
      totalApproved: metrics.totalApproved,
      totalRejected: metrics.totalRejected,
      errorMessage: metrics.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(jobRuns.id, id))
}

export async function checkCooldown(
  fingerprint: string,
  cooldownMinutes: number,
): Promise<JobRun | null> {
  const cutoff = sql`NOW() - INTERVAL '${sql.raw(String(cooldownMinutes))} minutes'`
  const rows = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.configFingerprint, fingerprint),
        eq(jobRuns.status, 'success'),
        gte(jobRuns.finishedAt, cutoff),
      ),
    )
    .orderBy(desc(jobRuns.finishedAt))
    .limit(1)

  if (rows.length === 0) return null

  const r = rows[0]
  return {
    id: r.id,
    jobName: r.jobName,
    configId: r.configId,
    configFingerprint: r.configFingerprint,
    configSnapshot: r.configSnapshot,
    triggerType: r.triggerType,
    status: r.status,
    totalFetched: r.totalFetched,
    totalApproved: r.totalApproved,
    totalRejected: r.totalRejected,
    errorMessage: r.errorMessage,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    triggeredBy: { type: 'automation', label: 'Automação agendada' },
  }
}

function mapJobRunWithTriggeredBy(row: {
  jobRun: typeof jobRuns.$inferSelect
  user: { id: number; nome: string; email: string } | null
}): JobRun {
  const jr = row.jobRun

  const base = {
    id: jr.id,
    jobName: jr.jobName,
    configId: jr.configId,
    configFingerprint: jr.configFingerprint?.substring(0, 8) ?? null,
    configSnapshot: jr.configSnapshot,
    triggerType: jr.triggerType,
    status: jr.status,
    totalFetched: jr.totalFetched,
    totalApproved: jr.totalApproved,
    totalRejected: jr.totalRejected,
    errorMessage: jr.errorMessage,
    startedAt: jr.startedAt.toISOString(),
    finishedAt: jr.finishedAt?.toISOString() ?? null,
  }

  const triggeredBy: TriggeredBy = row.user
    ? { type: 'user', userId: row.user.id, name: row.user.nome, email: row.user.email }
    : { type: 'automation', label: 'Automação agendada' }

  return { ...base, triggeredBy }
}

export async function listJobRuns(triggerType?: string): Promise<JobRun[]> {
  const filters = []
  if (triggerType) filters.push(eq(jobRuns.triggerType, triggerType))

  const where = filters.length > 0 ? and(...filters) : undefined

  const rows = await db
    .select({
      jobRun: jobRuns,
      user: {
        id: users.id,
        nome: users.nome,
        email: users.email,
      },
    })
    .from(jobRuns)
    .leftJoin(users, eq(jobRuns.userId, users.id))
    .where(where)
    .orderBy(sql`${jobRuns.startedAt} DESC`)

  return rows.map(mapJobRunWithTriggeredBy)
}

export async function seedDefaultConfig(): Promise<void> {
  const existing = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(searchConfigs)
  if ((existing[0]?.count ?? 0) > 0) return

  await db.insert(searchConfigs).values({
    nome: 'Padrão São Luís',
    municipio: 'São Luís',
    uf: 'MA',
    portes: 'ME,EPP,MEI',
    situacao: 'ATIVA',
    isDefault: true,
  })
}
