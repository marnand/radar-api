import { z } from 'zod'

export const quotaQuerySchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
})

export type QuotaQueryDto = z.infer<typeof quotaQuerySchema>
