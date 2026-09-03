import { ExtractIntegrationModel } from '@/prisma/zod'

export const ExtractIntegrationCreate = ExtractIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const ExtractIntegrationUpdate = ExtractIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const ExtractIntegrationUpsert = ExtractIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const ExtractIntegrationList = ExtractIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const ExtractIntegrationFetch = ExtractIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = ExtractIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
