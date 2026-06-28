import { sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { cnpjaQuota } from '../../db/schema.js'
import type { Quota } from './quota.types.js'

function mapQuota(row: typeof cnpjaQuota.$inferSelect): Quota {
  return {
    id: row.id,
    perpetual: row.perpetual,
    transient: row.transient,
    total: row.total,
    fetchedAt: row.fetchedAt.toISOString(),
  }
}

export async function getLatestQuota(): Promise<Quota | null> {
  const rows = await db
    .select()
    .from(cnpjaQuota)
    .orderBy(sql`${cnpjaQuota.fetchedAt} DESC`)
    .limit(1)
  if (rows.length === 0) return null
  return mapQuota(rows[0])
}

export async function saveQuota(data: { perpetual: number; transient: number }): Promise<Quota> {
  const rows = await db
    .insert(cnpjaQuota)
    .values({
      perpetual: data.perpetual,
      transient: data.transient,
      total: data.perpetual + data.transient,
    })
    .returning()
  return mapQuota(rows[0])
}

export function isStale(fetchedAt: Date): boolean {
  const hour = 60 * 60 * 1000
  return Date.now() - fetchedAt.getTime() > hour
}
