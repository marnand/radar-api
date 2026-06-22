import type { FastifyInstance } from 'fastify'
import * as service from './config.service.js'
import { configIdParamsSchema, searchConfigInputSchema, searchConfigUpdateSchema } from './config.schema.js'
import type { SearchConfigUpdateDto } from './config.schema.js'

export async function configRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const data = await service.listConfigs()
    return reply.send({ data })
  })

  app.get('/default', async (_request, reply) => {
    const data = await service.getDefaultConfig()
    if (!data) return reply.status(404).send({ error: 'Default config not found' })
    return reply.send({ data })
  })

  app.post('/', async (request, reply) => {
    const parsed = searchConfigInputSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.format() })

    const data = await service.createConfig(parsed.data)
    return reply.status(201).send({ data })
  })

  app.put('/:id', async (request, reply) => {
    const paramsParsed = configIdParamsSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid id', details: paramsParsed.error.format() })

    const bodyParsed = searchConfigUpdateSchema.safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Invalid input', details: bodyParsed.error.format() })

    const data = await service.updateConfig(paramsParsed.data.id, bodyParsed.data as SearchConfigUpdateDto)
    if (!data) return reply.status(404).send({ error: 'Config not found' })
    return reply.send({ data })
  })

  app.delete('/:id', async (request, reply) => {
    const parsed = configIdParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid id', details: parsed.error.format() })

    const result = await service.deleteConfig(parsed.data.id)

    if (result === 'not-found') return reply.status(404).send({ error: 'Config not found' })
    if (result === 'is-default') return reply.status(409).send({ error: 'Cannot delete default config' })

    return reply.status(204).send()
  })

  app.put('/:id/default', async (request, reply) => {
    const parsed = configIdParamsSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid id', details: parsed.error.format() })

    const data = await service.setDefaultConfig(parsed.data.id)
    if (!data) return reply.status(404).send({ error: 'Config not found' })
    return reply.send({ data })
  })
}
