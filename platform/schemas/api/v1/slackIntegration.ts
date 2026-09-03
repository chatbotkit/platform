import { SlackIntegrationModel } from '@/prisma/zod'

export const SlackIntegrationCreate = SlackIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SlackIntegrationUpdate = SlackIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SlackIntegrationUpsert = SlackIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const SlackIntegrationList = SlackIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const SlackIntegrationFetch = SlackIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = SlackIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: SlackIntegrationModel.shape.allowFrom.default('*'),
})
