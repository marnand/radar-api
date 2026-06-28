import cron from 'node-cron'
import { getDefaultConfig } from '../modules/config/config.repository.js'
import { createJobRunIfIdle } from '../modules/cnpj/cnpj.repository.js'
import { computeConfigFingerprint } from '../modules/cnpj/cnpj.fingerprint.js'
import { executarFetchCnpjs } from './fetch-cnpjs.job.js'
import type { FastifyBaseLogger } from 'fastify'
import type { SearchConfig } from '../modules/config/config.types.js'

let currentTask: cron.ScheduledTask | null = null
let schedulerLogger: FastifyBaseLogger

export function setSchedulerLogger(logger: FastifyBaseLogger): void {
  schedulerLogger = logger
}

function getLogger(): FastifyBaseLogger {
  if (!schedulerLogger) {
    throw new Error('Scheduler logger not set')
  }
  return schedulerLogger
}

export async function iniciarAgendador(): Promise<void> {
  const logger = getLogger()
  const cfg = await getDefaultConfig()
  if (!cfg || !cfg.agendamentoAtivo) {
    logger.info('Scheduler disabled by default config')
    return
  }
  registrarCron(cfg)
}

export function registrarCron(cfg: SearchConfig): void {
  const logger = getLogger()

  if (currentTask) {
    currentTask.stop()
    currentTask = null
  }

  if (!cfg.agendamentoAtivo) {
    logger.info('Scheduler stopped — agendamento_ativo = false')
    return
  }

  if (!cron.validate(cfg.cronSchedule)) {
    logger.warn({ schedule: cfg.cronSchedule }, 'Invalid cron schedule, scheduler not started')
    return
  }

  currentTask = cron.schedule(cfg.cronSchedule, async () => {
    const fresh = await getDefaultConfig()
    if (!fresh) return

    const fingerprint = computeConfigFingerprint(fresh)
    const run = await createJobRunIfIdle({
      jobName: 'fetch-cnpjs',
      configId: fresh.id || null,
      configFingerprint: fingerprint,
      configSnapshot: fresh,
      triggerType: 'scheduled',
      status: 'running',
    })

    if (!run) {
      getLogger().warn({ schedule: cfg.cronSchedule }, 'Scheduler tick skipped — job already running')
      return
    }

    await executarFetchCnpjs(fresh, run.id, 'scheduled')
  })

  logger.info({ schedule: cfg.cronSchedule }, 'Scheduler registered')
}
