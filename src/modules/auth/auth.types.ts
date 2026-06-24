export interface User {
  id: number
  email: string
  passwordHash: string
  nome: string
  role: string
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
}
