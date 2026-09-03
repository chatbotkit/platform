import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Google Tasks abilities.
 *
 * @see https://developers.google.com/workspace/tasks/reference/rest
 */
const abilities = {
  // --- Task List Abilities ---

  'google/tasks/tasklist/list': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Task Lists',
    description: 'Get all task lists for the authenticated user.',
    tags: ['google', 'tasks', 'tasklist', 'list'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'GET',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/tasks/tasklist/fetch': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Google Task List',
    description: 'Get a specific task list by ID.',
    tags: ['google', 'tasks', 'tasklist', 'fetch'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'GET',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/tasks/tasklist/create': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Google Task List',
    description: 'Create a new task list.',
    tags: ['google', 'tasks', 'tasklist', 'create'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'POST',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'the title of the task list',
        }),
      },
    },
  }),

  'google/tasks/tasklist/update': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Update Google Task List',
    description: 'Update an existing task list.',
    tags: ['google', 'tasks', 'tasklist', 'update'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'PATCH',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'the new title of the task list',
        }),
      },
    },
  }),

  'google/tasks/tasklist/delete': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Google Task List',
    description: 'Delete a specific task list by ID.',
    tags: ['google', 'tasks', 'tasklist', 'delete'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'DELETE',
      url: 'https://tasks.googleapis.com/tasks/v1/users/@me',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Task Abilities ---

  'google/tasks/task/list': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Tasks',
    description:
      'Get all tasks in a specific task list. Returns tasks sorted by their position.',
    tags: ['google', 'tasks', 'task', 'list'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'GET',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks',
      ],
      query: {
        showCompleted: field({
          name: 'showCompleted',
          description: 'whether to show completed tasks',
          type: 'boolean',
          optional: true,
          default: true,
        }),
        showHidden: field({
          name: 'showHidden',
          description: 'whether to show hidden tasks',
          type: 'boolean',
          optional: true,
          default: false,
        }),
        maxResults: field({
          name: 'maxResults',
          description:
            'maximum number of tasks to return (default 20, max 100)',
          type: 'number',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/tasks/task/fetch': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Google Task',
    description: 'Get a specific task by ID from a task list.',
    tags: ['google', 'tasks', 'task', 'fetch'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'GET',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the task ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/tasks/task/create': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Google Task',
    description:
      'Create a new task in a specific task list with title, notes, and due date.',
    tags: ['google', 'tasks', 'task', 'create'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'POST',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'the title of the task',
        }),
        notes: field({
          name: 'notes',
          description: 'notes or description for the task',
          optional: true,
        }),
        due: field({
          name: 'due',
          description:
            'due date in RFC 3339 format (e.g., 2024-12-31T00:00:00.000Z)',
          optional: true,
        }),
      },
    },
  }),

  'google/tasks/task/update': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Update Google Task',
    description: 'Update an existing task with new title, notes, or due date.',
    tags: ['google', 'tasks', 'task', 'update'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'PATCH',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the task ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'the new title of the task',
          optional: true,
        }),
        notes: field({
          name: 'notes',
          description: 'updated notes or description for the task',
          optional: true,
        }),
        due: field({
          name: 'due',
          description:
            'updated due date in RFC 3339 format (e.g., 2024-12-31T00:00:00.000Z)',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'task status - either "needsAction" or "completed"',
          optional: true,
        }),
      },
    },
  }),

  'google/tasks/task/complete': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Complete Google Task',
    description: 'Mark a task as completed.',
    tags: ['google', 'tasks', 'task', 'complete'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'PATCH',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the task ID to mark as completed',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'completed',
      },
    },
  }),

  'google/tasks/task/delete': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Google Task',
    description: 'Delete a specific task from a task list.',
    tags: ['google', 'tasks', 'task', 'delete'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'DELETE',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID',
        }),
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the task ID to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/tasks/task/clear': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Clear Completed Google Tasks',
    description: 'Clears all completed tasks from a task list.',
    tags: ['google', 'tasks', 'task', 'clear'],
    secret: '@platform/google/tasks',
    instruction: {
      method: 'POST',
      url: 'https://tasks.googleapis.com/tasks/v1',
      path: [
        '/lists/',
        field({
          name: 'tasklistId',
          description: 'the task list ID to clear completed tasks from',
        }),
        '/clear',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Pack Abilities ---

  'pack/google/tasks': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Tasks Tools',
    description:
      'Installs Google Tasks tools into the conversation. You can manage task lists and tasks, create, update, complete, and delete tasks.',
    tags: ['google', 'tasks', 'pack', 'beta'],
    secret: '@platform/google/tasks',
    instruction: {
      abilities: [
        'google/tasks/tasklist/list',
        'google/tasks/tasklist/fetch',
        'google/tasks/tasklist/create',
        'google/tasks/tasklist/update',
        'google/tasks/tasklist/delete',
        'google/tasks/task/list',
        'google/tasks/task/fetch',
        'google/tasks/task/create',
        'google/tasks/task/update',
        'google/tasks/task/complete',
        'google/tasks/task/delete',
        'google/tasks/task/clear',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/tasks[read-only]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Tasks Search Tools',
    description:
      'Installs read-only Google Tasks tools into the conversation. You can list task lists and tasks without modification.',
    tags: ['google', 'tasks', 'pack', 'beta'],
    secret: '@platform/google/tasks',
    instruction: {
      abilities: [
        'google/tasks/tasklist/list',
        'google/tasks/tasklist/fetch',
        'google/tasks/task/list',
        'google/tasks/task/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
