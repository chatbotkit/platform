import type { User } from '@/prisma/types'

import fetch, { getFetchError } from '@/lib/fetch'
import { logEvent } from '@/lib/log'

export interface SlackChannelInfo {
  id: string
  name: string
  topic?: string
  purpose?: string
}

const cache = new Map<string, SlackChannelInfo>()

export async function getChannelInfo(
  channelId: string,
  options: {
    token: string

    user?: Pick<User, 'id' | 'email'>

    slackIntegrationId?: string
  }
): Promise<SlackChannelInfo | null> {
  if (!cache.has(channelId)) {
    const url = new URL(`https://slack.com/api/conversations.info`)

    url.searchParams.set('channel', channelId)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = await response.json()

    const { ok, channel } = data || {}

    if (!ok) {
      if (options.user && options.slackIntegrationId) {
        await logEvent({
          user: options.user,
          name: 'Get Slack Channel Info Error',
          description: `Failed to get Slack channel info for channel ID ${channelId}`,
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

    // @note handle case where data is malformed or missing channel data

    if (!data || !channel || channel.id == null || channel.name == null) {
      return null
    }

    cache.set(channelId, {
      id: channel.id,
      name: channel.name,
      topic: channel?.topic?.value,
      purpose: channel?.purpose?.value,
    })
  }

  return cache.get(channelId) || null
}

/**
 * Infers the channel type from a Slack channel ID based on its prefix.
 * @see https://api.slack.com/types/channel
 */
export function inferChannelType(
  channelId: string
): 'im' | 'channel' | 'group' {
  const prefix = channelId.charAt(0).toUpperCase()

  switch (prefix) {
    case '@': // @username reference - addresses a person, i.e. a direct message
    case 'D': // Direct message
    case 'W': // Workspace-level DM (enterprise)
      return 'im'

    case 'G': // Private channel or multi-party DM (group)
      return 'group'

    case '#': // #channel-name reference - a channel
    case 'C': // Public channel
    default:
      return 'channel'
  }
}

export interface ResolveChannelOptions {
  token: string
  user?: Pick<User, 'id' | 'email'>
  slackIntegrationId?: string
}

export interface ResolvedChannel {
  channelId: string
  channelType: 'im' | 'channel' | 'group'
}

/**
 * Resolves a channel identifier to a Slack channel ID and infers its type.
 *
 * Supports:
 * - Channel IDs (C..., D..., G...)
 * - User IDs (U...) - opens a DM and returns the resulting IM channel
 * - #channel-name
 * - @username (opens a DM)
 */
export async function resolveChannel(
  identifier: string,
  options: ResolveChannelOptions
): Promise<ResolvedChannel | null> {
  const trimmed = identifier.trim()

  // @note handle channel IDs directly (C..., D..., G..., W...)
  if (/^[CDGW][A-Z0-9]+$/i.test(trimmed)) {
    return {
      channelId: trimmed.toUpperCase(),
      channelType: inferChannelType(trimmed),
    }
  }

  // @note a bare user ID (U..., e.g. resolved from a directory lookup) is not a
  // channel. Open the DM so we return the D... IM channel and mark it 'im'. If
  // we left it as a raw U... id, the session would be keyed on that id while the
  // recipient's reply arrives on - and is looked up under - the D... IM channel,
  // so the two would never match and the bot would lose all context.
  if (/^U[A-Z0-9]+$/i.test(trimmed)) {
    const result = await openDmByUserId(trimmed.toUpperCase(), options)

    if (result) {
      return {
        channelId: result.channelId,
        channelType: 'im',
      }
    }

    return null
  }

  // @note handle #channel-name format

  if (trimmed.startsWith('#')) {
    const channelName = trimmed.slice(1)
    const channelId = await findChannelByName(channelName, options)

    if (channelId) {
      return {
        channelId,
        channelType: inferChannelType(channelId),
      }
    }

    return null
  }

  // @note handle @username format - open a DM with the user

  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1)
    const result = await openDmByUsername(username, options)

    if (result) {
      return {
        channelId: result.channelId,
        channelType: 'im',
      }
    }

    return null
  }

  // @note fallback - treat as channel ID

  return {
    channelId: trimmed,
    channelType: inferChannelType(trimmed),
  }
}

/**
 * Finds a channel by name using Slack API.
 *
 * @note uses cursor-based pagination to handle workspaces with >1000 channels
 */
async function findChannelByName(
  channelName: string,
  options: ResolveChannelOptions
): Promise<string | null> {
  let cursor: string | undefined

  do {
    const url = new URL('https://slack.com/api/conversations.list')

    url.searchParams.set('types', 'public_channel,private_channel')
    url.searchParams.set('limit', '1000')

    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = await response.json()

    if (!data.ok) {
      if (options.user && options.slackIntegrationId) {
        await logEvent({
          user: options.user,
          name: 'Find Slack Channel By Name Error',
          description: `Failed to find Slack channel by name: ${channelName}`,
          type: 'integration.slack.api.error',
          relations: {
            slackIntegrationId: options.slackIntegrationId,
          },
          meta: {
            error: data.error,
          },
        })
      }

      return null
    }

    const channel = data.channels?.find(
      (c: { name: string }) =>
        c.name.toLowerCase() === channelName.toLowerCase()
    )

    if (channel) {
      return channel.id
    }

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor)

  return null
}

/**
 * Opens a DM with a user by username.
 */
async function openDmByUsername(
  username: string,
  options: ResolveChannelOptions
): Promise<{ channelId: string } | null> {
  // @note first find the user ID by username
  const userId = await findUserByUsername(username, options)

  if (!userId) {
    return null
  }

  // @note then open a DM with that user
  return openDmByUserId(userId, options)
}

/**
 * Opens a DM with a user by their Slack user ID and returns the IM channel.
 */
async function openDmByUserId(
  userId: string,
  options: ResolveChannelOptions
): Promise<{ channelId: string } | null> {
  const url = new URL('https://slack.com/api/conversations.open')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: userId }),
  })

  if (!response.ok) {
    throw await getFetchError(response)
  }

  const data = await response.json()

  if (!data.ok) {
    if (options.user && options.slackIntegrationId) {
      await logEvent({
        user: options.user,
        name: 'Open Slack DM Error',
        description: `Failed to open DM with user: ${userId}`,
        type: 'integration.slack.api.error',
        relations: {
          slackIntegrationId: options.slackIntegrationId,
        },
        meta: {
          error: data.error,
        },
      })
    }

    return null
  }

  return { channelId: data.channel?.id }
}

