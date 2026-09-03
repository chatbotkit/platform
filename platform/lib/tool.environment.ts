import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { type Ability, ResourceState } from '@/prisma/types'

import { getAbilityFunctionInput } from '@/lib/ability.function'
import {
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import type { JsonSchema } from '@/lib/jsonschema'
import { callMcpTool } from '@/lib/mcp.edge'
import memcache from '@/lib/memcache'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { canUseSkillset } from '@/lib/skillset.access'
import { applySkillset } from '@/lib/skillset.apply'

export interface AbilityToolOptions {
  userId: string

  skillsetId: string
  abilityId: string
}

export interface McpToolOptions {
  userId: string

  sessionId: string

  url: string
  headers?: Record<string, string>

  toolName: string
}

export interface BaseSerializableToolBase {
  name: string
  description?: string

  /**
   * Identifies the install origin (a skillset, pack or MCP server) the tool
   * belongs to. Used to scope re-installs: installing a source replaces only
   * that source's tools, leaving tools from other sources untouched - even when
   * tool names collide across sources. Optional for back-compat; when absent the
   * tool falls back to name-based identity.
   */
  source?: string

  inputSchema: JsonSchema | Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

/**
 * Builds a stable source key for a batch of installed tools. The same
 * (kind, id, prefix) triple always yields the same key, so a re-install of the
 * same source replaces its previous tools, while a different source - or the
 * same source installed under a different prefix - coexists alongside it.
 */
export function makeEnvironmentToolSource(
  kind: 'skillset' | 'pack' | 'mcp',
  id: string,
  prefix?: string
): string {
  return [kind, id, prefix].filter(Boolean).join(':')
}

export interface AbilitySerializableTool extends BaseSerializableToolBase {
  handler: 'ability'

  options: AbilityToolOptions
}

export interface McpSerializableTool extends BaseSerializableToolBase {
  handler: 'mcp'

  options: McpToolOptions
}

export interface AbilityTemplateToolOptions {
  userId: string

  instruction: string

  linkedResources?: {
    secretId?: string
    fileId?: string
    botId?: string
    spaceId?: string
  }

  inlineSecrets?: Record<string, { value: string }>
}

export interface AbilityTemplateSerializableTool
  extends BaseSerializableToolBase {
  handler: 'ability-template'

  options: AbilityTemplateToolOptions
}

export type SerializableTool =
  | AbilitySerializableTool
  | McpSerializableTool
  | AbilityTemplateSerializableTool

export interface CallableTool {
  name: string
  description?: string

  inputSchema: JsonSchema | Record<string, unknown> // @todo make it more specific
  outputSchema?: JsonSchema | Record<string, unknown> // @todo make it more specific

  handler: (...args: unknown[]) => Promise<unknown>
}

export async function getEnvironmentKey(): Promise<string | null> {
  debug('getting environment key').log('tool.environment.getEnvironmentKey')

  // @note the `v2` segment is a deliberate keyspace bump: environment tools are
  // now stored as a Redis hash (one field per install source) rather than a
  // single JSON-array string. Reading the old string value with `hgetall` would
  // raise WRONGTYPE, so v2 sidesteps any leftover v1 keys - those carry a short
  // TTL and simply expire. Active conversations re-install their tools once.

  const commonPrefix = 'tool:environment:v2:'

  const conversation = getContextConversation()

  if (conversation) {
    return `${commonPrefix}conversation-${conversation.id}`
  }

  const namespace = getContextNamespace()

  if (namespace) {
    return `${commonPrefix}namespace-${namespace}`
  }

  debug(`no suitable environment key found`).log(
    'tool.environment.getEnvironmentKey'
  )

  return null
}

/**
 * The hash field a tool is stored under. Tools that share an install `source` (a
 * skillset/pack/MCP server) live in the same field, so re-installing a source
 * replaces exactly its tools and a same-named tool from a different source is
 * never evicted. Tools without a `source` fall back to a per-name field for
 * back-compat.
 */
function getToolFieldIdentity({ source, name }: SerializableTool): string {
  return source ? `source:${source}` : `name:${name}`
}

/**
 * Parses a stored hash field value back into a tool array. The key-value module
 * deserializes JSON on read, so a value can arrive already parsed (array) or as
 * the raw string we wrote - handle both.
 */
function parseStoredToolGroup(value: unknown): SerializableTool[] | null {
  if (Array.isArray(value)) {
    return value as SerializableTool[]
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)

      return Array.isArray(parsed) ? (parsed as SerializableTool[]) : null
    } catch {
      return null
    }
  }

  return null
}

