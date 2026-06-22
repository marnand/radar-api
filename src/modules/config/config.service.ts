import type { SearchConfig, SearchConfigInput } from './config.types.js'
import * as repository from './config.repository.js'
import { registrarCron } from '../../jobs/scheduler.js'

export async function listConfigs(): Promise<SearchConfig[]> {
  return repository.listConfigs()
}

export async function getDefaultConfig(): Promise<SearchConfig | null> {
  return repository.getDefaultConfig()
}

export async function getConfigById(id: number): Promise<SearchConfig | null> {
  return repository.getConfigById(id)
}

export async function createConfig(input: SearchConfigInput): Promise<SearchConfig> {
  return repository.createConfig(input)
}

export async function updateConfig(id: number, input: Partial<SearchConfigInput>): Promise<SearchConfig | null> {
  const updated = await repository.updateConfig(id, input)
  if (!updated) return null

  const shouldReschedule =
    updated.isDefault &&
    (input.cronSchedule !== undefined || input.agendamentoAtivo !== undefined)
  if (shouldReschedule) {
    registrarCron(updated)
  }

  return updated
}

export async function setDefaultConfig(id: number): Promise<SearchConfig | null> {
  const updated = await repository.setDefaultConfig(id)
  if (!updated) return null

  registrarCron(updated)
  return updated
}

export async function deleteConfig(id: number): Promise<'deleted' | 'not-found' | 'is-default'> {
  const cfg = await repository.getConfigById(id)
  if (!cfg) return 'not-found'
  if (cfg.isDefault) return 'is-default'

  await repository.deleteConfig(id)
  return 'deleted'
}
