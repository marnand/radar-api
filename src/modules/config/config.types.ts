export interface SearchConfig {
  id: number
  nome: string
  municipio: string
  uf: string
  portes: string
  situacao: string
  simplesNacional: boolean | null
  fundacaoDe: string | null
  fundacaoAte: string | null
  cronSchedule: string
  agendamentoAtivo: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type SearchConfigInput = Omit<SearchConfig, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean }
