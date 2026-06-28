import type { FastifyInstance } from 'fastify'
import { loginBodySchema } from './auth.schema.js'
import { validateCredentials } from './auth.service.js'
import { findUserById } from './auth.repository.js'
import { config } from '../../config/env.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.format() })
    }

    const user = await validateCredentials(parsed.data)
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = await reply.jwtSign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: config.JWT_EXPIRES_IN },
    )

    reply.setCookie(config.COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: config.COOKIE_SAME_SITE,
      maxAge: 24 * 60 * 60, // segundos (RFC 6265) — 24 horas
    })

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
      },
    })
  })

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(config.COOKIE_NAME, {
      path: '/',
      secure: config.COOKIE_SECURE,
      sameSite: config.COOKIE_SAME_SITE,
    })
    return reply.send({ message: 'Logged out' })
  })

  app.get('/me', async (request, reply) => {
    await request.jwtVerify()
    const user = await findUserById(request.user.userId)
    if (!user || !user.ativo) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
      },
    })
  })
}
