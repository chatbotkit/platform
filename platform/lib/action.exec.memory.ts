import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getScopedResourceFilter } from '@/lib/action.filter'
import { getContextBot, getContextContact } from '@/lib/context.store'
import debug from '@/lib/debug'
import { UserInputError, UserResourceNotFoundError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { rerankMemories } from '@/lib/memory.search'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.memory.ts for ability definitions related
// to these schemas

/**
 * Access scope
 */
const scope = z.enum(['user', 'contact', 'bot']).describe('The access scope')

/**
 * Schema for searching memories - requires search query
 */
export const memorySearchSchema = z.object({
  '@scope': scope,
  query: z.string().min(1).describe('The search query'),
})

/**
 * Schema for listing memories - no parameters required
 */
export const memoryListSchema = z.object({
  '@scope': scope,
})

/**
 * Schema for creating a memory - requires text content
 */
export const memoryCreateSchema = z.object({
  '@scope': scope,
  text: z.string().min(1).describe('The text content of the memory'),
})

/**
 * Schema for updating a memory - requires memory ID and new text
 */
export const memoryUpdateSchema = z.object({
  '@scope': scope,
  memoryId: z.string().min(1).describe('The memory ID to update'),
  text: z.string().min(1).describe('The new text content'),
})

/**
 * Schema for deleting a memory - requires memory ID
 */
export const memoryDeleteSchema = z.object({
  '@scope': scope,
  memoryId: z.string().min(1).describe('The memory ID to delete'),
})

/**
 * Inferred type for memory search schema
 */
export type MemorySearchSchema = z.infer<typeof memorySearchSchema>

/**
 * Inferred type for memory list schema
 */
export type MemoryListSchema = z.infer<typeof memoryListSchema>

/**
 * Inferred type for memory create schema
 */
export type MemoryCreateSchema = z.infer<typeof memoryCreateSchema>

/**
 * Inferred type for memory update schema
 */
export type MemoryUpdateSchema = z.infer<typeof memoryUpdateSchema>

/**
 * Inferred type for memory delete schema
 */
export type MemoryDeleteSchema = z.infer<typeof memoryDeleteSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const MEMORY_SEARCH_OPERATION_NAME = 'search'
export const MEMORY_LIST_OPERATION_NAME = 'list'
export const MEMORY_CREATE_OPERATION_NAME = 'create'
export const MEMORY_UPDATE_OPERATION_NAME = 'update'
export const MEMORY_DELETE_OPERATION_NAME = 'delete'

/**
 * The parameters for memory actions.
 */
interface MemoryActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

/**
 * This function performs memory search logic.
 */
export async function doMemorySearch({
  input,
  params,
  options,
}: MemoryActionParams): Promise<ActionReturn> {
  debug(`do memory search`, {
    input,
    params,
    options,
  }).log('action.exec.memory.doMemorySearch')

  await logEvent({
    user: { id: options.userId },
    type: 'action.memory.search',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { '@scope': scope, query } = getConfigBySchema({
    input,
    params,
    initial: {
      query: input,
    },
    schema: memorySearchSchema,
    options,
  })

  debug(`vars`, { scope, query }).log('action.exec.memory.doMemorySearch')

  const memories = await prisma.memory.findMany({
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

      text: true,

      createdAt: true,
      updatedAt: true,
    },

    orderBy: {
      updatedAt: 'desc',
    },

    take: 100, // @note fetch more for reranking, then trim
  })

  debug(`memories fetched`, { count: memories.length }).log(
    'action.exec.memory.doMemorySearch'
  )

  const result = await rerankMemories(query, memories, 10, {
    user: { id: options.userId },
  })

  debug(`result`, { count: result.length }).log(
    'action.exec.memory.doMemorySearch'
  )

  return {
    result: result.map(({ text }) => text),
    messages: [],
  }
}

/**
 * This function performs memory listing logic.
 */
export async function doMemoryList({
  input,
  params,
  options,
}: MemoryActionParams): Promise<ActionReturn> {
  debug(`do memory list`, {
    input,
    params,
    options,
  }).log('action.exec.memory.doMemoryList')

  await logEvent({
    user: { id: options.userId },
    type: 'action.memory.list',
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
    schema: memoryListSchema,
    options,
  })

  debug(`vars`, { scope }).log('action.exec.memory.doMemoryList')

  const memories = await prisma.memory.findMany({
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
      text: true,
      createdAt: true,
      updatedAt: true,
    },

    orderBy: {
      updatedAt: 'desc',
    },

    take: 50,
  })

  debug(`memories`, { count: memories.length }).log(
    'action.exec.memory.doMemoryList'
  )

  return {
    result: memories,
    messages: [],
  }
}

/**
 * This function performs memory creation logic.
 */
async function doMemoryCreate({
  input,
  params,
  options,
}: MemoryActionParams): Promise<ActionReturn> {
  debug(`do memory create`, {
    input,
    params,
    options,
  }).log('action.exec.memory.doMemoryCreate')

  await logEvent({
    user: { id: options.userId },
    type: 'action.memory.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { '@scope': scope, text } = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: memoryCreateSchema,
    options,
  })

  debug(`vars`, { scope, text }).log('action.exec.memory.doMemoryCreate')

  // @note determine which IDs to associate based on scope
  let contactId: string | undefined
  let botId: string | undefined

  switch (scope) {
    case 'contact': {
      const contact = getContextContact()

      contactId = contact?.id

      break
    }

    case 'bot': {
      const bot = getContextBot()

      botId = bot?.id || options.linkedResources?.botId

      break
    }

    case 'user':
    default: {
      // No additional associations for user scope
      break
    }
  }

  const { id } = await prisma.memory.create({
    data: {
      userId: options.userId,

      text: text,

      contactId,
      botId,
    },
  })

  debug(`memory`, { id }).log('action.exec.memory.doMemoryCreate')

  return {
    result: { id },
    messages: [],
  }
}

/**
 * This function performs memory update logic.
 */
export async function doMemoryUpdate({
  input,
  params,
  options,
}: MemoryActionParams): Promise<ActionReturn> {
  debug(`do memory update`, {
    input,
    params,
    options,
  }).log('action.exec.memory.doMemoryUpdate')

  await logEvent({
    user: { id: options.userId },
    type: 'action.memory.update',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    memoryId,
    text,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: memoryUpdateSchema,
    options,
  })

  debug(`vars`, { scope, memoryId, text }).log(
    'action.exec.memory.doMemoryUpdate'
  )

  const memory = await prisma.memory.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
      }),

      id: memoryId,

      userId: options.userId, // @note added for more security
    },
  })

  if (!memory) {
    throw new UserResourceNotFoundError(`Memory not found`)
  }

  await prisma.memory.update({
    where: {
      id: memoryId,
    },

    data: {
      text,
    },
  })

  debug(`memory`, { memoryId }).log('action.exec.memory.doMemoryUpdate')

  return {
    result: { memoryId },
    messages: [],
  }
}

