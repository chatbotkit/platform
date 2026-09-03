import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'intercom/contact/list': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'List Contacts',
    description:
      'Retrieve a list of all contacts (users and leads) from Intercom.',
    tags: ['intercom', 'contacts', 'list'],
    secret: '@platform/intercom',
    instruction: {
      method: 'GET',
      url: 'https://api.intercom.io',
      path: ['/contacts'],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'intercom/contact/fetch': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Get Contact',
    description: 'Retrieve details of a specific contact by their ID.',
    tags: ['intercom', 'contacts', 'fetch'],
    secret: '@platform/intercom',
    instruction: {
      method: 'GET',
      url: 'https://api.intercom.io',
      path: [
        '/contacts/',
        field({
          name: 'contactId',
          description: 'The ID of the contact to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'intercom/contact/create': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Create Contact',
    description: 'Create a new contact in Intercom with email and name.',
    tags: ['intercom', 'contacts', 'create'],
    secret: '@platform/intercom',
    instruction: {
      method: 'POST',
      url: 'https://api.intercom.io',
      path: ['/contacts'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        email: field({
          name: 'email',
          description: 'The email address of the contact',
        }),
        name: field({
          name: 'name',
          description: 'The name of the contact',
          optional: true,
        }),
      },
    },
  }),

  'intercom/contact/update': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Update Contact',
    description: 'Update information for an existing contact.',
    tags: ['intercom', 'contacts', 'update'],
    secret: '@platform/intercom',
    instruction: {
      method: 'PUT',
      url: 'https://api.intercom.io',
      path: [
        '/contacts/',
        field({
          name: 'contactId',
          description: 'The ID of the contact to update',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'The updated name of the contact',
          optional: true,
        }),
        email: field({
          name: 'email',
          description: 'The updated email address',
          optional: true,
        }),
      },
    },
  }),

  'intercom/conversation/list': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'List Conversations',
    description: 'Retrieve a list of all conversations from Intercom.',
    tags: ['intercom', 'conversations', 'list'],
    secret: '@platform/intercom',
    instruction: {
      method: 'GET',
      url: 'https://api.intercom.io',
      path: ['/conversations'],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'intercom/conversation/fetch': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Get Conversation',
    description: 'Retrieve details of a specific conversation by its ID.',
    tags: ['intercom', 'conversations', 'fetch'],
    secret: '@platform/intercom',
    instruction: {
      method: 'GET',
      url: 'https://api.intercom.io',
      path: [
        '/conversations/',
        field({
          name: 'conversationId',
          description: 'The ID of the conversation to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'intercom/conversation/search': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Search Conversations',
    description:
      'Search for conversations by contact ID or other criteria using Intercom search API.',
    tags: ['intercom', 'conversations', 'search'],
    secret: '@platform/intercom',
    instruction: {
      method: 'POST',
      url: 'https://api.intercom.io',
      path: ['/conversations/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        query: {
          field: field({
            name: 'field',
            description: 'The field to search by (e.g., contact_ids)',
            default: 'contact_ids',
          }),
          operator: field({
            name: 'operator',
            description: 'The search operator',
            default: '=',
          }),
          value: field({
            name: 'value',
            description: 'The value to search for (e.g., contact ID)',
          }),
        },
      },
    },
  }),

  'intercom/conversation/reply': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Reply to Conversation',
    description: 'Send a reply to an existing conversation in Intercom.',
    tags: ['intercom', 'conversations', 'reply'],
    secret: '@platform/intercom',
    instruction: {
      method: 'POST',
      url: 'https://api.intercom.io',
      path: [
        '/conversations/',
        field({
          name: 'conversationId',
          description: 'The ID of the conversation to reply to',
          placeholder: true,
        }),
        '/reply',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        message_type: field({
          name: 'messageType',
          description: 'The type of message (comment, note)',
          enum: ['comment', 'note'],
          default: 'comment',
        }),
        type: field({
          name: 'type',
          description: 'The reply type (admin or user)',
          enum: ['admin', 'user'],
          default: 'admin',
        }),
        body: field({
          name: 'body',
          description: 'The message content to send',
        }),
      },
    },
  }),

  'intercom/message/send': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Send Message',
    description:
      'Send a message to a contact via email, in-app, or push notification.',
    tags: ['intercom', 'messages', 'send'],
    secret: '@platform/intercom',
    instruction: {
      method: 'POST',
      url: 'https://api.intercom.io',
      path: ['/messages'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        message_type: field({
          name: 'messageType',
          description: 'The type of message to send (inapp, email)',
          enum: ['inapp', 'email'],
          default: 'inapp',
        }),
        body: field({
          name: 'body',
          description: 'The message content to send',
        }),
        from: {
          type: 'admin',
          id: field({
            name: 'adminId',
            description: 'The admin ID sending the message',
            placeholder: true,
          }),
        },
        to: {
          type: 'user',
          id: field({
            name: 'userId',
            description: 'The user/contact ID to send the message to',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'intercom/api/call': createFetchTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Call Intercom API',
    description:
      'Make a generic API call to Intercom. This is a flexible template that can be used to call any Intercom API endpoint by specifying the method, URL, and request body.',
    tags: ['intercom', 'api', 'call', 'generic'],
    secret: '@platform/intercom',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Intercom API endpoint to call',
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

  'pack/intercom': createPackTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Install Intercom Tools',
    description:
      'Installs Intercom tools into the conversation. You can manage contacts, conversations, and send messages.',
    tags: ['intercom', 'pack', 'beta'],
    secret: '@platform/intercom',
    instruction: {
      abilities: [
        'intercom/contact/list',
        'intercom/contact/fetch',
        'intercom/contact/create',
        'intercom/contact/update',
        'intercom/conversation/list',
        'intercom/conversation/fetch',
        'intercom/conversation/search',
        'intercom/conversation/reply',
        'intercom/message/send',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/intercom[read-only]': createPackTemplate({
    provider: 'intercom',
    icon: '@logo/intercom.com',
    name: 'Install Intercom Search Tools',
    description:
      'Installs read-only Intercom tools into the conversation. You can list contacts and conversations without modification.',
    tags: ['intercom', 'pack', 'beta'],
    secret: '@platform/intercom',
    instruction: {
      abilities: [
        'intercom/contact/list',
        'intercom/contact/fetch',
        'intercom/conversation/list',
        'intercom/conversation/fetch',
        'intercom/conversation/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
