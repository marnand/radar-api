import { getCredit } from '../../services/cnpja.client.js'
import { getLatestQuota, saveQuota, isStale } from './quota.repository.js'
import type { QuotaResponse } from './quota.types.js'

export async function refreshQuota(): Promise<QuotaResponse> {
  const credit = await getCredit()
  const saved = await saveQuota({ perpetual: credit.perpetual, transient: credit.transient })
  return buildResponse(saved)
}

export async function getQuotaResponse(forceRefresh: boolean): Promise<QuotaResponse> {
  const latest = await getLatestQuota()

  if (!latest || forceRefresh) {
    return refreshQuota()
  }

  const fetchedAt = new Date(latest.fetchedAt)
  const stale = isStale(fetchedAt)

  if (stale) {
    return refreshQuota()
  }

  return buildResponse(latest)
}

function buildResponse(q: { perpetual: number; transient: number; total: number; fetchedAt: string }): QuotaResponse {
  return {
    perpetual: q.perpetual,
    transient: q.transient,
    total: q.total,
    fetchedAt: q.fetchedAt,
    stale: false,
  }
}
