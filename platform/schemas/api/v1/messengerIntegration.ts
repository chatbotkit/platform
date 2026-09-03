import { MessengerIntegrationModel } from '@/prisma/zod'

export const MessengerIntegrationCreate = MessengerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const MessengerIntegrationUpdate = MessengerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const MessengerIntegrationUpsert = MessengerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const MessengerIntegrationList = MessengerIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const MessengerIntegrationFetch = MessengerIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = MessengerIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
