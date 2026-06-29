import fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import jwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { config } from './config/env.js'
import { configRoutes } from './modules/config/config.routes.js'
import { cnpjRoutes } from './modules/cnpj/cnpj.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { quotaRoutes } from './modules/quota/quota.routes.js'

const SSE_PATH = '/api/v1/jobs/stream'
const PUBLIC_PATHS = ['/health', '/api/v1/auth/login']

async function authenticateRequest(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    return
  } catch {
    // continua para tentar token via query string (SSE com EventSource)
  }

  const query = request.query as { token?: string }
  if (!query.token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  try {
    const payload = await request.server.jwt.verify(query.token)
    request.user = payload as typeof request.user
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export function buildApp() {
  const app = fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  const corsOrigin =
    config.CORS_ORIGIN === '*'
      ? (origin: string | undefined, cb: (err: Error | null, origin: boolean | string) => void) => {
          if (!origin) return cb(null, false)
          app.log.warn('CORS_ORIGIN="*" refletindo origem da requisição; configure uma origem específica para maior segurança')
          cb(null, origin)
        }
      : config.CORS_ORIGIN

  app.register(cors, { origin: corsOrigin })
  app.register(sensible)
  app.register(jwt, { secret: config.JWT_SECRET })

  app.register(authRoutes, { prefix: '/api/v1/auth' })
  app.register(configRoutes, { prefix: '/api/v1/configs' })
  app.register(cnpjRoutes, { prefix: '/api/v1' })
  app.register(quotaRoutes, { prefix: '/api/v1' })

  app.get('/health', async () => ({ status: 'ok' }))

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0]
    if (PUBLIC_PATHS.includes(path)) return
    if (path === SSE_PATH) {
      await authenticateRequest(request, reply)
      return
    }

    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  return app
}
