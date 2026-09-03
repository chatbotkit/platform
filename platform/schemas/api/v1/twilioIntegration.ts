import { TwilioIntegrationModel } from '@/prisma/zod'

export const TwilioIntegrationCreate = TwilioIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TwilioIntegrationUpdate = TwilioIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TwilioIntegrationUpsert = TwilioIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const TwilioIntegrationList = TwilioIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const TwilioIntegrationFetch = TwilioIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = TwilioIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
