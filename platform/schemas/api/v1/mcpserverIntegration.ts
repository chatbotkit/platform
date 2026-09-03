import { McpserverIntegrationModel } from '@/prisma/zod'

export const McpserverIntegrationCreate = McpserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const McpserverIntegrationUpdate = McpserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const McpserverIntegrationUpsert = McpserverIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const McpserverIntegrationList = McpserverIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const McpserverIntegrationFetch = McpserverIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = McpserverIntegrationUpsert.omit({
  blueprintId: true,
  // specific
  accessToken: true,
})
