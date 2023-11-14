import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const UserEntity = prisma.users
const GameEntity = prisma.games

export {
    prisma,
    UserEntity,
    GameEntity
}