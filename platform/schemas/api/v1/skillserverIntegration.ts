import { SkillserverIntegrationModel } from '@/prisma/zod'

export const SkillserverIntegrationCreate = SkillserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillserverIntegrationUpdate = SkillserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillserverIntegrationUpsert = SkillserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SkillserverIntegrationList = SkillserverIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const SkillserverIntegrationFetch = SkillserverIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SkillserverIntegrationUpsert.omit({
  blueprintId: true,
  // specific
  accessToken: true,
})
