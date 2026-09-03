import { DatasetModel } from '@/prisma/zod'

export const DatasetCreate = DatasetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DatasetUpdate = DatasetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DatasetUpsert = DatasetModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const DatasetList = DatasetModel.omit({
  userId: true,
  // specific
}).partial()

export const DatasetFetch = DatasetModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = DatasetUpsert.omit({
  blueprintId: true,
  // specific
  recordMaxTokens: true,
  searchMinScore: true,
  searchMaxRecords: true,
  searchMaxTokens: true,
  separators: true,
  matchInstruction: true,
  mismatchInstruction: true,
})
