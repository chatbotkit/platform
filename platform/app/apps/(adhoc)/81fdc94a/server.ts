'use server'

import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { appActionHandler } from '@/lib/app.action'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import { errorToErrorResponse } from '@/lib/error'
import { nameToIcon } from '@/lib/name.icon'
import { throwUnprocessableEntity } from '@/lib/response'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import type { SecretVerifyResponse } from '@chatbotkit/sdk/secret/v1'

import { z } from 'zod'

/**
 * @action
 */
export const listSecrets = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    session,
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
    const client = await getSessionGraphQLClient(session)

    const result = await client.availableSharedSecrets({
      // @note maybe filter
    })

    const edges = [...(result.secrets?.edges ?? [])]

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

          verification: edge.node.verification
            ? {
                status: edge.node.verification.status,
                action: edge.node.verification.action
                  ? {
                      type: edge.node.verification.action.type,
                      url: edge.node.verification.action.url || '', // @note not ideal to return empty string but in theory it should not happen
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
export const revokeSecret = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }): Promise<SecretVerifyResponse> => {
    const userClient = await getSessionClient(session)

    await userClient.secret.revoke(id)

    return await userClient.secret.verify(id)
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
