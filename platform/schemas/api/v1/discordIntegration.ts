import { DiscordIntegrationModel } from '@/prisma/zod'

export const DiscordIntegrationCreate = DiscordIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DiscordIntegrationUpdate = DiscordIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DiscordIntegrationUpsert = DiscordIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DiscordIntegrationList = DiscordIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const DiscordIntegrationFetch = DiscordIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = DiscordIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: DiscordIntegrationModel.shape.allowFrom.default('*'),
})
