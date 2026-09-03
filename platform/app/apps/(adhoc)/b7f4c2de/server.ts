'use server'

import { QUARTER_HOUR_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { appActionHandler } from '@/lib/app.action'
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'
import { getPlatformGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import { captureException } from '@/lib/error'
import fetch, { withNextCache } from '@/lib/fetch'
import { throwNotFound } from '@/lib/response'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from 'zod'

type PlatformAbilityNode = {
  id?: string
  template?: string
  name?: string
  description?: string
  instruction?: string
  schema?: {
    properties?: Record<string, unknown>
  }
  icon?: unknown
  commentary?: unknown
  setup?: unknown
  tags?: unknown
  secret?: unknown
  file?: unknown
}

type PlatformSecretNode = {
  id?: string
  template?: string
  name?: string
  description?: string
  type?: string
  kind?: string
  config?: unknown
  icon?: unknown
  commentary?: unknown
  setup?: unknown
  tags?: unknown
}

type PlatformTemplatesData = {
  platformAbilities?: {
    edges?: Array<{
      node?: PlatformAbilityNode
    }>
  }
  platformSecrets?: {
    edges?: Array<{
      node?: PlatformSecretNode
    }>
  }
}

const hasAbilityId = (
  item: PlatformAbilityNode | undefined
): item is PlatformAbilityNode & { id: string } => {
  return !!item?.id
}

const hasSecretId = (
  item: PlatformSecretNode | undefined
): item is PlatformSecretNode & { id: string } => {
  return !!item?.id
}

/**
 * List all available blueprints.
 *
 * @action
 */
export const listBlueprints = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (config, session, {}) => {
    const userClient = await getSessionClient(session)

    const response = await userClient.blueprint.list().cache()
    const allowedBlueprintIds = config.blueprintIds

    let items = response.items

    if (allowedBlueprintIds) {
      if (allowedBlueprintIds.length === 0) {
        items = []
      } else {
        items = items.filter((blueprint) =>
          allowedBlueprintIds.includes(blueprint.id)
        )
      }
    }

    const blueprints = [...items].sort((a, b) => {
      const left = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const right = new Date(b.updatedAt || b.createdAt || 0).getTime()

      return right - left
    })

    return {
      blueprints,
    }
  }
)

/**
 * Fetch a single blueprint.
 *
 * @action
 */
export const fetchBlueprint = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (config, session, { blueprintId }) => {
    const allowedBlueprintIds = config.blueprintIds

    if (allowedBlueprintIds) {
      if (
        allowedBlueprintIds.length === 0 ||
        !allowedBlueprintIds.includes(blueprintId)
      ) {
        return throwNotFound('Blueprint not found')
      }
    }

    const userClient = await getSessionClient(session)

    const blueprint = await userClient.blueprint.fetch(blueprintId)

    return {
      blueprint,
    }
  }
)

/**
 * Fetch a single blueprint with full resources for read-only viewer rendering.
 *
 * @action
 */
export const fetchBlueprintViewer = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string(),
  }),
  async (config, session, { blueprintId }) => {
    const allowedBlueprintIds = config.blueprintIds

    if (allowedBlueprintIds) {
      if (
        allowedBlueprintIds.length === 0 ||
        !allowedBlueprintIds.includes(blueprintId)
      ) {
        return throwNotFound('Blueprint not found')
      }
    }

    const blueprintAndResources =
      await getBlueprintAndCloneableResources(blueprintId)

    if (!blueprintAndResources) {
      return throwNotFound('Blueprint not found')
    }

    if (blueprintAndResources.blueprint.userId !== session.user.id) {
      return throwNotFound('Blueprint not found')
    }

    const viewerBlueprint = blueprintAndResources.blueprint as {
      userId?: string
      hubBlueprintPage?: unknown
      secrets?: Array<{ value?: unknown; config?: unknown }>
      [key: string]: unknown
    }

    delete viewerBlueprint.hubBlueprintPage

    for (const secret of viewerBlueprint.secrets || []) {
      // @note remove secret values and configs for security/privacy

      delete secret.value
      delete secret.config
    }

    delete viewerBlueprint.userId

    let platformAbilitiesData = {}
    let platformSecretsData = {}

    try {
      const client = await getPlatformGraphQLClient({
        fetchFn: withNextCache(fetch, {
          tags: ['platformAbilities', 'platformSecrets'],
          ttl: QUARTER_HOUR_IN_MILLISECONDS,
        }),
      })

      const data = (await client.platformTemplates()) as PlatformTemplatesData

      platformAbilitiesData = Object.fromEntries(
        (data?.platformAbilities?.edges || [])
          .map((edge) => edge?.node)
          .filter(hasAbilityId)
          .map((item) => [
            item.template,
            {
              name: item.name ?? '',
              description: item.description ?? '',
              instruction: item.instruction ?? '',
              properties: item.schema?.properties || {},
              icon: item.icon ?? null,
              commentary: item.commentary ?? null,
              setup: item.setup ?? null,
              tags: Array.isArray(item.tags) ? item.tags : [],
              secret: item.secret ?? null,
              file: item.file ?? null,
            },
          ])
      )

      platformSecretsData = Object.fromEntries(
        (data?.platformSecrets?.edges || [])
          .map((edge) => edge?.node)
          .filter(hasSecretId)
          .map((item) => [
            item.template,
            {
              name: item.name ?? '',
              description: item.description ?? '',
              type: item.type ?? 'basic',
              kind: item.kind ?? 'personal',
              config: item.config ?? null,
              icon: item.icon ?? null,
              commentary: item.commentary ?? null,
              setup: item.setup ?? null,
              tags: Array.isArray(item.tags) ? item.tags : [],
            },
          ])
      )
    } catch (error) {
      await captureException(error)
    }

    return {
      blueprint: viewerBlueprint,

      platformAbilitiesData,
      platformSecretsData,
    }
  }
)
