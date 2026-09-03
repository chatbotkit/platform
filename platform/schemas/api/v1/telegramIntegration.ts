import { TelegramIntegrationModel } from '@/prisma/zod'

export const TelegramIntegrationCreate = TelegramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TelegramIntegrationUpdate = TelegramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TelegramIntegrationUpsert = TelegramIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TelegramIntegrationList = TelegramIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const TelegramIntegrationFetch = TelegramIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = TelegramIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: TelegramIntegrationModel.shape.allowFrom.default('*'),
})
