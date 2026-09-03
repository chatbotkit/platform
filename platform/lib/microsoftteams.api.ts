import debug from '@/lib/debug'
import { SystemError } from '@/lib/error'
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'
import { CONFLICT_CODE } from '@/lib/response'

export interface MicrosoftteamsIntegration {
  botFrameworkAppId: string | null
  botFrameworkAppSecret: string | null
  tenantId?: string | null
}

interface ReplyOptions {
  conversationId: string
  activityId: string
  text: string
}

export const DEFAULT_TEAMS_SERVICE_URL =
  'https://smba.trafficmanager.net/teams/'

/**
 * Gets a Bot Framework access token for sending messages. Uses Redis to cache
 * the token so it survives across edge isolates.
 */
async function getAccessToken(
  integration: MicrosoftteamsIntegration
): Promise<string> {
  if (!integration.botFrameworkAppId || !integration.botFrameworkAppSecret) {
    throw new SystemError(
      'Teams integration is missing Bot Framework credentials',
      CONFLICT_CODE
    )
  }

  const cacheKey = `teams:token:${integration.botFrameworkAppId}`

  const cached = await memcache.get<string>(cacheKey)

  if (cached) {
    return cached
  }

  const tokenUrl = `https://login.microsoftonline.com/${integration.tenantId || 'botframework.com'}/oauth2/v2.0/token`

  const params = new URLSearchParams()

  params.set('grant_type', 'client_credentials')
  params.set('client_id', integration.botFrameworkAppId)
  params.set('client_secret', integration.botFrameworkAppSecret)
  params.set('scope', 'https://api.botframework.com/.default')

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()

    debug(`token error`, { text }).log('microsoftteams.api.getAccessToken')

    throw new SystemError(
      `Failed to get Bot Framework access token`,
      CONFLICT_CODE
    )
  }

  const data = await response.json()

  // @note expire 5 minutes before actual expiry for safety
  const ttl = Math.max(data.expires_in - 300, 60)

  await memcache.set(cacheKey, data.access_token, { ex: ttl })

  return data.access_token
}

/**
 * Sends a reply message to a Teams conversation using the Bot Framework
 * connector API.
 *
 * @param integration - The Teams integration with credentials
 * @param serviceUrl - The service URL from the incoming activity
 * @param options - The reply options (conversation, activity, text)
 */
export async function sendTeamsReply(
  integration: MicrosoftteamsIntegration,
  serviceUrl: string,
  options: ReplyOptions
): Promise<void> {
  const { conversationId, activityId, text } = options

  const accessToken = await getAccessToken(integration)

  // @note ensure service URL ends without trailing slash
  const baseUrl = serviceUrl.replace(/\/+$/, '')

  const url = `${baseUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities/${encodeURIComponent(activityId)}`

  debug(`sending reply`, { url, text: text.substring(0, 100) }).log(
    'microsoftteams.api.sendTeamsReply'
  )

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      text,
      replyToId: activityId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()

    debug(`reply error`, { status: response.status, error: errorText }).log(
      'microsoftteams.api.sendTeamsReply'
    )

    throw new SystemError(
      `Failed to send Teams reply: ${response.status}`,
      CONFLICT_CODE
    )
  }
}

/**
 * Sends a proactive message to a Teams conversation (not a reply to a
 * specific activity).
 *
 * @param integration - The Teams integration with credentials
 * @param serviceUrl - The service URL from a previous activity
 * @param conversationId - The conversation to send to
 * @param text - The message text
 */
export async function sendTeamsMessage(
  integration: MicrosoftteamsIntegration,
  serviceUrl: string,
  conversationId: string,
  text: string
): Promise<void> {
  const accessToken = await getAccessToken(integration)

  const baseUrl = serviceUrl.replace(/\/+$/, '')

  const url = `${baseUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()

    debug(`message error`, { status: response.status, error: errorText }).log(
      'microsoftteams.api.sendTeamsMessage'
    )

    throw new SystemError(
      `Failed to send Teams message: ${response.status}`,
      CONFLICT_CODE
    )
  }
}
