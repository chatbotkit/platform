import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Todoist abilities.
 */
const abilities = {
  'todoist/task/create': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Create Task',
    description:
      'Create a new task in Todoist with specified content, project, and due date',
    tags: ['todoist', 'task', 'create', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'POST',
      url: 'https://api.todoist.com/rest/v2/tasks',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'content',
          description: 'the task content or title',
        }),
        description: field({
          name: 'description',
          description: 'detailed description for the task',
          optional: true,
        }),
        project_id: field({
          name: 'projectId',
          description: 'the project ID to add this task to',
          optional: true,
        }),
        due_string: field({
          name: 'dueString',
          description:
            'human-readable due date like "tomorrow at 5pm" or "next Monday"',
          optional: true,
        }),
        priority: field({
          name: 'priority',
          type: 'number',
          description: 'task priority from 1 (normal) to 4 (urgent)',
          optional: true,
          default: 1,
        }),
      },
    },
  }),

  'todoist/task/fetch': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Get Task',
    description:
      'Retrieve detailed information about a specific task by its ID',
    tags: ['todoist', 'task', 'get', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'GET',
      url: 'https://api.todoist.com/rest/v2',
      path: ['/tasks/', field({ name: 'taskId', description: 'the task ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'todoist/task/list': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'List Tasks',
    description:
      'Get all active tasks, optionally filtered by project or label',
    tags: ['todoist', 'task', 'list', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'GET',
      url: 'https://api.todoist.com/rest/v2/tasks',
      query: {
        project_id: field({
          name: 'projectId',
          description: 'filter tasks by project ID',
          optional: true,
        }),
        label: field({
          name: 'label',
          description: 'filter tasks by label name',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'todoist/task/update': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Update Task',
    description:
      'Update an existing task with new content, due date, or priority',
    tags: ['todoist', 'task', 'update', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'POST',
      url: 'https://api.todoist.com/rest/v2',
      path: ['/tasks/', field({ name: 'taskId', description: 'the task ID' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'content',
          description: 'the new task content',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'updated task description',
          optional: true,
        }),
        due_string: field({
          name: 'dueString',
          description: 'updated due date in natural language',
          optional: true,
        }),
        priority: field({
          name: 'priority',
          type: 'number',
          description: 'updated priority from 1 to 4',
          optional: true,
        }),
      },
    },
  }),

  'todoist/task/close': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Close Task',
    description: 'Mark a task as completed',
    tags: ['todoist', 'task', 'complete', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'POST',
      url: 'https://api.todoist.com/rest/v2',
      path: [
        '/tasks/',
        field({ name: 'taskId', description: 'the task ID to complete' }),
        '/close',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'todoist/project/list': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'List Projects',
    description: 'Get all projects for the authenticated user',
    tags: ['todoist', 'project', 'list', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'GET',
      url: 'https://api.todoist.com/rest/v2/projects',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'todoist/project/create': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Create Project',
    description: 'Create a new project with specified name and optional color',
    tags: ['todoist', 'project', 'create', 'productivity'],
    secret: '@platform/todoist',
    instruction: {
      method: 'POST',
      url: 'https://api.todoist.com/rest/v2/projects',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the project name',
        }),
        color: field({
          name: 'color',
          description: 'project color like "red", "blue", "green"',
          optional: true,
        }),
        is_favorite: field({
          name: 'isFavorite',
          type: 'boolean',
          description: 'whether to mark project as favorite',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'todoist/api/call': createFetchTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Call Todoist API',
    description:
      'Make a generic API call to Todoist. This is a flexible template that can be used to call any Todoist API endpoint by specifying the method, URL, and request body.',
    tags: ['todoist', 'api', 'call', 'generic'],
    secret: '@platform/todoist',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Todoist API endpoint to call',
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

  'pack/todoist': createPackTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Install Todoist Tools',
    description:
      'Installs Todoist tools into the conversation. You can manage tasks, projects, and perform comprehensive productivity operations.',
    tags: ['todoist', 'pack', 'beta'],
    secret: '@platform/todoist',
    instruction: {
      abilities: [
        'todoist/task/create',
        'todoist/task/fetch',
        'todoist/task/list',
        'todoist/task/update',
        'todoist/task/close',
        'todoist/project/list',
        'todoist/project/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/todoist[read-only]': createPackTemplate({
    provider: 'todoist',
    icon: '@logo/todoist.com',
    name: 'Install Todoist Search Tools',
    description:
      'Installs read-only Todoist tools into the conversation. You can list tasks and projects without modification.',
    tags: ['todoist', 'pack', 'beta'],
    secret: '@platform/todoist',
    instruction: {
      abilities: [
        'todoist/task/fetch',
        'todoist/task/list',
        'todoist/project/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
