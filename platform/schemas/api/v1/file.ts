import { FileModel } from '@/prisma/zod'

export const FileCreate = FileModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const FileUpdate = FileModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const FileUpsert = FileModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const FileList = FileModel.omit({
  userId: true,
  // specific
}).partial()

export const FileFetch = FileModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = FileUpsert.omit({
  blueprintId: true,
  // specific
})