/**
 * Finds a user by username using Slack API.
 *
 * @note uses cursor-based pagination to handle workspaces with >1000 members
 */
async function findUserByUsername(
  username: string,
  options: ResolveChannelOptions
): Promise<string | null> {
  let cursor: string | undefined

  do {
    const url = new URL('https://slack.com/api/users.list')

    url.searchParams.set('limit', '1000')

    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = await response.json()

    if (!data.ok) {
      if (options.user && options.slackIntegrationId) {
        await logEvent({
          user: options.user,
          name: 'Find Slack User By Username Error',
          description: `Failed to find Slack user by username: ${username}`,
          type: 'integration.slack.api.error',
          relations: {
            slackIntegrationId: options.slackIntegrationId,
          },
          meta: {
            error: data.error,
          },
        })
      }

      return null
    }

    // @note search by name, display_name, or real_name

    const user = data.members?.find(
      (u: {
        name: string
        profile?: { display_name?: string; real_name?: string }
      }) =>
        u.name.toLowerCase() === username.toLowerCase() ||
        u.profile?.display_name?.toLowerCase() === username.toLowerCase() ||
        u.profile?.real_name?.toLowerCase() === username.toLowerCase()
    )

    if (user) {
      return user.id
    }

    cursor = data.response_metadata?.next_cursor || undefined
  } while (cursor)

  return null
}
