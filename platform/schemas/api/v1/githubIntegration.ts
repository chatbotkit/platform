import { GithubIntegrationModel } from '@/prisma/zod'

export const GithubIntegrationCreate = GithubIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GithubIntegrationUpdate = GithubIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GithubIntegrationUpsert = GithubIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const GithubIntegrationList = GithubIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const GithubIntegrationFetch = GithubIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = GithubIntegrationUpsert.omit({
  blueprintId: true,
  // specific
})
