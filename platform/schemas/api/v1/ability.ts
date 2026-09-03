import { AbilityModel } from '@/prisma/zod'

export const AbilityCreate = AbilityModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AbilityUpdate = AbilityModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AbilityUpsert = AbilityModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const AbilityList = AbilityModel.omit({
  userId: true,
  // specific
}).partial()

export const AbilityFetch = AbilityModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = AbilityUpsert.omit({
  blueprintId: true,
  // specific
})
