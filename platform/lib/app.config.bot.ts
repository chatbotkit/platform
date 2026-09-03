import type { StoreConfig, StoreSession } from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { isModelBot } from '@/lib/bot.kind'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'

import { z } from 'zod'

const BotConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  nick: z.string().optional(),
  icon: z.string().optional(),
  default: z.boolean().optional(),
  auto: z.boolean().optional(),
  multi: z.boolean().optional(),
})

const BotsSchema = z.union([
  // array of bot ids
  z.array(z.string()),
  // array of bot configs
  z.array(BotConfigSchema.extend({ exclude: z.boolean().optional() })),
  // record of bot configs
  z.record(
    z.string(),
    BotConfigSchema.omit({ id: true }).extend({
      exclude: z.boolean().optional(),
    })
  ),
])

// @note blueprintId is server metadata from GraphQL, not customer-configurable
export type ConfiguredBot = z.infer<typeof BotConfigSchema> & {
  blueprintId?: string
}

export type GetConfiguredBotsOptions = {
  blueprintId?: string
}

/**
 * Get the list of bots configured for the application and the user. If no bots
 * are configured, we will return the list of all bots within the account. If
 * some bots are configured, we will return only those bots along with any
 * related bots that match the id of the configured bots as long as they are
 * marked as protected (see graphql query). Additionally we will filter out any
 * bots that are marked as excluded within the configuration or are hidden by
 * convention (name starts with a dot).
 *
 * @todo consider auto-exposing only protected bots
 * @todo add config option to configure if by-convention bots should be excluded
 */
export async function getConfiguredBots(
  config: StoreConfig,
  session: StoreSession,
  options: GetConfiguredBotsOptions = {}
): Promise<ConfiguredBot[]> {
  const { blueprintId } = options

  let hasConfiguredBots = false

  const excludedBots: ConfiguredBot[] = []
  const includedBots: ConfiguredBot[] = []

  if (session.payload.aud === APP_AUDIENCE) {
    const botsResult = BotsSchema.safeParse(config.bots)

    if (botsResult.success) {
      const bots = botsResult.data

      if (bots) {
        hasConfiguredBots = true
      }

      if (Array.isArray(bots)) {
        for (const bot of bots) {
          if (typeof bot === 'string') {
            includedBots.push({ id: bot })
          } else {
            const { exclude, ...value } = bot

            if (exclude) {
              excludedBots.push({
                ...value,
              })
            } else {
              includedBots.push({
                ...value,
              })
            }
          }
        }
      } else {
        for (const [id, { exclude, ...value }] of Object.entries(bots)) {
          if (exclude) {
            excludedBots.push({
              ...value,

              id,
            })
          } else {
            includedBots.push({
              ...value,

              id,
            })
          }
        }
      }
    }
  }

  const client = await getSessionGraphQLClient(session)

  const result = await client.configuredBots({
    botIds: hasConfiguredBots ? includedBots.map((b) => b.id) : null,
    blueprintIds: blueprintId ? [blueprintId] : null,
    includeRelatedBots: hasConfiguredBots,
  })

  const edges = [
    ...(result.relatedBots?.edges || []),
    ...(result.bots?.edges || []),
  ]

  let bots: ConfiguredBot[] = []

  for (const edge of edges) {
    if (edge && edge.node) {
      const id = edge.node.id

      if (!id) {
        continue
      }

      if (excludedBots.some((b) => b.id === id)) {
        continue
      }

      const base = {
        id: id,

        name: edge.node.name || undefined,
        description: edge.node.description || undefined,
        // @note relatedBots (ContextBot) don't have blueprint, only bots (Bot) do
        blueprintId:
          (edge.node as { blueprint?: { id?: string | null } | null }).blueprint
            ?.id || undefined,
      }

      const config: ConfiguredBot | undefined = includedBots.find(
        (b) => b.id === id
      )

      bots.push({ ...base, ...config })
    }
  }

  if (session.payload.aud === APP_AUDIENCE) {
    bots = bots.filter(isVisibleBotByConvention)
  }

  bots = bots.sort((a, b) => {
    const aBot = isModelBot(a)
    const bBot = isModelBot(b)

    // model bots should be at the bottom

    if (aBot && !bBot) {
      return 1
    } else if (!aBot && bBot) {
      return -1
    } else {
      return a.name?.localeCompare(b.name || '') || 0
    }
  })

  return bots
}

/**
 * @todo consider moving this into graphql query as a filter
 */
export function isHiddenBotByConvention(bot: ConfiguredBot): boolean {
  return /^\s*\./i.test(bot.name || '')
}

/**
 * @todo consider moving this into graphql query as a filter
 */
export function isVisibleBotByConvention(bot: ConfiguredBot): boolean {
  return !isHiddenBotByConvention(bot)
}
