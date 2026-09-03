import { WhatsappIntegrationModel } from '@/prisma/zod'

export const WhatsappIntegrationCreate = WhatsappIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const WhatsappIntegrationUpdate = WhatsappIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const WhatsappIntegrationUpsert = WhatsappIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  verifyToken: true,
}).partial()

export const WhatsappIntegrationList = WhatsappIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const WhatsappIntegrationFetch = WhatsappIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = WhatsappIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: WhatsappIntegrationModel.shape.allowFrom.default('*'),
})
