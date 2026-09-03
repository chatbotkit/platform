import { SpaceModel } from '@/prisma/zod'

export const SpaceCreate = SpaceModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SpaceUpdate = SpaceModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SpaceUpsert = SpaceModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SpaceList = SpaceModel.omit({
  userId: true,
  // specific
}).partial()

export const SpaceFetch = SpaceModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SpaceUpsert.omit({
  blueprintId: true,
  // specific
})
