import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'raindrop/bookmark/create': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Save Bookmark',
    description:
      'Save a link as a bookmark to a Raindrop.io collection with optional tags and description',
    tags: ['raindrop', 'bookmark', 'save'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'POST',
      url: 'https://api.raindrop.io',
      path: ['/rest/v1/raindrop'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        link: field({
          name: 'url',
          description: 'the URL to bookmark',
        }),
        title: field({
          name: 'title',
          description: 'title for the bookmark',
          optional: true,
        }),
        excerpt: field({
          name: 'description',
          description: 'description or notes for the bookmark',
          optional: true,
        }),
        tags: field({
          name: 'tags',
          description: 'comma-separated list of tags',
          optional: true,
        }),
        collection: {
          $id: field({
            name: 'collectionId',
            type: 'number',
            description:
              'collection ID (0 for All, -1 for Unsorted, or specific collection ID)',
            optional: true,
            default: -1,
          }),
        },
      },
    },
  }),

  'raindrop/bookmark/list': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'List Bookmarks',
    description:
      'Retrieve bookmarks from a specific collection with optional search and sorting',
    tags: ['raindrop', 'bookmark', 'list', 'search'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'GET',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/raindrops/',
        field({
          name: 'collectionId',
          type: 'number',
          description:
            'collection ID (0 for All bookmarks, -1 for Unsorted, or specific collection ID)',
          placeholder: true,
          default: 0,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        search: field({
          name: 'searchQuery',
          description: 'search query to filter bookmarks',
          optional: true,
        }),
        sort: field({
          name: 'sort',
          description: 'sort order',
          optional: true,
          enum: ['-created', 'created', '-title', 'title', '-domain', 'domain'],
          default: '-created',
        }),
        perpage: field({
          name: 'limit',
          type: 'number',
          description: 'number of bookmarks to return (max 50)',
          optional: true,
          default: 20,
        }),
      },
    },
  }),

  'raindrop/bookmark/fetch': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Get Bookmark',
    description: 'Retrieve details of a specific bookmark by ID',
    tags: ['raindrop', 'bookmark', 'get'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'GET',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/raindrop/',
        field({
          name: 'bookmarkId',
          description: 'the bookmark ID to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'raindrop/bookmark/update': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Update Bookmark',
    description:
      'Update an existing bookmark with new title, description, tags, or collection',
    tags: ['raindrop', 'bookmark', 'update'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'PUT',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/raindrop/',
        field({
          name: 'bookmarkId',
          description: 'the bookmark ID to update',
          placeholder: true,
        }),
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'new title for the bookmark',
          optional: true,
        }),
        excerpt: field({
          name: 'description',
          description: 'new description for the bookmark',
          optional: true,
        }),
        tags: field({
          name: 'tags',
          description: 'new comma-separated list of tags',
          optional: true,
        }),
      },
    },
  }),

  'raindrop/bookmark/delete': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Delete Bookmark',
    description: 'Delete a bookmark from Raindrop.io permanently',
    tags: ['raindrop', 'bookmark', 'delete'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'DELETE',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/raindrop/',
        field({
          name: 'bookmarkId',
          description: 'the bookmark ID to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'raindrop/collection/create': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Create Collection',
    description:
      'Create a new collection to organize bookmarks with optional parent collection',
    tags: ['raindrop', 'collection', 'create'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'POST',
      url: 'https://api.raindrop.io',
      path: ['/rest/v1/collection'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'name of the collection',
          placeholder: true,
        }),
        view: field({
          name: 'view',
          description: 'view style for the collection',
          optional: true,
          enum: ['list', 'simple', 'grid', 'masonry'],
          default: 'list',
        }),
        public: field({
          name: 'public',
          type: 'boolean',
          description:
            'whether the collection is publicly accessible without authentication',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'raindrop/collection/list': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'List Collections',
    description: 'Retrieve all bookmark collections from Raindrop.io account',
    tags: ['raindrop', 'collection', 'list'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'GET',
      url: 'https://api.raindrop.io',
      path: ['/rest/v1/collections'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'raindrop/collection/fetch': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Get Collection',
    description: 'Retrieve details of a specific collection by ID',
    tags: ['raindrop', 'collection', 'get'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'GET',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/collection/',
        field({
          name: 'collectionId',
          description: 'the collection ID to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'raindrop/collection/update': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Update Collection',
    description:
      'Update an existing collection with new title, view style, or visibility',
    tags: ['raindrop', 'collection', 'update'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'PUT',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/collection/',
        field({
          name: 'collectionId',
          description: 'the collection ID to update',
          placeholder: true,
        }),
      ],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'new name for the collection',
          optional: true,
        }),
        view: field({
          name: 'view',
          description: 'new view style',
          optional: true,
          enum: ['list', 'simple', 'grid', 'masonry'],
        }),
      },
    },
  }),

  'raindrop/collection/delete': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Delete Collection',
    description: 'Delete a collection and optionally move its bookmarks',
    tags: ['raindrop', 'collection', 'delete'],
    secret: '@platform/raindrop',
    instruction: {
      method: 'DELETE',
      url: 'https://api.raindrop.io',
      path: [
        '/rest/v1/collection/',
        field({
          name: 'collectionId',
          description: 'the collection ID to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'raindrop/api/call': createFetchTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Call Raindrop API',
    description:
      'Make a generic API call to Raindrop. This is a flexible template that can be used to call any Raindrop API endpoint by specifying the method, URL, and request body.',
    tags: ['raindrop', 'api', 'call', 'generic'],
    secret: '@platform/raindrop',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Raindrop API endpoint to call',
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

  'pack/raindrop': createPackTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Install Raindrop Tools',
    description:
      'Installs Raindrop tools into the conversation. You can manage bookmarks and collections.',
    tags: ['raindrop', 'pack', 'beta'],
    secret: '@platform/raindrop',
    instruction: {
      abilities: [
        'raindrop/bookmark/create',
        'raindrop/bookmark/list',
        'raindrop/bookmark/fetch',
        'raindrop/bookmark/update',
        'raindrop/bookmark/delete',
        'raindrop/collection/create',
        'raindrop/collection/list',
        'raindrop/collection/fetch',
        'raindrop/collection/update',
        'raindrop/collection/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/raindrop[read-only]': createPackTemplate({
    provider: 'raindrop',
    icon: '@logo/raindrop.io',
    name: 'Install Raindrop Search Tools',
    description:
      'Installs read-only Raindrop tools into the conversation. You can list and fetch bookmarks and collections without modification.',
    tags: ['raindrop', 'pack', 'beta'],
    secret: '@platform/raindrop',
    instruction: {
      abilities: [
        'raindrop/bookmark/list',
        'raindrop/bookmark/fetch',
        'raindrop/collection/list',
        'raindrop/collection/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
