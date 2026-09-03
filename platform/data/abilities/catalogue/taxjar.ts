import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'taxjar/tax/calculate': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'Calculate Sales Tax',
    description:
      'Calculate the sales tax that should be collected for a given order',
    tags: ['taxjar', 'tax', 'calculate', 'sales'],
    secret: '@taxjar',
    instruction: {
      method: 'POST',
      url: 'https://api.taxjar.com',
      path: ['/v2/taxes'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        from_country: field({
          name: 'fromCountry',
          description: 'Two-letter ISO country code where order shipped from',
          optional: true,
        }),
        from_zip: field({
          name: 'fromZip',
          description: 'Postal code where order shipped from',
          optional: true,
        }),
        from_state: field({
          name: 'fromState',
          description: 'Two-letter ISO state code where order shipped from',
          optional: true,
        }),
        from_city: field({
          name: 'fromCity',
          description: 'City where order shipped from',
          optional: true,
        }),
        from_street: field({
          name: 'fromStreet',
          description: 'Street address where order shipped from',
          optional: true,
        }),
        to_country: field({
          name: 'toCountry',
          description: 'Two-letter ISO country code where order shipped to',
        }),
        to_zip: field({
          name: 'toZip',
          description: 'Postal code where order shipped to',
        }),
        to_state: field({
          name: 'toState',
          description: 'Two-letter ISO state code where order shipped to',
        }),
        to_city: field({
          name: 'toCity',
          description: 'City where order shipped to',
          optional: true,
        }),
        to_street: field({
          name: 'toStreet',
          description: 'Street address where order shipped to',
          optional: true,
        }),
        amount: field({
          name: 'amount',
          type: 'number',
          description: 'Total amount of the order, excluding shipping',
        }),
        shipping: field({
          name: 'shipping',
          type: 'number',
          description: 'Total amount of shipping for the order',
        }),
        exemption_type: field({
          name: 'exemptionType',
          description: 'Type of exemption for the customer',
          optional: true,
        }),
      },
    },
  }),

  'taxjar/address/validate': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'Validate Address',
    description:
      'Validate a customer address and receive the standardized form',
    tags: ['taxjar', 'address', 'validate', 'verification'],
    secret: '@taxjar',
    instruction: {
      method: 'POST',
      url: 'https://api.taxjar.com',
      path: ['/v2/addresses/validate'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        country: field({
          name: 'country',
          description: 'Two-letter ISO country code',
          optional: true,
        }),
        state: field({
          name: 'state',
          description: 'Two-letter ISO state code',
          optional: true,
        }),
        zip: field({
          name: 'zip',
          description: 'Postal code',
        }),
        city: field({
          name: 'city',
          description: 'City name',
          optional: true,
        }),
        street: field({
          name: 'street',
          description: 'Street address',
          optional: true,
        }),
      },
    },
  }),

  'taxjar/customer/create': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'Create Customer',
    description: 'Create a new customer in TaxJar for exemption management',
    tags: ['taxjar', 'customer', 'create', 'exemption'],
    secret: '@taxjar',
    instruction: {
      method: 'POST',
      url: 'https://api.taxjar.com',
      path: ['/v2/customers'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        customer_id: field({
          name: 'customerId',
          description: 'Unique identifier for the customer',
        }),
        exemption_type: field({
          name: 'exemptionType',
          description: 'Type of tax exemption',
        }),
        name: field({
          name: 'name',
          description: 'Name of the customer',
        }),
        country: field({
          name: 'country',
          description: 'Two-letter ISO country code',
          optional: true,
        }),
        state: field({
          name: 'state',
          description: 'Two-letter ISO state code',
          optional: true,
        }),
        zip: field({
          name: 'zip',
          description: 'Postal code',
          optional: true,
        }),
        city: field({
          name: 'city',
          description: 'City name',
          optional: true,
        }),
        street: field({
          name: 'street',
          description: 'Street address',
          optional: true,
        }),
      },
    },
  }),

  'taxjar/rate/fetch': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'Get Tax Rate',
    description: 'Get the sales tax rate for a specific location',
    tags: ['taxjar', 'rate', 'fetch', 'location'],
    secret: '@taxjar',
    instruction: {
      method: 'GET',
      url: 'https://api.taxjar.com',
      path: ['/v2/rates/', field({ name: 'zip', description: 'Postal code' })],
      headers: {
        Authorization: secret(),
      },
      query: {
        country: field({
          name: 'country',
          description: 'Two-letter ISO country code',
          optional: true,
        }),
        state: field({
          name: 'state',
          description: 'Two-letter ISO state code',
          optional: true,
        }),
        city: field({
          name: 'city',
          description: 'City name',
          optional: true,
        }),
        street: field({
          name: 'street',
          description: 'Street address',
          optional: true,
        }),
      },
    },
  }),

  'taxjar/category/list': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'List Product Categories',
    description:
      'List all product tax categories available in TaxJar for accurate tax calculations',
    tags: ['taxjar', 'category', 'list', 'product'],
    secret: '@taxjar',
    instruction: {
      method: 'GET',
      url: 'https://api.taxjar.com',
      path: ['/v2/categories'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'taxjar/api/call': createFetchTemplate({
    provider: 'taxjar',
    icon: '@logo/taxjar.com',
    name: 'Call Taxjar API',
    description:
      'Make a generic API call to Taxjar. This is a flexible template that can be used to call any Taxjar API endpoint by specifying the method, URL, and request body.',
    tags: ['taxjar', 'api', 'call', 'generic'],
    secret: '@taxjar',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Taxjar API endpoint to call',
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
