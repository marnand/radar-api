import { createHash } from 'node:crypto'
import type { SearchConfig } from '../config/config.types.js'

const FINGERPRINT_KEYS = [
  'municipio',
  'uf',
  'portes',
  'situacao',
  'simplesNacional',
  'fundacaoDe',
  'fundacaoAte',
] as const

export function computeConfigFingerprint(config: SearchConfig): string {
  const sorted: Record<string, unknown> = {}
  for (const key of FINGERPRINT_KEYS) {
    sorted[key] = config[key as keyof SearchConfig] ?? null
  }
  const payload = JSON.stringify(sorted)
  return createHash('sha256').update(payload).digest('hex')
}
