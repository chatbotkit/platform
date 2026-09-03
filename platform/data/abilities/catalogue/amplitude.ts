import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'amplitude/event/track': createFetchTemplate({
    provider: 'amplitude',
    icon: '@logo/amplitude.com',
    name: 'Track Event in Amplitude',
    description:
      'Send user event data to Amplitude for product analytics and behavioral tracking',
    tags: ['amplitude', 'analytics', 'event', 'tracking'],
    secret: '@amplitude',
    instruction: {
      method: 'POST',
      url: 'https://api2.amplitude.com',
      path: ['/2/httpapi'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        api_key: secret(),
        events: [
          {
            user_id: field({
              name: 'userId',
              description: 'unique identifier for the user',
            }),
            event_type: field({
              name: 'eventType',
              description: 'the type of event being tracked',
            }),
            time: field({
              name: 'timestamp',
              type: 'number',
              description:
                'the time the event occurred in milliseconds since epoch',
              optional: true,
            }),
            event_properties: field({
              name: 'eventProperties',
              description:
                'additional data to be sent along with the event as a JSON object',
              optional: true,
            }),
            user_properties: field({
              name: 'userProperties',
              description: 'additional data tied to the user as a JSON object',
              optional: true,
            }),
            device_id: field({
              name: 'deviceId',
              description: 'unique identifier for the device',
              optional: true,
            }),
            session_id: field({
              name: 'sessionId',
              type: 'number',
              description: 'unique identifier for the session',
              optional: true,
            }),
            insert_id: field({
              name: 'insertId',
              description: 'unique identifier for deduplication',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  'amplitude/user/identify': createFetchTemplate({
    provider: 'amplitude',
    icon: '@logo/amplitude.com',
    name: 'Identify User in Amplitude',
    description:
      'Update user properties in Amplitude to enrich user profiles with additional attributes',
    tags: ['amplitude', 'analytics', 'user', 'identify'],
    secret: '@amplitude',
    instruction: {
      method: 'POST',
      url: 'https://api2.amplitude.com',
      path: ['/2/httpapi'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        api_key: secret(),
        events: [
          {
            user_id: field({
              name: 'userId',
              description: 'unique identifier for the user',
            }),
            event_type: '$identify',
            user_properties: {
              $set: field({
                name: 'setProperties',
                description:
                  'user properties to set as a JSON object (will overwrite existing values)',
              }),
              $setOnce: field({
                name: 'setOnceProperties',
                description:
                  'user properties to set only if not already set as a JSON object',
                optional: true,
              }),
              $add: field({
                name: 'addProperties',
                description:
                  'numeric user properties to increment as a JSON object',
                optional: true,
              }),
              $unset: field({
                name: 'unsetProperties',
                description:
                  'user properties to remove as a JSON object with property names',
                optional: true,
              }),
            },
            time: field({
              name: 'timestamp',
              type: 'number',
              description:
                'the time the identify occurred in milliseconds since epoch',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  'amplitude/revenue/track': createFetchTemplate({
    provider: 'amplitude',
    icon: '@logo/amplitude.com',
    name: 'Track Revenue in Amplitude',
    description:
      'Track revenue and purchase events in Amplitude for product analytics and monetization insights',
    tags: ['amplitude', 'analytics', 'revenue', 'purchase'],
    secret: '@amplitude',
    instruction: {
      method: 'POST',
      url: 'https://api2.amplitude.com',
      path: ['/2/httpapi'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        api_key: secret(),
        events: [
          {
            user_id: field({
              name: 'userId',
              description: 'unique identifier for the user',
            }),
            event_type: field({
              name: 'eventType',
              description: 'the type of revenue event (e.g., purchase)',
              default: 'purchase',
            }),
            revenue: field({
              name: 'revenue',
              type: 'number',
              description: 'the revenue amount from the transaction',
            }),
            price: field({
              name: 'price',
              type: 'number',
              description: 'the price of the product',
              optional: true,
            }),
            quantity: field({
              name: 'quantity',
              type: 'number',
              description: 'the quantity of the product purchased',
              optional: true,
            }),
            productId: field({
              name: 'productId',
              description: 'the ID of the product',
              optional: true,
            }),
            revenueType: field({
              name: 'revenueType',
              description: 'the type of revenue (e.g., purchase, subscription)',
              optional: true,
            }),
            event_properties: field({
              name: 'eventProperties',
              description:
                'additional data about the purchase as a JSON object',
              optional: true,
            }),
            time: field({
              name: 'timestamp',
              type: 'number',
              description:
                'the time the purchase occurred in milliseconds since epoch',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  'amplitude/group/identify': createFetchTemplate({
    provider: 'amplitude',
    icon: '@logo/amplitude.com',
    name: 'Identify Group in Amplitude',
    description:
      'Update group properties in Amplitude to track organization or team-level attributes',
    tags: ['amplitude', 'analytics', 'group', 'organization'],
    secret: '@amplitude',
    instruction: {
      method: 'POST',
      url: 'https://api2.amplitude.com',
      path: ['/2/httpapi'],
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        api_key: secret(),
        events: [
          {
            user_id: field({
              name: 'userId',
              description: 'unique identifier for the user',
            }),
            event_type: '$groupidentify',
            groups: field({
              name: 'groups',
              description:
                'dictionary of group types and values as a JSON object (e.g., {"company": "acme"})',
            }),
            group_properties: {
              $set: field({
                name: 'setProperties',
                description:
                  'group properties to set as a JSON object (will overwrite existing values)',
              }),
              $setOnce: field({
                name: 'setOnceProperties',
                description:
                  'group properties to set only if not already set as a JSON object',
                optional: true,
              }),
            },
            time: field({
              name: 'timestamp',
              type: 'number',
              description:
                'the time the group identify occurred in milliseconds since epoch',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  'amplitude/api/call': createFetchTemplate({
    provider: 'amplitude',
    icon: '@logo/amplitude.com',
    name: 'Call Amplitude API',
    description:
      'Make a generic API call to Amplitude. This is a flexible template that can be used to call any Amplitude API endpoint by specifying the method, URL, and request body.',
    tags: ['amplitude', 'api', 'call', 'generic'],
    secret: '@amplitude',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Amplitude API endpoint to call',
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
