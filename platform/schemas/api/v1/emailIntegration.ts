import { EmailIntegrationModel } from '@/prisma/zod'

export const EmailIntegrationCreate = EmailIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const EmailIntegrationUpdate = EmailIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const EmailIntegrationUpsert = EmailIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const EmailIntegrationList = EmailIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const EmailIntegrationFetch = EmailIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = EmailIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: EmailIntegrationModel.shape.allowFrom.default('*'),
})
