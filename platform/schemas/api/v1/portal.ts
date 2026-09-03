import { PortalModel } from '@/prisma/zod'

export const PortalCreate = PortalModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PortalUpdate = PortalModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PortalUpsert = PortalModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PortalList = PortalModel.omit({
  userId: true,
  // specific
}).partial()

export const PortalFetch = PortalModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = PortalUpsert.omit({
  blueprintId: true,
  // specific
})
