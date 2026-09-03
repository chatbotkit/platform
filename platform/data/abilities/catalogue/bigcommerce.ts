import {
  createFetchTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'bigcommerce/customer/create': createFetchTemplate({
    provider: 'bigcommerce',
    icon: '@logo/bigcommerce.com',
    name: 'Create BigCommerce Customer',
    description: 'Create a new customer in BigCommerce',
    tags: ['bigcommerce', 'customer', 'create'],
    secret: '@bigcommerce',
    instruction: {
      method: 'POST',
      url: 'https://api.bigcommerce.com/stores/',
      path: [
        field({
          name: 'store hash',
          description: 'store hash',
          placeholder: true,
        }),
        '/v3/customers',
      ],
      headers: {
        'X-Auth-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        first_name: field({
          name: 'first_name',
          description: 'First name',
        }),
        last_name: field({
          name: 'last_name',
          description: 'Last name',
        }),
        email: field({
          name: 'email',
          description: 'Email',
        }),
        phone: field({
          name: 'phone',
          description: 'Phone',
        }),
        addresses: [
          object({
            shape: {
              address1: field({
                name: 'address1',
                description: 'Address line 1',
              }),
              city: field({
                name: 'city',
                description: 'City',
              }),
              state_or_province: field({
                name: 'state',
                description: 'State',
              }),
              postal_code: field({
                name: 'postal_code',
                description: 'Postal code',
              }),
              country_code: field({
                name: 'country_code',
                description: 'Country code',
              }),
            },
          }),
        ],
      },
    },
  }),

  'bigcommerce/order/details': createFetchTemplate({
    provider: 'bigcommerce',
    icon: '@logo/bigcommerce.com',
    name: 'Retrieve BigCommerce Order Details',
    description: 'Retrieve details of a specific order in BigCommerce',
    tags: ['bigcommerce', 'order', 'details'],
    secret: '@bigcommerce',
    instruction: {
      method: 'GET',
      url: 'https://api.bigcommerce.com/stores/',
      path: [
        field({
          name: 'store hash',
          description: 'store hash',
          placeholder: true,
        }),
        '/v2/orders/',
        field({
          name: 'order_id',
          description: 'Order ID',
        }),
      ],
      headers: {
        'X-Auth-Token': secret(),
      },
    },
  }),

  'bigcommerce/api/call': createFetchTemplate({
    provider: 'bigcommerce',
    icon: '@logo/bigcommerce.com',
    name: 'Call Bigcommerce API',
    description:
      'Make a generic API call to Bigcommerce. This is a flexible template that can be used to call any Bigcommerce API endpoint by specifying the method, URL, and request body.',
    tags: ['bigcommerce', 'api', 'call', 'generic'],
    secret: '@bigcommerce',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Bigcommerce API endpoint to call',
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
