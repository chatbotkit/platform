import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'slack/webhook': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Trigger Slack Webhook',
    description: 'Trigger a Slack webhook with data',
    tags: ['slack', 'webhook'],
    instruction: {
      method: 'POST',
      url: field({
        name: 'url',
        description: 'slack.com webhook url',
        placeholder: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        text: field({
          name: 'message',
          description: 'Message content',
        }),
      },
    },
  }),

  'slack/message/send': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Send Slack Message',
    description: 'Send a message to a specific channel in Slack',
    tags: ['slack', 'communication'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel',
          description: 'the slack channel ID',
          placeholder: true,
        }),
        text: field({
          name: 'message',
          description: 'text message content',
        }),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
      },
    },
  }),

  'slack/search[all]': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Search Slack',
    description: `Perform search operation on behalf of the user.

Advanced search syntax:
  * "phrase" for exact matches
  * -word to exclude results
  * in:#channel to filter by location
  * from:@name to filter by sender
  * is:saved/has:pin for saved/pinned items
  * before:/after:/on:/during: for date filters, e.g. before:YYYY-MM-DD, after:YYYY-MM-DD, during:YYYY-MM, during:august
  * -in: or -from: to exclude locations/senders

NOTE: Multiple function calls may be required to perform a comprehensive search.`,
    tags: ['slack', 'search'],
    secret: '@slack[search]',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/search.all',
      headers: {
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          description: 'slack search query',
        }),
        count: field({
          name: 'count',
          type: 'number',
          default: 20,
          placeholder: true,
          optional: true,
          description: 'number of results to return',
        }),
        sort: field({
          name: 'sort',
          enum: ['timestamp', 'relevance'],
          default: 'timestamp',
          placeholder: true,
          optional: true,
          description: "sort order, e.g., 'timestamp', 'relevance'",
        }),
        sort_dir: field({
          name: 'sort_dir',
          enum: ['desc', 'asc'],
          default: 'desc',
          placeholder: true,
          optional: true,
          description: "sort direction, e.g., 'desc', 'asc'",
        }),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
        jmespath: `messages.matches[*].{
  type: type,
  channel: channel.name,
  username: username,
  ts: {
    "$epochToDateTime": ts
  },
  text: text,
  permalink: permalink,
  file: files[*].{
    permalink: permalink,
    mimetype: mimetype,
    preview: preview
  }
}`,
      },
    },
  }),

  'slack/search[messages]': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Search Slack Messages',
    description: `Perform message search operation on behalf of the user.

Advanced search syntax:
  * "phrase" for exact matches
  * -word to exclude results
  * in:#channel to filter by location
  * from:@name to filter by sender
  * is:saved/has:pin for saved/pinned items
  * before:/after:/on:/during: for date filters, e.g. before:YYYY-MM-DD, after:YYYY-MM-DD, during:YYYY-MM, during:august
  * -in: or -from: to exclude locations/senders

NOTE: Multiple function calls may be required to perform a comprehensive search.`,
    tags: ['slack', 'search'],
    secret: '@slack[search]',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/search.messages',
      headers: {
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          description: 'slack search query',
        }),
        count: field({
          name: 'count',
          type: 'number',
          default: 20,
          placeholder: true,
          optional: true,
          description: 'number of results to return',
        }),
        sort: field({
          name: 'sort',
          enum: ['timestamp', 'relevance'],
          default: 'timestamp',
          placeholder: true,
          optional: true,
          description: "sort order, e.g., 'timestamp', 'relevance'",
        }),
        sort_dir: field({
          name: 'sort_dir',
          enum: ['asc', 'desc'],
          default: 'asc',
          placeholder: true,
          optional: true,
          description: "sort direction, e.g., 'asc', 'desc'",
        }),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
        jmespath: `messages.matches[*].{
  type: type,
  channel: channel.name,
  username: username,
  ts: {
    "$epochToDateTime": ts
  },
  text: text,
  permalink: permalink
}`,
      },
    },
  }),

  'slack/search[files]': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Search Slack Files',
    description: `Perform file search on behalf of the user.

Advanced search syntax:
  * "phrase" for exact matches
  * -word to exclude results
  * in:#channel to filter by location
  * from:@name to filter by sender
  * is:saved/has:pin for saved/pinned items
  * before:/after:/on:/during: for date filters, e.g. before:YYYY-MM-DD, after:YYYY-MM-DD, during:YYYY-MM, during:august
  * -in: or -from: to exclude locations/senders

NOTE: Multiple function calls may be required to perform a comprehensive search.`,
    tags: ['slack', 'search'],
    secret: '@slack[search]',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/search.files',
      headers: {
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          description: 'slack search query',
        }),
        count: field({
          name: 'count',
          type: 'number',
          default: 20,
          placeholder: true,
          optional: true,
          description: 'number of results to return',
        }),
        sort: field({
          name: 'sort',
          enum: ['timestamp', 'relevance'],
          default: 'timestamp',
          placeholder: true,
          optional: true,
          description: "sort order, e.g., 'timestamp', 'relevance'",
        }),
        sort_dir: field({
          name: 'sort_dir',
          enum: ['asc', 'desc'],
          default: 'asc',
          placeholder: true,
          optional: true,
          description: "sort direction, e.g., 'asc', 'desc'",
        }),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
        jmespath: `files.matches[*].{
  username: username,
  timestamp: timestamp,
  mimetype: mimetype,
  permalink: permalink,
  preview: preview
}`,
      },
    },
  }),

  'slack/file/download': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Read a file from Slack',
    description: `Download the contents of a file URL on behalf of the authenticated user.
This method is required due to Slack's file URLs not being publicly accessible.`,
    tags: ['slack', 'file'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: field({
        name: 'url',
        description: 'the slack file URL',
      }),
      headers: {
        Authorization: secret(),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
      },
    },
  }),

  // ---
  // New TypeScript abilities
  // ---

  'slack/channel/list': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'List Slack Channels',
    description:
      'List all channels in a Slack workspace with pagination support',
    tags: ['slack', 'channels', 'list'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/conversations.list',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of channels to return (max 1000)',
        }),
        types: field({
          name: 'types',
          optional: true,
          default: 'public_channel,private_channel',
          description:
            'channel types to include (public_channel, private_channel, mpim, im)',
        }),
        exclude_archived: field({
          name: 'exclude_archived',
          type: 'boolean',
          optional: true,
          default: true,
          description: 'exclude archived channels',
        }),
      },
    },
  }),

  'slack/user/list': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'List Slack Users',
    description: 'List all users in a Slack workspace with pagination support',
    tags: ['slack', 'users', 'list'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/users.list',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of users to return (max 1000)',
        }),
        include_locale: field({
          name: 'include_locale',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'include user locale information',
        }),
      },
    },
  }),

  'slack/message/update': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Update Slack Message',
    description:
      'Update an existing message in a Slack channel or conversation',
    tags: ['slack', 'message', 'update'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/chat.update',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel',
          description: 'channel ID where the message is located',
          placeholder: true,
        }),
        ts: field({
          name: 'timestamp',
          description:
            'timestamp of the message to update, e.g. 1403051575.000407',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description: 'new text content for the message',
        }),
        as_user: field({
          name: 'as_user',
          type: 'boolean',
          optional: true,
          default: true,
          description: 'update as the authenticated user',
        }),
      },
    },
  }),

  'slack/message/delete': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Delete Slack Message',
    description: 'Delete a message from a Slack channel or conversation',
    tags: ['slack', 'message', 'delete'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/chat.delete',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel',
          description: 'channel ID where the message is located',
          placeholder: true,
        }),
        ts: field({
          name: 'timestamp',
          description:
            'timestamp of the message to delete, e.g. 1403051575.000407',
          placeholder: true,
        }),
        as_user: field({
          name: 'as_user',
          type: 'boolean',
          optional: true,
          default: true,
          description: 'delete as the authenticated user',
        }),
      },
    },
  }),

  'slack/reaction/add': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Add Slack Reaction',
    description: 'Add an emoji reaction to a message in Slack',
    tags: ['slack', 'reaction', 'emoji'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/reactions.add',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel',
          description: 'channel ID where the message is located',
          placeholder: true,
        }),
        timestamp: field({
          name: 'timestamp',
          description:
            'timestamp of the message to react to, e.g. 1403051575.000407',
          placeholder: true,
        }),
        name: field({
          name: 'emoji',
          description: 'emoji name without colons, e.g. thumbsup, fire, heart',
        }),
      },
    },
  }),

  'slack/message/reply': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Reply to Slack Message',
    description:
      'Reply to a message in a thread within a Slack channel or conversation',
    tags: ['slack', 'message', 'reply', 'thread'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel',
          description: 'channel ID where the parent message is located',
          placeholder: true,
        }),
        thread_ts: field({
          name: 'thread_timestamp',
          description:
            'timestamp of the parent message to reply to, e.g. 1403051575.000407',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description: 'reply message content',
        }),
        reply_broadcast: field({
          name: 'reply_broadcast',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'also send the reply to the channel',
        }),
      },
    },
  }),

  'slack/user/info': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Get Slack User Info',
    description: 'Get information about a specific Slack user by their user ID',
    tags: ['slack', 'user', 'info'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/users.info',
      headers: {
        Authorization: secret(),
      },
      query: {
        user: field({
          name: 'user_id',
          description: 'user ID to get information about',
          placeholder: true,
        }),
        include_locale: field({
          name: 'include_locale',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'include user locale information',
        }),
      },
    },
  }),

  'slack/channel/info': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Get Slack Channel Info',
    description:
      'Get information about a specific Slack channel by its channel ID',
    tags: ['slack', 'channel', 'info'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/conversations.info',
      headers: {
        Authorization: secret(),
      },
      query: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to get information about',
          placeholder: true,
        }),
        include_locale: field({
          name: 'include_locale',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'include channel locale information',
        }),
        include_num_members: field({
          name: 'include_num_members',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'include member count',
        }),
      },
    },
  }),

  'slack/channel/create': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Create Slack Channel',
    description: 'Create a new public or private channel in Slack',
    tags: ['slack', 'channel', 'create'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.create',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'channel_name',
          description: 'name of the channel to create (lowercase, no spaces)',
        }),
        is_private: field({
          name: 'is_private',
          type: 'boolean',
          optional: true,
          default: false,
          description: 'create as a private channel',
        }),
      },
    },
  }),

  'slack/channel/invite': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Invite User to Slack Channel',
    description: 'Invite a user to a Slack channel',
    tags: ['slack', 'channel', 'invite', 'user'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.invite',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to invite the user to',
          placeholder: true,
        }),
        users: field({
          name: 'user_ids',
          description:
            'comma-separated list of user IDs to invite, e.g. U1234567890,U0987654321',
        }),
      },
    },
  }),

  'slack/channel/kick': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Remove User from Slack Channel',
    description:
      'Remove a user from a public channel, private channel, or group',
    tags: ['slack', 'channel', 'kick', 'user'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.kick',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to remove the user from',
          placeholder: true,
        }),
        user: field({
          name: 'user_id',
          description: 'user ID to remove from the channel',
          placeholder: true,
        }),
      },
    },
  }),

  'slack/channel/archive': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Archive Slack Channel',
    description: 'Archive a public or private channel',
    tags: ['slack', 'channel', 'archive'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.archive',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to archive',
          placeholder: true,
        }),
      },
    },
  }),

  'slack/channel/unarchive': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Unarchive Slack Channel',
    description: 'Unarchive an archived channel',
    tags: ['slack', 'channel', 'unarchive'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.unarchive',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to unarchive',
          placeholder: true,
        }),
      },
    },
  }),

  'slack/channel/topic/set': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Set Slack Channel Topic',
    description: 'Set the topic for a channel',
    tags: ['slack', 'channel', 'topic'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.setTopic',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to set the topic for',
          placeholder: true,
        }),
        topic: field({
          name: 'topic',
          description: 'new topic text',
        }),
      },
    },
  }),

  'slack/channel/purpose/set': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Set Slack Channel Purpose',
    description: 'Set the purpose for a channel',
    tags: ['slack', 'channel', 'purpose'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/conversations.setPurpose',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to set the purpose for',
          placeholder: true,
        }),
        purpose: field({
          name: 'purpose',
          description: 'new purpose text',
        }),
      },
    },
  }),

  'slack/channel/members/list': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'List Slack Channel Members',
    description: 'Retrieve members of a channel with pagination support',
    tags: ['slack', 'channel', 'members', 'list'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/conversations.members',
      headers: {
        Authorization: secret(),
      },
      query: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to retrieve members from',
          placeholder: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of members to return (max 1000)',
        }),
      },
    },
  }),

  'slack/file/list': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'List Slack Files',
    description: 'List files within a team with optional filtering by channel',
    tags: ['slack', 'file', 'list'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/files.list',
      headers: {
        Authorization: secret(),
      },
      query: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to filter files by',
          placeholder: true,
          optional: true,
        }),
        user: field({
          name: 'user_id',
          description: 'user ID to filter files by',
          placeholder: true,
          optional: true,
        }),
        count: field({
          name: 'count',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of files to return (max 1000)',
        }),
      },
    },
  }),

  'slack/file/delete': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Delete Slack File',
    description: 'Delete a file from Slack',
    tags: ['slack', 'file', 'delete'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/files.delete',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        file: field({
          name: 'file_id',
          description: 'file ID to delete',
          placeholder: true,
        }),
      },
    },
  }),

  'slack/message/history': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Get Slack Message History',
    description: 'Fetch message history from a channel with pagination support',
    tags: ['slack', 'message', 'history', 'conversation'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/conversations.history',
      headers: {
        Authorization: secret(),
      },
      query: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID to retrieve message history from',
          placeholder: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of messages to return (max 1000)',
        }),
        oldest: field({
          name: 'oldest',
          optional: true,
          description:
            'timestamp to start retrieving messages from (inclusive)',
        }),
        latest: field({
          name: 'latest',
          optional: true,
          description: 'timestamp to retrieve messages up to (exclusive)',
        }),
      },
    },
  }),

  'slack/message/replies': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Get Slack Thread Replies',
    description: 'Retrieve replies to a specific message thread',
    tags: ['slack', 'message', 'replies', 'thread'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/conversations.replies',
      headers: {
        Authorization: secret(),
      },
      query: {
        channel: field({
          name: 'channel_id',
          description: 'channel ID where the thread is located',
          placeholder: true,
        }),
        ts: field({
          name: 'thread_timestamp',
          description:
            'timestamp of the parent message, e.g. 1403051575.000407',
          placeholder: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          optional: true,
          default: 100,
          description: 'number of replies to return (max 1000)',
        }),
      },
    },
  }),

  'slack/user/lookup[by-email]': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Find Slack User by Email',
    description: 'Find a user by matching against their email address',
    tags: ['slack', 'user', 'search'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/users.lookupByEmail',
      headers: {
        Authorization: secret(),
      },
      query: {
        email: field({
          name: 'email',
          description: 'the email address to search for',
          placeholder: true,
        }),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
      },
    },
  }),

  'slack/user/status/set': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Set Slack User Status',
    description:
      'Set custom status text, emoji, and expiration for the authenticated user',
    tags: ['slack', 'user', 'status'],
    secret: '@slack',
    instruction: {
      method: 'POST',
      url: 'https://slack.com/api/users.profile.set',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        profile: {
          status_text: field({
            name: 'status_text',
            description: 'the status text to display (max 100 characters)',
          }),
          status_emoji: field({
            name: 'status_emoji',
            description:
              'the emoji to display with colon notation (e.g. :rocket:)',
            optional: true,
          }),
          status_expiration: field({
            name: 'status_expiration',
            type: 'number',
            description:
              'unix timestamp when status expires (0 or omit for no expiration)',
            optional: true,
          }),
        },
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
      },
    },
  }),

  'slack/user/fetch[current]': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Get Current User Info',
    description:
      'Get basic authentication info for the current user (user ID, team ID, and workspace URL)',
    tags: ['slack', 'user', 'auth'],
    secret: '@slack',
    instruction: {
      method: 'GET',
      url: 'https://slack.com/api/auth.test',
      headers: {
        Authorization: secret(),
      },
      options: {
        error: {
          jsonpath: '$.ok',
        },
      },
    },
  }),

  // @note https://slack.com/api/reminders.add is deprecated so no need to add it

  'slack/api/call': createFetchTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Call Slack API',
    description:
      'Make a generic API call to Slack. This is a flexible template that can be used to call any Slack API endpoint by specifying the method, URL, and request body.',
    tags: ['slack', 'api', 'call', 'generic'],
    secret: '@slack',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Slack API endpoint to call',
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

  'pack/slack': createPackTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Install Slack Tools',
    description:
      'Installs Slack tools into the conversation. You can send messages, manage channels, search content, and perform comprehensive workspace operations.',
    tags: ['slack', 'pack', 'beta'],
    secret: '@slack',
    instruction: {
      abilities: [
        'slack/message/send',
        'slack/message/update',
        'slack/message/delete',
        'slack/message/reply',
        'slack/message/history',
        'slack/message/replies',
        'slack/channel/list',
        'slack/channel/info',
        'slack/channel/create',
        'slack/channel/invite',
        'slack/channel/kick',
        'slack/channel/archive',
        'slack/channel/unarchive',
        'slack/channel/topic/set',
        'slack/channel/purpose/set',
        'slack/channel/members/list',
        'slack/user/list',
        'slack/user/info',
        'slack/user/lookup[by-email]',
        'slack/user/status/set',
        'slack/user/fetch[current]',
        'slack/reaction/add',
        'slack/file/list',
        'slack/file/delete',
        'slack/file/download',
        'slack/search[all]',
        'slack/search[messages]',
        'slack/search[files]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/slack[read-only]': createPackTemplate({
    provider: 'slack',
    icon: '@logo/slack.com',
    name: 'Install Slack Search Tools',
    description:
      'Installs read-only Slack tools into the conversation. You can list channels, users, search messages, and retrieve information without modification.',
    tags: ['slack', 'pack', 'beta'],
    secret: '@slack',
    instruction: {
      abilities: [
        'slack/channel/list',
        'slack/channel/info',
        'slack/channel/members/list',
        'slack/user/list',
        'slack/user/info',
        'slack/user/lookup[by-email]',
        'slack/user/fetch[current]',
        'slack/message/history',
        'slack/message/replies',
        'slack/file/list',
        'slack/file/download',
        'slack/search[all]',
        'slack/search[messages]',
        'slack/search[files]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