/**
 * Installs environment tools into the current environment key. Tools are stored
 * in a hash keyed by install source (one field per pack/skillset/MCP server),
 * and each field is written together with a TTL refresh in a single atomic
 * operation.
 *
 * Storing per-source is what makes concurrent installs safe. A single model turn
 * can emit several `install_*` tool calls that execute in parallel; the previous
 * implementation did a non-atomic get-merge-set in JS, so both calls read the
 * same baseline and the last `set` won - silently dropping the other pack's
 * tools. The model would then call a tool that had vanished ("function not
 * found"), re-install, evict the other set, and ping-pong from there. Because
 * different sources now map to different hash fields, parallel installs touch
 * disjoint fields and can no longer clobber each other; re-installing the same
 * source atomically replaces just that field (renamed/removed tools included).
 */
export async function installEnvironmentTools(
  tools: SerializableTool[]
): Promise<boolean> {
  debug('installing environment tools', { tools }).log(
    'tool.environment.installEnvironmentTools'
  )

  const key = await getEnvironmentKey()

  if (!key) {
    debug('no key').log('tool.environment.installEnvironmentTools')

    return false
  }

  debug('using', { key }).log('tool.environment.installEnvironmentTools')

  // @note group the incoming tools by their source field so each source is
  // written once. In practice an install carries a single source, but grouping
  // keeps sourceless (back-compat) batches correct too.

  const groups = new Map<string, SerializableTool[]>()

  for (const tool of tools) {
    const field = getToolFieldIdentity(tool)

    const group = groups.get(field)

    if (group) {
      group.push(tool)
    } else {
      groups.set(field, [tool])
    }
  }

  for (const [field, group] of groups) {
    // @note the write and the expiry are one operation so a freshly created
    // hash always carries an expiry - a crash between two commands would leave
    // it immortal.

    await memcache.setFieldWithExpiry(key, field, group, ONE_HOUR_IN_SECONDS)
  }

  return true
}

/**
 * Uninstalls environment tools that match the given predicate by removing them
 * from the stored hash. Each affected field is rewritten (or dropped) on its
 * own, so an uninstall never has to read-modify-write the whole tool set and
 * can't clobber a concurrent install of an unrelated source.
 */
export async function uninstallEnvironmentTools(
  predicate: (tool: SerializableTool) => boolean
): Promise<{ success: boolean; removedTools: string[] }> {
  debug('uninstalling environment tools').log(
    'tool.environment.uninstallEnvironmentTools'
  )

  const key = await getEnvironmentKey()

  if (!key) {
    debug('no key').log('tool.environment.uninstallEnvironmentTools')

    return { success: false, removedTools: [] }
  }

  const stored = await memcache.hgetall<Record<string, unknown>>(key)

  if (!stored || Object.keys(stored).length === 0) {
    debug('no tools').log('tool.environment.uninstallEnvironmentTools')

    return { success: true, removedTools: [] }
  }

  const removedTools: string[] = []

  let remainingFieldCount = 0

  for (const [field, value] of Object.entries(stored)) {
    const group = parseStoredToolGroup(value)

    if (!group) {
      continue
    }

    const remaining = group.filter((tool) => {
      if (predicate(tool)) {
        removedTools.push(tool.name)

        return false
      }

      return true
    })

    if (remaining.length === group.length) {
      // @note nothing removed from this source - leave the field untouched
      remainingFieldCount++

      continue
    }

    if (remaining.length === 0) {
      await memcache.hdel(key, field)
    } else {
      await memcache.setFieldWithExpiry(
        key,
        field,
        remaining,
        ONE_HOUR_IN_SECONDS
      )

      remainingFieldCount++
    }
  }

  // @note drop the key entirely once the last source is gone (Redis already
  // removes an emptied hash, but this is explicit and refreshes nothing)

  if (remainingFieldCount === 0) {
    await memcache.del(key)
  }

  debug('uninstalled', { removedTools }).log(
    'tool.environment.uninstallEnvironmentTools'
  )

  return { success: true, removedTools }
}

