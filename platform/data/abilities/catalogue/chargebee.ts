import { createFetchTemplate, field, secret } from '@/lib/ability.template'

// @see https://apidocs.chargebee.com/docs/api

const abilities = {
  'chargebee/customer/create': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Create Chargebee Customer',
    description:
      'Create a new customer in Chargebee with contact information and billing details',
    tags: ['chargebee', 'customer', 'create', 'billing'],
    secret: '@chargebee',
    instruction: {
      method: 'POST',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: ['/api/v2/customers'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        id: field({
          name: 'customerId',
          description: 'unique customer ID (auto-generated if not provided)',
          optional: true,
        }),
        first_name: field({
          name: 'firstName',
          description: "customer's first name",
          optional: true,
        }),
        last_name: field({
          name: 'lastName',
          description: "customer's last name",
          optional: true,
        }),
        email: field({
          name: 'email',
          description: "customer's email address",
          optional: true,
        }),
        phone: field({
          name: 'phone',
          description: "customer's phone number",
          optional: true,
        }),
        company: field({
          name: 'company',
          description: "customer's company name",
          optional: true,
        }),
      },
    },
  }),

  'chargebee/customer/list': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'List Chargebee Customers',
    description:
      'Retrieve a list of customers from Chargebee with optional filtering',
    tags: ['chargebee', 'customer', 'list', 'search'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: ['/api/v2/customers'],
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of customers to return (max 100)',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'chargebee/customer/fetch': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Get Chargebee Customer',
    description: 'Retrieve details of a specific customer by their ID',
    tags: ['chargebee', 'customer', 'get', 'details'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/customers/',
        field({ name: 'customerId', description: 'the Chargebee customer ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'chargebee/subscription/create': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Create Chargebee Subscription',
    description:
      'Create a new subscription for an existing customer with plan and pricing details',
    tags: ['chargebee', 'subscription', 'create', 'billing'],
    secret: '@chargebee',
    instruction: {
      method: 'POST',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/customers/',
        field({
          name: 'customerId',
          description: 'the customer ID to create subscription for',
        }),
        '/subscription_for_items',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subscription_items: [
          {
            item_price_id: field({
              name: 'itemPriceId',
              description: 'the unique identifier of the plan item price',
            }),
            unit_price: field({
              name: 'unitPrice',
              type: 'number',
              description: 'the unit price of the plan item in cents',
            }),
            quantity: field({
              name: 'quantity',
              type: 'number',
              description: 'the quantity of the plan item',
            }),
          },
        ],
      },
    },
  }),

  'chargebee/subscription/list': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'List Chargebee Subscriptions',
    description:
      'Retrieve a list of subscriptions from Chargebee with optional filtering',
    tags: ['chargebee', 'subscription', 'list', 'billing'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: ['/api/v2/subscriptions'],
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of subscriptions to return (max 100)',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'chargebee/subscription/fetch': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Get Chargebee Subscription',
    description: 'Retrieve details of a specific subscription by its ID',
    tags: ['chargebee', 'subscription', 'get', 'details'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'the Chargebee subscription ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'chargebee/invoice/list': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'List Chargebee Invoices',
    description:
      'Retrieve a list of invoices from Chargebee with optional filtering',
    tags: ['chargebee', 'invoice', 'list', 'billing'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: ['/api/v2/invoices'],
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of invoices to return (max 100)',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'chargebee/invoice/fetch': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Get Chargebee Invoice',
    description: 'Retrieve details of a specific invoice by its ID',
    tags: ['chargebee', 'invoice', 'get', 'details'],
    secret: '@chargebee',
    instruction: {
      method: 'GET',
      url: field({
        name: 'siteUrl',
        description:
          'your Chargebee site URL (e.g., https://yoursite.chargebee.com)',
        placeholder: true,
      }),
      path: [
        '/api/v2/invoices/',
        field({ name: 'invoiceId', description: 'the Chargebee invoice ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'chargebee/api/call': createFetchTemplate({
    provider: 'chargebee',
    icon: '@logo/chargebee.com',
    name: 'Call Chargebee API',
    description:
      'Make a generic API call to Chargebee. This is a flexible template that can be used to call any Chargebee API endpoint by specifying the method, URL, and request body.',
    tags: ['chargebee', 'api', 'call', 'generic'],
    secret: '@chargebee',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Chargebee API endpoint to call',
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
