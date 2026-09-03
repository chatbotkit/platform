// @note Amazon SES through its v2 JSON API, signed locally - see ./sigv4.ts.
// The credentials are SES's own rather than the storage module's: sharing
// them would make configuring object storage silently switch mail delivery on.
import { fetch, getFetchError } from '@chatbotkit-dev/fetch'

import type { OutboundMessage } from './identity'
import { threadingHeaders } from './identity'
import { sign } from './sigv4'

interface Env {
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  endpoint: string
}

export function isConfigured(): boolean {
  return Boolean(process.env.SES_AWS_ACCESS_KEY_ID)
}

/**
 * @throws {Error} naming every required variable that is missing.
 */
function getEnv(): Env {
  const {
    SES_AWS_REGION,
    SES_AWS_ACCESS_KEY_ID,
    SES_AWS_SECRET_ACCESS_KEY,
    SES_AWS_SESSION_TOKEN,
    SES_AWS_ENDPOINT,
  } = process.env

  const missing = Object.entries({
    SES_AWS_REGION,
    SES_AWS_ACCESS_KEY_ID,
    SES_AWS_SECRET_ACCESS_KEY,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length) {
    throw new Error(
      `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not set, so mail cannot be delivered through SES`
    )
  }

  return {
    region: SES_AWS_REGION as string,
    accessKeyId: SES_AWS_ACCESS_KEY_ID as string,
    secretAccessKey: SES_AWS_SECRET_ACCESS_KEY as string,
    sessionToken: SES_AWS_SESSION_TOKEN || undefined,
    endpoint:
      SES_AWS_ENDPOINT?.replace(/\/+$/, '') ||
      `https://email.${SES_AWS_REGION}.amazonaws.com`,
  }
}

/**
 * @throws {Error} when the configuration is incomplete.
 */
export function assertEnv(): void {
  getEnv()
}

/**
 * @throws {Error} when the API rejects the message.
 */
export async function send(message: OutboundMessage): Promise<void> {
  const { region, accessKeyId, secretAccessKey, sessionToken, endpoint } =
    getEnv()

  const { from, to, subject, text, html, replyTo, messageId } = message

  const url = `${endpoint}/v2/email/outbound-emails`

  const body = JSON.stringify({
    FromEmailAddress: from,

    Destination: { ToAddresses: [to] },

    ...(replyTo ? { ReplyToAddresses: [replyTo] } : null),

    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },

        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },

        ...(messageId
          ? {
              Headers: Object.entries(threadingHeaders(messageId)).map(
                ([Name, Value]) => ({ Name, Value })
              ),
            }
          : null),
      },
    },
  })

  const headers = sign({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    body,

    region,
    service: 'ses',

    accessKeyId,
    secretAccessKey,
    sessionToken,
  })

  const response = await fetch(url, { method: 'POST', headers, body })

  if (!response.ok) {
    throw await getFetchError(response, { vendor: 'ses', from })
  }
}
