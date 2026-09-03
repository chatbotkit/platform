import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'ably/message/publish': createFetchTemplate({
    provider: 'ably',
    icon: '@logo/ably.com',
    name: 'Publish Message to Ably Channel',
    description:
      'Publish a real-time message to an Ably channel for instant delivery to connected clients',
    tags: ['ably', 'messaging', 'realtime', 'publish'],
    secret: '@ably',
    instruction: {
      method: 'POST',
      url: 'https://rest.ably.io',
      path: [
        '/channels/',
        field({
          name: 'channelName',
          description: 'the name of the channel to publish to',
        }),
        '/messages',
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        name: field({
          name: 'eventName',
          description: 'the event name for the message',
          optional: true,
        }),
        data: field({
          name: 'messageData',
          description: 'the message data to publish',
        }),
      },
    },
  }),

  'ably/message/history': createFetchTemplate({
    provider: 'ably',
    icon: '@logo/ably.com',
    name: 'Get Ably Channel Message History',
    description:
      'Retrieve message history from an Ably channel to view past messages',
    tags: ['ably', 'messaging', 'history', 'retrieve'],
    secret: '@ably',
    instruction: {
      method: 'GET',
      url: 'https://rest.ably.io',
      path: [
        '/channels/',
        field({
          name: 'channelName',
          description: 'the name of the channel to retrieve history from',
        }),
        '/messages',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of messages to retrieve',
          optional: true,
          default: 100,
        }),
        direction: field({
          name: 'direction',
          description: 'direction to retrieve messages',
          optional: true,
          enum: ['backwards', 'forwards'],
          default: 'backwards',
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'ably/channel/status': createFetchTemplate({
    provider: 'ably',
    icon: '@logo/ably.com',
    name: 'Get Ably Channel Status',
    description:
      'Retrieve status information about an Ably channel including occupancy and presence data',
    tags: ['ably', 'channel', 'status', 'monitoring'],
    secret: '@ably',
    instruction: {
      method: 'GET',
      url: 'https://rest.ably.io',
      path: [
        '/channels/',
        field({
          name: 'channelName',
          description: 'the name of the channel to get status for',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'ably/push/publish': createFetchTemplate({
    provider: 'ably',
    icon: '@logo/ably.com',
    name: 'Publish Push Notification via Ably',
    description:
      'Publish a push notification to an Ably channel with native mobile notification support',
    tags: ['ably', 'push', 'notification', 'mobile'],
    secret: '@ably',
    instruction: {
      method: 'POST',
      url: 'https://rest.ably.io',
      path: [
        '/channels/',
        field({
          name: 'channelName',
          description: 'the name of the channel to publish notification to',
        }),
        '/messages',
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        name: field({
          name: 'eventName',
          description: 'the event name for the notification',
          optional: true,
        }),
        data: field({
          name: 'notificationData',
          description: 'the notification data payload',
          optional: true,
        }),
        extras: {
          push: {
            notification: {
              title: field({
                name: 'title',
                description: 'the notification title',
              }),
              body: field({
                name: 'body',
                description: 'the notification body text',
              }),
            },
          },
        },
      },
    },
  }),

  'ably/api/call': createFetchTemplate({
    provider: 'ably',
    icon: '@logo/ably.com',
    name: 'Call Ably API',
    description:
      'Make a generic API call to Ably. This is a flexible template that can be used to call any Ably API endpoint by specifying the method, URL, and request body.',
    tags: ['ably', 'api', 'call', 'generic'],
    secret: '@ably',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Ably API endpoint to call',
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
}

export default abilities
