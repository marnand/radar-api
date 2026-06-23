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
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const config = envSchema.parse(process.env)
