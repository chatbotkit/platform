'use server'

import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from '../config'
import { APP_NAME, CONTACT_NAMESPACE } from '../const'
import { getFeatures } from './lib'

/**
 * @action
 */
export const getConversationDetails = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (_config, session, { conversationId }) => {
    const cbk = await getSessionClient(session)

    const { data } = await cbk.graphql.call({
      query: `
        query GetConversationDetails($conversationId: ID!) {
          conversations(first: 1, conversationIds: [$conversationId]) {
            edges {
              node {
                id
                name
                description
                meta
                createdAt
                contact {
                  id
                  name
                  description
                  email
                  phone
                  nick
                  createdAt
                  conversations(first: 6) {
                    edges {
                      node {
                        id
                        name
                        description
                        createdAt
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        conversationId,
      },
    })

    return {
      conversation:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any)?.conversations?.edges?.[0]?.node || null,
    }
  }
)

/**
 * @action
 */
export const getConversationMessages = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (config, session, { conversationId }) => {
    const cbk = await getSessionClient(session)

    const features = getFeatures(config)

    const filter = features?.conversation?.detailed
      ? () => true
      : (item: unknown) =>
          ['bot', 'user'].includes(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item as any).type
          )

    const messages: unknown[] = []

    for await (const { data } of cbk.conversation.message
      .list(conversationId)
      .stream()) {
      if (!filter(data)) {
        continue
      }

      messages.push(data)
    }

    return {
      messages: messages,
    }
  }
)

/**
 * @action
 */
export const upvoteMessage = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    messageId: z.string(),
  }),
  async (_config, session, _contact, { conversationId, messageId }) => {
    const cbk = await getSessionClient(session)

    await cbk.conversation.message.upvote(conversationId, messageId, {
      // @todo use the contact
    })
  }
)

/**
 * @action
 */
export const downvoteMessage = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    messageId: z.string(),
    reason: z.string().optional(),
  }),
  async (_config, session, _contact, { conversationId, messageId, reason }) => {
    const cbk = await getSessionClient(session)

    await cbk.conversation.message.downvote(conversationId, messageId, {
      // @todo use the contact

      // @ts-ignore because it is not properly typed in the SDK yet
      reason: reason,
    })
  }
)
