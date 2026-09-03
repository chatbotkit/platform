import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'buffer/organization/list': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'List Buffer Organizations',
    description:
      'Retrieve all organizations associated with the authenticated Buffer account, including IDs, names, and owner emails',
    tags: ['buffer', 'organization', 'list', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetOrganizations {
            account {
              organizations {
                id
                name
                ownerEmail
              }
            }
          }
        `,
      },
    },
  }),

  'buffer/channel/list': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'List Buffer Channels',
    description:
      'Retrieve all channels (social accounts) for a specific Buffer organization, including network service, avatar, and queue status',
    tags: ['buffer', 'channel', 'list', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetChannels($organizationId: OrganizationId!) {
            channels(input: { organizationId: $organizationId }) {
              id
              name
              displayName
              service
              avatar
              isQueuePaused
            }
          }
        `,
        variables: {
          organizationId: field({
            name: 'organizationId',
            description: 'the organization ID to list channels for',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'buffer/post/create': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'Create Buffer Post',
    description:
      'Publish a text post to a Buffer channel immediately, add it to the queue, or schedule it for a specific UTC time',
    tags: ['buffer', 'post', 'create', 'social-media', 'publish'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CreatePost($text: String!, $channelId: ChannelId!, $schedulingType: SchedulingType!, $mode: ShareMode!, $dueAt: DateTime) {
            createPost(input: {
              text: $text
              channelId: $channelId
              schedulingType: $schedulingType
              mode: $mode
              dueAt: $dueAt
            }) {
              ... on PostActionSuccess {
                post {
                  id
                  text
                  dueAt
                }
              }
              ... on MutationError {
                message
              }
            }
          }
        `,
        variables: {
          text: field({
            name: 'text',
            description: 'the text content of the post',
          }),
          channelId: field({
            name: 'channelId',
            description: 'the channel ID to post to',
            placeholder: true,
          }),
          schedulingType: field({
            name: 'schedulingType',
            description: 'how to schedule the post (automatic or custom)',
            optional: true,
            default: 'automatic',
          }),
          mode: field({
            name: 'mode',
            description:
              'the publishing mode: shareNow to publish immediately, addToQueue to add to the next queue slot, or customScheduled to post at a specific UTC time',
            enum: ['shareNow', 'addToQueue', 'shareNext', 'customScheduled'],
            optional: true,
            default: 'shareNow',
          }),
          dueAt: field({
            name: 'dueAt',
            description:
              'the ISO 8601 UTC publish time; required when mode is customScheduled (for example, 2026-03-10T15:00:00.000Z)',
            optional: true,
          }),
        },
      },
    },
  }),

  'buffer/post/create[with-media]': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'Create Buffer Post with Image',
    description:
      'Publish a post with an attached image to a Buffer channel immediately, add it to the queue, or schedule it for a specific UTC time',
    tags: [
      'buffer',
      'post',
      'create',
      'image',
      'media',
      'social-media',
      'publish',
    ],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CreatePostWithImage($text: String!, $channelId: ChannelId!, $imageUrl: String!, $schedulingType: SchedulingType!, $mode: ShareMode!, $dueAt: DateTime) {
            createPost(input: {
              text: $text
              channelId: $channelId
              schedulingType: $schedulingType
              mode: $mode
              dueAt: $dueAt
              assets: [{ image: { url: $imageUrl } }]
            }) {
              ... on PostActionSuccess {
                post {
                  id
                  text
                  dueAt
                  assets {
                    id
                    mimeType
                  }
                }
              }
              ... on MutationError {
                message
              }
            }
          }
        `,
        variables: {
          text: field({
            name: 'text',
            description: 'the text content of the post',
          }),
          channelId: field({
            name: 'channelId',
            description: 'the channel ID to post to',
            placeholder: true,
          }),
          imageUrl: field({
            name: 'imageUrl',
            description: 'the publicly accessible URL of the image to attach',
          }),
          schedulingType: field({
            name: 'schedulingType',
            description: 'how to schedule the post (automatic or custom)',
            optional: true,
            default: 'automatic',
          }),
          mode: field({
            name: 'mode',
            description:
              'the publishing mode: shareNow to publish immediately, addToQueue to add to the next queue slot, or customScheduled to post at a specific UTC time',
            enum: ['shareNow', 'addToQueue', 'shareNext', 'customScheduled'],
            optional: true,
            default: 'shareNow',
          }),
          dueAt: field({
            name: 'dueAt',
            description:
              'the ISO 8601 UTC publish time; required when mode is customScheduled (for example, 2026-03-10T15:00:00.000Z)',
            optional: true,
          }),
        },
      },
    },
  }),

  'buffer/post/list': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'List Buffer Posts',
    description:
      'Retrieve sent posts for a specific channel in a Buffer organization, sorted by most recent first',
    tags: ['buffer', 'post', 'list', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $status: PostStatus) {
            posts(input: {
              organizationId: $organizationId
              sort: [{ field: dueAt, direction: desc }, { field: createdAt, direction: desc }]
              filter: { status: $status, channelIds: [$channelId] }
            }) {
              edges {
                node {
                  id
                  text
                  createdAt
                  channelId
                }
              }
            }
          }
        `,
        variables: {
          organizationId: field({
            name: 'organizationId',
            description: 'the organization ID to list posts for',
            placeholder: true,
          }),
          channelId: field({
            name: 'channelId',
            description: 'the channel ID to filter posts by',
            placeholder: true,
          }),
          status: field({
            name: 'status',
            description:
              'the post status to filter by (sent, scheduled, draft, etc.)',
            optional: true,
            default: 'sent',
          }),
        },
      },
    },
  }),

  'buffer/post/list[with-assets]': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'List Buffer Posts with Assets',
    description:
      'Retrieve sent posts including image and media asset details for a specific channel in a Buffer organization',
    tags: ['buffer', 'post', 'list', 'assets', 'media', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetPostsWithAssets($organizationId: OrganizationId!, $channelId: ChannelId!) {
            posts(input: {
              organizationId: $organizationId
              filter: { status: [sent], channelIds: [$channelId] }
            }) {
              edges {
                node {
                  id
                  text
                  createdAt
                  channelId
                  assets {
                    thumbnail
                    mimeType
                    source
                    ... on ImageAsset {
                      image {
                        altText
                        width
                        height
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {
          organizationId: field({
            name: 'organizationId',
            description: 'the organization ID to list posts for',
            placeholder: true,
          }),
          channelId: field({
            name: 'channelId',
            description: 'the channel ID to filter posts by',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'buffer/post/list[scheduled]': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'List Scheduled Buffer Posts',
    description:
      'Retrieve all scheduled posts for a Buffer organization, sorted by next due date first',
    tags: ['buffer', 'post', 'list', 'scheduled', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetScheduledPosts($organizationId: OrganizationId!) {
            posts(input: {
              organizationId: $organizationId
              sort: [{ field: dueAt, direction: asc }, { field: createdAt, direction: desc }]
              filter: { status: [scheduled] }
            }) {
              edges {
                node {
                  id
                  text
                  createdAt
                }
              }
            }
          }
        `,
        variables: {
          organizationId: field({
            name: 'organizationId',
            description: 'the organization ID to list scheduled posts for',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'buffer/graphql': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'Execute Buffer GraphQL',
    description:
      'Execute an advanced custom GraphQL query against the Buffer API; use the dedicated Buffer post tools for creating, queueing, or scheduling posts',
    tags: ['buffer', 'graphql', 'query', 'social-media'],
    secret: '@buffer',
    instruction: {
      method: 'POST',
      url: 'https://api.buffer.com',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'the GraphQL query or mutation to execute',
        }),
        variables: field({
          name: 'variables',
          description:
            'the GraphQL variables as a JSON object (e.g., {"organizationId": "abc123"})',
          optional: true,
        }),
      },
    },
  }),

  'buffer/api/call': createFetchTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'Call Buffer API',
    description:
      'Make a generic API call to Buffer. This is a flexible template that can be used to call any Buffer API endpoint by specifying the method, URL, and request body.',
    tags: ['buffer', 'api', 'call', 'generic'],
    secret: '@buffer',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Buffer API endpoint to call',
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

  'pack/buffer': createPackTemplate({
    provider: 'buffer',
    icon: '@logo/buffer.com',
    name: 'Install Buffer Tools',
    description:
      'Installs Buffer tools into the conversation. You can list organizations and channels, publish posts with or without images, list sent and scheduled posts, and execute custom GraphQL queries.',
    tags: ['buffer', 'pack', 'social-media', 'beta'],
    secret: '@buffer',
    instruction: {
      abilities: [
        'buffer/organization/list',
        'buffer/channel/list',
        'buffer/post/create',
        'buffer/post/create[with-media]',
        'buffer/post/list',
        'buffer/post/list[with-assets]',
        'buffer/post/list[scheduled]',
        'buffer/graphql',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
