import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Asana abilities.
 */
const abilities = {
  'asana/task/create': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Create Task',
    description:
      'Create a new task in Asana with specified properties and assignee',
    tags: ['asana', 'task', 'create', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'POST',
      url: 'https://app.asana.com/api/1.0/tasks',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          name: field({
            name: 'taskName',
            description: 'the name of the task',
          }),
          notes: field({
            name: 'notes',
            description: 'detailed description or notes for the task',
            optional: true,
          }),
          assignee: field({
            name: 'assignee',
            description: 'the user ID or email of the assignee',
            optional: true,
          }),
          projects: field({
            name: 'projectId',
            description: 'the project ID to add this task to',
            optional: true,
          }),
          due_on: field({
            name: 'dueDate',
            description: 'the due date in YYYY-MM-DD format',
            optional: true,
          }),
        },
      },
    },
  }),

  'asana/task/fetch': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Fetch Task',
    description:
      'Retrieve detailed information about a specific task by its ID',
    tags: ['asana', 'task', 'get', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0',
      path: ['/tasks/', field({ name: 'taskId', description: 'the task ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/task/update': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Update Task',
    description: 'Update an existing task with new information',
    tags: ['asana', 'task', 'update', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'PUT',
      url: 'https://app.asana.com/api/1.0',
      path: ['/tasks/', field({ name: 'taskId', description: 'the task ID' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          name: field({
            name: 'taskName',
            description: 'the new name of the task',
            optional: true,
          }),
          notes: field({
            name: 'notes',
            description: 'updated description or notes',
            optional: true,
          }),
          completed: field({
            name: 'completed',
            type: 'boolean',
            description: 'whether the task is completed',
            optional: true,
          }),
          assignee: field({
            name: 'assignee',
            description: 'the user ID or email of the new assignee',
            optional: true,
          }),
          due_on: field({
            name: 'dueDate',
            description: 'the new due date in YYYY-MM-DD format',
            optional: true,
          }),
        },
      },
    },
  }),

  'asana/task/search': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Search Tasks',
    description:
      'Search for tasks in a workspace using various filter criteria',
    tags: ['asana', 'task', 'search', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/workspaces/',
        field({ name: 'workspaceId', description: 'the workspace ID' }),
        '/tasks/search',
      ],
      query: {
        text: field({
          name: 'searchText',
          description: 'the text to search for in task names and descriptions',
          optional: true,
        }),
        assignee: field({
          name: 'assignee',
          description: 'filter by assignee user ID or email',
          optional: true,
        }),
        projects: field({
          name: 'projectId',
          description: 'filter by project ID',
          optional: true,
        }),
        completed: field({
          name: 'completed',
          type: 'boolean',
          description: 'filter by completion status',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of tasks to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/task/delete': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Delete Task',
    description: 'Delete a specific task permanently from Asana',
    tags: ['asana', 'task', 'delete', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'DELETE',
      url: 'https://app.asana.com/api/1.0',
      path: ['/tasks/', field({ name: 'taskId', description: 'the task ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/task/comment/create': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Create Task Comment',
    description: 'Add a comment (story) to a task for collaboration',
    tags: ['asana', 'task', 'comment', 'collaboration', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'POST',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/tasks/',
        field({ name: 'taskId', description: 'the task ID' }),
        '/stories',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          text: field({
            name: 'text',
            description: 'the plain text comment to add',
            optional: true,
          }),
          html_text: field({
            name: 'htmlText',
            description: 'the HTML formatted comment text',
            optional: true,
          }),
          is_pinned: field({
            name: 'isPinned',
            type: 'boolean',
            description: 'whether the comment should be pinned',
            optional: true,
          }),
        },
      },
    },
  }),

  'asana/task/subtask/create': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Create Subtask',
    description: 'Create a new subtask and add it to a parent task',
    tags: ['asana', 'task', 'subtask', 'create', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'POST',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/tasks/',
        field({ name: 'taskId', description: 'the parent task ID' }),
        '/subtasks',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          name: field({
            name: 'subtaskName',
            description: 'the name of the subtask',
          }),
          notes: field({
            name: 'notes',
            description: 'detailed description or notes for the subtask',
            optional: true,
          }),
          assignee: field({
            name: 'assignee',
            description: 'the user ID or email of the assignee',
            optional: true,
          }),
          due_on: field({
            name: 'dueDate',
            description: 'the due date in YYYY-MM-DD format',
            optional: true,
          }),
          completed: field({
            name: 'completed',
            type: 'boolean',
            description: 'whether the subtask is completed',
            optional: true,
          }),
        },
      },
    },
  }),

  'asana/project/create': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Create Project',
    description: 'Create a new project in a workspace',
    tags: ['asana', 'project', 'create', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'POST',
      url: 'https://app.asana.com/api/1.0/projects',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          name: field({
            name: 'projectName',
            description: 'the name of the project',
          }),
          workspace: field({
            name: 'workspaceId',
            description: 'the workspace ID where the project will be created',
          }),
          notes: field({
            name: 'notes',
            description: 'project description or notes',
            optional: true,
          }),
        },
      },
    },
  }),

  'asana/project/task/list': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'List Project Tasks',
    description: 'List all tasks in a specific project',
    tags: ['asana', 'project', 'task', 'list', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/tasks',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of tasks to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/project/section/list': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'List Project Sections',
    description: 'List all sections in a specific project',
    tags: ['asana', 'project', 'section', 'list', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/sections',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/workspace/list': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'List Workspaces',
    description: 'Get a list of all workspaces accessible to the user',
    tags: ['asana', 'workspace', 'list', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0/workspaces',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/workspace/project/list': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'List Workspace Projects',
    description: 'List all projects in a specific workspace',
    tags: ['asana', 'workspace', 'project', 'list', 'project-management'],
    secret: '@platform/asana',
    instruction: {
      method: 'GET',
      url: 'https://app.asana.com/api/1.0',
      path: [
        '/workspaces/',
        field({ name: 'workspaceId', description: 'the workspace ID' }),
        '/projects',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of projects to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'asana/api/call': createFetchTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Call Asana API',
    description:
      'Make a generic API call to Asana. This is a flexible template that can be used to call any Asana API endpoint by specifying the method, URL, and request body.',
    tags: ['asana', 'api', 'call', 'generic'],
    secret: '@platform/asana',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Asana API endpoint to call',
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

  'pack/asana': createPackTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Install Asana Tools',
    description:
      'Installs Asana tools into the conversation. You can manage tasks, projects, workspaces, and perform comprehensive project management operations.',
    tags: ['asana', 'pack', 'beta'],
    secret: '@platform/asana',
    instruction: {
      abilities: [
        'asana/task/create',
        'asana/task/fetch',
        'asana/task/update',
        'asana/task/search',
        'asana/task/delete',
        'asana/task/comment/create',
        'asana/task/subtask/create',
        'asana/project/create',
        'asana/project/task/list',
        'asana/project/section/list',
        'asana/workspace/list',
        'asana/workspace/project/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/asana[read-only]': createPackTemplate({
    provider: 'asana',
    icon: '@logo/asana.com',
    name: 'Install Asana Search Tools',
    description:
      'Installs read-only Asana tools into the conversation. You can list workspaces, projects, tasks, and retrieve information without modification.',
    tags: ['asana', 'pack', 'beta'],
    secret: '@platform/asana',
    instruction: {
      abilities: [
        'asana/task/fetch',
        'asana/task/search',
        'asana/project/task/list',
        'asana/project/section/list',
        'asana/workspace/list',
        'asana/workspace/project/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
