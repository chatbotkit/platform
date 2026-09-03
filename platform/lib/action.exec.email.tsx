import { render } from 'react-email'

import { sendEmailAction } from '@chatbotkit-dev/email'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { isValidEmail } from '@/lib/email.validation'
import { UserInputError } from '@/lib/error'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { recordEmailUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

import EmailAction from '@/emails/EmailAction'

/**
 * Schema for email action parameters
 */
export const executeEmailSchema = z.object({
  to: z.string(),
  replyTo: z.string().optional(),
  subject: z.string().optional(),
  content: z.string(),
})

/**
 * Executes an email action. This action is used to send emails to a specified
 * email address.
 */
export async function executeEmailAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  await logEvent({
    user: { id: options.userId },
    type: 'action.email.send',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const {
    to,
    replyTo,
    subject: _subject,
    content,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      content: input,
    },
    schema: executeEmailSchema,
  })

  if (to) {
    if (!isValidEmail(to)) {
      throw new UserInputError(`Invalid 'to' parameter`)
    }
  } else {
    throw new UserInputError(`Missing 'to' parameter`)
  }

  if (replyTo) {
    if (!isValidEmail(replyTo)) {
      throw new UserInputError(`Invalid 'replyTo' parameter`)
    }
  }

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  if (!(await accountLimitsOk(user, ['email']))) {
    const error = 'You have reached your email limit.'

    return {
      error: error,
    }
  }

  // @todo check the rate limits

  const element = <EmailAction input={content} />

  const subject = _subject || EmailAction.subject

  const text = await render(element, { plainText: true })
  const html = await render(element)

  // @todo customize the from email address

  debug(`sending email action email`, {
    subject,
    html,
    text,
    replyTo,
    to,
  }).log('action.exec.email.executeEmailAction')

  // @note the action sending identity belongs to the email provider

  await sendEmailAction({
    to,
    subject,
    content: { text, html },
    replyTo,
  })

  await recordEmailUsage({
    user,
    count: 1,
    meta: {
      reason: 'action/email',
    },
  })

  return {
    result: {
      status: 'success',
    },
  }
}

/**
 * @doc Skillsets
 * @index 43
 *
 * ## Email Action - Sending Messages
 *
 * The email action allows your chatbot to send emails to specified recipients. This is useful for notifications, support requests, confirmations, and other communication needs.
 *
 * ### Properties
 *
 * - **to**: The email address to send the message to (required)
 * - **replyTo**: The email address to use for the reply-to field
 * - **subject**: The subject for the email. If not provided, a default subject will be used
 *
 * ### Example
 *
 * `````markdown
 * ```email
 * to: $[to! ys|recipient email address]
 * replyTo: $[replyTo ys|sender email address for replies]
 * subject: $[subject ys|email subject line]
 * content: $[content! ys|the message to send]
 * ```
 * `````
 */
