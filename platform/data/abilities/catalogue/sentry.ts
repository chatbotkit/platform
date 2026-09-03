import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'sentry/organization/list': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'List Sentry Organizations',
    description:
      'Retrieve a list of organizations available to the authenticated session in Sentry',
    tags: ['sentry', 'organization', 'list'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: ['/organizations/'],
      query: {
        owner: field({
          name: 'owner',
          description:
            'Set to true to restrict results to organizations in which you are an owner',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/project/list': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'List Sentry Projects',
    description:
      'Retrieve a list of projects bound to an organization in Sentry',
    tags: ['sentry', 'project', 'list'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/projects/',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/issue/list': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'List Project Issues',
    description:
      'Return a list of issues bound to a specific project in Sentry',
    tags: ['sentry', 'issue', 'list'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/projects/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/',
        field({
          name: 'projectSlug',
          description: 'The project slug',
          placeholder: true,
        }),
        '/issues/',
      ],
      query: {
        query: field({
          name: 'query',
          description:
            'Sentry structured search query (e.g. is:unresolved, is:resolved)',
          optional: true,
        }),
        statsPeriod: field({
          name: 'statsPeriod',
          description: 'Stats period for issue statistics (e.g. 24h, 14d, 30d)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/issue/fetch': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Get Issue Details',
    description:
      'Retrieve detailed information about a specific issue in Sentry including tags, context, and metadata',
    tags: ['sentry', 'issue', 'get', 'details'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/issues/',
        field({
          name: 'issueId',
          description: 'The ID of the issue to retrieve',
          placeholder: true,
        }),
        '/',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/issue/events/list[latest]': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Get Latest Issue Event',
    description:
      'Retrieve the latest event for a specific issue with full stacktrace and context',
    tags: ['sentry', 'issue', 'event', 'latest', 'stacktrace'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/issues/',
        field({
          name: 'issueId',
          description: 'The ID of the issue',
          placeholder: true,
        }),
        '/events/latest/',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/event/list': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'List Project Events',
    description:
      'Return a list of events bound to a specific project in Sentry',
    tags: ['sentry', 'event', 'list'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/projects/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/',
        field({
          name: 'projectSlug',
          description: 'The project slug',
          placeholder: true,
        }),
        '/events/',
      ],
      query: {
        full: field({
          name: 'full',
          description: 'Include full event body including stacktrace',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/issue/update': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Update Issue',
    description:
      'Update a Sentry issue status, assignment, or other attributes such as resolving or assigning to a team member',
    tags: ['sentry', 'issue', 'update', 'resolve', 'assign'],
    secret: '@sentry',
    instruction: {
      method: 'PUT',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/issues/',
        field({
          name: 'issueId',
          description: 'The ID of the issue to update',
        }),
        '/',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: field({
          name: 'status',
          description:
            'The new status of the issue: resolved, unresolved, or ignored',
          optional: true,
          enum: ['resolved', 'unresolved', 'ignored'],
        }),
        assignedTo: field({
          name: 'assignedTo',
          description: 'The username or team slug to assign the issue to',
          optional: true,
        }),
        hasSeen: field({
          name: 'hasSeen',
          description: 'Mark the issue as seen',
          type: 'boolean',
          optional: true,
        }),
        isBookmarked: field({
          name: 'isBookmarked',
          description: 'Mark the issue as bookmarked',
          type: 'boolean',
          optional: true,
        }),
        isSubscribed: field({
          name: 'isSubscribed',
          description: 'Subscribe to notifications for the issue',
          type: 'boolean',
          optional: true,
        }),
      },
    },
  }),

  'sentry/issue/delete': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Delete Issue',
    description: 'Permanently remove a Sentry issue and all associated data',
    tags: ['sentry', 'issue', 'delete'],
    secret: '@sentry',
    instruction: {
      method: 'DELETE',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/issues/',
        field({
          name: 'issueId',
          description: 'The ID of the issue to delete',
        }),
        '/',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/issue/comment/create': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Add Comment to Issue',
    description: 'Add a note or comment to a specific Sentry issue',
    tags: ['sentry', 'issue', 'comment', 'note'],
    secret: '@sentry',
    instruction: {
      method: 'POST',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/issues/',
        field({
          name: 'issueId',
          description: 'The ID of the issue to comment on',
        }),
        '/notes/',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        text: field({
          name: 'text',
          description: 'The comment text to add to the issue',
        }),
      },
    },
  }),

  'sentry/release/list': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'List Releases',
    description: 'Return a list of releases for a given organization in Sentry',
    tags: ['sentry', 'release', 'list'],
    secret: '@sentry',
    instruction: {
      method: 'GET',
      url: 'https://sentry.io/api/0',
      path: [
        '/organizations/',
        field({
          name: 'organizationSlug',
          description: 'The organization slug',
          placeholder: true,
        }),
        '/releases/',
      ],
      query: {
        project: field({
          name: 'projectId',
          description: 'Filter releases by project ID',
          optional: true,
          placeholder: true,
        }),
        query: field({
          name: 'query',
          description: 'Query string to filter releases by version',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sentry/api/call': createFetchTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Call Sentry API',
    description:
      'Make a generic API call to Sentry. This is a flexible template that can be used to call any Sentry API endpoint by specifying the method, URL, and request body.',
    tags: ['sentry', 'api', 'call', 'generic'],
    secret: '@sentry',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Sentry API endpoint to call',
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

  'pack/sentry': createPackTemplate({
    provider: 'sentry',
    icon: '@logo/sentry.io',
    name: 'Install Sentry Tools',
    description:
      'Installs Sentry tools into the conversation. List organizations, projects, issues, and events; update and resolve issues; add comments; and manage releases.',
    tags: ['sentry', 'pack', 'error-monitoring', 'observability'],
    secret: '@sentry',
    instruction: {
      abilities: [
        'sentry/organization/list',
        'sentry/project/list',
        'sentry/issue/list',
        'sentry/issue/fetch',
        'sentry/issue/update',
        'sentry/issue/delete',
        'sentry/issue/comment/create',
        'sentry/issue/events/list[latest]',
        'sentry/event/list',
        'sentry/release/list',
      ],
    },
  }),
}

export default abilities
