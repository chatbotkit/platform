import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of ActiveCampaign abilities.
 *
 * @see https://developers.activecampaign.com/reference/overview
 */
const abilities = {
  // Contact operations
  'activecampaign/contact/create': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Create Contact',
    description:
      'Create a new contact in ActiveCampaign with email and optional details',
    tags: ['activecampaign', 'contact', 'create', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/contacts'],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        contact: {
          email: field({
            name: 'email',
            description: 'the email address of the contact',
          }),
          firstName: field({
            name: 'firstName',
            description: 'the first name of the contact',
            optional: true,
          }),
          lastName: field({
            name: 'lastName',
            description: 'the last name of the contact',
            optional: true,
          }),
          phone: field({
            name: 'phone',
            description: 'the phone number of the contact',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/contact/fetch': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Fetch Contact',
    description: 'Retrieve detailed information about a specific contact by ID',
    tags: ['activecampaign', 'contact', 'get', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/contact/update': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Update Contact',
    description: 'Update an existing contact with new information',
    tags: ['activecampaign', 'contact', 'update', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        contact: {
          email: field({
            name: 'email',
            description: 'the new email address of the contact',
            optional: true,
          }),
          firstName: field({
            name: 'firstName',
            description: 'the new first name of the contact',
            optional: true,
          }),
          lastName: field({
            name: 'lastName',
            description: 'the new last name of the contact',
            optional: true,
          }),
          phone: field({
            name: 'phone',
            description: 'the new phone number of the contact',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/contact/delete': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Delete Contact',
    description: 'Delete a specific contact from ActiveCampaign',
    tags: ['activecampaign', 'contact', 'delete', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/contact/list': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'List Contacts',
    description: 'List all contacts with optional filtering and pagination',
    tags: ['activecampaign', 'contact', 'list', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/contacts'],
      query: {
        email: field({
          name: 'email',
          description: 'filter contacts by email address',
          optional: true,
        }),
        search: field({
          name: 'search',
          description: 'search contacts by name, email, organization or phone',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of contacts to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // Deal operations
  'activecampaign/deal/create': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Create Deal',
    description: 'Create a new deal in ActiveCampaign CRM',
    tags: ['activecampaign', 'deal', 'create', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/deals'],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        deal: {
          title: field({
            name: 'title',
            description: 'the title of the deal',
          }),
          contact: field({
            name: 'contactId',
            description: "the ID of the deal's contact",
          }),
          value: field({
            name: 'value',
            type: 'number',
            description: 'the value of the deal in cents',
          }),
          currency: field({
            name: 'currency',
            description: 'the currency code (e.g., USD, EUR)',
            default: 'USD',
          }),
          group: field({
            name: 'pipelineId',
            description: 'the pipeline ID for the deal',
            optional: true,
          }),
          stage: field({
            name: 'stageId',
            description: 'the stage ID for the deal',
            optional: true,
          }),
          owner: field({
            name: 'ownerId',
            description: 'the owner ID for the deal',
            optional: true,
          }),
          description: field({
            name: 'description',
            description: 'the description of the deal',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/deal/fetch': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Fetch Deal',
    description: 'Retrieve detailed information about a specific deal by ID',
    tags: ['activecampaign', 'deal', 'get', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/deal/update': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Update Deal',
    description: 'Update an existing deal with new information',
    tags: ['activecampaign', 'deal', 'update', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        deal: {
          title: field({
            name: 'title',
            description: 'the new title of the deal',
            optional: true,
          }),
          contact: field({
            name: 'contactId',
            description: 'the new contact ID for the deal',
            optional: true,
          }),
          value: field({
            name: 'value',
            type: 'number',
            description: 'the new value of the deal in cents',
            optional: true,
          }),
          currency: field({
            name: 'currency',
            description: 'the new currency code (e.g., USD, EUR)',
            optional: true,
          }),
          group: field({
            name: 'pipelineId',
            description: 'the new pipeline ID for the deal',
            optional: true,
          }),
          stage: field({
            name: 'stageId',
            description: 'the new stage ID for the deal',
            optional: true,
          }),
          owner: field({
            name: 'ownerId',
            description: 'the new owner ID for the deal',
            optional: true,
          }),
          description: field({
            name: 'description',
            description: 'the new description of the deal',
            optional: true,
          }),
          status: field({
            name: 'status',
            type: 'number',
            description: 'the status of the deal (0=open, 1=won, 2=lost)',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/deal/delete': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Delete Deal',
    description: 'Delete a specific deal from ActiveCampaign',
    tags: ['activecampaign', 'deal', 'delete', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/deal/list': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'List Deals',
    description: 'List all deals with optional filtering and pagination',
    tags: ['activecampaign', 'deal', 'list', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/deals'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of deals to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // Tag operations
  'activecampaign/tag/create': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Create Tag',
    description: 'Create a new tag in ActiveCampaign',
    tags: ['activecampaign', 'tag', 'create', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/tags'],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        tag: {
          tag: field({
            name: 'tagName',
            description: 'the name of the tag',
          }),
          tagType: field({
            name: 'tagType',
            description: 'the type of tag (contact or template)',
            enum: ['contact', 'template'],
            default: 'contact',
          }),
          description: field({
            name: 'description',
            description: 'the description of the tag',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/tag/fetch': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Fetch Tag',
    description: 'Retrieve detailed information about a specific tag by ID',
    tags: ['activecampaign', 'tag', 'get', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/tags/',
        field({ name: 'tagId', description: 'the tag ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/tag/update': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Update Tag',
    description: 'Update an existing tag with new information',
    tags: ['activecampaign', 'tag', 'update', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/tags/',
        field({ name: 'tagId', description: 'the tag ID' }),
      ],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        tag: {
          tag: field({
            name: 'tagName',
            description: 'the new name of the tag',
            optional: true,
          }),
          description: field({
            name: 'description',
            description: 'the new description of the tag',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/tag/delete': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Delete Tag',
    description: 'Delete a specific tag from ActiveCampaign',
    tags: ['activecampaign', 'tag', 'delete', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/tags/',
        field({ name: 'tagId', description: 'the tag ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/tag/list': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'List Tags',
    description: 'List all tags with optional pagination',
    tags: ['activecampaign', 'tag', 'list', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/tags'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of tags to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // Account operations
  'activecampaign/account/create': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Create Account',
    description:
      'Create a new account (company/organization) in ActiveCampaign',
    tags: ['activecampaign', 'account', 'create', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/accounts'],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        account: {
          name: field({
            name: 'accountName',
            description: 'the name of the account/organization',
          }),
          accountUrl: field({
            name: 'accountUrl',
            description: 'the website URL of the account',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/account/fetch': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Fetch Account',
    description: 'Retrieve detailed information about a specific account by ID',
    tags: ['activecampaign', 'account', 'get', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/accounts/',
        field({ name: 'accountId', description: 'the account ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/account/update': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Update Account',
    description: 'Update an existing account with new information',
    tags: ['activecampaign', 'account', 'update', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/accounts/',
        field({ name: 'accountId', description: 'the account ID' }),
      ],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        account: {
          name: field({
            name: 'accountName',
            description: 'the new name of the account/organization',
            optional: true,
          }),
          accountUrl: field({
            name: 'accountUrl',
            description: 'the new website URL of the account',
            optional: true,
          }),
        },
      },
    },
  }),

  'activecampaign/account/delete': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Delete Account',
    description: 'Delete a specific account from ActiveCampaign',
    tags: ['activecampaign', 'account', 'delete', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/accounts/',
        field({ name: 'accountId', description: 'the account ID' }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  'activecampaign/account/list': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'List Accounts',
    description: 'List all accounts with optional filtering and pagination',
    tags: ['activecampaign', 'account', 'list', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/accounts'],
      query: {
        search: field({
          name: 'search',
          description: 'search accounts by name',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of accounts to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // Contact Tag operations
  'activecampaign/contact/tag/add': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Add Tag to Contact',
    description: 'Add a tag to a contact in ActiveCampaign',
    tags: ['activecampaign', 'contact', 'tag', 'add', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/contactTags'],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        contactTag: {
          contact: field({
            name: 'contactId',
            description: 'the ID of the contact',
          }),
          tag: field({
            name: 'tagId',
            description: 'the ID of the tag to add',
          }),
        },
      },
    },
  }),

  'activecampaign/contact/tag/remove': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Remove Tag from Contact',
    description: 'Remove a tag from a contact in ActiveCampaign',
    tags: ['activecampaign', 'contact', 'tag', 'remove', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/contactTags/',
        field({
          name: 'contactTagId',
          description: 'the contact tag relationship ID',
        }),
      ],
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // List operations
  'activecampaign/list/list': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'List Lists',
    description: 'Get all email lists from ActiveCampaign',
    tags: ['activecampaign', 'list', 'email', 'crm', 'marketing'],
    secret: '@activecampaign',
    instruction: {
      method: 'GET',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: ['/api/3/lists'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of lists to return',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        'Api-Token': secret(),
      },
    },
  }),

  // Deal Note operations
  'activecampaign/deal/note/create': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Create Deal Note',
    description: 'Add a note to a deal in ActiveCampaign',
    tags: ['activecampaign', 'deal', 'note', 'create', 'crm', 'sales'],
    secret: '@activecampaign',
    instruction: {
      method: 'POST',
      url: field({
        name: 'apiUrl',
        description:
          'the ActiveCampaign API URL (e.g., https://yourname.api-us1.com)',
        placeholder: true,
      }),
      path: [
        '/api/3/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
        '/notes',
      ],
      headers: {
        'Api-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        note: {
          note: field({
            name: 'note',
            description: 'the content of the note',
          }),
        },
      },
    },
  }),

  'activecampaign/api/call': createFetchTemplate({
    provider: 'activecampaign',
    icon: '@logo/activecampaign.com',
    name: 'Call Activecampaign API',
    description:
      'Make a generic API call to Activecampaign. This is a flexible template that can be used to call any Activecampaign API endpoint by specifying the method, URL, and request body.',
    tags: ['activecampaign', 'api', 'call', 'generic'],
    secret: '@activecampaign',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Activecampaign API endpoint to call',
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
