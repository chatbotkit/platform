import type { User } from '@/prisma/types'

import { getChannelInfo } from '@/lib/slack.channel'
import { getUserInfo } from '@/lib/slack.user'

export interface SlackReferenceOptions {
  token: string

  user?: Pick<User, 'id' | 'email'>

  slackIntegrationId?: string

  /**
   * Whether to translate references that already contain names.
   * When true (default), references like <#C123|general> are translated to #general.
   * When false, only references without names like <#C123|> are translated.
   */
  translateNamedReferences?: boolean
}

/**
 * Translates Slack channel and user references in text to human-readable names.
 *
 * This function processes text containing Slack references:
 * - Channel references: `<#CHANNEL_ID|>` or `<#CHANNEL_ID|channel-name>` -> `#channel-name`
 * - User references: `<@USER_ID>` or `<@USER_ID|username>` -> `@username`
 *
 * For references that already contain names (e.g., `<#C123|general>`), the behavior
 * depends on the `translateNamedReferences` option:
 * - When true (default): translates to `#general`
 * - When false: leaves the reference unchanged as `<#C123|general>`
 *
 * If the channel or user name cannot be retrieved, falls back to the original reference
 * or shows "Unknown channel/user".
 *
 * @param text - Text containing Slack references to translate
 * @param options - Slack API options including token and user context
 * @returns Promise<string> - Text with references translated to names
 */
export async function translateSlackReferences(
  text: string,
  options: SlackReferenceOptions
): Promise<string> {
  if (!text) {
    return text
  }

  const { translateNamedReferences = true } = options

  // Channel reference patterns: <#CHANNEL_ID|> or <#CHANNEL_ID|channel-name>
  // Channel IDs typically start with 'C' and contain alphanumeric characters and some special chars

  const channelPattern = /<#([A-Za-z0-9][A-Za-z0-9#$%&*+\-_.]+)(\|[^>]*)?>/g

  // User reference patterns: <@USER_ID> or <@USER_ID|username>
  // User IDs typically start with 'U' and contain alphanumeric characters and some special chars

  const userPattern = /<@([A-Za-z0-9][A-Za-z0-9#$%&*+\-_.]+)(\|[^>]*)?>/g

  let translatedText = text

  // translate channel references

  const channelMatches = [...text.matchAll(channelPattern)]

  for (const match of channelMatches) {
    const [fullMatch, channelId, existingName] = match

    // if there's already a name in the reference (e.g., <#C123|general>)

    if (existingName && existingName.length > 1) {
      if (translateNamedReferences) {
        // translate to human-readable format

        const channelName = existingName.substring(1) // Remove the | prefix

        translatedText = translatedText.replace(fullMatch, `#${channelName}`)
      }

      // if translateNamedReferences is false, leave the reference as-is

      continue
    }

    // otherwise, fetch the channel name from Slack API

    try {
      const channelInfo = await getChannelInfo(channelId, options)

      if (channelInfo?.name) {
        translatedText = translatedText.replace(
          fullMatch,
          `#${channelInfo.name}`
        )
      } else {
        // fallback to unknown channel

        translatedText = translatedText.replace(fullMatch, '#unknown-channel')
      }
    } catch {
      // @note if API call fails, fallback to original reference or unknown

      translatedText = translatedText.replace(fullMatch, '#unknown-channel')
    }
  }

  // translate user references

  const userMatches = [...text.matchAll(userPattern)]

  for (const match of userMatches) {
    const [fullMatch, userId, existingName] = match

    // if there's already a name in the reference (e.g., <@U123|john>)

    if (existingName && existingName.length > 1) {
      if (translateNamedReferences) {
        // translate to human-readable format

        const userName = existingName.substring(1) // Remove the | prefix

        translatedText = translatedText.replace(fullMatch, `@${userName}`)
      }

      // if translateNamedReferences is false, leave the reference as-is

      continue
    }

    // otherwise, fetch the user name from Slack API

    try {
      const userInfo = await getUserInfo(userId, options)

      if (userInfo?.name) {
        translatedText = translatedText.replace(fullMatch, `@${userInfo.name}`)
      } else {
        // fallback to unknown user

        translatedText = translatedText.replace(fullMatch, '@unknown-user')
      }
    } catch {
      // @note if API call fails, fallback to original reference or unknown

      translatedText = translatedText.replace(fullMatch, '@unknown-user')
    }
  }

  return translatedText
}
