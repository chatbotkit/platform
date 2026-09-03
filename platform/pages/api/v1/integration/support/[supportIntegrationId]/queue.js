// @ts-check
import { sendEmailNotification } from '@chatbotkit-dev/email'

import prisma from '@/prisma/client'
import { MessageType, Trigger } from '@/prisma/types'

import { ensureUntrustedContact } from '@/lib/contact.create'
import { isAutonomousConversation } from '@/lib/conversation.app'
import debug from '@/lib/debug'
import { isReservedExampleEmail, isValidEmail } from '@/lib/email.validation'
import { captureInputError } from '@/lib/error'
import { extractContactDetails3 } from '@/lib/extract.contact'
import { runTasks } from '@/lib/job'
import { toHtml } from '@/lib/md.convert'
import { getSortedMessages } from '@/lib/message'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { Usage } from '@/lib/usage.model'
import { parseAsync } from '@/lib/zod.schema'

import humanparser from 'humanparser'
import { z } from 'zod'

export const IDLE_EVENT_TYPE = 'idle'

/**
 * @typedef {z.infer<typeof IdlePayloadSchema>} IdlePayload
 */
export const IdlePayloadSchema = z.object({
  conversationId: z.string(),
})

/**
 * @typedef {{
 *   type: typeof IDLE_EVENT_TYPE,
 *   payload: IdlePayload
 * }} IdleEvent
 *
 * @param {string} supportIntegrationId
 * @param {IdlePayload} payload
 * @returns {Promise<void>}
 */
export async function handleIdleEvent(supportIntegrationId, payload, context) {
  debug(`handle idle event`, { supportIntegrationId, payload })
    .log('integration.support.handleIdleEvent')
    .log('temp.integration.support.handleIdleEvent') // @todo temp setup to be removed after 2025/09/30

  const integration = await prisma.supportIntegration.findUnique({
    where: {
      id: supportIntegrationId,
    },
  })

  if (!integration) {
    return throwNotFound(
      `SupportIntegration not found: ${supportIntegrationId}`
    )
  }

  // @note no need to stop if no bot configured

  if (integration.trigger === Trigger.never) {
    return
  }

  // Find the conversation.

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: payload.conversationId,

      ...(integration.botId ? { botId: integration.botId } : {}), // filter by botId if provided
    },

    include: {
      user: true,

      contact: true,
    },
  })

  if (!conversation) {
    return throwNotFound(`Conversation not found: ${payload.conversationId}`)
  }

  if (integration.userId !== conversation.userId) {
    return throwNotAuthorized(
      `Conversation access not allowed: ${payload.conversationId}`
    )
  }

  // @note autonomous conversations (trigger/task runs) have no human
  // counterpart. Running contact extraction on them makes the extractor
  // hallucinate placeholder contacts (e.g. "Daily Trigger"
  // <daily_trigger@example.com>) and attach a bogus contact per run, so the
  // support integration does not apply to them.

  if (isAutonomousConversation(conversation)) {
    debug(`skipping support extraction for autonomous conversation`, {
      conversationId: conversation.id,
      app: conversation.meta?.app,
    }).log('integration.support.handleIdleEvent')

    return
  }

  // Get the messages.

  const messages = getSortedMessages(
    await prisma.message.findMyriad({
      where: {
        conversationId: conversation.id,
      },

      select: {
        id: true, // @note important for sorting

        type: true,
        text: true,

        meta: true, // @note required for activity message processing

        createdAt: true, // @note important for sorting
      },

      orderBy: {
        createdAt: 'desc',
      },
    })
  )

  // Perform the extraction.

  const { details, tokensUsed, modelUsed } = await extractContactDetails3(
    messages,
    // @note forward the queue monitor's hard-timeout signal so the extraction
    // aborts promptly instead of running to the hard kill (the queue-timeout regression)
    { user: conversation.user, signal: context?.signal }
  )

  await Usage.createAndRecord({
    user: conversation.user,
    token: tokensUsed,
    model: modelUsed,
    meta: {
      reason: 'conversation/extract',
    },
    references: {
      conversationId: conversation.id,
      botId: integration.botId || undefined,
    },
  })

  const conversationName =
    details?.conversationName || conversation.name || null
  const conversationDescription =
    details?.conversationDescription || conversation.description || null

  const email = details?.email || conversation.contact?.email
  const name = details?.name || conversation.contact?.name

  const info = humanparser.parseName(name || '')

  const subject = `Conversation with ${info.firstName || 'user'}`

  // @note only treat the extraction as a real person when it yields a
  // syntactically valid, non-placeholder email. On conversations without a human
  // counterpart the extractor can hallucinate plausible-looking details (e.g.
  // "Daily Trigger" <daily_trigger@example.com>), so creating a contact from
  // those would pollute the contact list with one bogus contact per run.

  const hasRealContactEmail =
    !!email && isValidEmail(email) && !isReservedExampleEmail(email)

  // get associated contact

  let associatedContact = conversation.contact || undefined

  {
    if (!associatedContact && hasRealContactEmail) {
      associatedContact = await ensureUntrustedContact(
        { id: conversation.userId },
        {
          email: email,
          name: info.fullName,
        }
      )
    }
  }

  await runTasks([
    // capture meta

    async () => {
      // @todo this needs to be made optional behind a configurable option

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          ...(conversation.name || !conversationName
            ? null
            : {
                name: conversationName,
              }),

          ...(conversation.description || !conversationDescription
            ? null
            : {
                description: conversationDescription,
              }),

          ...(associatedContact ? { contactId: associatedContact.id } : null),

          meta: {
            ...conversation.meta,

            integrations: {
              ...conversation.meta?.integrations,

              support: {
                ...conversation.meta?.integrations?.support,

                email: email,
                name: info.fullName,
              },
            },
          },
        },
      })
    },

    // send email

    async () => {
      // @todo use email template for this

      let textConversation =
        `${conversationDescription || ''}\n\n---\n\n` +
        messages
          .filter(({ type }) =>
            /** @type {MessageType[]} */ ([
              MessageType.bot,
              MessageType.user,
            ]).includes(type)
          )
          .map((message) => {
            return `**${
              message.type === MessageType.user ? info.firstName : message.type
            }**: ${message.text}`
          })
          .join('\n\n')

      textConversation += `\n\nThis conversation can be found at ${process.env.SITE_URL}/conversations/${conversation.id}`

      if (
        integration.email &&
        associatedContact?.email &&
        isValidEmail(associatedContact.email)
      ) {
        // @note the provider takes a rendered body. Whether this text is
        // markdown is something this caller knows and the provider does not.

        await sendEmailNotification({
          to: integration.email,
          subject,
          content: {
            text: textConversation,
            html: await toHtml(textConversation),
          },
          replyTo: associatedContact.email,
        })
      }
    },

    // trigger event

    async () => {
      // @todo add code here
    },
  ])
}

/**
 * @param {string} supportIntegrationId
 * @param {IdleEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(supportIntegrationId, event) {
  switch (true) {
    case event.type === IDLE_EVENT_TYPE: {
      await parseAsync(IdlePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(
    `/api/v1/integration/support/${supportIntegrationId}/queue`,
    event
  )
}

/**
 */
export default withQueueHandlerBounded('supportIntegrationId', {
  [IDLE_EVENT_TYPE]: {
    handler: handleIdleEvent,
    schema: IdlePayloadSchema,
  },
})
