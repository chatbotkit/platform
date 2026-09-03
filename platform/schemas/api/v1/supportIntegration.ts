import { SupportIntegrationModel } from '@/prisma/zod'

export const SupportIntegrationCreate = SupportIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SupportIntegrationUpdate = SupportIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SupportIntegrationUpsert = SupportIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SupportIntegrationList = SupportIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const SupportIntegrationFetch = SupportIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SupportIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
