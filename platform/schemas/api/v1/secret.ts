import { SecretModel } from '@/prisma/zod'

export const SecretCreate = SecretModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SecretUpdate = SecretModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SecretUpsert = SecretModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SecretList = SecretModel.omit({
  userId: true,
  // specific
}).partial()

export const SecretFetch = SecretModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SecretUpsert.omit({
  blueprintId: true,
})
