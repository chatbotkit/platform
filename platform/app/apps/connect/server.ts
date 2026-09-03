'use server'

import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { getConfiguredBots } from '@/lib/app.config.bot'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import { errorToErrorResponse } from '@/lib/error'
import { nameToIcon } from '@/lib/name.icon'
import { throwUnprocessableEntity } from '@/lib/response'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

import type { SecretVerifyResponse } from '@chatbotkit/sdk/contact/secret/v1'

/**
 * @action
 */
export const listSecrets = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (
    config,
    session,
    contact,
    {}
  ): Promise<
    {
      id: string
      name?: string
      description?: string
      verification: Omit<SecretVerifyResponse, 'id'>
      icon?: string
    }[]
  > => {
    const bots = await getConfiguredBots(config, session)

    const botIds = [
      ...new Set<string>(bots.map(({ id }) => id).filter(Boolean) as string[]),
    ]

    const client = await getSessionGraphQLClient(session)

    const result = await client.availableSecrets({
      botIds: botIds,
      contactIds: [contact.id],
    })

    const edges = [...(result.relatedSecrets?.edges ?? [])]

    const secrets: {
      id: string

      name?: string
      description?: string

      verification: Omit<SecretVerifyResponse, 'id'>

      icon?: string
    }[] = []

    for (const edge of edges) {
      if (edge && edge.node) {
        const id = edge.node.id

        if (!id) {
          continue
        }

        secrets.push({
          id: id,

          name: edge.node.name || undefined,
          description: edge.node.description || undefined,

          verification: edge.node.contacts?.[0]?.verification
            ? {
                status: edge.node.contacts[0].verification.status,
                action: edge.node.contacts[0].verification.action
                  ? {
                      type: edge.node.contacts[0].verification.action.type,
                      url: edge.node.contacts[0].verification.action.url || '', // @note not ideal to return empty string but in theory it should not happen
                    }
                  : undefined,
              }
            : {
                status: 'authenticated',
              },

          icon: nameToIcon(edge.node.name || '') || undefined,
        })
      }
    }

    return secrets
  }
)

/**
 * @action
 */
export const revokeSecret = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }): Promise<SecretVerifyResponse> => {
    const userClient = await getSessionClient(session)

    await userClient.contact.secret.revoke(contact.id, id)

    return await userClient.contact.secret.verify(contact.id, id)
  }
)

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    _session,
    {}
  ): Promise<{
    secrets: UnwrapPromise<ReturnType<typeof listSecrets>>
  }> => {
    const [secrets] = await Promise.all([listSecrets({})])

    if (!secrets) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in secrets) {
      throw errorToErrorResponse(secrets.error)
    }

    return { secrets }
  }
)
