import { GooglechatIntegrationModel } from '@/prisma/zod'

export const GooglechatIntegrationCreate = GooglechatIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GooglechatIntegrationUpdate = GooglechatIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GooglechatIntegrationUpsert = GooglechatIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GooglechatIntegrationList = GooglechatIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const GooglechatIntegrationFetch = GooglechatIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = GooglechatIntegrationUpsert.omit({
  blueprintId: true,
  // specific
}).extend({
  allowFrom: GooglechatIntegrationModel.shape.allowFrom.default('*'),
})
