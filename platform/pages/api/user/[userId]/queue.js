// @ts-check
import { siteUrl } from '@/config/site'

import prisma from '@/prisma/client'

import { getUserClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { runTasksEach } from '@/lib/job'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { generateThreeWordSlug } from '@/lib/slug'
import { isEffectivePartnerAccount } from '@/lib/user.type'

import { sendEvent as sendWebhookEvent } from '@/pages/api/v1/webhook/[webhookId]/queue'

import { z } from 'zod'

export const MAX_WORKERS = 10

export const SETUP_EVENT_TYPE = 'setup'
export const TRIGGER_EVENT_TYPE = 'trigger'

export const CREATE_EMAIL_AGENT = false
export const CREATE_APPLICATION_PORTAL = false
export const CREATE_SUPPORT_INTEGRATION = false

/**
 * @typedef {z.infer<typeof SetupPayloadSchema>} SetupPayload
 */
export const SetupPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {z.infer<typeof TriggerPayloadSchema>} TriggerPayload
 */
export const TriggerPayloadSchema = z.object({
  eventType: z.string(),
  eventData: z.record(z.any()),
})

/**
 * @typedef {{
 *   type: typeof SETUP_EVENT_TYPE,
 *   payload: SetupPayload
 * }} SetupEvent
 *
 * @param {string} userId
 * @param {SetupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSetupEventType(userId, payload) {
  debug(`handle setup event type`, { payload }).log(
    'user.instance.queue.handleSetupEventType'
  )

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!user) {
    debug(`user not found`, { userId }).log(
      'user.instance.queue.handleSetupEventType'
    )

    return
  }

  if (await isEffectivePartnerAccount(user)) {
    debug(`skipping setup for partner-managed account`, { userId }).log(
      'user.instance.queue.handleSetupEventType'
    )

    return
  }

  const createSetupResources =
    CREATE_EMAIL_AGENT ||
    CREATE_APPLICATION_PORTAL ||
    CREATE_SUPPORT_INTEGRATION

  let client

  let setupBlueprintId

  if (createSetupResources) {
    try {
      client = await getUserClient(user)

      const { id } = await client.blueprint.create({
        name: 'Getting Started',
        description:
          'Resources created automatically to help you get started with ChatBotKit.',

        meta: {
          app: 'setup',
          source: 'automatic',
        },
      })

      setupBlueprintId = id
    } catch (e) {
      await captureException(e)

      return
    }
  }

  if (!client) {
    return
  }

  // setup personal email agent
  {
    if (CREATE_EMAIL_AGENT) {
      try {
        const { id: skillsetId } = await client.skillset.create({
          name: 'Assistant',
          description:
            'We took the liberty of creating a personal assistant for you. Please customize it to your liking.',

          blueprintId: setupBlueprintId,

          meta: {
            app: 'setup',
            source: 'automatic',
          },
        })

        const { id: botId } = await client.bot.create({
          name: 'Assistant',
          description:
            'We took the liberty of creating a personal assistant for you. Please customize it to your liking.',

          blueprintId: setupBlueprintId,

          backstory: `You are a personal assistant created by ChatBotKit.
  
Act as a general-purpose chat agent.

Respond as thoroughly as possible using the available information and tools.

Explain things in a way that is easy to understand and provide examples when possible.

Failure to follow these instructions will result in poor performance and will negatively impact the user experience.`,

          skillsetId,

          meta: {
            app: 'setup',
            source: 'automatic',
          },
        })

        const { id: emailIntegrationId } =
          await client.integration.email.create({
            name: 'Assistant',
            description:
              'We took the liberty of creating a personal assistant for you. Please customize it to your liking. See the associated bot for more details.',

            blueprintId: setupBlueprintId,

            botId,

            allowFrom: `${user.email}`,

            attachments: true,

            meta: {
              app: 'setup',
              source: 'automatic',
            },
          })

        // @todo use the specific sdk method once available

        await client.clientFetch(
          `/api/v1/integration/email/${emailIntegrationId}/initiate`,
          {
            method: 'POST',
            record: {
              text: `Great the user. Their name is ${user.name || 'unknown'}.

Explain that you are their personal assistant.

Explain that the ChatBotKit took the liberty of creating you for them as a way to showcase the capabilities of the platform.

Remind them that they can customize you to their liking or delete you if they want. This can be done here ${siteUrl}/integrations/email/${emailIntegrationId}.

Explain that they can reply back to you and you will take care of the rest.

Failure to follow these instructions will result in poor performance and will negatively impact the user experience.`,
              email: user.email,
              subject: 'Welcome to your personal assistant',
            },
          }
        )
      } catch (e) {
        await captureException(e)
      }
    }
  }

  // setup default portal
  {
    if (CREATE_APPLICATION_PORTAL) {
      try {
        const slug = generateThreeWordSlug({ suffix: true })

        debug(`creating default portal with slug: ${slug}`).log(
          'user.instance.queue.handleSetupEventType'
        )

        const { id: portalId } = await client.portal.create({
          name: 'My Chat App',
          description:
            'Your personal chat application portal. Customize this to build your own chat experience.',

          blueprintId: setupBlueprintId,

          slug: slug,

          config: {
            apps: {
              chat: {
                models: true,
                sources: {
                  datasets: true,
                  skillsets: true,
                  spaces: true,
                  mcps: true,
                },
                save: true,
              },
              connect: {},
              inbox: {},
            },
            users: {
              [`${user.email}`]: {},
            },
            layout: {
              icon: '/icon.png;/icon.png#filter=invertGrayscale',
              sidebar: true,
            },
          },
          meta: {
            app: 'setup',
            source: 'automatic',
          },
        })

        debug(`created default portal`, { portalId, slug }).log(
          'user.instance.queue.handleSetupEventType'
        )
      } catch (e) {
        await captureException(e)
      }
    }
  }

  // setup default support integration
  {
    if (CREATE_SUPPORT_INTEGRATION) {
      try {
        debug(`creating default support integration`).log(
          'user.instance.queue.handleSetupEventType'
        )

        const { id: supportIntegrationId } =
          await client.integration.support.create({
            name: 'Default Support Integration',
            description:
              'This integration will be used to automatically summarize conversation information.',

            blueprintId: setupBlueprintId,

            meta: {
              app: 'setup',
              source: 'automatic',
            },
          })

        debug(`created default support integration`, {
          supportIntegrationId,
        }).log('user.instance.queue.handleSetupEventType')
      } catch (e) {
        await captureException(e)
      }
    }
  }
}

/**
 * @param {import('@/prisma/types').Webhook} webhook
 * @param {string} eventType
 * @param {Record<string,any>} eventData
 * @returns {Promise<void>}
 */
export async function executeWebhook(webhook, eventType, eventData) {
  debug(`executing webhook`, { webhook, eventType, eventData }).log(
    'user.instance.queue.executeWebhook'
  )

  if (!webhook.request) {
    debug(`no request specified`).log('user.instance.queue.executeWebhook')

    return
  }

  if (!webhook.events) {
    debug(`no events specified`).log('user.instance.queue.executeWebhook')

    return
  }

  const supportedEvents = webhook.events.split(',')

  if (!supportedEvents.includes(eventType)) {
    debug(`event not supported`, { supportedEvents, eventType }).log(
      'user.instance.queue.executeWebhook'
    )

    return
  }

  await sendWebhookEvent(webhook.id, {
    type: 'trigger',
    payload: {
      eventType,
      eventData,
    },
  })
}

/**
 * @typedef {{
 *   type: typeof TRIGGER_EVENT_TYPE,
 *   payload: TriggerPayload
 * }} TriggerEvent
 *
 * @param {string} userId
 * @param {TriggerPayload} payload
 * @returns {Promise<void>}
 */
export async function handleTriggerEventType(userId, payload) {
  debug(`handle trigger event type`, { payload }).log(
    'user.instance.queue.handleTriggerEventType'
  )

  const { eventType, eventData } = payload

  const it = prisma.webhook.paginate({
    where: {
      userId: userId,
    },
  })

  await runTasksEach(MAX_WORKERS, it, async (webhook) => {
    await executeWebhook(webhook, eventType, eventData)
  })
}

/**
 * @param {string} userId
 * @param {SetupEvent|TriggerEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(userId, event) {
  debug(`queueing event`, { userId, event }).log(
    'user.instance.queue.sendEvent'
  )

  switch (true) {
    case event.type === SETUP_EVENT_TYPE: {
      await SetupPayloadSchema.parseAsync(event.payload)

      break
    }

    case event.type === TRIGGER_EVENT_TYPE: {
      await TriggerPayloadSchema.parseAsync(event.payload)

      break
    }
  }

  await queue(`/api/user/${userId}/queue`, event, {
    ...(event.type === SETUP_EVENT_TYPE
      ? {
          deduplicationId: `user-queue-event-${userId}-${event.type}`,
        }
      : {}),
  })
}

/**
 */
export default withQueueHandlerBounded('userId', {
  [SETUP_EVENT_TYPE]: {
    handler: handleSetupEventType,
    schema: SetupPayloadSchema,
  },
  [TRIGGER_EVENT_TYPE]: {
    handler: handleTriggerEventType,
    schema: TriggerPayloadSchema,
  },
})
