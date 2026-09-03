import debug from '@/lib/debug'
import { SystemError } from '@/lib/error'
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'
import { CONFLICT_CODE } from '@/lib/response'

export interface GooglechatIntegration {
  serviceAccountKey: string | null
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  project_id?: string
}

interface GoogleChatSendMessageOptions {
  privateMessageViewerName?: string
}

// @note base64url encoding helper used for JWT construction
function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

  let binary = ''

  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlJson(obj: unknown): string {
  return base64url(JSON.stringify(obj))
}

/**
 * Creates a signed JWT assertion for a Google service account, suitable for
 * exchanging with Google's OAuth2 token endpoint.
 */
async function createServiceAccountJwt(
  sa: ServiceAccountKey,
  scope: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }

  const payload = {
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`

  // @note strip PEM headers/footers and decode the private key
  const pemContent = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const keyBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

/**
 * Obtains a Google OAuth2 access token for the Chat API using a service
 * account JWT assertion. Result is cached in redis to avoid repeated
 * token exchanges.
 */
export async function getGoogleChatAccessToken(
  integration: GooglechatIntegration
): Promise<string> {
  if (!integration.serviceAccountKey) {
    throw new SystemError(
      'Google Chat integration is missing service account key',
      CONFLICT_CODE
    )
  }

  let sa: ServiceAccountKey

  try {
    sa = JSON.parse(integration.serviceAccountKey)
  } catch {
    throw new SystemError(
      'Google Chat integration has invalid service account key JSON',
      CONFLICT_CODE
    )
  }

  const cacheKey = `googlechat:token:${sa.client_email}`

  const cached = await memcache.get<string>(cacheKey)

  if (cached) {
    return cached
  }

  const jwt = await createServiceAccountJwt(
    sa,
    'https://www.googleapis.com/auth/chat.bot'
  )

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  if (!response.ok) {
    const text = await response.text()

    debug(`token error`, { text }).log('googlechat.api.getAccessToken')

    throw new SystemError(
      `Failed to get Google Chat access token: ${response.status}`,
      CONFLICT_CODE
    )
  }

  const data = await response.json()

  // @note expire 5 minutes before actual expiry for safety
  const ttl = Math.max((data.expires_in ?? 3600) - 300, 60)

  await memcache.set(cacheKey, data.access_token, { ex: ttl })

  return data.access_token
}

export function getGoogleChatAttachmentMediaDownloadUrl(
  resourceName: string
): string {
  return `https://chat.googleapis.com/v1/media/${encodeURI(resourceName)}?alt=media`
}

export function normalizeGoogleChatUserName(user: string): string {
  return user.startsWith('users/') ? user : `users/${user}`
}

export function isGoogleChatSpaceName(space: string): boolean {
  return space.startsWith('spaces/')
}

/**
 * Finds the direct message space between the Chat app and a Google Chat user.
 *
 * @param integration  The Google Chat integration with service account key
 * @param user         The Google Chat user resource name or ID
 */
export async function findGoogleChatDirectMessageSpace(
  integration: GooglechatIntegration,
  user: string
): Promise<string> {
  const accessToken = await getGoogleChatAccessToken(integration)
  const userName = normalizeGoogleChatUserName(user)
  const query = new URLSearchParams({ name: userName }).toString()

  const response = await fetch(
    `https://chat.googleapis.com/v1/spaces:findDirectMessage?${query}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()

    debug(`find dm error`, { status: response.status, error: errorText }).log(
      'googlechat.api.findGoogleChatDirectMessageSpace'
    )

    throw new SystemError(
      `Failed to find Google Chat direct message space: ${response.status}`,
      CONFLICT_CODE
    )
  }

  const data = await response.json()

  if (!data.name) {
    throw new SystemError(
      'Google Chat direct message space response is missing name',
      CONFLICT_CODE
    )
  }

  return data.name
}

/**
 * Resolves either a Google Chat space resource name or a user identifier to a
 * Google Chat space resource name.
 */
export async function resolveGoogleChatSpace(
  integration: GooglechatIntegration,
  space: string
): Promise<string> {
  if (isGoogleChatSpaceName(space)) {
    return space
  }

  return await findGoogleChatDirectMessageSpace(integration, space)
}

/**
 * Sends a message to a Google Chat space via the Chat REST API.
 *
 * @param accessToken  OAuth2 access token
 * @param spaceName    The space resource name, e.g. "spaces/SPACE_ID"
 * @param body         The message body to send
 * @param threadName   Optional thread resource name for threaded replies
 */
async function postMessage(
  accessToken: string,
  spaceName: string,
  body: Record<string, unknown>,
  threadName?: string,
  options?: GoogleChatSendMessageOptions
): Promise<void> {
  if (threadName) {
    body.thread = { name: threadName }
  }

  if (options?.privateMessageViewerName) {
    body.privateMessageViewer = { name: options.privateMessageViewerName }
  }

  const url = `https://chat.googleapis.com/v1/${spaceName}/messages`

  const postUrl = threadName
    ? `${url}?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`
    : url

  const response = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()

    debug(`send error`, {
      status: response.status,
      error: errorText,
      url: postUrl,
      spaceName,
      body,
      threadName,
      privateMessageViewerName: options?.privateMessageViewerName,
    }).log('googlechat.api.postMessage')

    throw new SystemError(
      `Failed to send Google Chat message: ${response.status}: ${errorText}`,
      CONFLICT_CODE
    )
  }
}

/**
 * Sends a text message to a Google Chat space. Uses the Chat REST API with
 * service account authentication.
 *
 * @param integration  The Google Chat integration with service account key
 * @param spaceName    The space resource name, e.g. "spaces/SPACE_ID"
 * @param text         The message text to send
 * @param threadName   Optional thread resource name for threaded replies
 */
export async function sendGoogleChatMessage(
  integration: GooglechatIntegration,
  spaceName: string,
  text: string,
  threadName?: string,
  options?: GoogleChatSendMessageOptions
): Promise<void> {
  const accessToken = await getGoogleChatAccessToken(integration)

  debug(`sending message`, {
    spaceName,
    text: text.substring(0, 100),
    threadName,
    privateMessageViewerName: options?.privateMessageViewerName,
  }).log('googlechat.api.sendGoogleChatMessage')

  await postMessage(accessToken, spaceName, { text }, threadName, options)
}

/**
 * Sends an image to a Google Chat space using a cardsV2 message with an
 * Image widget. Falls back to sending the URL as plain text if the image
 * URL is empty.
 *
 * @param integration  The Google Chat integration with service account key
 * @param spaceName    The space resource name, e.g. "spaces/SPACE_ID"
 * @param imageUrl     The image URL to embed
 * @param threadName   Optional thread resource name for threaded replies
 */
export async function sendGoogleChatImageMessage(
  integration: GooglechatIntegration,
  spaceName: string,
  imageUrl: string,
  threadName?: string,
  options?: GoogleChatSendMessageOptions
): Promise<void> {
  const accessToken = await getGoogleChatAccessToken(integration)

  debug(`sending image`, {
    spaceName,
    imageUrl,
    threadName,
    privateMessageViewerName: options?.privateMessageViewerName,
  }).log('googlechat.api.sendGoogleChatImageMessage')

  const body: Record<string, unknown> = {
    cardsV2: [
      {
        cardId: 'imageCard',
        card: {
          sections: [
            {
              widgets: [
                {
                  image: {
                    imageUrl,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  }

  await postMessage(accessToken, spaceName, body, threadName, options)
}
