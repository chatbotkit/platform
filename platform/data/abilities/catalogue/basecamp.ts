import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Basecamp abilities.
 *
 * @see https://github.com/basecamp/bc3-api
 */
const abilities = {
  'basecamp/project/list': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'List Projects',
    description: 'Get a list of all active projects in a Basecamp account',
    tags: ['basecamp', 'project', 'list', 'project-management'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'GET',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/projects.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'basecamp/project/fetch': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Fetch Project',
    description: 'Retrieve detailed information about a specific project',
    tags: ['basecamp', 'project', 'fetch', 'project-management'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'GET',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/projects/',
        field({
          name: 'projectId',
          description: 'the project ID',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'basecamp/message/create': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Create Message',
    description:
      'Create a new message in a project message board for team communication',
    tags: ['basecamp', 'message', 'create', 'communication'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'POST',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/buckets/',
        field({
          name: 'projectId',
          description: 'the project ID',
        }),
        '/message_boards/',
        field({
          name: 'messageBoardId',
          description: 'the message board ID',
        }),
        '/messages.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subject: field({
          name: 'subject',
          description: 'the title of the message',
        }),
        content: field({
          name: 'content',
          description: 'the message content (HTML supported)',
          optional: true,
        }),
        status: 'active',
      },
    },
  }),

  'basecamp/todo/create': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Create To-Do',
    description: 'Create a new to-do item in a to-do list for task tracking',
    tags: ['basecamp', 'todo', 'task', 'create', 'project-management'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'POST',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/buckets/',
        field({
          name: 'projectId',
          description: 'the project ID',
        }),
        '/todolists/',
        field({
          name: 'todoListId',
          description: 'the to-do list ID',
        }),
        '/todos.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'content',
          description: 'the title of the to-do item',
        }),
        description: field({
          name: 'description',
          description: 'detailed description of the to-do (HTML supported)',
          optional: true,
        }),
        assignee_ids: array({
          name: 'assigneeIds',
          description: 'array of user IDs to assign this to-do',
          optional: true,
          items: {
            type: 'string',
          },
        }),
        due_on: field({
          name: 'dueOn',
          description: 'due date in YYYY-MM-DD format',
          optional: true,
        }),
        starts_on: field({
          name: 'startsOn',
          description: 'start date in YYYY-MM-DD format',
          optional: true,
        }),
      },
    },
  }),

  'basecamp/comment/create': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Create Comment',
    description:
      'Add a comment to any recording (message, todo, document, etc.) for collaboration',
    tags: ['basecamp', 'comment', 'create', 'collaboration'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'POST',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/buckets/',
        field({
          name: 'projectId',
          description: 'the project ID',
        }),
        '/recordings/',
        field({
          name: 'recordingId',
          description: 'the ID of the recording to comment on',
        }),
        '/comments.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'content',
          description: 'the comment text (HTML supported)',
        }),
      },
    },
  }),

  'basecamp/campfire/message/create': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Send Campfire Message',
    description:
      'Send a real-time chat message in a project Campfire for instant team communication',
    tags: ['basecamp', 'campfire', 'chat', 'message', 'communication'],
    secret: '@platform/basecamp',
    instruction: {
      method: 'POST',
      url: 'https://3.basecampapi.com',
      path: [
        '/',
        field({
          name: 'accountId',
          description: 'the Basecamp account ID',
        }),
        '/buckets/',
        field({
          name: 'projectId',
          description: 'the project ID',
        }),
        '/chats/',
        field({
          name: 'campfireId',
          description: 'the Campfire chat ID',
        }),
        '/lines.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        content: field({
          name: 'content',
          description: 'the chat message content',
        }),
      },
    },
  }),

  'basecamp/api/call': createFetchTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Call Basecamp API',
    description:
      'Make a generic API call to Basecamp. This is a flexible template that can be used to call any Basecamp API endpoint by specifying the method, URL, and request body.',
    tags: ['basecamp', 'api', 'call', 'generic'],
    secret: '@platform/basecamp',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Basecamp API endpoint to call',
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

  'pack/basecamp': createPackTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Install Basecamp Tools',
    description:
      'Installs Basecamp tools into the conversation. You can manage projects, messages, to-dos, comments, and Campfire chats for comprehensive project management and team collaboration.',
    tags: ['basecamp', 'pack', 'beta'],
    secret: '@platform/basecamp',
    instruction: {
      abilities: [
        'basecamp/project/list',
        'basecamp/project/fetch',
        'basecamp/message/create',
        'basecamp/todo/create',
        'basecamp/comment/create',
        'basecamp/campfire/message/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/basecamp[read-only]': createPackTemplate({
    provider: 'basecamp',
    icon: '@logo/basecamp.com',
    name: 'Install Basecamp Search Tools',
    description:
      'Installs read-only Basecamp tools into the conversation. You can list and fetch project information without making modifications.',
    tags: ['basecamp', 'pack', 'beta'],
    secret: '@platform/basecamp',
    instruction: {
      abilities: [
        'basecamp/project/list',
        'basecamp/project/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
