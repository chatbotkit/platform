import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Trello abilities for comprehensive project management.
 *
 * @todo Investigate authentication mechanism. Currently using query params
 *   (key, token) but @platform/trello uses Pipedream Connect OAuth 1.0a which
 *   requires signed requests via oauthSignerUri. The current approach may not
 *   work correctly - need to verify how Pipedream handles Trello auth and
 *   whether we need a special auth handler or should use Authorization header.
 */
const abilities = {
  // ===========================
  // Board Operations
  // ===========================

  'trello/board/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create Board',
    description: 'Create a new Trello board',
    tags: ['trello', 'board', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1/boards',
      query: {
        name: field({ name: 'name', description: 'the board name' }),
        desc: field({
          name: 'description',
          description: 'the board description',
          optional: true,
        }),
        defaultLabels: field({
          name: 'defaultLabels',
          type: 'boolean',
          description: 'whether to use default labels',
          optional: true,
          default: true,
        }),
        defaultLists: field({
          name: 'defaultLists',
          type: 'boolean',
          description: 'whether to add default lists (To Do, Doing, Done)',
          optional: true,
          default: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/board/fetch': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Fetch Board',
    description: 'Get details of a specific Trello board',
    tags: ['trello', 'board', 'fetch', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: [
        '/boards/',
        field({ name: 'boardId', description: 'the board ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/board/list': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'List Boards',
    description: 'List all boards for the authenticated user',
    tags: ['trello', 'board', 'list', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1/members/me/boards',
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/board/update': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Update Board',
    description: 'Update an existing Trello board',
    tags: ['trello', 'board', 'update', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: [
        '/boards/',
        field({ name: 'boardId', description: 'the board ID' }),
      ],
      query: {
        name: field({
          name: 'name',
          description: 'the new board name',
          optional: true,
        }),
        desc: field({
          name: 'description',
          description: 'the new board description',
          optional: true,
        }),
        closed: field({
          name: 'closed',
          type: 'boolean',
          description: 'whether the board is closed',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // List Operations
  // ===========================

  'trello/list/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create List',
    description: 'Create a new list on a Trello board',
    tags: ['trello', 'list', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1/lists',
      query: {
        name: field({ name: 'name', description: 'the list name' }),
        idBoard: field({ name: 'boardId', description: 'the board ID' }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/list/fetch': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Fetch List',
    description: 'Get details of a specific Trello list',
    tags: ['trello', 'list', 'fetch', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: ['/lists/', field({ name: 'listId', description: 'the list ID' })],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/list/update': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Update List',
    description: 'Update an existing Trello list',
    tags: ['trello', 'list', 'update', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: ['/lists/', field({ name: 'listId', description: 'the list ID' })],
      query: {
        name: field({
          name: 'name',
          description: 'the new list name',
          optional: true,
        }),
        closed: field({
          name: 'closed',
          type: 'boolean',
          description: 'whether the list is closed',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/list': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'List Cards in List',
    description: 'Get all cards from a specific Trello list',
    tags: ['trello', 'card', 'list', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: [
        '/lists/',
        field({ name: 'listId', description: 'the list ID' }),
        '/cards',
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // Card Operations
  // ===========================

  'trello/card/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create Card',
    description: 'Create a new card in a specified list on Trello',
    tags: ['trello', 'card', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1/cards',
      query: {
        name: field({ name: 'name', description: 'the card name' }),
        desc: field({
          name: 'description',
          description: 'the card description',
          optional: true,
        }),
        idList: field({ name: 'listId', description: 'the list ID' }),
        due: field({
          name: 'dueDate',
          description: 'the due date in ISO format',
          optional: true,
        }),
        idMembers: field({
          name: 'memberIds',
          description: 'comma-separated list of member IDs to assign',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/fetch': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Fetch Card',
    description: 'Get details of a specific Trello card',
    tags: ['trello', 'card', 'fetch', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: ['/cards/', field({ name: 'cardId', description: 'the card ID' })],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/update': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Update Card',
    description: 'Update an existing Trello card',
    tags: ['trello', 'card', 'update', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: ['/cards/', field({ name: 'cardId', description: 'the card ID' })],
      query: {
        name: field({
          name: 'name',
          description: 'the new card name',
          optional: true,
        }),
        desc: field({
          name: 'description',
          description: 'the new card description',
          optional: true,
        }),
        due: field({
          name: 'dueDate',
          description: 'the new due date in ISO format',
          optional: true,
        }),
        dueComplete: field({
          name: 'dueComplete',
          type: 'boolean',
          description: 'whether the due date is marked complete',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/delete': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Delete Card',
    description: 'Delete a Trello card permanently',
    tags: ['trello', 'card', 'delete', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: ['/cards/', field({ name: 'cardId', description: 'the card ID' })],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/archive': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Archive Card',
    description: 'Archive (close) a Trello card',
    tags: ['trello', 'card', 'archive', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: ['/cards/', field({ name: 'cardId', description: 'the card ID' })],
      query: {
        closed: true,
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/move': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Move Card',
    description: 'Move a Trello card to a different list',
    tags: ['trello', 'card', 'move', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: ['/cards/', field({ name: 'cardId', description: 'the card ID' })],
      query: {
        idList: field({
          name: 'targetListId',
          description: 'the target list ID',
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/comment/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Add Comment to Card',
    description: 'Add a comment to a Trello card',
    tags: ['trello', 'card', 'comment', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/actions/comments',
      ],
      query: {
        text: field({ name: 'text', description: 'the comment text' }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // Checklist Operations
  // ===========================

  'trello/checklist/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create Checklist',
    description: 'Create a new checklist on a Trello card',
    tags: ['trello', 'checklist', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1/checklists',
      query: {
        idCard: field({ name: 'cardId', description: 'the card ID' }),
        name: field({
          name: 'name',
          description: 'the checklist name',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/checklist/fetch': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Fetch Checklist',
    description: 'Get details of a specific checklist',
    tags: ['trello', 'checklist', 'fetch', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: [
        '/checklists/',
        field({ name: 'checklistId', description: 'the checklist ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/checklist/delete': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Delete Checklist',
    description: 'Delete a checklist from a Trello card',
    tags: ['trello', 'checklist', 'delete', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/checklists/',
        field({ name: 'checklistId', description: 'the checklist ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/checklist/item/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create Checklist Item',
    description: 'Add a new item to a checklist',
    tags: ['trello', 'checklist', 'item', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1',
      path: [
        '/checklists/',
        field({ name: 'checklistId', description: 'the checklist ID' }),
        '/checkItems',
      ],
      query: {
        name: field({ name: 'name', description: 'the item name' }),
        checked: field({
          name: 'checked',
          type: 'boolean',
          description: 'whether the item is checked',
          optional: true,
          default: false,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/checklist/item/update': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Update Checklist Item',
    description: 'Update a checklist item state or name',
    tags: ['trello', 'checklist', 'item', 'update', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/checkItem/',
        field({ name: 'checkItemId', description: 'the checklist item ID' }),
      ],
      query: {
        name: field({
          name: 'name',
          description: 'the new item name',
          optional: true,
        }),
        state: field({
          name: 'state',
          description: 'the item state: complete or incomplete',
          optional: true,
          enum: ['complete', 'incomplete'],
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/checklist/item/delete': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Delete Checklist Item',
    description: 'Remove an item from a checklist',
    tags: ['trello', 'checklist', 'item', 'delete', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/checklists/',
        field({ name: 'checklistId', description: 'the checklist ID' }),
        '/checkItems/',
        field({ name: 'checkItemId', description: 'the checklist item ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // Label Operations
  // ===========================

  'trello/label/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Create Label',
    description: 'Create a new label on a Trello board',
    tags: ['trello', 'label', 'create', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1/labels',
      query: {
        name: field({ name: 'name', description: 'the label name' }),
        color: field({
          name: 'color',
          description:
            'the label color: yellow, purple, blue, red, green, orange, black, sky, pink, lime',
          optional: true,
        }),
        idBoard: field({ name: 'boardId', description: 'the board ID' }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/label/fetch': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Fetch Label',
    description: 'Get details of a specific label',
    tags: ['trello', 'label', 'fetch', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'GET',
      url: 'https://api.trello.com/1',
      path: [
        '/labels/',
        field({ name: 'labelId', description: 'the label ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/label/update': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Update Label',
    description: 'Update an existing label',
    tags: ['trello', 'label', 'update', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'PUT',
      url: 'https://api.trello.com/1',
      path: [
        '/labels/',
        field({ name: 'labelId', description: 'the label ID' }),
      ],
      query: {
        name: field({
          name: 'name',
          description: 'the new label name',
          optional: true,
        }),
        color: field({
          name: 'color',
          description: 'the new label color',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/label/delete': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Delete Label',
    description: 'Delete a label from a board',
    tags: ['trello', 'label', 'delete', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/labels/',
        field({ name: 'labelId', description: 'the label ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/label/add': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Add Label to Card',
    description: 'Add an existing label to a card',
    tags: ['trello', 'card', 'label', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/idLabels',
      ],
      query: {
        value: field({ name: 'labelId', description: 'the label ID' }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/label/remove': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Remove Label from Card',
    description: 'Remove a label from a card',
    tags: ['trello', 'card', 'label', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/idLabels/',
        field({ name: 'labelId', description: 'the label ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // Member Operations
  // ===========================

  'trello/card/member/add': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Add Member to Card',
    description: 'Assign a member to a card',
    tags: ['trello', 'card', 'member', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/idMembers',
      ],
      query: {
        value: field({ name: 'memberId', description: 'the member ID' }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/member/remove': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Remove Member from Card',
    description: 'Unassign a member from a card',
    tags: ['trello', 'card', 'member', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/idMembers/',
        field({ name: 'memberId', description: 'the member ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  // ===========================
  // Attachment Operations
  // ===========================

  'trello/card/attachment/create': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Add Attachment to Card',
    description: 'Attach a file or link to a card',
    tags: ['trello', 'card', 'attachment', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'POST',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/attachments',
      ],
      query: {
        url: field({
          name: 'url',
          description: 'the URL of the attachment',
        }),
        name: field({
          name: 'name',
          description: 'the name of the attachment',
          optional: true,
        }),
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/card/attachment/delete': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Delete Attachment from Card',
    description: 'Remove an attachment from a card',
    tags: ['trello', 'card', 'attachment', 'productivity'],
    secret: '@platform/trello',
    instruction: {
      method: 'DELETE',
      url: 'https://api.trello.com/1',
      path: [
        '/cards/',
        field({ name: 'cardId', description: 'the card ID' }),
        '/attachments/',
        field({ name: 'attachmentId', description: 'the attachment ID' }),
      ],
      query: {
        key: secret(),
        token: secret(),
      },
    },
  }),

  'trello/api/call': createFetchTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Call Trello API',
    description:
      'Make a generic API call to Trello. This is a flexible template that can be used to call any Trello API endpoint by specifying the method, URL, and request body.',
    tags: ['trello', 'api', 'call', 'generic'],
    secret: '@platform/trello',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Trello API endpoint to call',
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

  // ===========================
  // Pack Template
  // ===========================

  'pack/trello': createPackTemplate({
    provider: 'trello',
    icon: '@logo/trello.com',
    name: 'Install Trello Tools',
    description:
      'Installs Trello tools into the conversation. Manage boards, lists, cards, checklists, labels, and more.',
    tags: ['trello', 'pack', 'productivity', 'project-management'],
    secret: '@platform/trello',
    instruction: {
      abilities: [
        'trello/board/create',
        'trello/board/fetch',
        'trello/board/list',
        'trello/board/update',
        'trello/list/create',
        'trello/list/fetch',
        'trello/list/update',
        'trello/card/list',
        'trello/card/create',
        'trello/card/fetch',
        'trello/card/update',
        'trello/card/delete',
        'trello/card/archive',
        'trello/card/move',
        'trello/card/comment/create',
        'trello/checklist/create',
        'trello/checklist/fetch',
        'trello/checklist/delete',
        'trello/checklist/item/create',
        'trello/checklist/item/update',
        'trello/checklist/item/delete',
        'trello/label/create',
        'trello/label/fetch',
        'trello/label/update',
        'trello/label/delete',
        'trello/card/label/add',
        'trello/card/label/remove',
        'trello/card/member/add',
        'trello/card/member/remove',
        'trello/card/attachment/create',
        'trello/card/attachment/delete',
      ],
    },
  }),
}

export default abilities
