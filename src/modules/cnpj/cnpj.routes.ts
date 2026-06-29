import type { FastifyInstance } from 'fastify'
import { companyParamsSchema, companiesQuerySchema, fetchJobBodySchema, jobsQuerySchema } from './cnpj.schema.js'
import type { FetchJobBodyDto } from './cnpj.schema.js'
import * as repository from './cnpj.repository.js'
import * as configRepository from '../config/config.repository.js'
import { executarFetchCnpjs } from '../../jobs/fetch-cnpjs.job.js'
import { computeConfigFingerprint } from './cnpj.fingerprint.js'
import { config } from '../../config/env.js'
import { jobEmitter } from '../../jobs/job-events.js'
import type { JobStartedPayload, JobStatusPayload } from '../../jobs/job-events.js'
import type { SearchConfig } from '../config/config.types.js'

function resolveCorsOrigin(requestOrigin: string | undefined): string | false {
  const configured = config.CORS_ORIGIN

  if (!requestOrigin) return false
  if (configured === '*') return requestOrigin
  if (Array.isArray(configured)) {
    return configured.includes(requestOrigin) ? requestOrigin : false
  }
  return configured === requestOrigin ? requestOrigin : false
}

export async function cnpjRoutes(app: FastifyInstance) {
  app.get('/jobs/stream', async (request, reply) => {
    const headers: Record<string, string | number> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }

    const allowedOrigin = resolveCorsOrigin(request.headers.origin)
    if (allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = allowedOrigin
    }

    reply.raw.writeHead(200, headers)
    reply.raw.write('\n')

    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(`event: ping\ndata: {}\n\n`)
      } catch {
        // cliente pode ter desconectado entre ticks
      }
    }, 30_000)

    const onStarted = (payload: JobStartedPayload) => {
      const ssePayload = {
        jobRunId: payload.jobRunId,
        status: 'running',
        triggerType: payload.triggerType,
        startedAt: payload.startedAt,
        finishedAt: null,
      }
      try {
        reply.raw.write(`event: job:started\ndata: ${JSON.stringify(ssePayload)}\n\n`)
      } catch (err) {
        request.log.error({ err }, 'SSE write error on job:started')
      }
    }

    const onStatus = (payload: JobStatusPayload) => {
      const ssePayload: Record<string, unknown> = {
        jobRunId: payload.jobRunId,
        status: payload.status,
        triggerType: payload.triggerType,
        finishedAt: payload.finishedAt,
        totalFetched: payload.totalFetched,
        totalApproved: payload.totalApproved,
        totalRejected: payload.totalRejected,
      }
      try {
        reply.raw.write(`event: job:status\ndata: ${JSON.stringify(ssePayload)}\n\n`)
      } catch (err) {
        request.log.error({ err }, 'SSE write error on job:status')
      }
    }

    jobEmitter.on('job:started', onStarted)
    jobEmitter.on('job:status', onStatus)

    request.raw.on('close', () => {
      clearInterval(pingInterval)
      jobEmitter.off('job:started', onStarted)
      jobEmitter.off('job:status', onStatus)
    })
  })

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

    const fingerprint = computeConfigFingerprint(searchConfig)
    const isAdmin = request.user.role === 'admin'
    const canBypass = isAdmin && body.force === true

    if (!canBypass) {
      const cooldownRun = await repository.checkCooldown(fingerprint, config.CNPJA_COOLDOWN_MINUTES)
      if (cooldownRun) {
        const elapsedMs = Date.now() - new Date(cooldownRun.finishedAt!).getTime()
        const remainingMs = config.CNPJA_COOLDOWN_MINUTES * 60 * 1000 - elapsedMs
        const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000))

        return reply.status(409).send({
          error: 'job_cooldown_active',
          message: `Busca idêntica executada há ${Math.floor(elapsedMs / 60000)} minutos. Próximo disparo disponível em ${remainingMin} minutos.`,
          lastRunId: cooldownRun.id,
          lastRunAt: cooldownRun.finishedAt,
          cooldownRemainingMinutes: remainingMin,
        })
      }
    }

    const userId = request.user.userId

    const run = await repository.createJobRunIfIdle({
      jobName: 'fetch-cnpjs',
      configId: searchConfig.id || null,
      userId,
      configFingerprint: fingerprint,
      configSnapshot: searchConfig,
      triggerType: 'manual',
      status: 'running',
    })

    if (!run) {
      const currentRunning = await repository.getRunningJob()
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'Já existe um job em execução. Aguarde a conclusão antes de disparar outro.',
        runningJobId: currentRunning?.id,
        startedAt: currentRunning?.startedAt,
      })
    }

    setImmediate(() => {
      executarFetchCnpjs(searchConfig!, run.id, 'manual')
    })

    return reply.status(202).send({
      jobRunId: run.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggerType: 'manual',
    })
  })

  app.get('/jobs', async (request, reply) => {
    const parsed = jobsQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() })

    const data = await repository.listJobRuns(parsed.data.trigger_type)
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
