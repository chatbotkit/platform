import { MicrosoftteamsIntegrationModel } from '@/prisma/zod'

export const MicrosoftteamsIntegrationCreate = MicrosoftteamsIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const MicrosoftteamsIntegrationUpdate = MicrosoftteamsIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const MicrosoftteamsIntegrationUpsert = MicrosoftteamsIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const MicrosoftteamsIntegrationList = MicrosoftteamsIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const MicrosoftteamsIntegrationFetch = MicrosoftteamsIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = MicrosoftteamsIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: MicrosoftteamsIntegrationModel.shape.allowFrom.default('*'),
})
