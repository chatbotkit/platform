import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'discord/message/send': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Send Discord Message',
    description: 'Send a message to a specific channel in Discord',
    tags: ['discord', 'message', 'send'],
    instruction: {
      method: 'POST',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'message',
          description: 'the message content',
        }),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/message/fetch': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Get Discord Message',
    description: 'Fetch a specific message from a Discord channel',
    tags: ['discord', 'message', 'fetch'],
    instruction: {
      method: 'GET',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
        '/messages/',
        field({
          name: 'messageId',
          description: 'the message id to fetch',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/message/delete': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Delete Discord Message',
    description: 'Delete a message from a Discord channel',
    tags: ['discord', 'message', 'delete'],
    instruction: {
      method: 'DELETE',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
        '/messages/',
        field({
          name: 'messageId',
          description: 'the message id to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/message/react': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'React to Discord Message',
    description: 'Add a reaction emoji to a Discord message',
    tags: ['discord', 'message', 'react'],
    instruction: {
      method: 'PUT',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
        '/messages/',
        field({
          name: 'messageId',
          description: 'the message id to react to',
          placeholder: true,
        }),
        '/reactions/',
        field({
          name: 'emoji',
          description: 'the emoji to react with (e.g., 👍 or custom_emoji:id)',
          placeholder: true,
        }),
        '/@me',
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/channel/fetch': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Get Discord Channel',
    description: 'Fetch information about a Discord channel',
    tags: ['discord', 'channel', 'fetch'],
    instruction: {
      method: 'GET',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/webhook/trigger': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Trigger Discord Webhook',
    description: 'Trigger a Discord webhook with data',
    tags: ['discord', 'webhook', 'trigger'],
    instruction: {
      method: 'POST',
      url: field({
        name: 'url',
        description: 'discord.com webhook url',
        placeholder: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'message',
          description: 'message content',
        }),
        username: field({
          name: 'username',
          description: 'webhook username',
        }),
        avatar_url: field({
          name: 'avatar_url',
          description: 'webhook avatar url',
        }),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/message/list': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'List Channel Messages',
    description: 'List messages from a Discord channel with pagination support',
    tags: ['discord', 'message', 'list'],
    instruction: {
      method: 'GET',
      url: 'https://discord.com/api/v10/channels',
      path: [
        '/',
        field({
          name: 'channelId',
          description: 'the discord channel id',
          placeholder: true,
        }),
        '/messages',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'max number of messages to return (1-100)',
          optional: true,
          default: 50,
        }),
        before: field({
          name: 'before',
          description: 'get messages before this message id',
          optional: true,
        }),
        after: field({
          name: 'after',
          description: 'get messages after this message id',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/guild/member/list': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'List Guild Members',
    description: 'List members of a Discord guild/server',
    tags: ['discord', 'guild', 'member', 'list'],
    instruction: {
      method: 'GET',
      url: 'https://discord.com/api/v10/guilds',
      path: [
        '/',
        field({
          name: 'guildId',
          description: 'the discord guild/server id',
          placeholder: true,
        }),
        '/members',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'max number of members to return (1-1000)',
          optional: true,
          default: 100,
        }),
        after: field({
          name: 'after',
          description: 'get members after this user id',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/guild/member/role/add': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Add Role to Member',
    description:
      'Assign a role to a guild member (requires MANAGE_ROLES permission)',
    tags: ['discord', 'guild', 'member', 'role', 'add'],
    instruction: {
      method: 'PUT',
      url: 'https://discord.com/api/v10/guilds',
      path: [
        '/',
        field({
          name: 'guildId',
          description: 'the discord guild/server id',
          placeholder: true,
        }),
        '/members/',
        field({
          name: 'userId',
          description: 'the user id to add role to',
          placeholder: true,
        }),
        '/roles/',
        field({
          name: 'roleId',
          description: 'the role id to assign',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/guild/member/role/remove': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Remove Role from Member',
    description:
      'Remove a role from a guild member (requires MANAGE_ROLES permission)',
    tags: ['discord', 'guild', 'member', 'role', 'remove'],
    instruction: {
      method: 'DELETE',
      url: 'https://discord.com/api/v10/guilds',
      path: [
        '/',
        field({
          name: 'guildId',
          description: 'the discord guild/server id',
          placeholder: true,
        }),
        '/members/',
        field({
          name: 'userId',
          description: 'the user id to remove role from',
          placeholder: true,
        }),
        '/roles/',
        field({
          name: 'roleId',
          description: 'the role id to remove',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/channel/list': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'List Guild Channels',
    description: 'List all channels in a Discord guild/server',
    tags: ['discord', 'channel', 'list'],
    instruction: {
      method: 'GET',
      url: 'https://discord.com/api/v10/guilds',
      path: [
        '/',
        field({
          name: 'guildId',
          description: 'the discord guild/server id',
          placeholder: true,
        }),
        '/channels',
      ],
      headers: {
        Authorization: secret(),
      },
    },
    secret: '@discord[bot]',
  }),

  'discord/api/call': createFetchTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Call Discord API',
    description:
      'Make a generic API call to Discord. This is a flexible template that can be used to call any Discord API endpoint by specifying the method, URL, and request body.',
    tags: ['discord', 'api', 'call', 'generic'],
    secret: '@discord[bot]',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Discord API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),

  'pack/discord': createPackTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Install Discord Tools',
    description:
      'Installs Discord tools into the conversation. You can send messages, manage channels, guild members, and perform comprehensive server operations.',
    tags: ['discord', 'pack', 'beta'],
    secret: '@discord[bot]',
    instruction: {
      abilities: [
        'discord/message/send',
        'discord/message/fetch',
        'discord/message/delete',
        'discord/message/react',
        'discord/message/list',
        'discord/channel/fetch',
        'discord/channel/list',
        'discord/guild/member/list',
        'discord/guild/member/role/add',
        'discord/guild/member/role/remove',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/discord[read-only]': createPackTemplate({
    provider: 'discord',
    icon: '@logo/discord.com',
    name: 'Install Discord Search Tools',
    description:
      'Installs read-only Discord tools into the conversation. You can list channels, messages, and guild members without modification.',
    tags: ['discord', 'pack', 'beta'],
    secret: '@discord[bot]',
    instruction: {
      abilities: [
        'discord/message/fetch',
        'discord/message/list',
        'discord/channel/fetch',
        'discord/channel/list',
        'discord/guild/member/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
