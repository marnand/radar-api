import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginBodyDto = z.infer<typeof loginBodySchema>

export const loginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string(),
    nome: z.string(),
    role: z.string(),
  }),
})

export type LoginResponseDto = z.infer<typeof loginResponseSchema>
