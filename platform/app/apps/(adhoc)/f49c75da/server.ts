'use server'

import { siteHostname } from '@/config/site'

import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'

import { buildSlackManifestInstallUrl } from '../../../../lib/slack.manifest'
import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from 'zod'

/**
 * @action
 */
export const listIntegrations = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    session,
    {},
    context
  ): Promise<
    {
      id: string
      name?: string
      description?: string
      icon?: string
      manifestUrl: string
      signingSecret?: string
      botToken?: string
      userToken?: string
      configured: boolean
    }[]
  > => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.integration.slack.list()

    return items
      .filter(({ name }) => (name ? !name.startsWith('.') : true))
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        icon: '@clearbit/slack.com',
        manifestUrl: buildSlackManifestInstallUrl(
          i,
          `https://${context.host || siteHostname}`
        ),
        signingSecret: i.signingSecret,
        botToken: i.botToken,
        userToken: i.userToken,
        configured: i.signingSecret === '********' && i.botToken === '********',
      }))
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
    integrations: UnwrapPromise<ReturnType<typeof listIntegrations>>
  }> => {
    const [integrations] = await Promise.all([listIntegrations({})])

    if (!integrations) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in integrations) {
      throw errorToErrorResponse(integrations.error)
    }

    return { integrations }
  }
)

/**
 * @action
 */
export const configureIntegration = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
    signingSecret: z
      .string()
      .transform((v) => v.trim())
      .optional(),
    botToken: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => !v || v.startsWith('xoxb-'), {
        message: 'Bot User OAuth token must start with xoxb-',
      })
      .optional(),
    userToken: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => !v || v.startsWith('xoxp-'), {
        message: 'User OAuth token must start with xoxp-',
      })
      .optional(),
  }),
  async (_config, session, { id, signingSecret, botToken, userToken }) => {
    const userClient = await getSessionClient(session)

    const payload = {
      signingSecret:
        signingSecret && signingSecret.length > 0 ? signingSecret : undefined,

      botToken: botToken && botToken.length > 0 ? botToken : undefined,

      userToken:
        userToken && userToken.length > 0 ? (userToken as string) : undefined,
    }

    await userClient.integration.slack.update(id, payload)

    return { ok: true }
  }
)
