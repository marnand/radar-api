import { z } from 'zod'

const cnpjParamSchema = z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits')

export const companyParamsSchema = z.object({
  cnpj: cnpjParamSchema,
})

export const companiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  icp_aprovado: z.enum(['true', 'false']).optional(),
  porte: z.string().optional(),
  tier: z.string().optional(),
  q: z.string().optional(),
})

export const fetchJobBodySchema = z
  .object({
    configId: z.number().int().positive().optional(),
    municipio: z.string().optional(),
    uf: z.string().length(2).optional(),
    portes: z.string().optional(),
    situacao: z.string().optional(),
    simplesNacional: z.boolean().nullable().optional(),
    fundacaoDe: z.string().date().optional().nullable(),
    fundacaoAte: z.string().date().optional().nullable(),
  })
  .refine(
    (data) =>
      data.configId !== undefined ||
      data.municipio !== undefined ||
      data.uf !== undefined ||
      data.portes !== undefined ||
      data.situacao !== undefined ||
      data.simplesNacional !== undefined ||
      data.fundacaoDe !== undefined ||
      data.fundacaoAte !== undefined,
    { message: 'At least one field must be provided' },
  )

export type CompaniesQueryDto = z.infer<typeof companiesQuerySchema>
export type FetchJobBodyDto = z.infer<typeof fetchJobBodySchema>
