import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import type { User } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getScopedResourceFilter } from '@/lib/action.filter'
import { canUseBot } from '@/lib/bot.access'
import {
  getContextBot,
  getContextConversation,
  getContextUser,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { UserInputError, UserResourceNotFoundError } from '@/lib/error'
import { buildMetaQueryFilter } from '@/lib/filter'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.rating.ts for ability definitions related
// to these schemas

const scope = z.enum(['user', 'contact', 'bot']).describe('The access scope')

type RatingScope = z.infer<typeof scope>

export const ratingListSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  value: z.number().int().optional().describe('Optional rating value filter'),
  meta: z.record(z.unknown()).optional().describe('Optional metadata filter'),
})

export const ratingFetchSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  ratingId: z.string().min(1).describe('The rating ID to fetch'),
})

export const ratingCreateSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to assign'),
  name: z.string().optional().describe('The name of the rating'),
  description: z.string().optional().describe('The description of the rating'),
  value: z.number().int().describe('The rating value'),
  reason: z
    .union([z.string(), z.null()])
    .optional()
    .describe('Optional reason for the rating'),
  conversationId: z
    .string()
    .min(1)
    .optional()
    .describe('Optional conversation ID to associate with the rating'),
  messageId: z
    .string()
    .min(1)
    .optional()
    .describe('Optional message ID to associate with the rating'),
  meta: z
    .record(z.unknown())
    .optional()
    .describe('Optional metadata to store on the rating'),
})

export const ratingDeleteSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  ratingId: z.string().min(1).describe('The rating ID to delete'),
})

export type RatingListSchema = z.infer<typeof ratingListSchema>
export type RatingFetchSchema = z.infer<typeof ratingFetchSchema>
export type RatingCreateSchema = z.infer<typeof ratingCreateSchema>
export type RatingDeleteSchema = z.infer<typeof ratingDeleteSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const RATING_LIST_OPERATION_NAME = 'list'
export const RATING_FETCH_OPERATION_NAME = 'fetch'
export const RATING_CREATE_OPERATION_NAME = 'create'
export const RATING_DELETE_OPERATION_NAME = 'delete'

interface RatingActionParams {
  user: User
  input: string
  params: ActionParams
  options: ActionOptions
}

function getRatingActionBotId(
  options: ActionOptions,
  explicitBotId?: string
): string | undefined {
  const linkedBotId = options.linkedResources?.botId

  if (linkedBotId) {
    return linkedBotId
  }

  if (explicitBotId) {
    return explicitBotId
  }

  const contextBotId = getContextBot()?.id

  if (contextBotId) {
    return contextBotId
  }

  return undefined
}

async function getRatingScopedWhere({
  userId,
  scope,
  options,
  explicitBotId,
}: {
  userId: string
  scope: RatingScope
  options: ActionOptions
  explicitBotId?: string
}) {
  const botId = getRatingActionBotId(options, explicitBotId)

  if (botId) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } })

    if (!bot || (await canUseBot(userId, bot)) === false) {
      throw new UserInputError(`Bot not found`)
    }
  }

  const linkedResources = botId
    ? {
        ...(options.linkedResources || {}),
        botId,
      }
    : options.linkedResources

  const scopedWhere = getScopedResourceFilter({
    userId,
    scope,
    linkedResources,
  })

  if (!botId) {
    return scopedWhere
  }

  return {
    ...scopedWhere,
    botId,
  }
}

function normalizeRatingReason(reason: string | null | undefined) {
  if (reason === '') {
    return null
  }

  return reason
}

