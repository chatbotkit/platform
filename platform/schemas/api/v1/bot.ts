import { BotModel } from '@/prisma/zod'

export const BotCreate = BotModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const BotUpdate = BotModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const BotUpsert = BotModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const BotList = BotModel.omit({
  userId: true,
  // specific
}).partial()

export const BotFetch = BotModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = BotUpsert.omit({
  blueprintId: true,
  // specific
})
