import fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { config } from './config/env.js'
import { configRoutes } from './modules/config/config.routes.js'
import { cnpjRoutes } from './modules/cnpj/cnpj.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'

export function buildApp() {
  const app = fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  })
  app.register(sensible)
  app.register(cookie)
  app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: {
      cookieName: config.COOKIE_NAME,
      signed: false,
    },
  })

  app.register(authRoutes, { prefix: '/api/v1/auth' })
  app.register(configRoutes, { prefix: '/api/v1/configs' })
  app.register(cnpjRoutes, { prefix: '/api/v1' })

  app.get('/health', async () => ({ status: 'ok' }))

  app.addHook('onRequest', async (request, reply) => {
    const publicPaths = ['/health', '/api/v1/auth/login']
    if (publicPaths.includes(request.url)) return

    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  return app
}
