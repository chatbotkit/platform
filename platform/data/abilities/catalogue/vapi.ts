import {
  array,
  createFetchTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'vapi/outbound-call/create': createFetchTemplate({
    provider: 'vapi',
    icon: '@logo/vapi.ai',
    name: 'Create Vapi Outbound Call',
    description:
      'Create an outbound phone call to a single customer using a Vapi assistant and phone number.',
    tags: ['vapi', 'outbound', 'call', 'create', 'voice'],
    secret: '@vapi',
    instruction: {
      method: 'POST',
      url: 'https://api.vapi.ai',
      path: ['/call'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        assistantId: field({
          name: 'assistantId',
          description:
            'the saved Vapi assistant ID to use for the outbound call',
          placeholder: true,
        }),
        phoneNumberId: field({
          name: 'phoneNumberId',
          description: 'the Vapi phone number ID used as the caller number',
          placeholder: true,
        }),
        customer: object({
          name: 'customer',
          description: 'the single customer to call',
          shape: {
            number: field({
              name: 'customerNumber',
              description:
                'the destination phone number, ideally in E.164 format',
              placeholder: true,
            }),
            name: field({
              name: 'customerName',
              description: 'optional customer display name for reference',
              optional: true,
            }),
            email: field({
              name: 'customerEmail',
              description: 'optional customer email for reference',
              optional: true,
            }),
            externalId: field({
              name: 'customerExternalId',
              description: 'optional external customer identifier',
              optional: true,
            }),
          },
        }),
        schedulePlan: object({
          name: 'schedulePlan',
          description: 'optional scheduling window for delayed outbound calls',
          optional: true,
          shape: {
            earliestAt: field({
              name: 'earliestAt',
              description:
                'earliest ISO 8601 date-time when Vapi can place the call',
              optional: true,
            }),
            latestAt: field({
              name: 'latestAt',
              description:
                'latest ISO 8601 date-time when Vapi can place the call',
              optional: true,
            }),
          },
        }),
      },
    },
  }),

  'vapi/outbound-call/batch/create': createFetchTemplate({
    provider: 'vapi',
    icon: '@logo/vapi.ai',
    name: 'Create Vapi Batch Outbound Calls',
    description:
      'Create outbound phone calls to multiple customers in one Vapi API request.',
    tags: ['vapi', 'outbound', 'call', 'batch', 'create', 'voice'],
    secret: '@vapi',
    instruction: {
      method: 'POST',
      url: 'https://api.vapi.ai',
      path: ['/call'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        assistantId: field({
          name: 'assistantId',
          description:
            'the saved Vapi assistant ID to use for the outbound calls',
          placeholder: true,
        }),
        phoneNumberId: field({
          name: 'phoneNumberId',
          description: 'the Vapi phone number ID used as the caller number',
          placeholder: true,
        }),
        customers: array({
          name: 'customers',
          description: 'the list of customers to call in this batch',
          minItems: 1,
          items: object({
            shape: {
              number: field({
                name: 'batchCustomerNumber',
                description:
                  'destination phone number for each batch customer, ideally in E.164 format',
                placeholder: true,
              }),
              name: field({
                name: 'batchCustomerName',
                description: 'optional customer display name for reference',
                optional: true,
              }),
              email: field({
                name: 'batchCustomerEmail',
                description: 'optional customer email for reference',
                optional: true,
              }),
              externalId: field({
                name: 'batchCustomerExternalId',
                description: 'optional external customer identifier',
                optional: true,
              }),
            },
          }),
        }),
        schedulePlan: object({
          name: 'schedulePlan',
          description: 'optional scheduling window for delayed outbound calls',
          optional: true,
          shape: {
            earliestAt: field({
              name: 'earliestAt',
              description:
                'earliest ISO 8601 date-time when Vapi can place the calls',
              optional: true,
            }),
            latestAt: field({
              name: 'latestAt',
              description:
                'latest ISO 8601 date-time when Vapi can place the calls',
              optional: true,
            }),
          },
        }),
      },
    },
  }),

  'vapi/api/call': createFetchTemplate({
    provider: 'vapi',
    icon: '@logo/vapi.ai',
    name: 'Call Vapi API',
    description:
      'Make a generic API call to Vapi. This is a flexible template that can be used to call any Vapi API endpoint by specifying the method, URL, and request body.',
    tags: ['vapi', 'api', 'call', 'generic', 'voice'],
    secret: '@vapi',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Vapi API endpoint to call',
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
