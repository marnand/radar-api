import fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { config } from './config/env.js'
import { configRoutes } from './modules/config/config.routes.js'
import { cnpjRoutes } from './modules/cnpj/cnpj.routes.js'

export function buildApp() {
  const app = fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  app.register(cors)
  app.register(sensible)

  app.register(configRoutes, { prefix: '/api/v1/configs' })
  app.register(cnpjRoutes, { prefix: '/api/v1' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
