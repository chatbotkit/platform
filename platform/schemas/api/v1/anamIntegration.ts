import { AnamIntegrationModel } from '@/prisma/zod'

export const AnamIntegrationCreate = AnamIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AnamIntegrationUpdate = AnamIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AnamIntegrationUpsert = AnamIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AnamIntegrationList = AnamIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const AnamIntegrationFetch = AnamIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = AnamIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
