// @ts-check
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import prisma from '@/prisma/client'

import { canUseBot } from '@/lib/bot.access'
import { getConversationDetailsField } from '@/lib/bot.conversation'
import cuid from '@/lib/cuid'
import { canUseDataset } from '@/lib/dataset.access'
import debug, { createSpan } from '@/lib/debug'
import { getMessageType } from '@/lib/message'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { canUseSkillset } from '@/lib/skillset.access'
import { byteSlice } from '@/lib/string'
import { recordConversationUsage, recordMessageUsage } from '@/lib/usage.record'

/**
 * @typedef {{type: string, text: string, meta?: Record<string,any>}} Message
 */

/**
 * The following are used mostly to optimize and speed up execution.
 *
 * @typedef {{
 *   type: 'bot',
 *   instance: Pick<import('@/prisma/types').Bot,'id'|'userId'|'visibility'>
 * }} BotResource
 *
 * @typedef {{
 *   type: 'dataset',
 *   instance: Pick<import('@/prisma/types').Dataset,'id'|'userId'|'visibility'>
 * }} DatasetResource
 *
 * @typedef {{
 *   type: 'skillset',
 *   instance: Pick<import('@/prisma/types').Skillset,'id'|'userId'|'visibility'>
 * }} SkillsetResource
 *
 * @typedef {BotResource|DatasetResource|SkillsetResource} Resource
 */

/**
 * Exported create conversation function to be reused across different services.
 *
 * @param {string} userId
 * @param {{
 *   namespace?: string|null,
 *   name?: string|null,
 *   description?: string|null,
 *   backstory?: string|null,
 *   model?: string|null,
 *   privacy?: boolean|null,
 *   moderation?: boolean|null,
 *   contactId?: string|null,
 *   taskId?: string|null,
 *   spaceId?: string|null,
 *   botId?: string|null,
 *   datasetId?: string|null,
 *   skillsetId?: string|null,
 *   expiresAt?: Date|null,
 *   meta?: Record<string,any>|null,
 *   messages?: Message[]|null,
 *   resources?: Resource[]|null,
 * }} options
 * @param {{
 *   bpacc?: boolean
 * }} [securityOptions]
 * @returns {Promise<{id: string, messages?: Message[] }>}
 */
