import { EventEmitter } from 'node:events'
import type { FastifyBaseLogger } from 'fastify'

export interface JobStartedPayload {
  jobRunId: number
  triggerType: 'scheduled' | 'manual'
  startedAt: string
}

export interface JobStatusPayload {
  jobRunId: number
  status: 'success' | 'error'
  triggerType: 'scheduled' | 'manual'
  finishedAt: string
  totalFetched: number
  totalApproved: number
  totalRejected: number
}

type JobEvents = {
  'job:started': [payload: JobStartedPayload]
  'job:status': [payload: JobStatusPayload]
}

let jobEmitterLogger: FastifyBaseLogger

export function setJobEmitterLogger(logger: FastifyBaseLogger): void {
  jobEmitterLogger = logger
}

function getLogger(): FastifyBaseLogger {
  if (!jobEmitterLogger) throw new Error('Job emitter logger not set')
  return jobEmitterLogger
}

class JobEventEmitter extends EventEmitter<JobEvents> {
  emitJobStarted(payload: JobStartedPayload): void {
    const logger = getLogger()
    logger.info({ event: 'job:started', ...payload }, 'Job started event emitted')
    this.emit('job:started', payload)
  }

  emitJobStatus(payload: JobStatusPayload): void {
    const logger = getLogger()
    logger.info({ event: 'job:status', ...payload }, 'Job status event emitted')
    this.emit('job:status', payload)
  }
}

export const jobEmitter = new JobEventEmitter()
jobEmitter.setMaxListeners(100)
