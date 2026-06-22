import { z } from 'zod'
import cron from 'node-cron'

const isValidCron = (value: string) => cron.validate(value)

export const searchConfigInputSchema = z.object({
  nome: z.string().min(1).max(255),
  municipio: z.string().min(1).max(255),
  uf: z.string().length(2),
  portes: z.string().min(1).max(255),
  situacao: z.string().min(1).max(255),
  simplesNacional: z.boolean().nullable(),
  fundacaoDe: z.string().date().nullable(),
  fundacaoAte: z.string().date().nullable(),
  cronSchedule: z.string().refine(isValidCron, { message: 'Invalid cron expression' }),
  agendamentoAtivo: z.boolean(),
  isDefault: z.boolean().optional(),
})

export const searchConfigUpdateSchema = searchConfigInputSchema.partial()

export const configIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type SearchConfigInputDto = z.infer<typeof searchConfigInputSchema>
export type SearchConfigUpdateDto = z.infer<typeof searchConfigUpdateSchema>
