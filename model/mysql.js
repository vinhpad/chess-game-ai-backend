import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
export const UserEntity = prisma.users
export const GameEntity = prisma.games