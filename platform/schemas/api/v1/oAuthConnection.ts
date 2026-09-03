import { OAuthConnectionModel } from '@/prisma/zod'

export const OAuthConnectionCreate = OAuthConnectionModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const OAuthConnectionUpdate = OAuthConnectionModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const OAuthConnectionUpsert = OAuthConnectionModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const OAuthConnectionList = OAuthConnectionModel.omit({
  userId: true,
  // specific
}).partial()

export const OAuthConnectionFetch = OAuthConnectionModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = OAuthConnectionUpsert.omit({
  blueprintId: true,
})
