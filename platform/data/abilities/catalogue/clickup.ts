import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of ClickUp abilities.
 */
const abilities = {
  'clickup/task/create': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Create Task',
    description:
      'Create a new task in ClickUp with specified properties and assignees',
    tags: ['clickup', 'task', 'create', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'POST',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/list/',
        field({
          name: 'listId',
          description: 'the list ID where the task will be created',
          placeholder: true,
        }),
        '/task',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'taskName',
          description: 'the name of the task',
        }),
        description: field({
          name: 'description',
          description: 'detailed description of the task',
          optional: true,
        }),
        assignees: field({
          name: 'assignees',
          description: 'array of user IDs to assign to the task',
          optional: true,
        }),
        priority: field({
          name: 'priority',
          type: 'number',
          description: 'task priority (1=urgent, 2=high, 3=normal, 4=low)',
          optional: true,
        }),
        due_date: field({
          name: 'dueDate',
          type: 'number',
          description: 'due date as Unix timestamp in milliseconds',
          optional: true,
        }),
      },
    },
  }),

  'clickup/task/fetch': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Get Task',
    description:
      'Retrieve detailed information about a specific task by its ID',
    tags: ['clickup', 'task', 'get', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'GET',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/task/',
        field({
          name: 'taskId',
          description: 'the task ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clickup/task/update': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Update Task',
    description: 'Update an existing task with new information',
    tags: ['clickup', 'task', 'update', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'PUT',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/task/',
        field({
          name: 'taskId',
          description: 'the task ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'taskName',
          description: 'the new name of the task',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'updated description of the task',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the status name to update to',
          optional: true,
        }),
        priority: field({
          name: 'priority',
          type: 'number',
          description: 'updated priority (1=urgent, 2=high, 3=normal, 4=low)',
          optional: true,
        }),
      },
    },
  }),

  'clickup/task/delete': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Delete Task',
    description: 'Delete a task from ClickUp',
    tags: ['clickup', 'task', 'delete', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'DELETE',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/task/',
        field({
          name: 'taskId',
          description: 'the task ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clickup/list/fetch': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Get List',
    description: 'Retrieve information about a specific list',
    tags: ['clickup', 'list', 'get', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'GET',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/list/',
        field({
          name: 'listId',
          description: 'the list ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clickup/list/task/list': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Get Tasks in List',
    description: 'Retrieve all tasks from a specific list',
    tags: ['clickup', 'list', 'task', 'get', 'project-management'],
    secret: '@platform/clickup',
    instruction: {
      method: 'GET',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/list/',
        field({
          name: 'listId',
          description: 'the list ID',
          placeholder: true,
        }),
        '/task',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        archived: field({
          name: 'includeArchived',
          type: 'boolean',
          description: 'whether to include archived tasks',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'clickup/goal/list': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Get Goals',
    description: 'Retrieve all goals in a team or workspace',
    tags: ['clickup', 'goal', 'list', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'GET',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/team/',
        field({
          name: 'teamId',
          description: 'the team ID',
          placeholder: true,
        }),
        '/goal',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clickup/goal/create': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Create Goal',
    description: 'Create a new goal with targets in ClickUp',
    tags: ['clickup', 'goal', 'create', 'project-management', 'productivity'],
    secret: '@platform/clickup',
    instruction: {
      method: 'POST',
      url: 'https://api.clickup.com/api/v2',
      path: [
        '/team/',
        field({
          name: 'teamId',
          description: 'the team ID',
          placeholder: true,
        }),
        '/goal',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'goalName',
          description: 'the name of the goal',
        }),
        description: field({
          name: 'description',
          description: 'detailed description of the goal',
          optional: true,
        }),
        due_date: field({
          name: 'dueDate',
          type: 'number',
          description: 'goal due date as Unix timestamp in milliseconds',
          optional: true,
        }),
      },
    },
  }),

  'clickup/api/call': createFetchTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Call Clickup API',
    description:
      'Make a generic API call to Clickup. This is a flexible template that can be used to call any Clickup API endpoint by specifying the method, URL, and request body.',
    tags: ['clickup', 'api', 'call', 'generic'],
    secret: '@platform/clickup',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Clickup API endpoint to call',
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

  'pack/clickup': createPackTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Install ClickUp Tools',
    description:
      'Installs ClickUp tools into the conversation. You can manage tasks, lists, goals, and perform comprehensive project management operations.',
    tags: ['clickup', 'pack', 'beta'],
    secret: '@platform/clickup',
    instruction: {
      abilities: [
        'clickup/task/create',
        'clickup/task/fetch',
        'clickup/task/update',
        'clickup/task/delete',
        'clickup/list/fetch',
        'clickup/list/task/list',
        'clickup/goal/list',
        'clickup/goal/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/clickup[read-only]': createPackTemplate({
    provider: 'clickup',
    icon: '@logo/clickup.com',
    name: 'Install ClickUp Search Tools',
    description:
      'Installs read-only ClickUp tools into the conversation. You can list tasks, lists, and goals without modification.',
    tags: ['clickup', 'pack', 'beta'],
    secret: '@platform/clickup',
    instruction: {
      abilities: [
        'clickup/task/fetch',
        'clickup/list/fetch',
        'clickup/list/task/list',
        'clickup/goal/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
