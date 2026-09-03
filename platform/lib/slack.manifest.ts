import { toSlug } from '@/lib/string'

interface SlackIntegration {
  id: string
  name?: string
  description?: string
}

interface SlackManifest {
  display_information: {
    name: string
    description?: string
    long_description?: string
  }
  settings: {
    event_subscriptions: {
      request_url: string
      bot_events: string[]
    }
    interactivity: {
      is_enabled: boolean
      request_url: string
    }
  }
  features: {
    app_home: {
      home_tab_enabled: boolean
      messages_tab_enabled: boolean
      messages_tab_read_only_enabled: boolean
    }
    slash_commands: Array<{
      command: string
      url: string
      description: string
      usage_hint: string
    }>
    bot_user: {
      display_name: string
      always_online: boolean
    }
  }
  oauth_config: {
    scopes: {
      bot: string[]
      user: string[]
    }
  }
}

/**
 * Builds a Slack app manifest configuration object for the ChatBotKit platform integration.
 * This manifest can be used with Slack's App Builder or imported directly into a Slack app.
 *
 * The manifest includes:
 * - Display information (name, description)
 * - Event subscriptions for bot interactions
 * - Interactivity configuration for user interactions
 * - App home and bot user settings
 * - Slash command configuration
 * - OAuth scopes for proper bot permissions
 */
export function buildSlackManifest(
  integration: SlackIntegration,
  baseUrl: string
): SlackManifest {
  // @note Slack's app manifest import fails when the name contains slashes
  // (`/` or `\`) or square brackets, so strip them here. Replacing with a space
  // keeps words separated; the collapse + trim tidy up, and we fall back to the
  // default if nothing usable remains. Documented hard limits are 35 chars for
  // the app name and 80 for the bot display name, whose only allowed characters
  // are `a-z 0-9 - _ .`.
  // @see https://docs.slack.dev/reference/app-manifest
  const name =
    (integration.name || 'ChatBotKit')
      .replace(/[\\/[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'ChatBotKit'

  const slug = toSlug(name).toLowerCase()

  return {
    display_information: {
      name: name,

      ...(integration.description?.length
        ? {
            ...(integration.description.length <= 174
              ? {
                  description: integration.description,
                }
              : {
                  long_description: integration.description,
                }),
          }
        : {}),
    },

    settings: {
      event_subscriptions: {
        request_url: new URL(
          `/api/v1/integration/slack/${integration.id}/event`,
          baseUrl
        ).href,
        bot_events: [
          'app_mention',
          'message.channels',
          'message.groups',
          'message.im',
          'message.mpim',
        ],
      },
      interactivity: {
        is_enabled: true,
        request_url: new URL(
          `/api/v1/integration/slack/${integration.id}/interaction`,
          baseUrl
        ).href,
      },
    },

    features: {
      app_home: {
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },

      slash_commands: [
        {
          command: `/${slug}`,
          url: new URL(
            `/api/v1/integration/slack/${integration.id}/command`,
            baseUrl
          ).href,
          description: `Interact with ${name} in any channel or direct message.`,
          usage_hint: `ask a question or give a command`,
        },
      ],

      // @todo enable when the Slack assistant flow supports this manifest feature
      // assistant_view: {
      //   assistant_description: integration.description || '',
      //   suggested_prompts: [],
      // },

      bot_user: {
        display_name: name,
        always_online: true,
      },
    },

    oauth_config: {
      scopes: {
        bot: [
          'app_mentions:read',
          'groups:history',
          'chat:write',
          'channels:history',
          'im:history',
          'im:read',
          'mpim:history',
          'users:read',
          'channels:read',
          'groups:read',
          'commands',
          'files:read',

          // @todo enable when public-channel search is supported end to end
          // "search:read.public",
        ],

        user: ['search:read'],
      },
    },
  }
}

/**
 * Builds a Slack app installation URL with embedded manifest configuration.
 * This URL can be used to directly install the ChatBotKit Slack app with the
 * specified configuration into a Slack workspace.
 */
export function buildSlackManifestInstallUrl(
  integration: SlackIntegration,
  baseUrl: string
): string {
  const manifest = buildSlackManifest(integration, baseUrl)

  const url = new URL('https://api.slack.com/apps')

  url.searchParams.set('new_app', '1')
  url.searchParams.set('manifest_json', JSON.stringify(manifest))

  return url.href
}
