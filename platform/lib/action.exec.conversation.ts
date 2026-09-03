import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getScopedResourceFilter } from '@/lib/action.filter'
import debug from '@/lib/debug'
import { UserInputError, UserResourceNotFoundError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { getSortedMessages } from '@/lib/message'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.conversation.ts for ability definitions
// related to these schemas

/**
 * Access scope
 */
const scope = z.enum(['user', 'contact', 'bot']).describe('The access scope')

/**
 * Schema for searching conversations - requires search query
 */
export const conversationSearchSchema = z.object({
  '@scope': scope,
  query: z.string().min(1).describe('The search query'),
})

/**
 * Schema for listing conversations - no parameters required
 */
export const conversationListSchema = z.object({
  '@scope': scope,
})

/**
 * Schema for fetching a single conversation - requires conversation ID
 */
export const conversationFetchSchema = z.object({
  '@scope': scope,
  conversationId: z.string().min(1).describe('The conversation ID to fetch'),
})

/**
 * Inferred type for conversation search schema
 */
export type ConversationSearchSchema = z.infer<typeof conversationSearchSchema>

/**
 * Inferred type for conversation list schema
 */
export type ConversationListSchema = z.infer<typeof conversationListSchema>

/**
 * Inferred type for conversation fetch schema
 */
export type ConversationFetchSchema = z.infer<typeof conversationFetchSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const CONVERSATION_SEARCH_OPERATION_NAME = 'search'
export const CONVERSATION_LIST_OPERATION_NAME = 'list'
export const CONVERSATION_FETCH_OPERATION_NAME = 'fetch'

/**
 * The parameters for conversation actions.
 */
interface ConversationActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

/**
 * This function performs conversation search logic.
 */
export async function doConversationSearch({
  input,
  params,
  options,
}: ConversationActionParams): Promise<ActionReturn> {
  debug(`do conversation search`, {
    input,
    params,
    options,
  }).log('action.exec.conversation.doConversationSearch')

  await logEvent({
    user: { id: options.userId },
    type: 'action.conversation.search',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Conversation search is not yet available`)
}

/**
 * This function performs conversation listing logic.
 */
export async function doConversationList({
  input,
  params,
  options,
}: ConversationActionParams): Promise<ActionReturn> {
  debug(`do conversation list`, {
    input,
    params,
    options,
  }).log('action.exec.conversation.doConversationList')

  await logEvent({
    user: { id: options.userId },
    type: 'action.conversation.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { '@scope': scope } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: conversationListSchema,
    options,
  })

  debug(`vars`, { scope }).log('action.exec.conversation.doConversationList')

  const conversations = await prisma.conversation.findMany({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
      }),

      userId: options.userId, // @note added for more security
    },

    select: {
      id: true,

      name: true,
      description: true,
    },

    orderBy: {
      createdAt: 'desc',
    },

    take: 100,
  })

  debug(`conversations`, { conversations }).log(
    'action.exec.conversation.doConversationList'
  )

  return {
    result: conversations,
    messages: [],
  }
}

/**
 * This function performs conversation fetching logic.
 */
export async function doConversationFetch({
  input,
  params,
  options,
}: ConversationActionParams): Promise<ActionReturn> {
  debug(`do conversation fetch`, {
    input,
    params,
    options,
  }).log('action.exec.conversation.doConversationFetch')

  await logEvent({
    user: { id: options.userId },
    type: 'action.conversation.fetch',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { '@scope': scope, conversationId } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: conversationFetchSchema,
    options,
  })

  debug(`vars`, { scope, conversationId }).log(
    'action.exec.conversation.doConversationFetch'
  )

  const conversation = await prisma.conversation.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
      }),

      id: conversationId,

      userId: options.userId, // @note added for more security
    },

    select: {
      id: true,

      name: true,
      description: true,

      messages: {
        where: {
          type: {
            in: [MessageType.bot, MessageType.user],
          },
        },

        select: {
          type: true,
          text: true,

          createdAt: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 100,
      },
    },
  })

  if (!conversation) {
    throw new UserResourceNotFoundError(`Conversation not found`)
  }

  conversation.messages = getSortedMessages(conversation.messages)

  debug(`conversation`, { conversation }).log(
    'action.exec.conversation.doConversationFetch'
  )

  return {
    result: conversation,
    messages: [],
  }
}

/**
 * The main router for the conversation action.
 */
export async function executeConversationAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute conversation action`, { input, params, options }).log(
    'action.exec.conversation.executeConversationAction'
  )

  type ConversationOperation =
    | typeof CONVERSATION_SEARCH_OPERATION_NAME
    | typeof CONVERSATION_LIST_OPERATION_NAME
    | typeof CONVERSATION_FETCH_OPERATION_NAME

  let operation: ConversationOperation

  {
    switch (true) {
      case 'search' in params: {
        operation = CONVERSATION_SEARCH_OPERATION_NAME

        break
      }

      case 'list' in params: {
        operation = CONVERSATION_LIST_OPERATION_NAME

        break
      }

      case 'fetch' in params: {
        operation = CONVERSATION_FETCH_OPERATION_NAME

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
    case CONVERSATION_SEARCH_OPERATION_NAME: {
      response = await doConversationSearch(actionParams)

      break
    }

    case CONVERSATION_LIST_OPERATION_NAME: {
      response = await doConversationList(actionParams)

      break
    }

    case CONVERSATION_FETCH_OPERATION_NAME: {
      response = await doConversationFetch(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
