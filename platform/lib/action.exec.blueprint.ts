import { timeAgo } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { ResourceState } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import {
  BULLETIN_DEFAULT_TTL_SECONDS,
  BULLETIN_MAX_TEXT_LENGTH,
  BULLETIN_MAX_TTL_SECONDS,
  type BlueprintBulletin,
  createBlueprintBulletin,
  listBlueprintBulletins,
} from '@/lib/blueprint.bulletin'
import { getUserClient } from '@/lib/cbk.sdk'
import { getContextBot } from '@/lib/context.store'
import debug from '@/lib/debug'
import { getShortDescription } from '@/lib/description.parse'
import { jmespath } from '@/lib/jmespath'
import { jsonpath } from '@/lib/jsonpath'
import { logEvent } from '@/lib/log'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.blueprint.ts for ability definitions related
// to these schemas

/**
 * Schema for listing blueprint resources - optionally filter by resource type
 */
export const blueprintResourceListSchema = z.object({
  blueprintId: z.string().optional().describe('The blueprint ID to query'),
  type: z
    .enum([
      'all',
      'bot',
      'dataset',
      'skillset',
      'ability',
      'file',
      'secret',
      'space',
      // @todo add integration type
    ])
    .optional()
    .describe('Optional resource type to filter by'),
})

/**
 * Inferred type for blueprint resource list schema
 */
export type BlueprintResourceListSchema = z.infer<
  typeof blueprintResourceListSchema
>

/**
 * Schema for listing blueprint notes
 */
export const blueprintNoteListSchema = z.object({
  blueprintId: z.string().optional().describe('The blueprint ID to query'),
})

/**
 * Inferred type for blueprint note list schema
 */
export type BlueprintNoteListSchema = z.infer<typeof blueprintNoteListSchema>

/**
 * Schema for listing blueprint bulletins
 */
export const blueprintBulletinListSchema = z.object({
  blueprintId: z.string().optional().describe('The blueprint ID to query'),
})

/**
 * Inferred type for blueprint bulletin list schema
 */
export type BlueprintBulletinListSchema = z.infer<
  typeof blueprintBulletinListSchema
>

/**
 * Schema for creating a blueprint bulletin
 */
export const blueprintBulletinCreateSchema = z.object({
  blueprintId: z.string().optional().describe('The blueprint ID to query'),
  text: z
    .string()
    .min(1)
    .max(BULLETIN_MAX_TEXT_LENGTH)
    .describe('The message to post to the shared blueprint bulletin board'),
  ttl: z
    .union([z.number().positive(), z.string().min(1)])
    .optional()
    .describe(
      `Optional time-to-live before the bulletin expires - a number of seconds or a duration string like "1 hour", "30 minutes" or "2d" (default ${BULLETIN_DEFAULT_TTL_SECONDS} seconds, max ${BULLETIN_MAX_TTL_SECONDS} seconds)`
    ),
})

/**
 * Inferred type for blueprint bulletin create schema
 */
export type BlueprintBulletinCreateSchema = z.infer<
  typeof blueprintBulletinCreateSchema
>

/**
 * Schema for fetching blueprint meta information with an optional filter
 */
export const blueprintMetaFetchSchema = z.object({
  blueprintId: z.string().optional().describe('The blueprint ID to query'),
  jsonpath: z
    .string()
    .optional()
    .describe(
      'Optional JSONPath expression to filter the meta object (e.g. $.field)'
    ),
  jmespath: z
    .string()
    .optional()
    .describe(
      'Optional JMESPath expression to filter the meta object (e.g. field.subfield)'
    ),
})

/**
 * Inferred type for blueprint meta fetch schema
 */
export type BlueprintMetaFetchSchema = z.infer<typeof blueprintMetaFetchSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const BLUEPRINT_RESOURCE_LIST_OPERATION_NAME = 'resource/list'
export const BLUEPRINT_NOTE_LIST_OPERATION_NAME = 'note/list'
export const BLUEPRINT_META_FETCH_OPERATION_NAME = 'meta/fetch'
export const BLUEPRINT_BULLETIN_LIST_OPERATION_NAME = 'bulletin/list'
export const BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME = 'bulletin/create'

