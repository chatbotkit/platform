import {
  array,
  createTodoManageTemplate,
  field,
  object,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit todo abilities.
 */
const abilities = {
  'todo/manage': createTodoManageTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Manage Todo List',
    description:
      'Manage a structured todo list to track progress and plan tasks. Use read to retrieve the current list, write to replace it entirely.',
    tags: ['todo', 'manage', 'beta'],
    commentary:
      '**NOTE:** This ability manages a temporary todo list stored in Redis. The list expires after 24 hours of inactivity. Use this to track multi-step tasks and planning.',
    instruction: {
      op: field({
        name: 'operation',
        description:
          'the operation to perform: read to retrieve todos, write to replace the entire list',
        enum: ['read', 'write'],
      }),
      todoList: array({
        name: 'todoList',
        description:
          'complete array of all todo items (required for write operation)',
        items: object({
          shape: {
            id: field({
              name: 'id',
              type: 'number',
              description: 'unique identifier for the todo',
            }),
            title: field({
              name: 'title',
              description: 'concise action-oriented todo label (3-7 words)',
            }),
            status: field({
              name: 'status',
              description:
                'not-started: not begun | in-progress: currently working | completed: finished',
              enum: ['not-started', 'in-progress', 'completed'],
            }),
          },
        }),
      }),
    },
  }),

  'todo/read': createTodoManageTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Todo List',
    description: 'Retrieve the current todo list',
    tags: ['todo', 'read', 'beta'],
    commentary:
      '**NOTE:** This ability retrieves the current todo list. Returns an empty array if no todos exist.',
    instruction: {
      op: 'read',
    },
  }),

  'todo/write': createTodoManageTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write Todo List',
    description:
      'Replace the entire todo list with a new set of items. Always provide the complete list.',
    tags: ['todo', 'write', 'beta'],
    commentary:
      '**NOTE:** This ability replaces the entire todo list. You must provide all items - partial updates are not supported.',
    instruction: {
      op: 'write',
      todoList: array({
        name: 'todoList',
        description: 'complete array of all todo items',
        items: object({
          shape: {
            id: field({
              name: 'id',
              type: 'number',
              description:
                'unique identifier for the todo (sequential numbers)',
            }),
            title: field({
              name: 'title',
              description: 'concise action-oriented todo label (3-7 words)',
            }),
            status: field({
              name: 'status',
              description: 'the current status of the todo',
              enum: ['not-started', 'in-progress', 'completed'],
            }),
          },
        }),
      }),
    },
  }),
}

export default abilities
