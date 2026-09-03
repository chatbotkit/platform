import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  // Forms
  'tally/form/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Forms',
    description: 'Get a paginated list of all forms in your Tally account',
    tags: ['tally', 'form', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: ['/forms'],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'Number of forms per page (max 500)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/form/fetch': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Get Form',
    description: 'Retrieve details of a specific form by its ID',
    tags: ['tally', 'form', 'fetch'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/forms/',
        field({
          name: 'formId',
          description: 'The form ID to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/form/question/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Form Questions',
    description: 'Get all questions/fields defined in a form',
    tags: ['tally', 'form', 'question', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/forms/',
        field({
          name: 'formId',
          description: 'The form ID to get questions for',
          placeholder: true,
        }),
        '/questions',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/form/block/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Form Blocks',
    description: 'Get all blocks (content elements) in a form',
    tags: ['tally', 'form', 'block', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/forms/',
        field({
          name: 'formId',
          description: 'The form ID to get blocks for',
          placeholder: true,
        }),
        '/blocks',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Submissions
  'tally/submission/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Form Submissions',
    description:
      'Get all submissions for a specific form with optional filtering',
    tags: ['tally', 'form', 'submission', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/forms/',
        field({
          name: 'formId',
          description: 'The form ID to get submissions for',
          placeholder: true,
        }),
        '/submissions',
      ],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
        }),
        startDate: field({
          name: 'startDate',
          description: 'Filter submissions after this date (ISO 8601 format)',
          optional: true,
        }),
        endDate: field({
          name: 'endDate',
          description: 'Filter submissions before this date (ISO 8601 format)',
          optional: true,
        }),
        afterId: field({
          name: 'afterId',
          description:
            'Get submissions after this submission ID (for cursor pagination)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/submission/fetch': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Get Submission',
    description: 'Retrieve a specific form submission by its ID',
    tags: ['tally', 'form', 'submission', 'fetch'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/forms/',
        field({
          name: 'formId',
          description: 'The form ID',
          placeholder: true,
        }),
        '/submissions/',
        field({
          name: 'submissionId',
          description: 'The submission ID to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Users
  'tally/user/me': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Get Current User',
    description: 'Retrieve information about the currently authenticated user',
    tags: ['tally', 'user', 'me'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: ['/users/me'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Workspaces
  'tally/workspace/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Workspaces',
    description: 'Get a list of all workspaces in your Tally account',
    tags: ['tally', 'workspace', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: ['/workspaces'],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/workspace/fetch': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Get Workspace',
    description: 'Retrieve details of a specific workspace by its ID',
    tags: ['tally', 'workspace', 'fetch'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/workspaces/',
        field({
          name: 'workspaceId',
          description: 'The workspace ID to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Webhooks
  'tally/webhook/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Webhooks',
    description: 'Get a list of all webhooks configured in your account',
    tags: ['tally', 'webhook', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: ['/webhooks'],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'Number of webhooks per page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/webhook/event/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Webhook Events',
    description: 'Get a list of events for a specific webhook',
    tags: ['tally', 'webhook', 'event', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/webhooks/',
        field({
          name: 'webhookId',
          description: 'The webhook ID to get events for',
          placeholder: true,
        }),
        '/events',
      ],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'Page number for pagination',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Organizations
  'tally/organization/user/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Organization Users',
    description: 'Get a list of all users in an organization',
    tags: ['tally', 'organization', 'user', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/organizations/',
        field({
          name: 'organizationId',
          description: 'The organization ID',
          placeholder: true,
        }),
        '/users',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/organization/invite/list': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'List Organization Invites',
    description: 'Get a list of pending invites for an organization',
    tags: ['tally', 'organization', 'invite', 'list'],
    secret: '@platform/tally',
    instruction: {
      method: 'GET',
      url: 'https://api.tally.so',
      path: [
        '/organizations/',
        field({
          name: 'organizationId',
          description: 'The organization ID',
          placeholder: true,
        }),
        '/invites',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'tally/api/call': createFetchTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Call Tally API',
    description:
      'Make a generic API call to Tally. This is a flexible template that can be used to call any Tally API endpoint by specifying the method, URL, and request body.',
    tags: ['tally', 'api', 'call', 'generic'],
    secret: '@platform/tally',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Tally API endpoint to call',
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

  'pack/tally': createPackTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Install Tally Tools',
    description:
      'Installs Tally tools into the conversation. You can manage forms, submissions, workspaces, and organization data.',
    tags: ['tally', 'pack', 'beta'],
    secret: '@platform/tally',
    instruction: {
      abilities: [
        'tally/form/list',
        'tally/form/fetch',
        'tally/form/question/list',
        'tally/form/block/list',
        'tally/submission/list',
        'tally/submission/fetch',
        'tally/user/me',
        'tally/workspace/list',
        'tally/workspace/fetch',
        'tally/webhook/list',
        'tally/webhook/event/list',
        'tally/organization/user/list',
        'tally/organization/invite/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/tally[read-only]': createPackTemplate({
    provider: 'tally',
    icon: '@logo/tally.so',
    name: 'Install Tally Search Tools',
    description:
      'Installs read-only Tally tools into the conversation. You can list and fetch forms, submissions, and workspaces without modification.',
    tags: ['tally', 'pack', 'beta'],
    secret: '@platform/tally',
    instruction: {
      abilities: [
        'tally/form/list',
        'tally/form/fetch',
        'tally/form/question/list',
        'tally/form/block/list',
        'tally/submission/list',
        'tally/submission/fetch',
        'tally/user/me',
        'tally/workspace/list',
        'tally/workspace/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
