import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'coda/doc/list': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'List Coda Docs',
    description:
      'List all docs accessible by the user in reverse chronological order',
    tags: ['coda', 'doc', 'list'],
    secret: '@coda',
    instruction: {
      method: 'GET',
      url: 'https://coda.io',
      path: ['/apis/v1/docs'],
      query: {
        query: field({
          name: 'query',
          description: 'search term to filter docs',
          optional: true,
        }),
        isOwner: field({
          name: 'isOwner',
          description: 'show only docs owned by the user',
          type: 'boolean',
          optional: true,
        }),
        isPublished: field({
          name: 'isPublished',
          description: 'show only published docs',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'coda/doc/create': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Create Coda Doc',
    description: 'Create a new Coda document',
    tags: ['coda', 'doc', 'create'],
    secret: '@coda',
    instruction: {
      method: 'POST',
      url: 'https://coda.io',
      path: ['/apis/v1/docs'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'title of the doc',
          optional: true,
          default: 'Untitled',
        }),
        folderId: field({
          name: 'folderId',
          description: 'ID of the folder to create the doc in',
          optional: true,
        }),
      },
    },
  }),

  'coda/table/list': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'List Coda Tables',
    description: 'List all tables in a Coda doc',
    tags: ['coda', 'table', 'list'],
    secret: '@coda',
    instruction: {
      method: 'GET',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables',
      ],
      query: {
        sortBy: field({
          name: 'sortBy',
          description: 'how to sort the tables',
          enum: ['name'],
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'coda/row/list': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'List Coda Table Rows',
    description: 'List all rows in a Coda table',
    tags: ['coda', 'row', 'list', 'table'],
    secret: '@coda',
    instruction: {
      method: 'GET',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/rows',
      ],
      query: {
        query: field({
          name: 'query',
          description: 'search query to filter rows',
          optional: true,
        }),
        sortBy: field({
          name: 'sortBy',
          description: 'how to sort the rows',
          enum: ['natural', 'createdAt', 'updatedAt'],
          optional: true,
        }),
        visibleOnly: field({
          name: 'visibleOnly',
          description: 'return only visible rows',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'coda/row/fetch': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Get Coda Row',
    description: 'Get a specific row from a Coda table by ID',
    tags: ['coda', 'row', 'fetch', 'get'],
    secret: '@coda',
    instruction: {
      method: 'GET',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/rows/',
        field({
          name: 'rowId',
          description: 'the row ID',
          placeholder: true,
        }),
      ],
      query: {
        useColumnNames: field({
          name: 'useColumnNames',
          description: 'use column names instead of column IDs in values',
          type: 'boolean',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'coda/row/create': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Create Coda Table Row',
    description: 'Insert a new row into a Coda table',
    tags: ['coda', 'row', 'create', 'insert'],
    secret: '@coda',
    instruction: {
      method: 'POST',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/rows',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        rows: [
          {
            cells: field({
              name: 'cells',
              description:
                'array of cell objects with column and value properties',
            }),
          },
        ],
      },
    },
  }),

  'coda/row/update': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Update Coda Table Row',
    description: 'Update an existing row in a Coda table',
    tags: ['coda', 'row', 'update'],
    secret: '@coda',
    instruction: {
      method: 'PUT',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/rows/',
        field({
          name: 'rowId',
          description: 'the row ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        row: {
          cells: field({
            name: 'cells',
            description:
              'array of cell objects with column and value properties',
          }),
        },
      },
    },
  }),

  'coda/row/delete': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Delete Coda Table Row',
    description: 'Delete a row from a Coda table',
    tags: ['coda', 'row', 'delete'],
    secret: '@coda',
    instruction: {
      method: 'DELETE',
      url: 'https://coda.io',
      path: [
        '/apis/v1/docs/',
        field({
          name: 'docId',
          description: 'the doc ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/rows/',
        field({
          name: 'rowId',
          description: 'the row ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'coda/api/call': createFetchTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Call Coda API',
    description:
      'Make a generic API call to Coda. This is a flexible template that can be used to call any Coda API endpoint by specifying the method, URL, and request body.',
    tags: ['coda', 'api', 'call', 'generic'],
    secret: '@coda',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Coda API endpoint to call',
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

  'pack/coda': createPackTemplate({
    provider: 'coda',
    icon: '@logo/coda.io',
    name: 'Install Coda Tools',
    description:
      'Installs Coda tools into the conversation. You can list docs, create and manage tables, and perform comprehensive database operations.',
    tags: ['coda', 'pack', 'beta'],
    secret: '@coda',
    instruction: {
      abilities: [
        'coda/doc/list',
        'coda/doc/create',
        'coda/table/list',
        'coda/row/list',
        'coda/row/fetch',
        'coda/row/create',
        'coda/row/update',
        'coda/row/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
