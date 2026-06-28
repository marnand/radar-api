import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  CNPJA_TOKEN: z.string().min(1, 'CNPJA_TOKEN é obrigatório'),
  CNPJA_BASE_URL: z.string().url().default('https://api.cnpja.com'),
  CNPJA_USER_AGENT: z.string().default('Radar-Ikasa-Automation/2.2'),
  CNPJA_MAX_AGE: z.coerce.number().default(7),
  CNPJA_STRATEGY: z.string().default('CACHE_IF_FRESH'),
  CNPJA_LIMIT_PER_PAGE: z.coerce.number().default(10),
  CNPJA_MAX_PAGES: z.coerce.number().default(20),
  CNPJA_ENRICHMENT_DELAY_MS: z.coerce.number().default(500),
  CNPJA_COOLDOWN_MINUTES: z.coerce.number().default(60).transform((v) => Math.max(v, 5)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => {
      const trimmed = value.trim()
      if (trimmed === '' || trimmed === '*') return '*'
      const origins = trimmed.split(',').map((origin) => origin.trim())
      return origins.length === 1 ? origins[0] : origins
    }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  COOKIE_NAME: z.string().default('radar_session'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD deve ter no mínimo 8 caracteres'),
}).refine(
  (data) => !(data.NODE_ENV === 'production' && data.CORS_ORIGIN === '*'),
  {
    message: 'CORS_ORIGIN não pode ser "*" em produção quando credentials estão habilitados',
    path: ['CORS_ORIGIN'],
  },
)

export const config = envSchema.parse(process.env)