export async function doRatingList({
  user,
  input,
  params,
  options,
}: RatingActionParams): Promise<ActionReturn> {
  debug(`do rating list`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.rating.doRatingList')

  const {
    '@scope': scope,
    botId,
    value,
    meta,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: ratingListSchema,
    options,
  })

  const listScopedWhere = await getRatingScopedWhere({
    userId: user.id,
    scope,
    options,
    explicitBotId: botId,
  })

  let metaWhere = {}

  if (meta && Object.keys(meta).length > 0) {
    metaWhere = {
      AND: buildMetaQueryFilter(meta),
    }
  }

  const ratings = await prisma.rating.findMany({
    where: {
      ...listScopedWhere,
      ...(typeof value === 'number' ? { value } : {}),
      ...metaWhere,
    },
    select: {
      id: true,
      name: true,
      description: true,
      contactId: true,
      botId: true,
      conversationId: true,
      messageId: true,
      value: true,
      reason: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  return {
    result: ratings,
    messages: [],
  }
}

export async function doRatingFetch({
  user,
  input,
  params,
  options,
}: RatingActionParams): Promise<ActionReturn> {
  debug(`do rating fetch`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.rating.doRatingFetch')

  const {
    '@scope': scope,
    botId,
    ratingId,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: ratingFetchSchema,
    options,
  })

  const fetchScopedWhere = await getRatingScopedWhere({
    userId: user.id,
    scope,
    options,
    explicitBotId: botId,
  })

  const rating = await prisma.rating.findFirst({
    where: {
      ...fetchScopedWhere,
      id: ratingId,
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      contactId: true,
      botId: true,
      conversationId: true,
      messageId: true,
      value: true,
      reason: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!rating) {
    throw new UserResourceNotFoundError(`Rating not found`)
  }

  return {
    result: rating,
    messages: [],
  }
}

export async function doRatingCreate({
  user,
  input,
  params,
  options,
}: RatingActionParams): Promise<ActionReturn> {
  debug(`do rating create`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.rating.doRatingCreate')

  const {
    '@scope': scope,
    botId,
    name,
    description,
    value,
    reason,
    conversationId,
    messageId,
    meta,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: ratingCreateSchema,
    options,
  })

  const createScopedWhere = await getRatingScopedWhere({
    userId: user.id,
    scope,
    options,
    explicitBotId: botId,
  })

  const resolvedConversationId = conversationId || getContextConversation()?.id

  const rating = await prisma.rating.create({
    data: {
      userId: user.id,
      botId: 'botId' in createScopedWhere ? createScopedWhere.botId : null,
      contactId:
        'contactId' in createScopedWhere ? createScopedWhere.contactId : null,
      conversationId: resolvedConversationId || null,
      messageId: messageId || null,
      name,
      description,
      value,
      reason: normalizeRatingReason(reason),
      meta,
    },
    select: {
      id: true,
      name: true,
      description: true,
      contactId: true,
      botId: true,
      conversationId: true,
      messageId: true,
      value: true,
      reason: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    result: rating,
    messages: [],
  }
}

export async function doRatingDelete({
  user,
  input,
  params,
  options,
}: RatingActionParams): Promise<ActionReturn> {
  debug(`do rating delete`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.rating.doRatingDelete')

  const {
    '@scope': scope,
    botId,
    ratingId,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: ratingDeleteSchema,
    options,
  })

  const deleteScopedWhere = await getRatingScopedWhere({
    userId: user.id,
    scope,
    options,
    explicitBotId: botId,
  })

  const existingRating = await prisma.rating.findFirst({
    where: {
      ...deleteScopedWhere,
      id: ratingId,
      userId: user.id,
    },
  })

  if (!existingRating) {
    throw new UserResourceNotFoundError(`Rating not found`)
  }

  const rating = await prisma.rating.delete({
    where: {
      id: ratingId,
    },
    select: {
      id: true,
    },
  })

  return {
    result: rating,
    messages: [],
  }
}

export async function executeRatingAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute rating action`, { input, params, options }).log(
    'action.exec.rating.executeRatingAction'
  )

  const user = getContextUser()

  if (!user) {
    throw new Error(`Missing user`)
  }

  type RatingOperation =
    | typeof RATING_LIST_OPERATION_NAME
    | typeof RATING_FETCH_OPERATION_NAME
    | typeof RATING_CREATE_OPERATION_NAME
    | typeof RATING_DELETE_OPERATION_NAME

  let operation: RatingOperation

  {
    switch (true) {
      case 'list' in params: {
        operation = RATING_LIST_OPERATION_NAME

        break
      }

      case 'fetch' in params: {
        operation = RATING_FETCH_OPERATION_NAME

        break
      }

      case 'create' in params: {
        operation = RATING_CREATE_OPERATION_NAME

        break
      }

      case 'delete' in params: {
        operation = RATING_DELETE_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  const actionParams = { user, input, params, options }

  let response: ActionReturn

  switch (operation) {
    case RATING_LIST_OPERATION_NAME: {
      response = await doRatingList(actionParams)

      break
    }

    case RATING_FETCH_OPERATION_NAME: {
      response = await doRatingFetch(actionParams)

      break
    }

    case RATING_CREATE_OPERATION_NAME: {
      response = await doRatingCreate(actionParams)

      break
    }

    case RATING_DELETE_OPERATION_NAME: {
      response = await doRatingDelete(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

/**
 * @doc Skillsets
 * @index 39
 *
 * ## Rating Actions
 *
 * Rating actions let skillsets create, inspect, list, and delete structured
 * feedback records for bots and contacts using the current conversation scope.
 */
