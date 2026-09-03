import {
  array,
  createFetchTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of RevenueCat subscription management abilities.
 *
 * RevenueCat provides a unified API for in-app subscriptions, simplifying the complexities
 * of managing subscriptions across multiple platforms including iOS, Android, and web.
 *
 * @see https://docs.revenuecat.com/docs/api-reference
 */
const abilities = {
  // V1 API - Legacy but commonly used
  'revenuecat/customer/fetch': createFetchTemplate({
    provider: 'revenuecat',
    icon: '@logo/revenuecat.com',
    name: 'Get Customer Info',
    description:
      'Retrieve customer subscription status and entitlements using the legacy v1 API.',
    tags: ['revenuecat', 'customer', 'subscription'],
    secret: '@revenuecat',
    instruction: {
      method: 'GET',
      url: 'https://api.revenuecat.com',
      path: [
        '/v1/subscribers/',
        field({
          name: 'appUserId',
          description: 'The unique identifier for the user in your application',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  // V2 API - Create customer
  'revenuecat/customer/create': createFetchTemplate({
    provider: 'revenuecat',
    icon: '@logo/revenuecat.com',
    name: 'Create Customer',
    description:
      'Create a new customer within a specified project using the v2 API.',
    tags: ['revenuecat', 'customer'],
    secret: '@revenuecat',
    instruction: {
      method: 'POST',
      url: 'https://api.revenuecat.com',
      path: [
        '/v2/projects/',
        field({
          name: 'projectId',
          description: 'ID of the project (e.g., proj1ab2c3d4)',
        }),
        '/customers',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        id: field({
          name: 'customerId',
          description: 'Unique customer ID (UUID format recommended)',
        }),
        attributes: array({
          items: field({
            name: 'attribute',
            description: 'Customer attribute',
          }),
          name: 'attributes',
          description: 'Array of customer attributes',
        }),
      },
    },
  }),

  // V2 API - List customer subscriptions
  'revenuecat/subscription/list': createFetchTemplate({
    provider: 'revenuecat',
    icon: '@logo/revenuecat.com',
    name: 'List Customer Subscriptions',
    description:
      'Retrieve a list of subscriptions associated with a specific customer using the v2 API.',
    tags: ['revenuecat', 'subscription'],
    secret: '@revenuecat',
    instruction: {
      method: 'GET',
      url: 'https://api.revenuecat.com',
      path: [
        '/v2/projects/',
        field({
          name: 'projectId',
          description: 'ID of the project (e.g., proj1ab2c3d4)',
        }),
        '/customers/',
        field({ name: 'customerId', description: 'ID of the customer' }),
        '/subscriptions',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        environment: field({
          name: 'environment',
          description: 'Filter by environment',
          optional: true,
          enum: ['sandbox', 'production'],
        }),
        limit: field({
          name: 'limit',
          description:
            'Maximum number of subscriptions to return (default: 20)',
          type: 'number',
          optional: true,
          default: 20,
        }),
        starting_after: field({
          name: 'startingAfter',
          description:
            'Returns subscriptions created after a specific subscription ID',
          optional: true,
        }),
      },
    },
  }),

  // V2 API - Get specific subscription details
  'revenuecat/subscription/fetch': createFetchTemplate({
    provider: 'revenuecat',
    icon: '@logo/revenuecat.com',
    name: 'Get Subscription Details',
    description:
      'Retrieve detailed information about a specific subscription using the v2 API.',
    tags: ['revenuecat', 'subscription'],
    secret: '@revenuecat',
    instruction: {
      method: 'GET',
      url: 'https://api.revenuecat.com',
      path: [
        '/v2/projects/',
        field({
          name: 'projectId',
          description: 'ID of the project (e.g., proj1ab2c3d4)',
        }),
        '/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'ID of the subscription (e.g., sub1a2b3c4d5e)',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
    },
  }),

  'revenuecat/api/call': createFetchTemplate({
    provider: 'revenuecat',
    icon: '@logo/revenuecat.com',
    name: 'Call Revenuecat API',
    description:
      'Make a generic API call to Revenuecat. This is a flexible template that can be used to call any Revenuecat API endpoint by specifying the method, URL, and request body.',
    tags: ['revenuecat', 'api', 'call', 'generic'],
    secret: '@revenuecat',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Revenuecat API endpoint to call',
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
