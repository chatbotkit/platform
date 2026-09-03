import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Monday.com abilities.
 *
 * @see https://developer.monday.com/api-reference/reference/about-the-api
 */
const abilities = {
  'monday/board/create': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Create Board',
    description:
      'Create a new board in Monday.com with specified name, kind, and optional workspace',
    tags: ['monday', 'board', 'create', 'project-management'],
    secret: '@monday',
    instruction: {
      method: 'POST',
      url: 'https://api.monday.com/v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CreateBoard($boardName: String!, $boardKind: BoardKind!, $workspaceId: ID) {
            create_board(
              board_name: $boardName
              board_kind: $boardKind
              workspace_id: $workspaceId
            ) {
              id
              name
              board_kind
              workspace {
                id
                name
              }
            }
          }
        `,
        variables: {
          boardName: field({
            name: 'boardName',
            description: 'the name of the board',
          }),
          boardKind: field({
            name: 'boardKind',
            description: 'the kind of board (public, private, or share)',
            optional: true,
            default: 'public',
            enum: ['public', 'private', 'share'],
          }),
          workspaceId: field({
            name: 'workspaceId',
            description: 'the workspace ID to create the board in',
            optional: true,
            placeholder: true,
          }),
        },
      },
    },
  }),

  'monday/item/create': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Create Item',
    description:
      'Create a new item in a Monday.com board with specified name and optional group',
    tags: ['monday', 'item', 'create', 'project-management'],
    secret: '@monday',
    instruction: {
      method: 'POST',
      url: 'https://api.monday.com/v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CreateItem($boardId: ID!, $itemName: String!, $groupId: String) {
            create_item(
              board_id: $boardId
              item_name: $itemName
              group_id: $groupId
            ) {
              id
              name
              created_at
              board {
                id
                name
              }
              group {
                id
                title
              }
            }
          }
        `,
        variables: {
          boardId: field({
            name: 'boardId',
            description: 'the board ID to create the item in',
            placeholder: true,
          }),
          itemName: field({
            name: 'itemName',
            description: 'the name of the item',
          }),
          groupId: field({
            name: 'groupId',
            description: 'the group ID to add the item to',
            optional: true,
            placeholder: true,
          }),
        },
      },
    },
  }),

  'monday/item/update': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Update Item',
    description: 'Update the name of an existing item in Monday.com',
    tags: ['monday', 'item', 'update', 'project-management'],
    secret: '@monday',
    instruction: {
      method: 'POST',
      url: 'https://api.monday.com/v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation ChangeItemName($boardId: ID!, $itemId: ID!, $value: String!) {
            change_simple_column_value(
              board_id: $boardId
              item_id: $itemId
              column_id: "name"
              value: $value
            ) {
              id
              name
            }
          }
        `,
        variables: {
          boardId: field({
            name: 'boardId',
            description: 'the board ID',
            placeholder: true,
          }),
          itemId: field({
            name: 'itemId',
            description: 'the item ID to update',
            placeholder: true,
          }),
          value: field({
            name: 'itemName',
            description: 'the new name for the item',
          }),
        },
      },
    },
  }),

  'monday/item/list': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'List Board Items',
    description: 'Retrieve all items from a specific board in Monday.com',
    tags: ['monday', 'item', 'list', 'project-management'],
    secret: '@monday',
    instruction: {
      method: 'POST',
      url: 'https://api.monday.com/v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query GetBoardItems($boardId: [ID!]!, $limit: Int) {
            boards(ids: $boardId) {
              id
              name
              items_page(limit: $limit) {
                cursor
                items {
                  id
                  name
                  created_at
                  updated_at
                  group {
                    id
                    title
                  }
                }
              }
            }
          }
        `,
        variables: {
          boardId: field({
            name: 'boardId',
            description: 'the board ID to list items from',
            placeholder: true,
          }),
          limit: field({
            name: 'limit',
            type: 'number',
            description: 'maximum number of items to return',
            optional: true,
            default: 25,
          }),
        },
      },
    },
  }),

  'monday/update/create': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Create Update',
    description: 'Add a text update or comment to an item in Monday.com',
    tags: ['monday', 'update', 'create', 'comment', 'project-management'],
    secret: '@monday',
    instruction: {
      method: 'POST',
      url: 'https://api.monday.com/v2',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CreateUpdate($itemId: ID!, $body: String!) {
            create_update(
              item_id: $itemId
              body: $body
            ) {
              id
              body
              created_at
              creator {
                id
                name
              }
            }
          }
        `,
        variables: {
          itemId: field({
            name: 'itemId',
            description: 'the item ID to add the update to',
            placeholder: true,
          }),
          body: field({
            name: 'body',
            description: 'the text content of the update',
          }),
        },
      },
    },
  }),

  'monday/api/call': createFetchTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Call Monday API',
    description:
      'Make a generic API call to Monday. This is a flexible template that can be used to call any Monday API endpoint by specifying the method, URL, and request body.',
    tags: ['monday', 'api', 'call', 'generic'],
    secret: '@monday',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Monday API endpoint to call',
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

  'pack/monday': createPackTemplate({
    provider: 'monday',
    icon: '@logo/monday.com',
    name: 'Install Monday.com Tools',
    description:
      'Installs Monday.com tools into the conversation for managing boards, items, and updates.',
    tags: ['monday', 'project-management', 'collaboration', 'productivity'],
    secret: '@monday',
    instruction: {
      abilities: [
        'monday/board/create',
        'monday/item/create',
        'monday/item/update',
        'monday/item/list',
        'monday/update/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
