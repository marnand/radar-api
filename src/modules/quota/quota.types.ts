export interface Quota {
  id: number
  perpetual: number
  transient: number
  total: number
  fetchedAt: string
}

export interface QuotaResponse {
  perpetual: number
  transient: number
  total: number
  fetchedAt: string
  stale: boolean
}
