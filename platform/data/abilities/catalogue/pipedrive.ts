import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Pipedrive CRM abilities.
 *
 * @see https://developers.pipedrive.com/docs/api/v2
 */
const abilities = {
  'pipedrive/deal/create': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Create Deal',
    description:
      'Create a new deal in Pipedrive with title, value, and associated contacts',
    tags: ['pipedrive', 'deal', 'create', 'crm', 'sales'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'POST',
      url: 'https://api.pipedrive.com/api/v2/deals',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'the title of the deal',
        }),
        value: field({
          name: 'value',
          type: 'number',
          description: 'the value of the deal',
          optional: true,
        }),
        currency: field({
          name: 'currency',
          description: 'the currency code (e.g., USD, EUR)',
          optional: true,
          default: 'USD',
        }),
        person_id: field({
          name: 'personId',
          type: 'number',
          description: 'the ID of the person this deal is associated with',
          optional: true,
        }),
        org_id: field({
          name: 'organizationId',
          type: 'number',
          description:
            'the ID of the organization this deal is associated with',
          optional: true,
        }),
        stage_id: field({
          name: 'stageId',
          type: 'number',
          description: 'the ID of the pipeline stage',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the status of the deal (open, won, lost, deleted)',
          optional: true,
          enum: ['open', 'won', 'lost', 'deleted'],
          default: 'open',
        }),
        expected_close_date: field({
          name: 'expectedCloseDate',
          description: 'the expected close date in YYYY-MM-DD format',
          optional: true,
        }),
      },
    },
  }),

  'pipedrive/deal/fetch': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Fetch Deal',
    description:
      'Retrieve detailed information about a specific deal by its ID',
    tags: ['pipedrive', 'deal', 'get', 'crm', 'sales'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'GET',
      url: 'https://api.pipedrive.com/api/v2',
      path: ['/deals/', field({ name: 'dealId', description: 'the deal ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'pipedrive/deal/update': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Update Deal',
    description: 'Update an existing deal with new information',
    tags: ['pipedrive', 'deal', 'update', 'crm', 'sales'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'PATCH',
      url: 'https://api.pipedrive.com/api/v2',
      path: ['/deals/', field({ name: 'dealId', description: 'the deal ID' })],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        title: field({
          name: 'title',
          description: 'the updated title of the deal',
          optional: true,
        }),
        value: field({
          name: 'value',
          type: 'number',
          description: 'the updated value of the deal',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the updated status (open, won, lost, deleted)',
          optional: true,
          enum: ['open', 'won', 'lost', 'deleted'],
        }),
        stage_id: field({
          name: 'stageId',
          type: 'number',
          description: 'the updated pipeline stage ID',
          optional: true,
        }),
      },
    },
  }),

  'pipedrive/person/create': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Create Person',
    description:
      'Create a new person contact in Pipedrive with name, email, and phone',
    tags: ['pipedrive', 'person', 'create', 'crm', 'contact'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'POST',
      url: 'https://api.pipedrive.com/api/v2/persons',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        name: field({
          name: 'name',
          description: 'the full name of the person',
        }),
        emails: array({
          name: 'emails',
          description: 'email addresses for the person',
          optional: true,
          items: object({
            shape: {
              value: field({
                name: 'value',
                description: 'the email address',
              }),
              label: field({
                name: 'label',
                description: 'the label for the email (e.g., work, home)',
                optional: true,
              }),
            },
          }),
        }),
        phones: array({
          name: 'phones',
          description: 'phone numbers for the person',
          optional: true,
          items: object({
            shape: {
              value: field({
                name: 'value',
                description: 'the phone number',
              }),
              label: field({
                name: 'label',
                description: 'the label for the phone (e.g., work, mobile)',
                optional: true,
              }),
            },
          }),
        }),
        org_id: field({
          name: 'organizationId',
          type: 'number',
          description: 'the ID of the organization this person belongs to',
          optional: true,
        }),
      },
    },
  }),

  'pipedrive/person/search': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Search Persons',
    description:
      'Search for persons by name, email, phone, or notes in Pipedrive',
    tags: ['pipedrive', 'person', 'search', 'crm', 'contact'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'GET',
      url: 'https://api.pipedrive.com/api/v2/persons/search',
      headers: {
        Authorization: secret(),
      },
      query: {
        term: field({
          name: 'searchTerm',
          description: 'the search term (minimum 2 characters)',
        }),
        fields: field({
          name: 'fields',
          description:
            'comma-separated fields to search (name, email, phone, notes)',
          optional: true,
        }),
        exact_match: field({
          name: 'exactMatch',
          type: 'boolean',
          description: 'whether to search for exact matches only',
          optional: true,
          default: false,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of results to return',
          optional: true,
          default: 100,
        }),
      },
    },
  }),

  'pipedrive/organization/create': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Create Organization',
    description: 'Create a new organization in Pipedrive',
    tags: ['pipedrive', 'organization', 'create', 'crm', 'company'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'POST',
      url: 'https://api.pipedrive.com/api/v2/organizations',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        name: field({
          name: 'name',
          description: 'the name of the organization',
        }),
        address: field({
          name: 'address',
          description: 'the address of the organization',
          optional: true,
        }),
      },
    },
  }),

  'pipedrive/activity/create': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Create Activity',
    description:
      'Create a new activity (call, meeting, task, etc.) in Pipedrive',
    tags: ['pipedrive', 'activity', 'create', 'crm', 'task'],
    secret: '@platform/pipedrive',
    instruction: {
      method: 'POST',
      url: 'https://api.pipedrive.com/api/v2/activities',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        subject: field({
          name: 'subject',
          description: 'the subject/title of the activity',
        }),
        type: field({
          name: 'type',
          description:
            'the type of activity (call, meeting, task, deadline, email, lunch)',
          optional: true,
        }),
        due_date: field({
          name: 'dueDate',
          description: 'the due date in YYYY-MM-DD format',
          optional: true,
        }),
        due_time: field({
          name: 'dueTime',
          description: 'the due time in HH:MM format',
          optional: true,
        }),
        duration: field({
          name: 'duration',
          description: 'the duration in HH:MM format',
          optional: true,
        }),
        deal_id: field({
          name: 'dealId',
          type: 'number',
          description: 'the ID of the deal this activity is associated with',
          optional: true,
        }),
        person_id: field({
          name: 'personId',
          type: 'number',
          description: 'the ID of the person this activity is associated with',
          optional: true,
        }),
        org_id: field({
          name: 'organizationId',
          type: 'number',
          description:
            'the ID of the organization this activity is associated with',
          optional: true,
        }),
        note: field({
          name: 'note',
          description: 'a note for the activity',
          optional: true,
        }),
      },
    },
  }),

  'pipedrive/api/call': createFetchTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Call Pipedrive API',
    description:
      'Make a generic API call to Pipedrive. This is a flexible template that can be used to call any Pipedrive API endpoint by specifying the method, URL, and request body.',
    tags: ['pipedrive', 'api', 'call', 'generic'],
    secret: '@platform/pipedrive',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Pipedrive API endpoint to call',
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

  'pack/pipedrive': createPackTemplate({
    provider: 'pipedrive',
    icon: '@logo/pipedrive.com',
    name: 'Install Pipedrive CRM Tools',
    description: 'Installs Pipedrive CRM tools into the conversation.',
    tags: ['pipedrive', 'crm', 'sales', 'pack'],
    secret: '@platform/pipedrive',
    instruction: {
      abilities: [
        'pipedrive/deal/create',
        'pipedrive/deal/fetch',
        'pipedrive/deal/update',
        'pipedrive/person/create',
        'pipedrive/person/search',
        'pipedrive/organization/create',
        'pipedrive/activity/create',
      ],
    },
  }),
}

export default abilities
