import type { FastifyInstance } from 'fastify'
import { quotaQuerySchema } from './quota.schema.js'
import { getQuotaResponse } from './quota.service.js'

export async function quotaRoutes(app: FastifyInstance) {
  app.get('/quota', async (request, reply) => {
    const parsed = quotaQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query', details: parsed.error.format() })

    const data = await getQuotaResponse(parsed.data.refresh)
    return reply.send(data)
  })
}
