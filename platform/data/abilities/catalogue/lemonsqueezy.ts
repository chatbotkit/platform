import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'lemonsqueezy/customer/list': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'List Lemon Squeezy Customers',
    description:
      'Retrieve a paginated list of customers from your Lemon Squeezy store',
    tags: ['lemonsqueezy', 'customer', 'list', 'ecommerce'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com/v1/customers',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
      query: {
        'page[number]': field({
          name: 'pageNumber',
          type: 'number',
          description: 'page number to retrieve',
          optional: true,
          default: 1,
        }),
        'page[size]': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of customers per page',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'lemonsqueezy/customer/get': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Get Lemon Squeezy Customer',
    description:
      'Retrieve detailed information about a specific customer by their ID',
    tags: ['lemonsqueezy', 'customer', 'get', 'details'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com',
      path: [
        '/v1/customers/',
        field({
          name: 'customerId',
          description: 'the unique customer ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
    },
  }),

  'lemonsqueezy/order/list': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'List Lemon Squeezy Orders',
    description:
      'Retrieve a paginated list of orders from your Lemon Squeezy store',
    tags: ['lemonsqueezy', 'order', 'list', 'ecommerce'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com/v1/orders',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
      query: {
        'page[number]': field({
          name: 'pageNumber',
          type: 'number',
          description: 'page number to retrieve',
          optional: true,
          default: 1,
        }),
        'page[size]': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of orders per page',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'lemonsqueezy/order/get': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Get Lemon Squeezy Order',
    description:
      'Retrieve detailed information about a specific order including customer details and line items',
    tags: ['lemonsqueezy', 'order', 'get', 'details'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com',
      path: [
        '/v1/orders/',
        field({
          name: 'orderId',
          description: 'the unique order ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
    },
  }),

  'lemonsqueezy/product/list': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'List Lemon Squeezy Products',
    description:
      'Retrieve a paginated list of products from your Lemon Squeezy store',
    tags: ['lemonsqueezy', 'product', 'list', 'ecommerce'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com/v1/products',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
      query: {
        'page[number]': field({
          name: 'pageNumber',
          type: 'number',
          description: 'page number to retrieve',
          optional: true,
          default: 1,
        }),
        'page[size]': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of products per page',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'lemonsqueezy/product/get': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Get Lemon Squeezy Product',
    description:
      'Retrieve detailed information about a specific product including pricing and variants',
    tags: ['lemonsqueezy', 'product', 'get', 'details'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com',
      path: [
        '/v1/products/',
        field({
          name: 'productId',
          description: 'the unique product ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
    },
  }),

  'lemonsqueezy/subscription/list': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'List Lemon Squeezy Subscriptions',
    description:
      'Retrieve a paginated list of subscriptions from your Lemon Squeezy store',
    tags: ['lemonsqueezy', 'subscription', 'list', 'recurring'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com/v1/subscriptions',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
      query: {
        'page[number]': field({
          name: 'pageNumber',
          type: 'number',
          description: 'page number to retrieve',
          optional: true,
          default: 1,
        }),
        'page[size]': field({
          name: 'pageSize',
          type: 'number',
          description: 'number of subscriptions per page',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'lemonsqueezy/subscription/get': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Get Lemon Squeezy Subscription',
    description:
      'Retrieve detailed information about a specific subscription including status and billing details',
    tags: ['lemonsqueezy', 'subscription', 'get', 'details'],
    secret: '@lemonsqueezy',
    instruction: {
      method: 'GET',
      url: 'https://api.lemonsqueezy.com',
      path: [
        '/v1/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'the unique subscription ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.api+json',
      },
    },
  }),

  'lemonsqueezy/api/call': createFetchTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Call Lemonsqueezy API',
    description:
      'Make a generic API call to Lemonsqueezy. This is a flexible template that can be used to call any Lemonsqueezy API endpoint by specifying the method, URL, and request body.',
    tags: ['lemonsqueezy', 'api', 'call', 'generic'],
    secret: '@lemonsqueezy',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Lemonsqueezy API endpoint to call',
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

  'pack/lemonsqueezy': createPackTemplate({
    provider: 'lemonsqueezy',
    icon: '@logo/lemonsqueezy.com',
    name: 'Install LemonSqueezy Tools',
    description:
      'Installs LemonSqueezy tools into the conversation. You can manage customers, orders, products, and subscriptions.',
    tags: ['lemonsqueezy', 'pack', 'beta'],
    secret: '@lemonsqueezy',
    instruction: {
      abilities: [
        'lemonsqueezy/customer/list',
        'lemonsqueezy/customer/get',
        'lemonsqueezy/order/list',
        'lemonsqueezy/order/get',
        'lemonsqueezy/product/list',
        'lemonsqueezy/product/get',
        'lemonsqueezy/subscription/list',
        'lemonsqueezy/subscription/get',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
