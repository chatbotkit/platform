// @ts-check
import { parseInboundEmail } from '@chatbotkit-dev/email'
import { html2text } from '@chatbotkit-dev/file-html/parse'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { parseMessage } from '@/lib/email.message'
import {
  emailMatchesAnyPattern,
  parseEmailPatterns,
} from '@/lib/email.validation'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { reconcileTypeAndExt } from '@/lib/mime2'
import { badRequest, notAuthorized, notFound, ok } from '@/lib/response'
import {
  getSessionFileTempDownloadURL,
  uploadSessionFile,
} from '@/lib/session.file'
import { tryExtname } from '@/lib/url'

import {
  INTERACT_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/integration/email/[emailIntegrationId]/queue'

import EmailReplyParser from 'email-reply-parser'

export default withAny(async function (req) {
  const data = await req.formData()

  debug(`received data`, { data }).log('integration.email.parse')

  // @note the payload format belongs to the email module's inbound vendor -
  // the module normalizes it and recognizes its own integration addresses,
  // or declines with null

  const inbound = await parseInboundEmail(data)

  if (!inbound) {
    // @todo maybe reply back with a 404 message tha the inbox does not exist

    return notFound()
  }

  const {
    to: toEmail,
    fromName,
    fromEmail,
    subject,
    html,
    text,
    senderIp,
    headers,
    attachments: receivedAttachments,
  } = inbound

  debug(`received email`, {
    fromEmail,
    toEmail,
    subject,
    html,
    text,
    senderIp,
    headers,
  }).log('integration.email.parse')

  debug(`received attachments`, { receivedAttachments }).log(
    'integration.email.parse'
  )

  const emailIntegrationId = inbound.integrationId

  // verify integration exists and check allowed emails
  {
    const integration = await prisma.emailIntegration.findUnique({
      where: { id: emailIntegrationId },
      select: { allowFrom: true, userId: true },
    })

    if (!integration) {
      debug(`email integration not found`, { emailIntegrationId }).log(
        'integration.email.parse'
      )

      return notFound()
    }

    const allowedPatterns = parseEmailPatterns(integration.allowFrom || '')

    // @note empty list means deny all - use '*' to explicitly allow everyone

    const isAllowed = emailMatchesAnyPattern(fromEmail, allowedPatterns)

    if (!isAllowed) {
      debug(`email not allowed`, { fromEmail, allowedPatterns }).log(
        'integration.email.parse'
      )

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.email.blocked',
        relations: {
          emailIntegrationId,
        },
        meta: {
          from: fromEmail,
        },
      })

      return notAuthorized()
    }
  }

  let message

  // parse message
  {
    switch (true) {
      case !!text: {
        // @note always parse the text message first to ensure we get the correct text

        message = text

        break
      }

      case !!html: {
        // @note we always wrap in body to ensure the default selectors are applied

        message = html2text(`<body>${html}</body>`)

        break
      }

      default: {
        // @note no text or html body - fall through to subject as message
        message = ''
      }
    }

    message = message.trim()

    if (message) {
      const email = new EmailReplyParser().read(message)

      message = email.getVisibleText().trim()
    } else {
      message = subject.trim()
    }

    if (!message) {
      return badRequest()
    }
  }

  let messageId
  let inReplyTo

  // parse message-id and in-reply-to headers
  {
    const parse = await parseMessage(headers || '')

    messageId = parse.messageId
    inReplyTo = parse.inReplyTo
  }

  let attachments

  // upload attachments
  {
    if (receivedAttachments.length) {
      attachments = await Promise.all(
        receivedAttachments.map(
          async ({ name: _name, size, type: _type, data }) => {
            let { type, ext } = reconcileTypeAndExt(
              _type,
              tryExtname(`/${_name}`)?.slice(1) || null
            )

            if (!type) {
              type = 'application/octet-stream'
            }

            debug(`uploading attachment`, {
              type,
              ext,
            }).log('integration.email.parse')

            const { sessionId, name } = await uploadSessionFile(
              `email-integration-${emailIntegrationId}`,
              new Uint8Array(data),
              type,
              ext,
              {
                maxSize: Infinity, // @todo use the real limit
              }
            )

            const url = await getSessionFileTempDownloadURL(sessionId, name)

            return {
              name: _name,
              size,
              type,
              data: {
                url,
              },
            }
          }
        )
      )
    }
  }

  await sendEvent(emailIntegrationId, {
    type: INTERACT_EVENT_TYPE,
    payload: {
      to: toEmail,
      from: {
        name: fromName,
        email: fromEmail,
      },
      subject: subject,
      message: message,
      meta: {
        ...(senderIp ? { ipAddress: senderIp } : {}),
      },
      messageId: messageId,
      inReplyTo: inReplyTo,
      attachments: attachments,
    },
  })

  return ok({ id: emailIntegrationId })
})

export const config = {
  api: {
    bodyParser: false, // @note because the data is submitted as form data
  },
}
