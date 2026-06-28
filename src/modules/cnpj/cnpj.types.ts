import type { CnpjaCompany } from '../../services/cnpja.client.js'

export interface IcpResult {
  aprovado: boolean
  motivo?: string
}

export interface UpsertCompanyInput {
  cnpj: string
  rawData: CnpjaCompany
  icp: IcpResult
  enriquecido: boolean
}

export interface CompanyListItem {
  id: number
  cnpj: string
  razaoSocial: string | null
  nomeFantasia: string | null
  situacao: string
  porte: string | null
  regime: string | null
  municipio: string | null
  uf: string | null
  telefone: string | null
  email: string | null
  icpAprovado: boolean
  score: number | null
  tier: string | null
  statusPipeline: string
  createdAt: string
}

export interface CompanyDetail extends CompanyListItem {
  simplesOptante: boolean | null
  dataAbertura: string | null
  cnaePrincipal: string | null
  cnaeDescricao: string | null
  socios: unknown
  rawData: CnpjaCompany
  icpMotivo: string | null
}

export interface TriggeredByUser {
  type: 'user'
  userId: number
  name: string
  email: string
}

export interface TriggeredByAutomation {
  type: 'automation'
  label: string
}

export type TriggeredBy = TriggeredByUser | TriggeredByAutomation

export interface JobRun {
  id: number
  jobName: string
  configId: number | null
  configFingerprint: string | null
  configSnapshot: unknown
  triggerType: string
  status: string
  totalFetched: number | null
  totalApproved: number | null
  totalRejected: number | null
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
  triggeredBy: TriggeredBy
}