/**
 * This function performs memory deletion logic.
 */
export async function doMemoryDelete({
  input,
  params,
  options,
}: MemoryActionParams): Promise<ActionReturn> {
  debug(`do memory delete`, {
    input,
    params,
    options,
  }).log('action.exec.memory.doMemoryDelete')

  await logEvent({
    user: { id: options.userId },
    type: 'action.memory.delete',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { '@scope': scope, memoryId } = getConfigBySchema({
    input,
    params,
    initial: {
      memoryId: input,
    },
    schema: memoryDeleteSchema,
    options,
  })

  debug(`vars`, { scope, memoryId }).log('action.exec.memory.doMemoryDelete')

  const memory = await prisma.memory.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
      }),

      id: memoryId,

      userId: options.userId, // @note added for more security
    },
  })

  if (!memory) {
    throw new UserResourceNotFoundError(`Memory not found`)
  }

  await prisma.memory.delete({
    where: {
      id: memoryId,
    },
  })

  debug(`memory`, { memoryId }).log('action.exec.memory.doMemoryDelete')

  return {
    result: { memoryId },
    messages: [],
  }
}

/**
 * The main router for the memory action.
 */
export async function executeMemoryAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute memory action`, { input, params, options }).log(
    'action.exec.memory.executeMemoryAction'
  )

  type MemoryOperation =
    | typeof MEMORY_SEARCH_OPERATION_NAME
    | typeof MEMORY_LIST_OPERATION_NAME
    | typeof MEMORY_CREATE_OPERATION_NAME
    | typeof MEMORY_UPDATE_OPERATION_NAME
    | typeof MEMORY_DELETE_OPERATION_NAME

  let operation: MemoryOperation

  {
    switch (true) {
      case 'search' in params: {
        operation = MEMORY_SEARCH_OPERATION_NAME

        break
      }

      case 'list' in params: {
        operation = MEMORY_LIST_OPERATION_NAME

        break
      }

      case 'create' in params: {
        operation = MEMORY_CREATE_OPERATION_NAME

        break
      }

      case 'update' in params: {
        operation = MEMORY_UPDATE_OPERATION_NAME

        break
      }

      case 'delete' in params: {
        operation = MEMORY_DELETE_OPERATION_NAME

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
    case MEMORY_SEARCH_OPERATION_NAME: {
      response = await doMemorySearch(actionParams)

      break
    }

    case MEMORY_LIST_OPERATION_NAME: {
      response = await doMemoryList(actionParams)

      break
    }

    case MEMORY_CREATE_OPERATION_NAME: {
      response = await doMemoryCreate(actionParams)

      break
    }

    case MEMORY_UPDATE_OPERATION_NAME: {
      response = await doMemoryUpdate(actionParams)

      break
    }

    case MEMORY_DELETE_OPERATION_NAME: {
      response = await doMemoryDelete(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
