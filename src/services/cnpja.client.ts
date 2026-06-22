import { config } from '../config/env.js'

const BASE_HEADERS = {
  Authorization: config.CNPJA_TOKEN,
  'Content-Type': 'application/json',
  'User-Agent': config.CNPJA_USER_AGENT,
}

const SIZE_MAP: Record<string, number> = {
  ME: 1,
  EPP: 3,
  DEMAIS: 5,
}

const STATUS_MAP: Record<string, number> = {
  ATIVA: 2,
  NULA: 1,
  SUSPENSA: 3,
  INATIVA: 4,
  BAIXADA: 8,
}

const CITY_CODE_MAP: Record<string, string> = {
  'são luís': '2111300',
  'sao luis': '2111300',
  imperatriz: '2105302',
  bacabal: '2101203',
  caxias: '2103000',
  'são josé de ribamar': '2111201',
  'sao jose de ribamar': '2111201',
}

export interface CnpjaSearchParams {
  municipio?: string
  uf?: string
  porte?: string
  situacao?: string
  simplesNacional?: boolean
  fundacaoDe?: string
  fundacaoAte?: string
  limit?: number
  token?: string
}

export interface CnpjaCompany {
  taxId: string
  alias: string | null
  company: {
    name: string
    nature?: { id: number; text: string } | null
    size: { acronym: string; text: string } | null
    simples: { optant: boolean; since: string | null } | null
    simei: { optant: boolean } | null
  }
  status: { text: string }
  founded: string | null
  address: { municipality: string; state: string; city?: string; municipalityCode?: string }
  mainActivity: { id: number; text: string } | null
  phones: { area: string; number: string }[]
  emails: { address: string }[]
  partners: unknown[]
}

interface CnpjaSearchApiResponse {
  records?: CnpjaCompany[]
  next?: string | null
}

export interface CnpjaSearchResult {
  companies: CnpjaCompany[]
  nextToken: string | null
}

const FETCH_TIMEOUT_MS = 30000

export class CnpjaRateLimitError extends Error {
  constructor(message = 'CNPJÁ API rate limit exceeded (429)') {
    super(message)
    this.name = 'CnpjaRateLimitError'
  }
}

async function get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${config.CNPJA_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      url.searchParams.set(k, String(v))
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), { headers: BASE_HEADERS, signal: controller.signal })

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        throw new CnpjaRateLimitError(`CNPJÁ API 429: ${body}`)
      }
      throw new Error(`CNPJÁ API ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

function resolveCityCode(municipio?: string): string | undefined {
  if (!municipio) return undefined
  const code = CITY_CODE_MAP[municipio.toLowerCase()]
  if (code) return code
  const numeric = municipio.replace(/\D/g, '')
  if (numeric.length === 7) return numeric
  return undefined
}

function resolveSizeIds(porte?: string): { sizeIds: string[]; forceMei: boolean } {
  if (!porte) return { sizeIds: ['1', '3'], forceMei: false }
  const parts = porte.split(',').map((p) => p.trim().toUpperCase())
  const sizeIds = parts.filter((p) => p !== 'MEI').map((p) => String(SIZE_MAP[p] ?? p))
  return { sizeIds, forceMei: parts.includes('MEI') }
}

export async function searchOffices(params: CnpjaSearchParams): Promise<CnpjaSearchResult> {
  const query: Record<string, string | number | boolean> = {
    limit: params.limit ?? config.CNPJA_LIMIT_PER_PAGE,
  }

  if (params.token) {
    query.token = params.token
  } else {
    const { sizeIds, forceMei } = resolveSizeIds(params.porte)
    if (sizeIds.length > 0) query['company.size.id.in'] = sizeIds.join(',')
    if (forceMei) query['company.simei.optant.eq'] = true

    const cityCode = resolveCityCode(params.municipio)
    if (cityCode) query['address.municipality.in'] = cityCode
    if (params.uf) query['address.state.in'] = params.uf

    const statusId = params.situacao ? STATUS_MAP[params.situacao.toUpperCase()] : undefined
    if (statusId) query['status.id.in'] = statusId

    if (params.simplesNacional !== undefined) query['company.simples.optant.eq'] = params.simplesNacional
    if (params.fundacaoDe) query['founded.gte'] = params.fundacaoDe
    if (params.fundacaoAte) query['founded.lte'] = params.fundacaoAte
  }

  const response = await get<CnpjaSearchApiResponse>('/office', query)
  return {
    companies: response.records ?? [],
    nextToken: response.next ?? null,
  }
}

export async function getOffice(cnpj: string): Promise<CnpjaCompany> {
  return get<CnpjaCompany>(`/office/${cnpj.replace(/\D/g, '')}`, {
    simples: true,
    strategy: config.CNPJA_STRATEGY,
    maxAge: config.CNPJA_MAX_AGE,
  })
}
