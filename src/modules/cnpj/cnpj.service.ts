import type { CnpjaCompany } from '../../services/cnpja.client.js'
import type { SearchConfig } from '../config/config.types.js'
import type { IcpResult } from './cnpj.types.js'

const PORTES_ACEITOS = new Set(['MEI', 'ME', 'EPP'])
const SITUACAO_ACEITA = 'ATIVA'
const IDADE_MINIMA_MESES_DEFAULT = 12
const CNAES_EXCLUIDOS_PREFIXO = ['01', '94', '84', '99']

export function aplicarFiltroICP(company: CnpjaCompany, searchConfig: SearchConfig): IcpResult {
  const statusText = company.status.text.toUpperCase()
  if (statusText !== SITUACAO_ACEITA) {
    return { aprovado: false, motivo: `situacao_${statusText.toLowerCase()}` }
  }

  const porte = company.company.size?.acronym
  if (!porte || !PORTES_ACEITOS.has(porte)) {
    return { aprovado: false, motivo: `porte_${porte ?? 'desconhecido'}` }
  }

  if (searchConfig.simplesNacional !== null && searchConfig.simplesNacional !== undefined) {
    const isOptante = company.company.simples?.optant ?? false
    if (searchConfig.simplesNacional && !isOptante) {
      return { aprovado: false, motivo: 'nao_optante_simples' }
    }
    if (!searchConfig.simplesNacional && isOptante) {
      return { aprovado: false, motivo: 'optante_simples_excluido' }
    }
  }

  if (company.founded) {
    const fundacao = new Date(company.founded)

    if (searchConfig.fundacaoDe && fundacao < new Date(searchConfig.fundacaoDe)) {
      return { aprovado: false, motivo: `fundacao_anterior_a_${searchConfig.fundacaoDe}` }
    }
    if (searchConfig.fundacaoAte && fundacao > new Date(searchConfig.fundacaoAte)) {
      return { aprovado: false, motivo: `fundacao_posterior_a_${searchConfig.fundacaoAte}` }
    }

    const meses = diffMeses(fundacao, new Date())
    if (meses < IDADE_MINIMA_MESES_DEFAULT) {
      return { aprovado: false, motivo: `idade_insuficiente_${meses}meses` }
    }
  }

  const cnae = String(company.mainActivity?.id ?? '').slice(0, 2)
  if (CNAES_EXCLUIDOS_PREFIXO.includes(cnae)) {
    return { aprovado: false, motivo: `cnae_excluido_${cnae}` }
  }

  const temContato = company.phones.length > 0 || company.emails.length > 0
  if (!temContato) {
    return { aprovado: false, motivo: 'sem_contato' }
  }

  return { aprovado: true }
}

function diffMeses(inicio: Date, fim: Date): number {
  return (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth())
}
