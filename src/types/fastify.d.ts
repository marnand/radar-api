import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: number; email: string; role: string }
    user: { userId: number; email: string; role: string }
  }
}
