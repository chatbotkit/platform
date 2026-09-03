import { RecallIntegrationModel } from '@/prisma/zod'

export const RecallIntegrationCreate = RecallIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const RecallIntegrationUpdate = RecallIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const RecallIntegrationUpsert = RecallIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const RecallIntegrationList = RecallIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const RecallIntegrationFetch = RecallIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = RecallIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
