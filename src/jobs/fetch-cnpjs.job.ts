import { searchOffices, CnpjaRateLimitError } from '../services/cnpja.client.js'
import { aplicarFiltroICP } from '../modules/cnpj/cnpj.service.js'
import { upsertCompany, finalizarJobRun } from '../modules/cnpj/cnpj.repository.js'
import { refreshQuota } from '../modules/quota/quota.service.js'
import type { SearchConfig } from '../modules/config/config.types.js'
import { config } from '../config/env.js'
import type { FastifyBaseLogger } from 'fastify'
import { jobEmitter } from './job-events.js'

let jobLogger: FastifyBaseLogger

export function setJobLogger(logger: FastifyBaseLogger): void {
  jobLogger = logger
}

function getLogger(): FastifyBaseLogger {
  if (!jobLogger) {
    throw new Error('Job logger not set')
  }
  return jobLogger
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function executarFetchCnpjs(
  searchConfig: SearchConfig,
  runId: number,
  triggerType: 'scheduled' | 'manual' = 'scheduled',
): Promise<number> {
  const logger = getLogger()

  let totalFetched = 0
  let totalApproved = 0
  let totalRejected = 0
  let pageCount = 0
  let nextToken: string | null = null

  logger.info({ runId, configId: searchConfig.id, triggerType }, 'Job fetch-cnpjs started')
  jobEmitter.emitJobStarted({
    jobRunId: runId,
    triggerType,
    startedAt: new Date().toISOString(),
  })

  try {
    try {
      do {
        const result = await searchOffices({
          municipio: searchConfig.municipio,
          uf: searchConfig.uf,
          porte: searchConfig.portes,
          situacao: searchConfig.situacao,
          simplesNacional: searchConfig.simplesNacional ?? undefined,
          fundacaoDe: searchConfig.fundacaoDe ?? undefined,
          fundacaoAte: searchConfig.fundacaoAte ?? undefined,
          token: nextToken ?? undefined,
        })

        if (result.companies.length === 0) break

        totalFetched += result.companies.length
        nextToken = result.nextToken
        pageCount++

        for (const company of result.companies) {
          const icp = aplicarFiltroICP(company, searchConfig)
          await upsertCompany({ cnpj: company.taxId, rawData: company, icp, enriquecido: true })

          if (icp.aprovado) {
            totalApproved++
          } else {
            totalRejected++
          }

          await sleep(config.CNPJA_ENRICHMENT_DELAY_MS)
        }

        logger.info({ runId, page: pageCount, totalFetched, totalApproved, totalRejected }, 'Job fetch-cnpjs page processed')
      } while (nextToken && pageCount < config.CNPJA_MAX_PAGES)

      await finalizarJobRun(runId, 'success', { totalFetched, totalApproved, totalRejected })
      jobEmitter.emitJobStatus({
        jobRunId: runId,
        status: 'success',
        triggerType,
        finishedAt: new Date().toISOString(),
        totalFetched,
        totalApproved,
        totalRejected,
      })
      logger.info({ runId, totalFetched, totalApproved, totalRejected }, 'Job fetch-cnpjs finished successfully')
      return runId
    } catch (err) {
      if (err instanceof CnpjaRateLimitError) {
        await finalizarJobRun(runId, 'error', {
          totalFetched,
          totalApproved,
          totalRejected,
          error: 'Limite de requisições atingido na CNPJÁ (429). Processo encerrado.',
        })
        jobEmitter.emitJobStatus({
          jobRunId: runId,
          status: 'error',
          triggerType,
          finishedAt: new Date().toISOString(),
          totalFetched,
          totalApproved,
          totalRejected,
        })
        logger.error({ err, runId }, 'Job fetch-cnpjs stopped due to CNPJÁ rate limit')
        return runId
      }

      const msg = err instanceof Error ? err.message : String(err)
      await finalizarJobRun(runId, 'error', { totalFetched, totalApproved, totalRejected, error: msg })
      jobEmitter.emitJobStatus({
        jobRunId: runId,
        status: 'error',
        triggerType,
        finishedAt: new Date().toISOString(),
        totalFetched,
        totalApproved,
        totalRejected,
      })
      logger.error({ err, runId }, 'Job fetch-cnpjs failed')
      return runId
    }
  } finally {
    try {
      await refreshQuota()
      logger.info({ runId }, 'Quota snapshot updated after job')
    } catch (quotaErr) {
      logger.error({ err: quotaErr, runId }, 'Failed to update quota snapshot after job')
    }
  }
}