export async function getEnvironmentTools(): Promise<CallableTool[]> {
  debug('getting environment tools').log('tool.environment.getEnvironmentTools')

  const key = await getEnvironmentKey()

  if (!key) {
    debug('no key').log('tool.environment.installEnvironmentTools')

    return []
  }

  debug('using', { key }).log('tool.environment.getEnvironmentTools')

  const stored = await memcache.hgetall<Record<string, unknown>>(key)

  if (!stored) {
    debug('no tools').log('tool.environment.getEnvironmentTools')

    return []
  }

  // @note flatten the per-source fields back into a single tool list

  const tools: SerializableTool[] = []

  for (const value of Object.values(stored)) {
    const group = parseStoredToolGroup(value)

    if (group) {
      tools.push(...group)
    }
  }

  if (tools.length === 0) {
    debug('no tools').log('tool.environment.getEnvironmentTools')

    return []
  }

  debug('using', { tools }).log('tool.environment.getEnvironmentTools')

  return tools.map((tool) => {
    let handler: (...args: unknown[]) => Promise<unknown>

    switch (tool.handler) {
      case 'ability': {
        handler = async (args) => {
          const skillset = await prisma.skillset.findUnique({
            where: {
              id: tool.options.skillsetId,
            },

            include: {
              abilities: true,
            },
          })

          if (!skillset) {
            return throwNotFound(`Skillset not found`)
          }

          if ((await canUseSkillset(tool.options.userId, skillset)) === false) {
            return throwNotAuthorized(`Not authorized to use skillset`)
          }

          const ability = skillset.abilities.find(
            (a) => a.id === tool.options.abilityId
          )

          if (!ability) {
            return throwNotFound(`Ability not found in skillset`)
          }

          // @todo we need to somehow expose messages and all of that

          const input = getAbilityFunctionInput(ability, args)

          const { error, result } = await applySkillset(
            tool.options.userId,
            skillset,
            ability.name,
            input
          )

          return {
            error,
            result,
          }
        }

        break
      }

      case 'mcp': {
        handler = async (args) => {
          return await callMcpTool(
            {
              id: tool.options.userId,
            },
            tool,
            args
          )
        }

        break
      }

      case 'ability-template': {
        handler = async (args) => {
          // @note create a synthetic skillset and ability to reuse the
          // existing instruction execution pipeline via applySkillset

          const syntheticAbility: Ability & {
            inlineSecrets?: Record<string, { value: string }>
          } = {
            id: `pack-template-${tool.name}`,
            userId: tool.options.userId,
            skillsetId: null,
            blueprintId: null,
            alias: null,
            name: tool.name,
            description: tool.description || '',
            instruction: tool.options.instruction,
            state: ResourceState.enabled,
            meta: null,
            linkedSecretId: tool.options.linkedResources?.secretId || null,
            linkedFileId: tool.options.linkedResources?.fileId || null,
            linkedBotId: tool.options.linkedResources?.botId || null,
            linkedSpaceId: tool.options.linkedResources?.spaceId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            inlineSecrets: tool.options.inlineSecrets,
          }

          // @note synthetic skillset only needs fields used by applySkillset

          const syntheticSkillset = {
            id: `pack-template`,
            description: '',
            abilities: [syntheticAbility],
          } as Parameters<typeof applySkillset>[1]

          // @todo we need to somehow expose messages and all of that

          const input = getAbilityFunctionInput(syntheticAbility, args)

          const { error, result } = await applySkillset(
            tool.options.userId,
            syntheticSkillset,
            tool.name,
            input
          )

          return {
            error,
            result,
          }
        }

        break
      }

      default: {
        // @todo perhaps assert unreachable instead

        handler = async () => {
          throw new Error(`Not implemented`)
        }
      }
    }

    return {
      ...tool,

      handler,
    }
  })
}
