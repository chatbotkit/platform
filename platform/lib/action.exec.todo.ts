import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.todo.ts for ability definitions related
// to these schemas

/**
 * The default TTL for todo items in Redis (24 hours in seconds)
 */
const TODO_TTL_SECONDS = 24 * 60 * 60

/**
 * Todo item status
 */
const todoStatusSchema = z.enum(['not-started', 'in-progress', 'completed'])

/**
 * A single todo item
 */
const todoItemSchema = z.object({
  id: z.number().describe('Unique identifier for the todo'),
  title: z.string().min(1).describe('The title of the todo item'),
  status: todoStatusSchema.describe('The status of the todo item'),
})

/**
 * Schema for managing todos - single unified operation
 */
export const todoManageSchema = z.object({
  op: z
    .enum(['read', 'write'])
    .describe('The operation to perform: read or write'),
  todoList: z
    .array(todoItemSchema)
    .optional()
    .describe(
      'Complete array of all todo items (required for write operation)'
    ),
})

/**
 * Inferred type for todo item
 */
export type TodoItem = z.infer<typeof todoItemSchema>

/**
 * Inferred type for todo manage schema
 */
export type TodoManageSchema = z.infer<typeof todoManageSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const TODO_MANAGE_OPERATION_NAME = 'manage'
export const TODO_READ_OPERATION_NAME = 'read'
export const TODO_WRITE_OPERATION_NAME = 'write'

/**
 * The parameters for todo actions.
 */
interface TodoActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

/**
 * Generates the Redis key for storing todos based on namespace or session ID.
 *
 * @param options - The action options containing meta with namespace/session info
 * @returns The Redis key for the todo list
 */
function getTodoRedisKey(options: ActionOptions): string {
  // @note prefer namespace if provided, otherwise fall back to session id
  const namespace =
    (options.meta?.namespace as string) ||
    (options.meta?.sessionId as string) ||
    (options.meta?.conversationId as string) ||
    options.userId

  return `todo:${namespace}`
}

/**
 * Reads the current todo list from Redis.
 */
export async function doTodoRead({
  input,
  params,
  options,
}: TodoActionParams): Promise<ActionReturn> {
  debug(`do todo read`, {
    input,
    params,
    options,
  }).log('action.exec.todo.doTodoRead')

  await logEvent({
    user: { id: options.userId },
    type: 'action.todo.read',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const redisKey = getTodoRedisKey(options)

  debug(`reading from redis key`, { redisKey }).log(
    'action.exec.todo.doTodoRead'
  )

  const todoData = await memcache.get<TodoItem[]>(redisKey)

  debug(`todos`, { count: todoData?.length ?? 0 }).log(
    'action.exec.todo.doTodoRead'
  )

  return {
    result: todoData || [],
    messages: [],
  }
}

/**
 * Writes the todo list to Redis, replacing the entire list.
 */
export async function doTodoWrite({
  input,
  params,
  options,
}: TodoActionParams): Promise<ActionReturn> {
  debug(`do todo write`, {
    input,
    params,
    options,
  }).log('action.exec.todo.doTodoWrite')

  await logEvent({
    user: { id: options.userId },
    type: 'action.todo.write',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { todoList } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: todoManageSchema,
    options,
  })

  if (!todoList) {
    throw new UserInputError('todoList is required for write operation')
  }

  const redisKey = getTodoRedisKey(options)

  debug(`writing to redis key`, { redisKey, todoCount: todoList.length }).log(
    'action.exec.todo.doTodoWrite'
  )

  // @note set with expiration to auto-cleanup after inactivity
  await memcache.set(redisKey, todoList, { ex: TODO_TTL_SECONDS })

  debug(`todos written`, { count: todoList.length }).log(
    'action.exec.todo.doTodoWrite'
  )

  return {
    result: { success: true, count: todoList.length },
    messages: [],
  }
}

/**
 * Manages todos using a single unified operation with an op parameter.
 * This function routes to read or write based on the op parameter.
 */
export async function doTodoManage({
  input,
  params,
  options,
}: TodoActionParams): Promise<ActionReturn> {
  debug(`do todo manage`, {
    input,
    params,
    options,
  }).log('action.exec.todo.doTodoManage')

  const { op } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: z.object({ op: z.enum(['read', 'write']) }),
    options,
  })

  switch (op) {
    case 'read': {
      return doTodoRead({ input, params, options })
    }

    case 'write': {
      return doTodoWrite({ input, params, options })
    }

    default: {
      assertUnreachable(op)
    }
  }
}

/**
 * The main router for the todo action.
 */
export async function executeTodoAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute todo action`, { input, params, options }).log(
    'action.exec.todo.executeTodoAction'
  )

  type TodoOperation =
    | typeof TODO_MANAGE_OPERATION_NAME
    | typeof TODO_READ_OPERATION_NAME
    | typeof TODO_WRITE_OPERATION_NAME

  let operation: TodoOperation

  // @note determine operation from params
  {
    switch (true) {
      case 'manage' in params: {
        operation = TODO_MANAGE_OPERATION_NAME

        break
      }

      case 'read' in params: {
        operation = TODO_READ_OPERATION_NAME

        break
      }

      case 'write' in params: {
        operation = TODO_WRITE_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  const actionParams = { input, params, options }

  switch (operation) {
    case TODO_MANAGE_OPERATION_NAME: {
      response = await doTodoManage(actionParams)

      break
    }

    case TODO_READ_OPERATION_NAME: {
      response = await doTodoRead(actionParams)

      break
    }

    case TODO_WRITE_OPERATION_NAME: {
      response = await doTodoWrite(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
