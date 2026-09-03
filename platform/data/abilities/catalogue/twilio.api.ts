import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  // SMS Operations

  'twilio/message/send': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Send SMS Message',
    description: 'Send an SMS message to a specified phone number using Twilio',
    tags: ['twilio', 'sms', 'message', 'send'],
    secret: '@twilio',
    instruction: {
      method: 'POST',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Messages.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        From: field({
          name: 'from',
          description:
            'Your Twilio phone number in E.164 format e.g., +16175551212',
          placeholder: true,
        }),
        To: field({
          name: 'to',
          description:
            "Recipient's phone number in E.164 format e.g., +16175551212",
          placeholder: true,
        }),
        Body: field({
          name: 'message',
          description: 'Message content to send',
        }),
      },
    },
  }),

  'twilio/message/list': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'List Messages',
    description:
      'List messages associated with your Twilio account with optional filtering',
    tags: ['twilio', 'sms', 'message', 'list'],
    secret: '@twilio',
    instruction: {
      method: 'GET',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Messages.json',
      ],
      query: {
        To: field({
          name: 'to',
          description:
            'Filter messages sent to this phone number in E.164 format',
          optional: true,
        }),
        From: field({
          name: 'from',
          description:
            'Filter messages sent from this phone number in E.164 format',
          optional: true,
        }),
        PageSize: field({
          name: 'pageSize',
          type: 'number',
          description: 'Number of messages to return (max 1000)',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'twilio/message/get': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Get Message',
    description: 'Retrieve details of a specific message by its SID',
    tags: ['twilio', 'sms', 'message', 'get'],
    secret: '@twilio',
    instruction: {
      method: 'GET',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Messages/',
        field({
          name: 'messageSid',
          description: 'The SID of the message to retrieve',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'twilio/message/delete': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Delete Message',
    description: 'Delete a specific message by its SID',
    tags: ['twilio', 'sms', 'message', 'delete'],
    secret: '@twilio',
    instruction: {
      method: 'DELETE',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Messages/',
        field({
          name: 'messageSid',
          description: 'The SID of the message to delete',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Voice Call Operations

  'twilio/call/create': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Make Phone Call',
    description: 'Make a phone call with text-to-speech or a TwiML URL',
    tags: ['twilio', 'voice', 'call', 'create'],
    secret: '@twilio',
    instruction: {
      method: 'POST',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Calls.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        From: field({
          name: 'from',
          description:
            'Your Twilio phone number in E.164 format e.g., +16175551212',
          placeholder: true,
        }),
        To: field({
          name: 'to',
          description:
            "Recipient's phone number in E.164 format e.g., +16175551212",
          placeholder: true,
        }),
        Twiml: field({
          name: 'twiml',
          description:
            'TwiML instructions for the call e.g., <Response><Say>Hello</Say></Response>',
          optional: true,
        }),
        Url: field({
          name: 'url',
          description: 'URL that returns TwiML instructions for the call',
          optional: true,
        }),
        Timeout: field({
          name: 'timeout',
          type: 'number',
          description: 'Seconds to wait for answer (default 60, max 600)',
          optional: true,
          default: 60,
        }),
        Record: field({
          name: 'record',
          type: 'boolean',
          description: 'Whether to record the call',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'twilio/call/list': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'List Calls',
    description:
      'List calls associated with your Twilio account with optional filtering',
    tags: ['twilio', 'voice', 'call', 'list'],
    secret: '@twilio',
    instruction: {
      method: 'GET',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Calls.json',
      ],
      query: {
        To: field({
          name: 'to',
          description: 'Filter calls made to this phone number in E.164 format',
          optional: true,
        }),
        From: field({
          name: 'from',
          description:
            'Filter calls made from this phone number in E.164 format',
          optional: true,
        }),
        Status: field({
          name: 'status',
          description: 'Filter by call status',
          optional: true,
          enum: [
            'queued',
            'ringing',
            'in-progress',
            'completed',
            'busy',
            'failed',
            'no-answer',
            'canceled',
          ],
        }),
        PageSize: field({
          name: 'pageSize',
          type: 'number',
          description: 'Number of calls to return (max 1000)',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'twilio/call/get': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Get Call',
    description: 'Retrieve details of a specific call by its SID',
    tags: ['twilio', 'voice', 'call', 'get'],
    secret: '@twilio',
    instruction: {
      method: 'GET',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Calls/',
        field({
          name: 'callSid',
          description: 'The SID of the call to retrieve',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'twilio/call/update': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Update Call',
    description: 'Update an in-progress call e.g., redirect or terminate',
    tags: ['twilio', 'voice', 'call', 'update'],
    secret: '@twilio',
    instruction: {
      method: 'POST',
      url: 'https://api.twilio.com',
      path: [
        '/2010-04-01/Accounts/',
        field({
          name: 'accountSid',
          description: 'Twilio account SID',
          placeholder: true,
        }),
        '/Calls/',
        field({
          name: 'callSid',
          description: 'The SID of the call to update',
        }),
        '.json',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        Status: field({
          name: 'status',
          description:
            'New status for the call (completed to terminate, canceled to cancel)',
          optional: true,
          enum: ['completed', 'canceled'],
        }),
        Url: field({
          name: 'url',
          description: 'New TwiML URL to redirect the call',
          optional: true,
        }),
      },
    },
  }),

  'twilio/api/call': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Call Twilio API',
    description:
      'Make a generic API call to Twilio. This is a flexible template that can be used to call any Twilio API endpoint by specifying the method, URL, and request body.',
    tags: ['twilio', 'api', 'call', 'generic'],
    secret: '@twilio',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Twilio API endpoint to call',
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

  'pack/twilio': createPackTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Install Twilio Tools',
    description:
      'Installs Twilio tools into the conversation. You can send SMS messages, make calls, and manage communications.',
    tags: ['twilio', 'pack', 'beta'],
    secret: '@twilio',
    instruction: {
      abilities: [
        'twilio/message/send',
        'twilio/message/list',
        'twilio/message/get',
        'twilio/message/delete',
        'twilio/call/create',
        'twilio/call/list',
        'twilio/call/get',
        'twilio/call/update',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/twilio[read-only]': createPackTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Install Twilio Search Tools',
    description:
      'Installs read-only Twilio tools into the conversation. You can list and fetch messages and calls without modification.',
    tags: ['twilio', 'pack', 'beta'],
    secret: '@twilio',
    instruction: {
      abilities: [
        'twilio/message/list',
        'twilio/message/get',
        'twilio/call/list',
        'twilio/call/get',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
