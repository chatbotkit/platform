import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getContextBot } from '@/lib/context.store'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.list.ts for ability definitions related
// to these schemas

/**
 * The maximum lifetime for a Redis-backed bot list (48 hours in seconds).
 */
export const LIST_MAX_TTL_SECONDS = 48 * 60 * 60

const listItemSchema = z.custom<unknown>((value) => value !== undefined, {
  message: 'item is required',
})

const listNameSchema = z
  .string()
  .min(1)
  .max(256)
  .describe('The bot-scoped list name')

const listPositionSchema = z
  .enum(['start', 'end'])
  .describe('The list position')

const pushPositionSchema = listPositionSchema
  .default('end')
  .describe('Where to add the item')

const popPositionSchema = listPositionSchema
  .default('start')
  .describe('Where to remove the item from')

/**
 * Schema for pushing an item onto a bot-scoped list.
 */
export const listPushSchema = z.object({
  name: listNameSchema,
  item: listItemSchema.describe('The item to add to the list'),
  position: pushPositionSchema,
})

/**
 * Schema for popping an item from a bot-scoped list.
 */
export const listPopSchema = z.object({
  name: listNameSchema,
  position: popPositionSchema,
})

/**
 * Schema for reading items from a bot-scoped list.
 */
export const listReadSchema = z.object({
  name: listNameSchema,
  position: listPositionSchema
    .default('start')
    .describe('Where to read items from'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('How many items to skip from the selected position'),
  limit: z
    .number()
    .int()
    .min(1)
    .default(100)
    .describe('The maximum number of items to read'),
})

export interface ListPushSchema {
  name: string
  item: unknown
  position: 'start' | 'end'
}

export interface ListPopSchema {
  name: string
  position: 'start' | 'end'
}

export interface ListReadSchema {
  name: string
  position: 'start' | 'end'
  offset: number
  limit: number
}

// @note operation name constants for compile-time validation in action.tags.ts
export const LIST_PUSH_OPERATION_NAME = 'push'
export const LIST_POP_OPERATION_NAME = 'pop'
export const LIST_READ_OPERATION_NAME = 'read'

interface ListActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

type ListEventType = 'action.list.push' | 'action.list.pop' | 'action.list.read'

function getListActionBotId(options: ActionOptions): string | undefined {
  return options.linkedResources?.botId || getContextBot()?.id
}

function getListRedisKey(options: ActionOptions, name: string): string {
  const botId = getListActionBotId(options)

  if (!botId) {
    throw new UserInputError('A bot is required for list actions')
  }

  return `list:${encodeURIComponent(options.userId)}:${encodeURIComponent(
    botId
  )}:${encodeURIComponent(name)}`
}

async function logListEvent({
  type,
  params,
  options,
}: {
  type: ListEventType
  params: ActionParams
  options: ActionOptions
}) {
  await logEvent({
    user: { id: options.userId },
    type,
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })
}

export async function doListPush({
  input,
  params,
  options,
}: ListActionParams): Promise<ActionReturn> {
  debug(`do list push`, {
    input,
    params,
    options,
  }).log('action.exec.list.doListPush')

  await logListEvent({
    type: 'action.list.push',
    params,
    options,
  })

  const { name, item, position } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: listPushSchema,
    options,
  })

  const redisKey = getListRedisKey(options, name)

  debug(`pushing to redis list`, { redisKey, position }).log(
    'action.exec.list.doListPush'
  )

  const length =
    position === 'start'
      ? await memcache.lpush(redisKey, item)
      : await memcache.rpush(redisKey, item)

  if (length === 1) {
    await memcache.expire(redisKey, LIST_MAX_TTL_SECONDS)
  }

  return {
    result: {
      success: true,
      name,
      position,
      length,
    },
    messages: [],
  }
}

export async function doListPop({
  input,
  params,
  options,
}: ListActionParams): Promise<ActionReturn> {
  debug(`do list pop`, {
    input,
    params,
    options,
  }).log('action.exec.list.doListPop')

  await logListEvent({
    type: 'action.list.pop',
    params,
    options,
  })

  const { name, position = 'start' } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: listPopSchema,
    options,
  })

  const redisKey = getListRedisKey(options, name)

  debug(`popping from redis list`, { redisKey, position }).log(
    'action.exec.list.doListPop'
  )

  const item =
    position === 'start'
      ? await memcache.lpop<unknown>(redisKey)
      : await memcache.rpop<unknown>(redisKey)

  return {
    result: {
      name,
      position,
      item: item ?? null,
    },
    messages: [],
  }
}

export async function doListRead({
  input,
  params,
  options,
}: ListActionParams): Promise<ActionReturn> {
  debug(`do list read`, {
    input,
    params,
    options,
  }).log('action.exec.list.doListRead')

  await logListEvent({
    type: 'action.list.read',
    params,
    options,
  })

  const {
    name,
    position = 'start',
    offset = 0,
    limit = 100,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: listReadSchema,
    options,
  })

  const redisKey = getListRedisKey(options, name)
  const rangeStart = position === 'start' ? offset : -(offset + limit)
  const rangeStop = position === 'start' ? offset + limit - 1 : -(offset + 1)

  debug(`reading redis list`, {
    redisKey,
    position,
    offset,
    limit,
    rangeStart,
    rangeStop,
  }).log('action.exec.list.doListRead')

  const items = await memcache.lrange<unknown>(redisKey, rangeStart, rangeStop)

  return {
    result: position === 'start' ? items : [...items].reverse(),
    messages: [],
  }
}

export async function executeListAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute list action`, { input, params, options }).log(
    'action.exec.list.executeListAction'
  )

  type ListOperation =
    | typeof LIST_PUSH_OPERATION_NAME
    | typeof LIST_POP_OPERATION_NAME
    | typeof LIST_READ_OPERATION_NAME

  let operation: ListOperation

  switch (true) {
    case 'push' in params: {
      operation = LIST_PUSH_OPERATION_NAME

      break
    }

    case 'pop' in params: {
      operation = LIST_POP_OPERATION_NAME

      break
    }

    case 'read' in params: {
      operation = LIST_READ_OPERATION_NAME

      break
    }

    default: {
      throw new UserInputError(`Unknown operation`)
    }
  }

  const actionParams = { input, params, options }

  switch (operation) {
    case LIST_PUSH_OPERATION_NAME: {
      return await doListPush(actionParams)
    }

    case LIST_POP_OPERATION_NAME: {
      return await doListPop(actionParams)
    }

    case LIST_READ_OPERATION_NAME: {
      return await doListRead(actionParams)
    }

    default: {
      assertUnreachable(operation)
    }
  }
}
