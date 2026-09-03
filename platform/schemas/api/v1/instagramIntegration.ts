import { InstagramIntegrationModel } from '@/prisma/zod'

export const InstagramIntegrationCreate = InstagramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const InstagramIntegrationUpdate = InstagramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const InstagramIntegrationUpsert = InstagramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const InstagramIntegrationList = InstagramIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const InstagramIntegrationFetch = InstagramIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = InstagramIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
