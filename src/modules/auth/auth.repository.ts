import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import { config } from '../../config/env.js'
import { hashPassword } from './auth.service.js'
import type { User } from './auth.types.js'

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return rows[0] ?? null
}

export async function findUserById(id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function seedAdminUser(): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.email, config.ADMIN_EMAIL)).limit(1)
  if (existing.length > 0) return

  await db.insert(users).values({
    email: config.ADMIN_EMAIL,
    passwordHash: await hashPassword(config.ADMIN_PASSWORD),
    nome: 'Administrador',
    role: 'admin',
  })
}
