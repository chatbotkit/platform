import { fetch, getFetchError } from '@chatbotkit-dev/fetch'

import type { OutboundMessage } from './identity'
import { threadingHeaders } from './identity'

export const RESEND_API = 'https://api.resend.com/emails'

export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * @throws {Error} when `RESEND_API_KEY` is not set.
 */
export function assertEnv(): void {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY is not set, so mail cannot be delivered through Resend'
    )
  }
}

/**
 * @throws {Error} when the API rejects the message; the response body carries
 * Resend's own reason, typically an unverified sending domain.
 */
export async function send(message: OutboundMessage): Promise<void> {
  assertEnv()

  const { from, to, subject, text, html, replyTo, messageId } = message

  const response = await fetch(RESEND_API, {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,

      ...(replyTo ? { reply_to: replyTo } : null),
      ...(messageId ? { headers: threadingHeaders(messageId) } : null),
    }),
  })

  if (!response.ok) {
    throw await getFetchError(response, { vendor: 'resend', from })
  }
}
