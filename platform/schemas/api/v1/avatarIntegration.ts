import { AvatarIntegrationModel } from '@/prisma/zod'

export const AvatarIntegrationCreate = AvatarIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AvatarIntegrationUpdate = AvatarIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AvatarIntegrationUpsert = AvatarIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AvatarIntegrationList = AvatarIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const AvatarIntegrationFetch = AvatarIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = AvatarIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
