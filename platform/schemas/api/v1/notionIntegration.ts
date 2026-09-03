import { NotionIntegrationModel } from '@/prisma/zod'

export const NotionIntegrationCreate = NotionIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const NotionIntegrationUpdate = NotionIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const NotionIntegrationUpsert = NotionIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const NotionIntegrationList = NotionIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const NotionIntegrationFetch = NotionIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = NotionIntegrationUpsert.omit({
  blueprintId: true,
  // specific
  syncStatus: true,
  lastSyncedAt: true,
})
