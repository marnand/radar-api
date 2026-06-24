import type { FastifyInstance } from 'fastify'
import { companyParamsSchema, companiesQuerySchema, fetchJobBodySchema } from './cnpj.schema.js'
import type { FetchJobBodyDto } from './cnpj.schema.js'
import * as repository from './cnpj.repository.js'
import * as configRepository from '../config/config.repository.js'
import { executarFetchCnpjs } from '../../jobs/fetch-cnpjs.job.js'
import type { SearchConfig } from '../config/config.types.js'

export async function cnpjRoutes(app: FastifyInstance) {
  app.get('/companies', async (request, reply) => {
    const parsed = companiesQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() })

    const query = parsed.data
    const result = await repository.listCompanies({
      page: query.page,
      limit: query.limit,
      icpAprovado: query.icp_aprovado === undefined ? undefined : query.icp_aprovado === 'true',
      porte: query.porte,
      tier: query.tier,
      q: query.q,
    })

    return reply.send(result)
  })

  app.get('/companies/:cnpj', async (request, reply) => {
    const parsed = companyParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid CNPJ', details: parsed.error.format() })

    const data = await repository.getCompanyByCnpj(parsed.data.cnpj)
    if (!data) return reply.status(404).send({ error: 'Company not found' })
    return reply.send({ data })
  })

  app.post('/jobs/fetch', async (request, reply) => {
    const parsed = fetchJobBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.format() })

    const body = parsed.data
    let searchConfig: SearchConfig | null = null

    if (body.configId) {
      searchConfig = await configRepository.getConfigById(body.configId)
      if (!searchConfig) return reply.status(404).send({ error: 'Config not found' })
    } else {
      const defaultConfig = await configRepository.getDefaultConfig()
      searchConfig = buildInlineConfig(body, defaultConfig)
      if (!searchConfig) return reply.status(400).send({ error: 'Could not build a valid search config' })
    }

    const userId = request.user.userId
    const runId = await executarFetchCnpjs(searchConfig, 'manual', userId)

    return reply.status(202).send({
      jobRunId: runId,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggerType: 'manual',
    })
  })

  app.get('/jobs', async (_request, reply) => {
    const data = await repository.listJobRuns()
    return reply.send({ data })
  })
}

function buildInlineConfig(
  body: FetchJobBodyDto,
  defaultConfig: SearchConfig | null,
): SearchConfig | null {
  if (!defaultConfig && (!body.municipio || !body.uf)) return null

  const base = defaultConfig ?? {
    id: 0,
    nome: 'Inline manual',
    municipio: body.municipio ?? '',
    uf: body.uf ?? '',
    portes: 'ME,EPP,MEI',
    situacao: 'ATIVA',
    simplesNacional: null,
    fundacaoDe: null,
    fundacaoAte: null,
    cronSchedule: '',
    agendamentoAtivo: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return {
    ...base,
    id: defaultConfig?.id ?? 0,
    nome: defaultConfig?.nome ?? 'Inline manual',
    municipio: body.municipio ?? base.municipio,
    uf: body.uf ?? base.uf,
    portes: body.portes ?? base.portes,
    situacao: body.situacao ?? base.situacao,
    simplesNacional: body.simplesNacional ?? base.simplesNacional,
    fundacaoDe: body.fundacaoDe ?? base.fundacaoDe,
    fundacaoAte: body.fundacaoAte ?? base.fundacaoAte,
  }
}
