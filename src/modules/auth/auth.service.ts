import bcrypt from 'bcryptjs'
import { findUserByEmail } from './auth.repository.js'
import type { LoginBodyDto } from './auth.schema.js'
import type { User } from './auth.types.js'

export async function validateCredentials(input: LoginBodyDto): Promise<User | null> {
  const user = await findUserByEmail(input.email)
  if (!user) return null
  if (!user.ativo) return null

  const match = await bcrypt.compare(input.password, user.passwordHash)
  if (!match) return null

  return user
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
