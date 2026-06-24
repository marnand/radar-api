import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginBodyDto = z.infer<typeof loginBodySchema>
