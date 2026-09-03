import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Productboard abilities.
 */
const abilities = {
  'productboard/feature/create': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Create Feature',
    description:
      'Create a new feature in Productboard with name, description, and parent context',
    tags: ['productboard', 'feature', 'create', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'POST',
      url: 'https://api.productboard.com/features',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Version': '1',
      },
      body: {
        data: {
          name: field({
            name: 'name',
            description: 'the name of the feature',
          }),
          description: field({
            name: 'description',
            description:
              'the description of the feature in HTML format (e.g., <p>Feature description</p>)',
            optional: true,
          }),
          status: {
            id: field({
              name: 'statusId',
              description: 'the ID of the feature status',
              optional: true,
            }),
          },
          parent: {
            product: {
              id: field({
                name: 'productId',
                description: 'the ID of the parent product',
                optional: true,
              }),
            },
          },
        },
      },
    },
  }),

  'productboard/feature/list': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'List Features',
    description:
      'List all features in Productboard with optional filtering by status or parent',
    tags: ['productboard', 'feature', 'list', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'GET',
      url: 'https://api.productboard.com/features',
      headers: {
        Authorization: secret(),
        'X-Version': '1',
      },
      query: {
        'status.id': field({
          name: 'statusId',
          description: 'filter by feature status ID',
          optional: true,
        }),
        'parent.id': field({
          name: 'parentId',
          description: 'filter by parent feature, component, or product ID',
          optional: true,
        }),
      },
    },
  }),

  'productboard/feature/fetch': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Fetch Feature',
    description: 'Retrieve detailed information about a specific feature by ID',
    tags: ['productboard', 'feature', 'get', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'GET',
      url: 'https://api.productboard.com',
      path: [
        '/features/',
        field({ name: 'featureId', description: 'the feature ID' }),
      ],
      headers: {
        Authorization: secret(),
        'X-Version': '1',
      },
    },
  }),

  'productboard/feature/update': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Update Feature',
    description: 'Update an existing feature with new information',
    tags: ['productboard', 'feature', 'update', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'PATCH',
      url: 'https://api.productboard.com',
      path: [
        '/features/',
        field({ name: 'featureId', description: 'the feature ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Version': '1',
      },
      body: {
        data: {
          name: field({
            name: 'name',
            description: 'the updated name of the feature',
            optional: true,
          }),
          description: field({
            name: 'description',
            description:
              'the updated description in HTML format (e.g., <p>Updated description</p>)',
            optional: true,
          }),
          status: {
            id: field({
              name: 'statusId',
              description: 'the updated status ID',
              optional: true,
            }),
          },
        },
      },
    },
  }),

  'productboard/note/create': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Create Note',
    description:
      'Create a new note in Productboard to capture user feedback and insights',
    tags: ['productboard', 'note', 'create', 'feedback', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'POST',
      url: 'https://api.productboard.com/notes',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Version': '1',
      },
      body: {
        data: {
          title: field({
            name: 'title',
            description: 'the title of the note',
          }),
          content: field({
            name: 'content',
            description:
              'the content of the note in HTML format (e.g., <p>Note content</p>)',
          }),
          customer: {
            name: field({
              name: 'customerName',
              description: 'the name of the customer providing feedback',
              optional: true,
            }),
            email: field({
              name: 'customerEmail',
              description: 'the email of the customer',
              optional: true,
            }),
          },
        },
      },
    },
  }),

  'productboard/product/list': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'List Products',
    description: 'List all products in Productboard',
    tags: ['productboard', 'product', 'list', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'GET',
      url: 'https://api.productboard.com/products',
      headers: {
        Authorization: secret(),
        'X-Version': '1',
      },
    },
  }),

  'productboard/component/list': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'List Components',
    description: 'List all components in Productboard',
    tags: ['productboard', 'component', 'list', 'product-management'],
    secret: '@productboard',
    instruction: {
      method: 'GET',
      url: 'https://api.productboard.com/components',
      headers: {
        Authorization: secret(),
        'X-Version': '1',
      },
    },
  }),

  'productboard/api/call': createFetchTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Call Productboard API',
    description:
      'Make a generic API call to Productboard. This is a flexible template that can be used to call any Productboard API endpoint by specifying the method, URL, and request body.',
    tags: ['productboard', 'api', 'call', 'generic'],
    secret: '@productboard',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Productboard API endpoint to call',
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

  'pack/productboard': createPackTemplate({
    provider: 'productboard',
    icon: '@logo/productboard.com',
    name: 'Install Productboard Tools',
    description:
      'Installs Productboard tools into the conversation for product management: features, notes, products, and components.',
    tags: ['productboard', 'pack', 'product-management'],
    secret: '@productboard',
    instruction: {
      abilities: [
        'productboard/feature/create',
        'productboard/feature/list',
        'productboard/feature/fetch',
        'productboard/feature/update',
        'productboard/note/create',
        'productboard/product/list',
        'productboard/component/list',
      ],
    },
  }),
}

export default abilities
