import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'gumroad/product/list': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'List Gumroad Products',
    description: 'Retrieve the list of products from your Gumroad account',
    tags: ['gumroad', 'product', 'list', 'ecommerce'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com/v2/products',
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'gumroad/product/get': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Get Gumroad Product',
    description:
      'Retrieve detailed information about a specific product by its ID',
    tags: ['gumroad', 'product', 'get', 'details'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com',
      path: [
        '/v2/products/',
        field({
          name: 'productId',
          description: 'the unique product ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'gumroad/sale/list': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'List Gumroad Sales',
    description:
      'Retrieve a paginated list of successful sales from your Gumroad account, optionally filtered by product, email, or date range',
    tags: ['gumroad', 'sale', 'list', 'ecommerce'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com/v2/sales',
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
      query: {
        after: field({
          name: 'after',
          description: 'only return sales after this date (YYYY-MM-DD)',
          optional: true,
        }),
        before: field({
          name: 'before',
          description: 'only return sales before this date (YYYY-MM-DD)',
          optional: true,
        }),
        product_id: field({
          name: 'productId',
          description: 'only return sales for this product ID',
          optional: true,
        }),
        email: field({
          name: 'email',
          description: 'only return sales for this buyer email',
          optional: true,
        }),
        page_key: field({
          name: 'pageKey',
          description: 'the pagination key returned by a previous response',
          optional: true,
        }),
      },
    },
  }),

  'gumroad/sale/get': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Get Gumroad Sale',
    description:
      'Retrieve detailed information about a specific sale by its ID',
    tags: ['gumroad', 'sale', 'get', 'details'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com',
      path: [
        '/v2/sales/',
        field({
          name: 'saleId',
          description: 'the unique sale ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'gumroad/subscriber/list': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'List Gumroad Subscribers',
    description:
      'Retrieve the list of subscribers for a specific product from your Gumroad account',
    tags: ['gumroad', 'subscriber', 'list', 'recurring'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com',
      path: [
        '/v2/products/',
        field({
          name: 'productId',
          description: 'the unique product ID to list subscribers for',
        }),
        '/subscribers',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
      query: {
        email: field({
          name: 'email',
          description: 'only return subscribers with this email',
          optional: true,
        }),
      },
    },
  }),

  'gumroad/subscriber/get': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Get Gumroad Subscriber',
    description:
      'Retrieve detailed information about a specific subscriber by their ID',
    tags: ['gumroad', 'subscriber', 'get', 'details'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com',
      path: [
        '/v2/subscribers/',
        field({
          name: 'subscriberId',
          description: 'the unique subscriber ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'gumroad/user/get': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Get Gumroad User',
    description:
      'Retrieve the data of the authenticated Gumroad user, including profile and account details',
    tags: ['gumroad', 'user', 'get', 'account'],
    secret: '@gumroad',
    instruction: {
      method: 'GET',
      url: 'https://api.gumroad.com/v2/user',
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'gumroad/api/call': createFetchTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Call Gumroad API',
    description:
      'Make a generic API call to Gumroad. This is a flexible template that can be used to call any Gumroad API endpoint by specifying the method, URL, and request body.',
    tags: ['gumroad', 'api', 'call', 'generic'],
    secret: '@gumroad',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Gumroad API endpoint to call',
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

  'pack/gumroad': createPackTemplate({
    provider: 'gumroad',
    icon: '@logo/gumroad.com',
    name: 'Install Gumroad Tools',
    description:
      'Installs Gumroad tools into the conversation. You can manage products, sales, subscribers, and account details.',
    tags: ['gumroad', 'pack', 'beta'],
    secret: '@gumroad',
    instruction: {
      abilities: [
        'gumroad/product/list',
        'gumroad/product/get',
        'gumroad/sale/list',
        'gumroad/sale/get',
        'gumroad/subscriber/list',
        'gumroad/subscriber/get',
        'gumroad/user/get',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
