import { SkillsetModel } from '@/prisma/zod'

export const SkillsetCreate = SkillsetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillsetUpdate = SkillsetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillsetUpsert = SkillsetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillsetList = SkillsetModel.omit({
  userId: true,
  // specific
}).partial()

export const SkillsetFetch = SkillsetModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SkillsetUpsert.omit({
  blueprintId: true,
  // specific
})
