import { PolicyModel } from '@/prisma/zod'

export const PolicyCreate = PolicyModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PolicyUpdate = PolicyModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PolicyUpsert = PolicyModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const PolicyList = PolicyModel.omit({
  userId: true,
  // specific
}).partial()

export const PolicyFetch = PolicyModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = PolicyUpsert.omit({
  blueprintId: true,
  // specific
})
