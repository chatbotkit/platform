import { TaskModel } from '@/prisma/zod'

export const TaskCreate = TaskModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  status: true,
  outcome: true,
  nextRunAt: true,
  lastRunAt: true,
}).partial()

export const TaskUpdate = TaskModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  status: true,
  outcome: true,
  nextRunAt: true,
  lastRunAt: true,
}).partial()

export const TaskUpsert = TaskModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
  status: true,
  outcome: true,
  nextRunAt: true,
  lastRunAt: true,
}).partial()

export const TaskList = TaskModel.omit({
  userId: true,
  // specific
}).partial()

export const TaskFetch = TaskModel.omit({
  userId: true,
  // specific
}).partial()

export const blueprintSchema = TaskUpsert.omit({
  blueprintId: true,
  // specific
  contactId: true,
  expiresAt: true,
})
