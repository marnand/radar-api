import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { searchConfigs } from '../../db/schema.js'
import type { SearchConfig, SearchConfigInput } from './config.types.js'

function mapToConfig(row: typeof searchConfigs.$inferSelect): SearchConfig {
  return {
    id: row.id,
    nome: row.nome,
    municipio: row.municipio,
    uf: row.uf,
    portes: row.portes,
    situacao: row.situacao,
    simplesNacional: row.simplesNacional ?? null,
    fundacaoDe: row.fundacaoDe ?? null,
    fundacaoAte: row.fundacaoAte ?? null,
    cronSchedule: row.cronSchedule,
    agendamentoAtivo: row.agendamentoAtivo,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listConfigs(): Promise<SearchConfig[]> {
  const rows = await db.select().from(searchConfigs).orderBy(searchConfigs.id)
  return rows.map(mapToConfig)
}

export async function getConfigById(id: number): Promise<SearchConfig | null> {
  const rows = await db.select().from(searchConfigs).where(eq(searchConfigs.id, id)).limit(1)
  if (rows.length === 0) return null
  return mapToConfig(rows[0])
}

export async function getDefaultConfig(): Promise<SearchConfig | null> {
  const rows = await db.select().from(searchConfigs).where(eq(searchConfigs.isDefault, true)).limit(1)
  if (rows.length === 0) return null
  return mapToConfig(rows[0])
}

export async function createConfig(input: SearchConfigInput): Promise<SearchConfig> {
  const hasDefault = (await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(searchConfigs))[0]?.count ?? 0

  const values = {
    ...input,
    isDefault: hasDefault === 0,
    updatedAt: new Date(),
  }

  const rows = await db.insert(searchConfigs).values(values).returning()
  return mapToConfig(rows[0])
}

export async function updateConfig(id: number, input: Partial<SearchConfigInput>): Promise<SearchConfig | null> {
  const rows = await db
    .update(searchConfigs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(searchConfigs.id, id))
    .returning()

  if (rows.length === 0) return null
  return mapToConfig(rows[0])
}

export async function setDefaultConfig(id: number): Promise<SearchConfig | null> {
  await db.transaction(async (tx) => {
    await tx.update(searchConfigs).set({ isDefault: false }).where(eq(searchConfigs.isDefault, true))
    await tx.update(searchConfigs).set({ isDefault: true, updatedAt: new Date() }).where(eq(searchConfigs.id, id))
  })

  return getConfigById(id)
}

export async function deleteConfig(id: number): Promise<boolean> {
  const cfg = await getConfigById(id)
  if (!cfg) return false
  if (cfg.isDefault) return false

  await db.delete(searchConfigs).where(eq(searchConfigs.id, id))
  return true
}
