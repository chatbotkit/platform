import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'miro/board/list': createFetchTemplate({
    provider: 'miro',
    icon: '@logo/miro.com',
    name: 'List Miro Boards',
    description: 'List all boards accessible to the user in Miro.',
    tags: ['miro', 'board', 'list'],
    secret: '@platform/miro',
    instruction: {
      method: 'GET',
      url: 'https://api.miro.com/v2/boards',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'miro/board/fetch': createFetchTemplate({
    provider: 'miro',
    icon: '@logo/miro.com',
    name: 'Fetch Miro Board Details',
    description: 'Fetch details of a specific Miro board.',
    tags: ['miro', 'board', 'fetch'],
    secret: '@platform/miro',
    instruction: {
      method: 'GET',
      url: 'https://api.miro.com/v2/boards',
      path: [
        '/',
        field({
          name: 'board_id',
          description: 'the board ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'miro/board/item/list': createFetchTemplate({
    provider: 'miro',
    icon: '@logo/miro.com',
    name: 'List Miro Board Items',
    description: 'List all items (widgets) on a specific Miro board.',
    tags: ['miro', 'board', 'item', 'list'],
    secret: '@platform/miro',
    instruction: {
      method: 'GET',
      url: 'https://api.miro.com/v2/boards',
      path: [
        '/',
        field({
          name: 'board_id',
          description: 'the board ID',
        }),
        '/items',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'miro/board/item/fetch': createFetchTemplate({
    provider: 'miro',
    icon: '@logo/miro.com',
    name: 'Fetch Miro Board Item',
    description: 'Fetch details of a specific item (widget) on a Miro board.',
    tags: ['miro', 'board', 'item', 'fetch'],
    secret: '@platform/miro',
    instruction: {
      method: 'GET',
      url: 'https://api.miro.com/v2/boards',
      path: [
        '/',
        field({
          name: 'board_id',
          description: 'the board ID',
        }),
        '/items/',
        field({
          name: 'item_id',
          description: 'the item ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'miro/api/call': createFetchTemplate({
    provider: 'miro',
    icon: '@logo/miro.com',
    name: 'Call Miro API',
    description:
      'Make a generic API call to Miro. This is a flexible template that can be used to call any Miro API endpoint by specifying the method, URL, path parameters, query parameters, and request body.',
    tags: ['miro', 'api', 'call', 'generic'],
    secret: '@platform/miro',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Miro API endpoint to call',
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
}

export default abilities
