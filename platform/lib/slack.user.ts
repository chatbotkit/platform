import type { User } from '@/prisma/types'

import fetch, { getFetchError } from '@/lib/fetch'
import { logEvent } from '@/lib/log'

export interface SlackUserInfo {
  id: string
  name: string
  email?: string
  realName?: string
}

const userInfoCache = new Map<string, SlackUserInfo>()

const botUserIdCache = new Map<string, string | null>()

export async function getBotUserId(
  token: string | null | undefined
): Promise<string | null> {
  if (!token) {
    return null
  }

  if (!botUserIdCache.has(token)) {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!response.ok) {
      botUserIdCache.set(token, null)
    } else {
      const data = await response.json()

      botUserIdCache.set(token, data?.ok ? data.user_id || null : null)
    }
  }

  return botUserIdCache.get(token) || null
}

export async function getUserInfo(
  userId: string,
  options: {
    token: string

    user?: Pick<User, 'id' | 'email'>

    slackIntegrationId?: string
  }
): Promise<SlackUserInfo | null> {
  if (!userInfoCache.has(userId)) {
    const url = new URL(`https://slack.com/api/users.info`)

    url.searchParams.set('user', userId)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = await response.json()

    const { ok, user } = data || {}

    if (!ok) {
      if (options.user && options.slackIntegrationId) {
        await logEvent({
          user: options.user,
          name: 'Get Slack User Info Error',
          description: `Failed to get Slack user info for user ID ${userId}`,
          type: 'integration.slack.api.error',
          relations: {
            slackIntegrationId: options.slackIntegrationId,
          },
          meta: {
            error: data.error,
            needed: data.needed,
            provided: data.provided,
          },
        })
      }

      return null
    }

    const { profile } = user || {}

    // @note handle case where required fields are missing

    if (!user || user.id == null || user.name == null) {
      return null
    }

    userInfoCache.set(userId, {
      id: user.id,
      name: user.name,
      email: profile?.email,
      realName: profile?.real_name,
    })
  }

  return userInfoCache.get(userId) || null
}
