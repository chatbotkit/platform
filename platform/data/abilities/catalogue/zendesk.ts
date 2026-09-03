import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Zendesk abilities.
 *
 * @see https://developer.zendesk.com/api-reference
 */
const abilities = {
  'zendesk/ticket/search': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Search Zendesk Tickets',
    description:
      'Search for support tickets in Zendesk based on specific criteria',
    tags: ['zendesk', 'ticket', 'search'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: ['/api/v2/search.json'],
      query: {
        query: field({
          name: 'query',
          description: 'zendesk search query',
        }),
        sort_by: field({
          name: 'sort_by',
          enum: [
            'updated_at',
            'created_at',
            'priority',
            'status',
            'ticket_type',
          ],
          default: 'created_at',
          description: 'sort by field',
        }),
        sort_order: field({
          name: 'sort_order',
          enum: ['desc', 'asc'],
          default: 'desc',
          description: 'sort order',
        }),
        page: field({
          name: 'page',
          type: 'number',
          default: 1,
          description: 'page number when paginating - starting from 1',
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          default: 10,
          description: 'number of tickets per page',
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/ticket/list': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'List Zendesk Tickets',
    description: 'List all support tickets in Zendesk',
    tags: ['zendesk', 'ticket', 'list'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: ['/api/v2/tickets.json'],
      query: {
        sort_by: 'created_at',
        sort_order: 'desc',
        page: field({
          name: 'page',
          type: 'number',
          default: 1,
          description: 'page number when paginating - starting from 1',
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          default: 10,
          placeholder: true,
          description: 'number of tickets per page',
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/ticket/fetch': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Fetch Zendesk Ticket',
    description: 'Fetch details of a specific ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'status'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/ticket/create': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Create Zendesk Ticket',
    description: 'Create a new support ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'create'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: ['/api/v2/tickets.json'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ticket: {
          subject: field({
            name: 'subject',
            description: 'ticket subject',
          }),
          description: field({
            name: 'description',
            description: 'ticket description',
          }),
          status: field({
            name: 'status',
            enum: ['open', 'solved', 'pending'],
            default: 'open',
            description: 'ticket status',
          }),
          priority: field({
            name: 'priority',
            enum: ['urgent', 'high', 'normal', 'low'],
            default: 'normal',
            description: 'ticket priority',
          }),
        },
      },
    },
  }),

  'zendesk/ticket/update': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Update Zendesk Ticket',
    description: 'Update a specific support ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'update'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ticket: {
          subject: field({
            name: 'subject',
            description: 'ticket subject',
            optional: true,
          }),
          description: field({
            name: 'description',
            description: 'ticket description',
            optional: true,
          }),
          status: field({
            name: 'status',
            enum: ['open', 'solved', 'pending'],
            description: 'ticket status',
            optional: true,
          }),
          priority: field({
            name: 'priority',
            enum: ['urgent', 'high', 'normal', 'low'],
            description: 'ticket priority',
            optional: true,
          }),
        },
      },
    },
  }),

  'zendesk/ticket/delete': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Delete Zendesk Ticket',
    description: 'Delete a specific support ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'delete'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/ticket/comment/list': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'List Zendesk Ticket Comments',
    description: 'List comments of a specific ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'comment', 'list'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '/comments.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/ticket/comment/create': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Create Zendesk Ticket Comment',
    description: 'Create a new comment on a specific ticket in Zendesk',
    tags: ['zendesk', 'ticket', 'comment', 'create'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ticket: {
          comment: {
            body: field({
              name: 'body',
              description: 'comment body',
            }),
            public: field({
              name: 'public',
              type: 'boolean',
              default: false,
              description: 'public or private comment',
            }),
          },
        },
      },
    },
  }),

  'zendesk/ticket/reply': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Reply to Zendesk Ticket',
    description:
      'Send a public reply to a Zendesk ticket (sends email to requester)',
    tags: ['zendesk', 'ticket', 'reply', 'comment'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ticket: {
          comment: {
            body: field({
              name: 'body',
              description: 'reply body text',
            }),
            public: true,
          },
          status: field({
            name: 'status',
            enum: ['open', 'pending', 'solved'],
            description: 'new ticket status after reply',
            optional: true,
          }),
        },
      },
    },
  }),

  'zendesk/ticket/note': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Add Internal Note to Zendesk Ticket',
    description:
      'Add a private internal note to a Zendesk ticket (not visible to requester)',
    tags: ['zendesk', 'ticket', 'note', 'comment', 'internal'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/tickets/',
        field({
          name: 'ticket_id',
          description: 'ticket ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ticket: {
          comment: {
            body: field({
              name: 'body',
              description: 'internal note text',
            }),
            public: false,
          },
        },
      },
    },
  }),

  'zendesk/user/fetch': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Fetch Zendesk User',
    description: 'Fetch details of a specific user in Zendesk',
    tags: ['zendesk', 'user', 'fetch'],
    secret: '@platform/zendesk',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the Zendesk API URL (e.g., https://yoursubdomain.zendesk.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/users/',
        field({
          name: 'user_id',
          description: 'user ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'zendesk/api/call': createFetchTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Call Zendesk API',
    description:
      'Make a generic API call to Zendesk. This is a flexible template that can be used to call any Zendesk API endpoint by specifying the method, URL, and request body.',
    tags: ['zendesk', 'api', 'call', 'generic'],
    secret: '@platform/zendesk',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Zendesk API endpoint to call',
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

  'pack/zendesk': createPackTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Install Zendesk Tools',
    description:
      'Installs Zendesk tools into the conversation. You can manage tickets, search for issues, and perform comprehensive support operations.',
    tags: ['zendesk', 'pack', 'beta'],
    secret: '@platform/zendesk',
    instruction: {
      abilities: [
        'zendesk/ticket/search',
        'zendesk/ticket/list',
        'zendesk/ticket/fetch',
        'zendesk/ticket/create',
        'zendesk/ticket/update',
        'zendesk/ticket/delete',
        'zendesk/ticket/comment/list',
        'zendesk/ticket/comment/create',
        'zendesk/ticket/reply',
        'zendesk/ticket/note',
        'zendesk/user/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/zendesk[read-only]': createPackTemplate({
    provider: 'zendesk',
    icon: '@logo/zendesk.com',
    name: 'Install Zendesk Search Tools',
    description:
      'Installs read-only Zendesk tools into the conversation. You can list tickets, search for issues, and retrieve information without modification.',
    tags: ['zendesk', 'pack', 'beta'],
    secret: '@platform/zendesk',
    instruction: {
      abilities: [
        'zendesk/ticket/search',
        'zendesk/ticket/list',
        'zendesk/ticket/fetch',
        'zendesk/ticket/comment/list',
        'zendesk/user/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
