import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Clockify time tracking abilities.
 *
 * Clockify is a time tracking and timesheet app that lets you track work hours across projects.
 *
 * @see https://docs.clockify.me/
 */
const abilities = {
  'clockify/workspace/list': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'List Workspaces',
    description:
      'Get all workspaces for the authenticated user. Each workspace has projects, clients, and team members.',
    tags: ['clockify', 'workspace', 'list'],
    secret: '@clockify',
    instruction: {
      method: 'GET',
      url: 'https://api.clockify.me',
      path: ['/api/v1/workspaces'],
      headers: {
        'X-Api-Key': secret(),
      },
    },
  }),

  'clockify/project/list': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'List Projects',
    description:
      'Get all projects in a workspace. Projects organize time entries and tasks.',
    tags: ['clockify', 'project', 'list'],
    secret: '@clockify',
    instruction: {
      method: 'GET',
      url: 'https://api.clockify.me',
      path: [
        '/api/v1/workspaces/',
        field({
          name: 'workspaceId',
          description: 'workspace identifier',
          placeholder: true,
        }),
        '/projects',
      ],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (1-based)',
          optional: true,
          default: 1,
        }),
        'page-size': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of results per page',
          optional: true,
          default: 50,
        }),
      },
      headers: {
        'X-Api-Key': secret(),
      },
    },
  }),

  'clockify/project/create': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'Create Project',
    description:
      'Create a new project in a workspace. Projects help organize time tracking by client or initiative.',
    tags: ['clockify', 'project', 'create'],
    secret: '@clockify',
    instruction: {
      method: 'POST',
      url: 'https://api.clockify.me',
      path: [
        '/api/v1/workspaces/',
        field({
          name: 'workspaceId',
          description: 'workspace identifier',
          placeholder: true,
        }),
        '/projects',
      ],
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': secret(),
      },
      body: {
        name: field({ name: 'name', description: 'project name' }),
        clientId: field({
          name: 'clientId',
          description: 'client identifier for this project',
          optional: true,
        }),
        isPublic: field({
          name: 'isPublic',
          type: 'boolean',
          description: 'whether project is visible to all workspace members',
          optional: true,
        }),
        billable: field({
          name: 'billable',
          type: 'boolean',
          description:
            'whether time entries on this project are billable by default',
          optional: true,
        }),
        note: field({
          name: 'note',
          description: 'project description or notes',
          optional: true,
        }),
      },
    },
  }),

  'clockify/time-entry/list': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'List Time Entries',
    description:
      'Get time entries for a user in a workspace. Time entries track actual hours worked on projects and tasks.',
    tags: ['clockify', 'time-entry', 'list'],
    secret: '@clockify',
    instruction: {
      method: 'GET',
      url: 'https://api.clockify.me',
      path: [
        '/api/v1/workspaces/',
        field({
          name: 'workspaceId',
          description: 'workspace identifier',
          placeholder: true,
        }),
        '/user/',
        field({
          name: 'userId',
          description: 'user identifier',
          placeholder: true,
        }),
        '/time-entries',
      ],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (1-based)',
          optional: true,
          default: 1,
        }),
        'page-size': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of results per page',
          optional: true,
          default: 50,
        }),
      },
      headers: {
        'X-Api-Key': secret(),
      },
    },
  }),

  'clockify/task/list': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'List Tasks',
    description:
      'Get all tasks in a project. Tasks break down project work into trackable units.',
    tags: ['clockify', 'task', 'list'],
    secret: '@clockify',
    instruction: {
      method: 'GET',
      url: 'https://api.clockify.me',
      path: [
        '/api/v1/workspaces/',
        field({
          name: 'workspaceId',
          description: 'workspace identifier',
          placeholder: true,
        }),
        '/projects/',
        field({
          name: 'projectId',
          description: 'project identifier',
          placeholder: true,
        }),
        '/tasks',
      ],
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (1-based)',
          optional: true,
          default: 1,
        }),
        'page-size': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of results per page',
          optional: true,
          default: 50,
        }),
      },
      headers: {
        'X-Api-Key': secret(),
      },
    },
  }),

  'clockify/task/create': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'Create Task',
    description:
      'Create a new task in a project. Tasks help organize and track specific work items.',
    tags: ['clockify', 'task', 'create'],
    secret: '@clockify',
    instruction: {
      method: 'POST',
      url: 'https://api.clockify.me',
      path: [
        '/api/v1/workspaces/',
        field({
          name: 'workspaceId',
          description: 'workspace identifier',
          placeholder: true,
        }),
        '/projects/',
        field({
          name: 'projectId',
          description: 'project identifier',
          placeholder: true,
        }),
        '/tasks',
      ],
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': secret(),
      },
      body: {
        name: field({ name: 'name', description: 'task name' }),
        assigneeIds: field({
          name: 'assigneeIds',
          description: 'array of user IDs assigned to this task',
          optional: true,
        }),
        estimate: field({
          name: 'estimate',
          description: 'estimated duration in ISO 8601 format (e.g., PT2H30M)',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'task status',
          enum: ['ACTIVE', 'DONE'],
          optional: true,
          default: 'ACTIVE',
        }),
      },
    },
  }),

  'clockify/api/call': createFetchTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'Call Clockify API',
    description:
      'Make a generic API call to Clockify. This is a flexible template that can be used to call any Clockify API endpoint by specifying the method, URL, and request body.',
    tags: ['clockify', 'api', 'call', 'generic'],
    secret: '@clockify',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Clockify API endpoint to call',
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

  'pack/clockify': createPackTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'Install Clockify Tools',
    description:
      'Installs Clockify tools into the conversation. You can manage workspaces, projects, time entries, and tasks.',
    tags: ['clockify', 'pack', 'beta'],
    secret: '@clockify',
    instruction: {
      abilities: [
        'clockify/workspace/list',
        'clockify/project/list',
        'clockify/project/create',
        'clockify/time-entry/list',
        'clockify/task/list',
        'clockify/task/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/clockify[read-only]': createPackTemplate({
    provider: 'clockify',
    icon: '@logo/clockify.me',
    name: 'Install Clockify Search Tools',
    description:
      'Installs read-only Clockify tools into the conversation. You can list workspaces, projects, time entries, and tasks without modification.',
    tags: ['clockify', 'pack', 'beta'],
    secret: '@clockify',
    instruction: {
      abilities: [
        'clockify/workspace/list',
        'clockify/project/list',
        'clockify/time-entry/list',
        'clockify/task/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