interface BlueprintResource {
  id: string
  name?: string
  description?: string
  state?: string
  meta?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

interface FilteredResource {
  id: string
  name?: string
  description?: string
  meta?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

type ResourcesMap = Record<string, BlueprintResource[]>

/**
 * Lists all resources for a blueprint.
 */
export async function doBlueprintResourceList({
  input,
  params,
  options,
}: {
  input: string
  params: ActionParams
  options: ActionOptions
}): Promise<ActionReturn> {
  debug(`do blueprint resource list`, { input, params, options }).log(
    'action.exec.blueprint.doBlueprintResourceList'
  )

  const { type, blueprintId } = getConfigBySchema({
    input,
    params,
    initial: {
      blueprintId: '${BLUEPRINT_DEFAULT}',
    },
    schema: blueprintResourceListSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.blueprint.resource.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  try {
    const cbk = await getUserClient({ id: options.userId })

    if (!blueprintId) {
      return {
        error: 'No blueprint ID found in context or parameters',
        result: [],
        messages: [],
      }
    }

    const response = await cbk.blueprint.listResources(blueprintId)

    const associatedResourceIds = new Set<string>()

    if (options.contextResources) {
      for (const value of Object.values(options.contextResources)) {
        if (value && typeof value === 'string') {
          associatedResourceIds.add(value)
        }
      }
    }

    if (options.linkedResources) {
      for (const value of Object.values(options.linkedResources)) {
        if (value && typeof value === 'string') {
          associatedResourceIds.add(value)
        }
      }
    }

    const contextBot = getContextBot()

    if (contextBot?.id) {
      associatedResourceIds.add(contextBot.id)
    }

    const filterResourceFields = (
      resources: BlueprintResource[] | ResourcesMap | undefined
    ): FilteredResource[] | Record<string, FilteredResource[]> | undefined => {
      if (!resources) {
        return resources
      }

      const mapResource = (
        resource: BlueprintResource
      ): FilteredResource | null => {
        if (associatedResourceIds.has(resource.id)) {
          return null
        }

        // @note hide disabled resources from agent introspection - they cannot
        // be used (the engine's getFunctions whitelists `state === enabled`), so
        // listing them is just noise. Blacklist (not `!== enabled`) on purpose:
        // this list is heterogeneous and most resource types have no `state`.
        if (resource.state === ResourceState.disabled) {
          return null
        }

        return {
          id: resource.id,
          name: resource.name,
          description: getShortDescription(resource.description || ''),
          meta: resource.meta,
          createdAt: resource.createdAt,
          updatedAt: resource.updatedAt,
        }
      }

      if (Array.isArray(resources)) {
        return resources
          .map(mapResource)
          .filter((r): r is FilteredResource => r !== null)
      }

      const filtered: Record<string, FilteredResource[]> = {}

      for (const [key, value] of Object.entries(resources)) {
        filtered[key] = Array.isArray(value)
          ? value
              .map(mapResource)
              .filter((r): r is FilteredResource => r !== null)
          : (value as unknown as FilteredResource[])
      }

      return filtered
    }

    let filteredResources = filterResourceFields(
      response.resources as ResourcesMap
    )

    if (type && type !== 'all') {
      const resourceKey = type

      filteredResources = {
        [resourceKey]:
          (filteredResources as Record<string, FilteredResource[]>)?.[
            resourceKey
          ] || [],
      }
    }

    return {
      result: {
        id: response.id,
        resources: filteredResources,
      },
      messages: [],
    }
  } catch (error) {
    debug(`blueprint resource list error`, { error }).log(
      'action.exec.blueprint.doBlueprintResourceList.error'
    )

    return {
      error: `Failed to list blueprint resources: ${(error as Error).message}`,
      result: [],
      messages: [],
    }
  }
}

/**
 * Lists all notes for a blueprint.
 */
export async function doBlueprintNoteList({
  input,
  params,
  options,
}: {
  input: string
  params: ActionParams
  options: ActionOptions
}): Promise<ActionReturn> {
  debug(`do blueprint note list`, { input, params, options }).log(
    'action.exec.blueprint.doBlueprintNoteList'
  )

  const { blueprintId } = getConfigBySchema({
    input,
    params,
    initial: {
      blueprintId: '${BLUEPRINT_DEFAULT}',
    },
    schema: blueprintNoteListSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.blueprint.note.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  try {
    if (!blueprintId) {
      return {
        error: 'No blueprint ID found in context or parameters',
        result: [],
        messages: [],
      }
    }

    const blueprint = await prisma.blueprint.findUnique({
      where: {
        id: blueprintId,
        userId: options.userId,
      },
      select: {
        id: true,
        meta: true,
      },
    })

    if (!blueprint) {
      return {
        error: 'Blueprint not found or access denied',
        result: [],
        messages: [],
      }
    }

    const notes =
      (blueprint.meta as Record<string, unknown> | null)?.notes || {}

    return {
      result: {
        id: blueprint.id,
        notes: notes,
      },
      messages: [],
    }
  } catch (error) {
    debug(`blueprint note list error`, { error }).log(
      'action.exec.blueprint.doBlueprintNoteList.error'
    )

    return {
      error: `Failed to list blueprint notes: ${(error as Error).message}`,
      result: [],
      messages: [],
    }
  }
}

/**
 * Presents a stored bulletin for LLM consumption. The raw epoch-millisecond
 * `createdAt`/`expiresAt` are converted to ISO 8601 strings and each is paired
 * with a human-readable relative form (e.g. "2 minutes ago", "in 58 minutes") so
 * the agent can reason about recency and expiry without doing epoch math.
 *
 * When `currentBotId` is supplied the bulletin is tagged with `self` - `true`
 * when the bulletin was posted by the bot currently performing the action - so
 * the agent can tell its own bulletins apart from those left by other bots. The
 * flag is always `false` when there is no current bot or the bulletin carries no
 * `botId`, so an anonymous bulletin never matches an anonymous reader.
 */
function toClientBulletin(bulletin: BlueprintBulletin, currentBotId?: string) {
  return {
    ...bulletin,
    createdAt: new Date(bulletin.createdAt).toISOString(),
    createdAgo: timeAgo(bulletin.createdAt),
    expiresAt: new Date(bulletin.expiresAt).toISOString(),
    expiresIn: timeAgo(bulletin.expiresAt),
    self: Boolean(currentBotId) && bulletin.botId === currentBotId,
  }
}

/**
 * Lists the active bulletins on a blueprint's shared bulletin board.
 */
export async function doBlueprintBulletinList({
  input,
  params,
  options,
}: {
  input: string
  params: ActionParams
  options: ActionOptions
}): Promise<ActionReturn> {
  debug(`do blueprint bulletin list`, { input, params, options }).log(
    'action.exec.blueprint.doBlueprintBulletinList'
  )

  const { blueprintId } = getConfigBySchema({
    input,
    params,
    initial: {
      blueprintId: '${BLUEPRINT_DEFAULT}',
    },
    schema: blueprintBulletinListSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.blueprint.bulletin.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  try {
    if (!blueprintId) {
      return {
        error: 'No blueprint ID found in context or parameters',
        result: [],
        messages: [],
      }
    }

    const blueprint = await prisma.blueprint.findUnique({
      where: {
        id: blueprintId,
        userId: options.userId,
      },
      select: {
        id: true,
      },
    })

    if (!blueprint) {
      return {
        error: 'Blueprint not found or access denied',
        result: [],
        messages: [],
      }
    }

    const bulletins = await listBlueprintBulletins(blueprint.id)

    const contextBot = getContextBot()

    return {
      result: {
        id: blueprint.id,
        bulletins: bulletins.map((bulletin) =>
          toClientBulletin(bulletin, contextBot?.id)
        ),
      },
      messages: [],
    }
  } catch (error) {
    debug(`blueprint bulletin list error`, { error }).log(
      'action.exec.blueprint.doBlueprintBulletinList.error'
    )

    return {
      error: `Failed to list blueprint bulletins: ${(error as Error).message}`,
      result: [],
      messages: [],
    }
  }
}

/**
 * Creates a bulletin on a blueprint's shared bulletin board.
 */
export async function doBlueprintBulletinCreate({
  input,
  params,
  options,
}: {
  input: string
  params: ActionParams
  options: ActionOptions
}): Promise<ActionReturn> {
  debug(`do blueprint bulletin create`, { input, params, options }).log(
    'action.exec.blueprint.doBlueprintBulletinCreate'
  )

  const { blueprintId, text, ttl } = getConfigBySchema({
    input,
    params,
    initial: {
      blueprintId: '${BLUEPRINT_DEFAULT}',
    },
    schema: blueprintBulletinCreateSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.blueprint.bulletin.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  try {
    if (!blueprintId) {
      return {
        error: 'No blueprint ID found in context or parameters',
        result: [],
        messages: [],
      }
    }

    const blueprint = await prisma.blueprint.findUnique({
      where: {
        id: blueprintId,
        userId: options.userId,
      },
      select: {
        id: true,
      },
    })

    if (!blueprint) {
      return {
        error: 'Blueprint not found or access denied',
        result: [],
        messages: [],
      }
    }

    const contextBot = getContextBot()

    const bulletin = await createBlueprintBulletin(blueprint.id, {
      text,
      ttl,
      author: contextBot?.name ?? undefined,
      botId: contextBot?.id,
    })

    return {
      result: {
        id: blueprint.id,
        bulletin: toClientBulletin(bulletin, contextBot?.id),
      },
      messages: [],
    }
  } catch (error) {
    debug(`blueprint bulletin create error`, { error }).log(
      'action.exec.blueprint.doBlueprintBulletinCreate.error'
    )

    return {
      error: `Failed to create blueprint bulletin: ${(error as Error).message}`,
      result: [],
      messages: [],
    }
  }
}

/**
 * Fetches the meta information for a blueprint with an optional JSONPath or JMESPath filter.
 */
export async function doBlueprintMetaFetch({
  input,
  params,
  options,
}: {
  input: string
  params: ActionParams
  options: ActionOptions
}): Promise<ActionReturn> {
  debug(`do blueprint meta fetch`, { input, params, options }).log(
    'action.exec.blueprint.doBlueprintMetaFetch'
  )

  const {
    blueprintId,
    jsonpath: jsonpathExpr,
    jmespath: jmespathExpr,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      blueprintId: '${BLUEPRINT_DEFAULT}',
    },
    schema: blueprintMetaFetchSchema,
    options,
  })

  await logEvent({
    user: { id: options.userId },
    type: 'action.blueprint.meta.fetch',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  try {
    if (!blueprintId) {
      return {
        error: 'No blueprint ID found in context or parameters',
        result: [],
        messages: [],
      }
    }

    const blueprint = await prisma.blueprint.findUnique({
      where: {
        id: blueprintId,
        userId: options.userId,
      },
      select: {
        id: true,
        meta: true,
      },
    })

    if (!blueprint) {
      return {
        error: 'Blueprint not found or access denied',
        result: [],
        messages: [],
      }
    }

    const meta = (blueprint.meta as Record<string, unknown> | null) ?? {}

    let result: unknown = meta

    if (jsonpathExpr) {
      result = jsonpath(jsonpathExpr, meta)
    } else if (jmespathExpr) {
      result = jmespath(jmespathExpr, meta)
    }

    return {
      result: {
        id: blueprint.id,
        meta: result,
      },
      messages: [],
    }
  } catch (error) {
    debug(`blueprint meta fetch error`, { error }).log(
      'action.exec.blueprint.doBlueprintMetaFetch.error'
    )

    return {
      error: `Failed to fetch blueprint meta: ${(error as Error).message}`,
      result: [],
      messages: [],
    }
  }
}

/**
 * Executes a blueprint action.
 */
export async function executeBlueprintAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute blueprint action`, { input, params, options }).log(
    'action.exec.blueprint.executeBlueprintAction'
  )

  let operation:
    | typeof BLUEPRINT_RESOURCE_LIST_OPERATION_NAME
    | typeof BLUEPRINT_NOTE_LIST_OPERATION_NAME
    | typeof BLUEPRINT_META_FETCH_OPERATION_NAME
    | typeof BLUEPRINT_BULLETIN_LIST_OPERATION_NAME
    | typeof BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME

  {
    switch (true) {
      case 'resource' in params && 'list' in params: {
        operation = BLUEPRINT_RESOURCE_LIST_OPERATION_NAME

        break
      }

      case 'note' in params && 'list' in params: {
        operation = BLUEPRINT_NOTE_LIST_OPERATION_NAME

        break
      }

      case 'bulletin' in params && 'create' in params: {
        operation = BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME

        break
      }

      case 'bulletin' in params && 'list' in params: {
        operation = BLUEPRINT_BULLETIN_LIST_OPERATION_NAME

        break
      }

      case 'meta' in params && 'fetch' in params: {
        operation = BLUEPRINT_META_FETCH_OPERATION_NAME

        break
      }

      default: {
        // Default to resource/list if no specific operation is detected
        operation = BLUEPRINT_RESOURCE_LIST_OPERATION_NAME
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case BLUEPRINT_RESOURCE_LIST_OPERATION_NAME: {
      response = await doBlueprintResourceList({
        input,
        params,
        options,
      })

      break
    }

    case BLUEPRINT_NOTE_LIST_OPERATION_NAME: {
      response = await doBlueprintNoteList({
        input,
        params,
        options,
      })

      break
    }

    case BLUEPRINT_BULLETIN_LIST_OPERATION_NAME: {
      response = await doBlueprintBulletinList({
        input,
        params,
        options,
      })

      break
    }

    case BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME: {
      response = await doBlueprintBulletinCreate({
        input,
        params,
        options,
      })

      break
    }

    case BLUEPRINT_META_FETCH_OPERATION_NAME: {
      response = await doBlueprintMetaFetch({
        input,
        params,
        options,
      })

      break
    }

    default: {
      response = {
        error: `Unknown blueprint operation: ${operation}`,
        result: undefined,
        messages: [],
      }
    }
  }

  return response
}

/**
 * @manual Agent Introspection
 * @description Agent introspection enables AI agents to discover and query the resources available within their blueprint context, allowing them to dynamically adapt their behavior and make intelligent decisions about resource utilization at runtime.
 * @category Blueprints
 * @index 40
 *
 * ## Agent Introspection and Resource Discovery
 *
 * One of the powerful capabilities available to AI agents is the ability to introspect and discover the resources available within their blueprint context. This self-awareness enables agents to dynamically adapt their behavior based on the tools and resources they have access to, making them more autonomous and intelligent.
 *
 * ### Understanding Blueprint Resource Listing
 *
 * Agents can query their own blueprint to discover what resources are available to them at runtime. This capability allows agents to understand their environment and make informed decisions about which tools and resources to use for specific tasks.
 *
 * When an agent lists blueprint resources, the system automatically filters out resources that are part of the current execution chain to prevent infinite loops and self-referential behavior. This includes filtering out:
 *
 * - The current bot executing the conversation
 * - The skillset providing the introspection ability
 * - The specific ability being used for introspection
 * - Any other resources directly linked to the current execution context
 *
 * This filtering mechanism ensures that agents can safely explore their available resources without accidentally triggering recursive calls or creating circular dependencies.
 *
 * ### Practical Applications
 *
 * **Dynamic Tool Selection**: An agent can discover which bots are available in its blueprint and delegate specific tasks to specialized sub-agents based on their descriptions and capabilities. For example, a coordinator bot might discover a "Data Analysis Bot" and a "Report Generation Bot" and route tasks appropriately.
 *
 * **Resource-Aware Behavior**: By listing available datasets, an agent can determine which knowledge bases it has access to and inform users about its capabilities. This enables more transparent and helpful interactions where the agent can accurately describe what it knows and doesn't know.
 *
 * **Adaptive Workflows**: Agents can check for the presence of specific abilities or integrations before attempting to use them, allowing for graceful degradation when certain features aren't available. For instance, an agent might check if email capabilities exist before offering to send notifications.
 *
 * ### Listing Available Resources
 *
 * To discover all resources in the current blueprint context:
 *
 * ````markdown
 * ```blueprint/resource/list
 * type: all
 * ```
 * ````
 *
 * To discover specific types of resources:
 *
 * ````markdown
 * ```blueprint/resource/list
 * type: bot
 * ```
 * ````
 *
 * The response includes essential metadata for each resource including ID, name, description, and creation timestamps. This information allows agents to make intelligent decisions about resource utilization based on descriptions and metadata rather than requiring hard-coded resource IDs.
 *
 * ### Discovering Blueprint Notes
 *
 * In addition to listing resources, agents can also discover notes that have been added to the blueprint during design. Notes are annotations stored in the blueprint metadata that document the blueprint's architecture, design decisions, and usage instructions. These notes are typically created in the blueprint designer interface to provide context and documentation for the blueprint structure.
 *
 * To list all notes stored in the current blueprint:
 *
 * ````markdown
 * ```blueprint/note/list
 * ```
 * ````
 *
 * The response includes all notes from the blueprint's metadata, organized by their unique identifiers. Each note contains:
 * - **data**: The content and properties of the note
 * - **position**: The visual position of the note in the designer canvas
 * - **width/height**: The dimensions of the note box
 *
 * **Use Cases for Note Discovery**: Agents can read blueprint notes to understand the intended architecture, find usage guidelines left by the blueprint designer, discover implementation tips and best practices, or locate important warnings about specific resources or configurations. This enables agents to leverage human-authored documentation to make better decisions about resource utilization.
 *
 * ### Security and Isolation
 *
 * The introspection mechanism respects security boundaries and only returns resources that are part of the agent's blueprint context. This ensures agents cannot discover or access resources from other blueprints or users, maintaining proper isolation and security.
 *
 * Additionally, by filtering out the current execution context, the system prevents agents from accidentally creating self-referential loops where a bot tries to call itself or use abilities that are already in the execution chain. This automatic safeguard makes agent introspection safe and predictable.
 *
 * **Best Practice**: When building agents that leverage introspection, design them to handle scenarios where expected resources might not be present. Use descriptive resource names and detailed descriptions to help agents understand the purpose and capabilities of each resource they discover. Similarly, when designing blueprints, use notes to document important architectural decisions, usage patterns, and configuration requirements that agents should be aware of.
 */