export async function createConversation(
  userId,

  {
    namespace,

    name,
    description,

    backstory,

    model,

    privacy,
    moderation,

    contactId,

    taskId,

    spaceId,

    botId,

    datasetId,
    skillsetId,

    expiresAt,

    meta,

    messages,

    resources,
  },

  { bpacc } = {}
) {
  const span = createSpan({ name: 'createConversation' })

  try {
    debug('creating conversation', {
      namespace,

      name,
      description,

      backstory,

      model,

      privacy,
      moderation,

      contactId,

      taskId,

      spaceId,

      botId,

      datasetId,
      skillsetId,

      meta,

      bpacc,
    }).log('conversation.create.createConversation')

    // start validation tasks

    const validationTasks = [] // we run all the tasks concurrently in order to save time

    let bot

    // validate bot
    {
      if (botId) {
        validationTasks.push(async () => {
          const botResource = /** @type {BotResource|undefined} */ (
            resources?.find((resource) => {
              return resource.type === 'bot' && resource.instance.id === botId
            })
          )

          bot = botResource?.instance

          if (!bot) {
            const span = createSpan({
              name: 'prisma.bot.findUnique',
            })

            try {
              bot = await prisma.bot.findUnique({
                where: {
                  id: botId,
                },

                select: {
                  id: true,

                  userId: true,

                  visibility: true,
                },

                cacheStrategy: {
                  ttl: 60,
                  swr: 60,
                },
              })
            } finally {
              span.finish()
            }
          }

          if (!bot) {
            return throwNotFound(`Bot not found: ${botId}`)
          }

          if ((await canUseBot(userId, bot)) === false) {
            if (bpacc) {
              debug('bypassing access control for bot', { botId }).log(
                'conversation.create.createConversation'
              )
            } else {
              throwNotAuthorized('You are not authorized to access this bot')
            }
          }
        })
      }
    }

    let dataset

    // validate dataset
    {
      if (datasetId) {
        validationTasks.push(async () => {
          const datasetResource = /** @type {DatasetResource|undefined} */ (
            resources?.find((resource) => {
              return (
                resource.type === 'dataset' &&
                resource.instance.id === datasetId
              )
            })
          )

          dataset = datasetResource?.instance

          if (!dataset) {
            const span = createSpan({ name: 'prisma.dataset.findUnique' })

            try {
              dataset = await prisma.dataset.findUnique({
                where: {
                  id: datasetId,
                },

                select: {
                  id: true,

                  userId: true,

                  visibility: true,
                },

                cacheStrategy: {
                  ttl: 60,
                  swr: 60,
                },
              })
            } finally {
              span.finish()
            }
          }

          if (!dataset) {
            return throwNotFound(`Dataset not found: ${datasetId}`)
          }

          if ((await canUseDataset(userId, dataset)) === false) {
            if (bpacc) {
              debug('bypassing access control for dataset', { datasetId }).log(
                'conversation.create.createConversation'
              )
            } else {
              throwNotAuthorized(
                'You are not authorized to access this dataset'
              )
            }
          }
        })
      }
    }

    let skillset

    // validate skillset
    {
      if (skillsetId) {
        validationTasks.push(async () => {
          const skillsetResource = /** @type {SkillsetResource|undefined} */ (
            resources?.find((resource) => {
              return (
                resource.type === 'skillset' &&
                resource.instance.id === skillsetId
              )
            })
          )

          skillset = skillsetResource?.instance

          if (!skillset) {
            const span = createSpan({
              name: 'prisma.skillset.findUnique',
            })

            try {
              skillset = await prisma.skillset.findUnique({
                where: {
                  id: skillsetId,
                },

                select: {
                  id: true,

                  userId: true,

                  visibility: true,
                },

                cacheStrategy: {
                  ttl: 60,
                  swr: 60,
                },
              })
            } finally {
              span.finish()
            }
          }

          if (!skillset) {
            return throwNotFound(`Skillset not found: ${skillsetId}`)
          }

          if ((await canUseSkillset(userId, skillset)) === false) {
            if (bpacc) {
              debug('bypassing access control for skillset', {
                skillsetId,
              }).log('conversation.create.createConversation')
            } else {
              throwNotAuthorized(
                'You are not authorized to access this skillset'
              )
            }
          }
        })
      }
    }

    // run all the validation tasks
    {
      await Promise.all(validationTasks.map((task) => task()))
    }

    // start creation tasks

    const creationTasks = [] // we run all the tasks concurrently in order to save time

    const conversationId = cuid()

    // handle conversation
    {
      creationTasks.push(async () => {
        const span = createSpan({
          name: 'prisma.conversation.create',
        })

        try {
          // We assign all the fields no matter what regardless how we use them
          // in the future and this is useful to ensure continuity in some
          // circumstances such as when a bot is deleted and therefore the
          // conversation no longer having access to the backstory or the model.
          //
          // It is important to remember that all these fields also have
          // defaults that are in line with the prisma schema. If the prisma
          // schema changes then this code needs to be updated as well.

          const data = {
            id: conversationId,

            userId: userId,

            name: name ?? undefined,
            description: description ?? undefined,

            backstory: getConversationDetailsField(
              { backstory, bot },
              'backstory',
              ''
            ),

            model: getConversationDetailsField({ model, bot }, 'model', ''),

            privacy: getConversationDetailsField(
              { privacy, bot },
              'privacy',
              false
            ),
            moderation: getConversationDetailsField(
              { moderation, bot },
              'moderation',
              false
            ),

            contactId: contactId,

            taskId: taskId,

            spaceId: spaceId,

            botId: botId,

            datasetId: getConversationDetailsField(
              { datasetId, bot },
              'datasetId',
              undefined
            ),
            skillsetId: getConversationDetailsField(
              { skillsetId, bot },
              'skillsetId',
              undefined
            ),

            expiresAt: expiresAt ?? undefined,

            meta: {
              namespace: namespace ?? undefined,

              ...meta,
            },
          }

          debug(`using data`, { data })

          await prisma.conversation.create({ data })
        } finally {
          span.finish()
        }
      })
    }

    // handle conversation usage
    {
      creationTasks.push(async () => {
        const span = createSpan({
          name: 'recordConversationUsage',
        })

        try {
          await recordConversationUsage({ user: { id: userId }, count: 1 })
        } finally {
          span.finish()
        }
      })
    }

    // handle messages
    {
      if (messages?.length) {
        creationTasks.push(async () => {
          const span = createSpan({
            name: 'prisma.message.createMany',
          })

          try {
            const data = messages.map(({ type, text, meta }) => {
              return {
                conversationId,

                type: getMessageType(type),
                text: byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH), // @todo instead of slicing split the message into shorter messages

                meta: meta,
              }
            })

            debug(`using data`, { data })

            await prisma.message.createMany({
              data,
            })
          } finally {
            span.finish()
          }
        })
      }
    }

    // handle messages usage
    {
      if (messages?.length) {
        creationTasks.push(async () => {
          const span = createSpan({
            name: 'recordMessageUsage',
          })

          try {
            await recordMessageUsage({
              user: { id: userId },
              count: messages.length,
            })
          } finally {
            span.finish()
          }
        })
      }
    }

    // run all the creation tasks
    // @note the assumption is that neither of the tasks will fail and if they
    // do then there will be some miscounting of usage
    // @todo find a way to handle this better
    {
      await Promise.all(creationTasks.map((task) => task()))
    }

    return {
      id: conversationId,

      messages: messages?.length ? messages : undefined,
    }
  } finally {
    span.finish()
  }
}
