import { TriggerIntegrationModel } from '@/prisma/zod'

export const TriggerIntegrationCreate = TriggerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  secret: true,
  lastTriggerAt: true,
  nextTriggerAt: true,
}).partial()

export const TriggerIntegrationUpdate = TriggerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  secret: true,
  lastTriggerAt: true,
  nextTriggerAt: true,
}).partial()

export const TriggerIntegrationUpsert = TriggerIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  secret: true,
  lastTriggerAt: true,
  nextTriggerAt: true,
}).partial()

export const TriggerIntegrationList = TriggerIntegrationModel.omit({
  userId: true,
  // specific
  secret: true,
}).partial()

export const TriggerIntegrationFetch = TriggerIntegrationModel.omit({
  userId: true,
  // specific
  secret: true,
}).partial()

export const blueprintSchema = TriggerIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
