import { SitemapIntegrationModel } from '@/prisma/zod'

export const SitemapIntegrationCreate = SitemapIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SitemapIntegrationUpdate = SitemapIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SitemapIntegrationUpsert = SitemapIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SitemapIntegrationList = SitemapIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const SitemapIntegrationFetch = SitemapIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SitemapIntegrationUpsert.omit({
  blueprintId: true,
  // specific
  syncStatus: true,
  lastSyncedAt: true,
})
