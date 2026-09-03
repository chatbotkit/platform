import { fetch, getFetchError } from '@chatbotkit-dev/fetch'

import type { OutboundMessage } from './identity'
import { parseAddress, threadingHeaders } from './identity'

export const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send'

export function isConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY)
}

/**
 * @throws {Error} when `SENDGRID_API_KEY` is not set.
 */
export function assertEnv(): void {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error(
      'SENDGRID_API_KEY is not set, so mail cannot be delivered through SendGrid'
    )
  }
}

/**
 * @throws {Error} when the API rejects the message.
 */
export async function send(message: OutboundMessage): Promise<void> {
  assertEnv()

  const { from, to, subject, text, html, replyTo, messageId, essential } =
    message

  const response = await fetch(SENDGRID_API, {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      from: parseAddress(from),

      ...(replyTo ? { reply_to: { email: replyTo } } : null),

      subject,

      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],

      personalizations: [{ to: [{ email: to }] }],

      ...(messageId ? { headers: threadingHeaders(messageId) } : null),

      // @note account defaults apply otherwise; only essential mail overrides
      // them, because it must reach an unsubscribed recipient and is not
      // marketing
      ...(essential
        ? {
            tracking_settings: {
              click_tracking: { enable: false },
              open_tracking: { enable: false },
              subscription_tracking: { enable: false },
            },
            mail_settings: {
              bypass_list_management: { enable: true },
            },
          }
        : null),
    }),
  })

  if (!response.ok) {
    throw await getFetchError(response, { vendor: 'sendgrid', from })
  }
}
