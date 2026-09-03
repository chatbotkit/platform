import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'harvest/project/list': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'List Harvest Projects',
    description:
      'List all projects in Harvest for time tracking and project management',
    tags: ['harvest', 'project', 'list', 'time-tracking'],
    secret: '@platform/harvest',
    instruction: {
      method: 'GET',
      url: 'https://api.harvestapp.com/v2',
      path: ['/projects'],
      query: {
        is_active: field({
          name: 'isActive',
          description: 'Filter by active projects',
          type: 'boolean',
          optional: true,
        }),
        client_id: field({
          name: 'clientId',
          description: 'Filter by client ID',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/time-entry/create': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Create Time Entry',
    description: 'Create a new time entry in Harvest for tracking work hours',
    tags: ['harvest', 'time-entry', 'create', 'timesheet'],
    secret: '@platform/harvest',
    instruction: {
      method: 'POST',
      url: 'https://api.harvestapp.com/v2',
      path: ['/time_entries'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
      body: {
        project_id: field({
          name: 'projectId',
          description: 'The project ID to track time against',
        }),
        task_id: field({
          name: 'taskId',
          description: 'The task ID to track time against',
        }),
        spent_date: field({
          name: 'spentDate',
          description: 'The date the time was spent (YYYY-MM-DD format)',
        }),
        hours: field({
          name: 'hours',
          description: 'The number of hours to track',
          type: 'number',
          optional: true,
        }),
        notes: field({
          name: 'notes',
          description: 'Notes about the time entry',
          optional: true,
        }),
        user_id: field({
          name: 'userId',
          description: 'The user ID (defaults to current user)',
          optional: true,
        }),
      },
    },
  }),

  'harvest/time-entry/list': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'List Time Entries',
    description:
      'List time entries in Harvest with optional filtering by date, project, or user',
    tags: ['harvest', 'time-entry', 'list', 'timesheet'],
    secret: '@platform/harvest',
    instruction: {
      method: 'GET',
      url: 'https://api.harvestapp.com/v2',
      path: ['/time_entries'],
      query: {
        user_id: field({
          name: 'userId',
          description: 'Filter by user ID',
          optional: true,
        }),
        project_id: field({
          name: 'projectId',
          description: 'Filter by project ID',
          optional: true,
        }),
        is_running: field({
          name: 'isRunning',
          description: 'Filter by running time entries',
          type: 'boolean',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'Filter by entries after this date (YYYY-MM-DD)',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'Filter by entries before this date (YYYY-MM-DD)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/time-entry/stop': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Stop Running Timer',
    description: 'Stop a running time entry timer in Harvest',
    tags: ['harvest', 'time-entry', 'stop', 'timer'],
    secret: '@platform/harvest',
    instruction: {
      method: 'PATCH',
      url: 'https://api.harvestapp.com/v2',
      path: [
        '/time_entries/',
        field({
          name: 'timeEntryId',
          description: 'The time entry ID to stop',
          placeholder: true,
        }),
        '/stop',
      ],
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/time-entry/restart': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Restart Timer',
    description: 'Restart a previously stopped time entry timer in Harvest',
    tags: ['harvest', 'time-entry', 'restart', 'timer'],
    secret: '@platform/harvest',
    instruction: {
      method: 'PATCH',
      url: 'https://api.harvestapp.com/v2',
      path: [
        '/time_entries/',
        field({
          name: 'timeEntryId',
          description: 'The time entry ID to restart',
          placeholder: true,
        }),
        '/restart',
      ],
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/client/list': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'List Harvest Clients',
    description:
      'List all clients in Harvest for managing customer relationships',
    tags: ['harvest', 'client', 'list', 'customer'],
    secret: '@platform/harvest',
    instruction: {
      method: 'GET',
      url: 'https://api.harvestapp.com/v2',
      path: ['/clients'],
      query: {
        is_active: field({
          name: 'isActive',
          description: 'Filter by active clients',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/task/list': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'List Harvest Tasks',
    description: 'List all tasks in Harvest that can be assigned to projects',
    tags: ['harvest', 'task', 'list'],
    secret: '@platform/harvest',
    instruction: {
      method: 'GET',
      url: 'https://api.harvestapp.com/v2',
      path: ['/tasks'],
      query: {
        is_active: field({
          name: 'isActive',
          description: 'Filter by active tasks',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/user/list': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'List Harvest Users',
    description: 'List all users in Harvest with access to the account',
    tags: ['harvest', 'user', 'list', 'team'],
    secret: '@platform/harvest',
    instruction: {
      method: 'GET',
      url: 'https://api.harvestapp.com/v2',
      path: ['/users'],
      query: {
        is_active: field({
          name: 'isActive',
          description: 'Filter by active users',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Harvest-Account-Id': field({
          name: 'accountId',
          description: 'The Harvest account ID',
          placeholder: true,
        }),
      },
    },
  }),

  'harvest/api/call': createFetchTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Call Harvest API',
    description:
      'Make a generic API call to Harvest. This is a flexible template that can be used to call any Harvest API endpoint by specifying the method, URL, and request body.',
    tags: ['harvest', 'api', 'call', 'generic'],
    secret: '@platform/harvest',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Harvest API endpoint to call',
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

  'pack/harvest': createPackTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Install Harvest Tools',
    description:
      'Installs Harvest tools into the conversation. You can manage time entries, projects, clients, tasks, and users.',
    tags: ['harvest', 'pack', 'beta'],
    secret: '@platform/harvest',
    instruction: {
      abilities: [
        'harvest/project/list',
        'harvest/time-entry/create',
        'harvest/time-entry/list',
        'harvest/time-entry/stop',
        'harvest/time-entry/restart',
        'harvest/client/list',
        'harvest/task/list',
        'harvest/user/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/harvest[read-only]': createPackTemplate({
    provider: 'harvest',
    icon: '@logo/getharvest.com',
    name: 'Install Harvest Search Tools',
    description:
      'Installs read-only Harvest tools into the conversation. You can list projects, time entries, clients, tasks, and users without modification.',
    tags: ['harvest', 'pack', 'beta'],
    secret: '@platform/harvest',
    instruction: {
      abilities: [
        'harvest/project/list',
        'harvest/time-entry/list',
        'harvest/client/list',
        'harvest/task/list',
        'harvest/user/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
