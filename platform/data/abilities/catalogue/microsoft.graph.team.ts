import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph Teams abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
 */
const abilities = {
  'microsoft/graph/team/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Teams',
    description: 'List all teams the user is a member of',
    tags: ['microsoft', 'teams', 'collaboration'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/joinedTeams',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, description',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of teams to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  description: description,
  webUrl: webUrl
}`,
      },
    },
  }),

  'microsoft/graph/team/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch Team',
    description: 'Get details of a specific team by its ID',
    tags: ['microsoft', 'teams', 'collaboration'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  description: description,
  webUrl: webUrl,
  isArchived: isArchived
}`,
      },
    },
  }),

  'microsoft/graph/channel/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Channels',
    description: 'List all channels in a specific team',
    tags: ['microsoft', 'teams', 'channels'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
        '/channels',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, description',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  description: description,
  webUrl: webUrl,
  membershipType: membershipType
}`,
      },
    },
  }),

  'microsoft/graph/channel/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch Channel',
    description: 'Get details of a specific channel',
    tags: ['microsoft', 'teams', 'channels'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
        '/channels/',
        field({
          name: 'channelId',
          description: 'the channel ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  description: description,
  webUrl: webUrl,
  membershipType: membershipType,
  email: email
}`,
      },
    },
  }),

  'microsoft/graph/channel/create': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Create Channel',
    description: 'Create a new channel in a team',
    tags: ['microsoft', 'teams', 'channels'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
        '/channels',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        displayName: field({
          name: 'displayName',
          description: 'name of the channel',
        }),
        description: field({
          name: 'description',
          description: 'description of the channel',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  description: description,
  webUrl: webUrl
}`,
      },
    },
  }),

  'microsoft/graph/channel/message/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Channel Messages',
    description: 'List messages in a channel',
    tags: ['microsoft', 'teams', 'channels', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
        '/channels/',
        field({
          name: 'channelId',
          description: 'the channel ID',
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of messages to return',
          placeholder: true,
          default: 20,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  subject: subject,
  body: body.content,
  from: from.user.displayName,
  createdDateTime: createdDateTime
}`,
      },
    },
  }),

  'microsoft/graph/channel/message/send': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Send Channel Message',
    description: 'Send a message to a channel',
    tags: ['microsoft', 'teams', 'channels', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/teams',
      path: [
        '/',
        field({
          name: 'teamId',
          description: 'the team ID',
        }),
        '/channels/',
        field({
          name: 'channelId',
          description: 'the channel ID',
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        body: {
          content: field({
            name: 'content',
            description: 'message content',
          }),
        },
      },
      options: {
        jmespath: `{
  id: id,
  body: body.content,
  from: from.user.displayName,
  createdDateTime: createdDateTime
}`,
      },
    },
  }),

  'microsoft/graph/chat/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Chats',
    description: "List the user's chats (1:1 and group chats)",
    tags: ['microsoft', 'teams', 'chat'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/chats',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of chats to return',
          placeholder: true,
          default: 20,
          optional: true,
        }),
        $expand: field({
          name: 'expand',
          description: 'expand related entities, e.g., members',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  topic: topic,
  chatType: chatType,
  createdDateTime: createdDateTime,
  lastUpdatedDateTime: lastUpdatedDateTime
}`,
      },
    },
  }),

  'microsoft/graph/chat/message/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Chat Messages',
    description: 'List messages in a specific chat',
    tags: ['microsoft', 'teams', 'chat', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/chats',
      path: [
        '/',
        field({
          name: 'chatId',
          description: 'the chat ID',
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of messages to return',
          placeholder: true,
          default: 20,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  body: body.content,
  from: from.user.displayName,
  createdDateTime: createdDateTime
}`,
      },
    },
  }),

  'microsoft/graph/chat/message/send': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Send Chat Message',
    description: 'Send a message in a chat',
    tags: ['microsoft', 'teams', 'chat', 'messages'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/me/chats',
      path: [
        '/',
        field({
          name: 'chatId',
          description: 'the chat ID',
        }),
        '/messages',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        body: {
          content: field({
            name: 'content',
            description: 'message content',
          }),
        },
      },
      options: {
        jmespath: `{
  id: id,
  body: body.content,
  from: from.user.displayName,
  createdDateTime: createdDateTime
}`,
      },
    },
  }),
}

export default abilities
