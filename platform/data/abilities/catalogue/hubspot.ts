import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/hubspot/sql'

const abilities = {
  // ===========================
  // Contact Operations
  // ===========================

  'hubspot/crm/contact/create': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Create Contact',
    description: 'Create a new contact in HubSpot CRM',
    tags: ['crm', 'hubspot', 'contact', 'create'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/contacts'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'contact properties as JSON object (e.g., {"email":"test@example.com","firstname":"John","lastname":"Doe"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/contact/fetch': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Fetch Contact',
    description: 'Get a specific contact by ID from HubSpot CRM',
    tags: ['crm', 'hubspot', 'contact', 'fetch'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/contact/list': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Contacts',
    description: 'List all contacts from HubSpot CRM',
    tags: ['crm', 'hubspot', 'contact', 'list'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/contacts'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of contacts to return (1-100)',
          optional: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'comma-separated list of properties to return (e.g., "email,firstname,lastname")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/contact/update': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Update Contact',
    description: 'Update an existing contact in HubSpot CRM',
    tags: ['crm', 'hubspot', 'contact', 'update'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'PATCH',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'contact properties to update as JSON object (e.g., {"email":"new@example.com"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/contact/delete': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Delete Contact',
    description: 'Delete a contact from HubSpot CRM',
    tags: ['crm', 'hubspot', 'contact', 'delete'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'DELETE',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/contacts/',
        field({ name: 'contactId', description: 'the contact ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/contact/search': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Search Contacts',
    description: 'Search for contacts in HubSpot CRM using filters and queries',
    tags: ['crm', 'hubspot', 'contact', 'search'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/contacts/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        filterGroups: field({
          name: 'filterGroups',
          description:
            'array of filter groups for search criteria (e.g., [{"filters":[{"propertyName":"email","operator":"CONTAINS","value":"example"}]}])',
          placeholder: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'array of property names to return (e.g., ["email","firstname","lastname"])',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of results to return',
          optional: true,
        }),
      },
    },
  }),

  // ===========================
  // Company Operations
  // ===========================

  'hubspot/crm/company/create': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Create Company',
    description: 'Create a new company in HubSpot CRM',
    tags: ['crm', 'hubspot', 'company', 'create'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/companies'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'company properties as JSON object (e.g., {"name":"Acme Inc","domain":"acme.com"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/company/fetch': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Fetch Company',
    description: 'Get a specific company by ID from HubSpot CRM',
    tags: ['crm', 'hubspot', 'company', 'fetch'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/companies/',
        field({ name: 'companyId', description: 'the company ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/company/list': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Companies',
    description: 'List all companies from HubSpot CRM',
    tags: ['crm', 'hubspot', 'company', 'list'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/companies'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of companies to return (1-100)',
          optional: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'comma-separated list of properties to return (e.g., "name,domain,industry")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/company/update': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Update Company',
    description: 'Update an existing company in HubSpot CRM',
    tags: ['crm', 'hubspot', 'company', 'update'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'PATCH',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/companies/',
        field({ name: 'companyId', description: 'the company ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'company properties to update as JSON object (e.g., {"name":"New Company Name"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/company/delete': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Delete Company',
    description: 'Delete a company from HubSpot CRM',
    tags: ['crm', 'hubspot', 'company', 'delete'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'DELETE',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/companies/',
        field({ name: 'companyId', description: 'the company ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/company/search': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Search Companies',
    description: 'Search for companies in HubSpot CRM using text queries',
    tags: ['crm', 'hubspot', 'company', 'search'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/companies/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'full-text search query',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of results to return',
          optional: true,
        }),
        after: field({
          name: 'after',
          description: 'the cursor to fetch the next page of results',
          optional: true,
        }),
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'archived',
                operator: 'EQ',
                value: false,
              },
            ],
          },
        ],
      },
    },
  }),

  // ===========================
  // Deal Operations
  // ===========================

  'hubspot/crm/deal/create': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Create Deal',
    description: 'Create a new deal in HubSpot CRM',
    tags: ['crm', 'hubspot', 'deal', 'create'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/deals'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'deal properties as JSON object (e.g., {"dealname":"New Deal","dealstage":"appointmentscheduled","amount":"5000"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/deal/fetch': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Fetch Deal',
    description: 'Get a specific deal by ID from HubSpot CRM',
    tags: ['crm', 'hubspot', 'deal', 'fetch'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/deal/list': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Deals',
    description: 'List all deals from HubSpot CRM',
    tags: ['crm', 'hubspot', 'deal', 'list'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/deals'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of deals to return (1-100)',
          optional: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'comma-separated list of properties to return (e.g., "dealname,dealstage,amount")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/deal/update': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Update Deal',
    description: 'Update an existing deal in HubSpot CRM',
    tags: ['crm', 'hubspot', 'deal', 'update'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'PATCH',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'deal properties to update as JSON object (e.g., {"dealstage":"closedwon"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/deal/delete': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Delete Deal',
    description: 'Delete a deal from HubSpot CRM',
    tags: ['crm', 'hubspot', 'deal', 'delete'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'DELETE',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/deals/',
        field({ name: 'dealId', description: 'the deal ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/deal/search': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Search Deals',
    description: 'Search for deals in HubSpot CRM using filters and queries',
    tags: ['crm', 'hubspot', 'deal', 'search'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/deals/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        filterGroups: field({
          name: 'filterGroups',
          description:
            'array of filter groups for search criteria (e.g., [{"filters":[{"propertyName":"dealstage","operator":"EQ","value":"closedwon"}]}])',
          placeholder: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'array of property names to return (e.g., ["dealname","dealstage","amount"])',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of results to return',
          optional: true,
        }),
      },
    },
  }),

  // ===========================
  // Ticket Operations
  // ===========================

  'hubspot/crm/ticket/create': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Create Ticket',
    description: 'Create a new support ticket in HubSpot CRM',
    tags: ['crm', 'hubspot', 'ticket', 'create', 'support'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/tickets'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'ticket properties as JSON object (e.g., {"subject":"Support Request","hs_pipeline_stage":"1","hs_ticket_priority":"HIGH"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/ticket/fetch': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Fetch Ticket',
    description: 'Get a specific ticket by ID from HubSpot CRM',
    tags: ['crm', 'hubspot', 'ticket', 'fetch', 'support'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/tickets/',
        field({ name: 'ticketId', description: 'the ticket ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/ticket/list': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Tickets',
    description: 'List all tickets from HubSpot CRM',
    tags: ['crm', 'hubspot', 'ticket', 'list', 'support'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/tickets'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'maximum number of tickets to return (1-100)',
          optional: true,
        }),
        properties: field({
          name: 'properties',
          description:
            'comma-separated list of properties to return (e.g., "subject,hs_pipeline_stage,hs_ticket_priority")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'hubspot/crm/ticket/update': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Update Ticket',
    description: 'Update an existing ticket in HubSpot CRM',
    tags: ['crm', 'hubspot', 'ticket', 'update', 'support'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'PATCH',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/tickets/',
        field({ name: 'ticketId', description: 'the ticket ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        properties: field({
          name: 'properties',
          description:
            'ticket properties to update as JSON object (e.g., {"hs_pipeline_stage":"4"})',
          placeholder: true,
        }),
      },
    },
  }),

  'hubspot/crm/ticket/delete': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Delete Ticket',
    description: 'Delete a ticket from HubSpot CRM',
    tags: ['crm', 'hubspot', 'ticket', 'delete', 'support'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'DELETE',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/objects/tickets/',
        field({ name: 'ticketId', description: 'the ticket ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // ===========================
  // Additional CRM Variants
  // ===========================

  'hubspot/crm/property/list': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List CRM Properties',
    description:
      'List properties and options for a given object type in HubSpot CRM',
    tags: ['crm', 'hubspot', 'beta'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'GET',
      url: 'https://api.hubapi.com',
      path: [
        '/crm/v3/properties/',
        field({
          name: 'objectType',
          description: 'the object type',
          enum: ['company', 'contact', 'deal'],
        }),
      ],
      query: {
        archived: false,
      },
      headers: {
        Authorization: secret(),
      },
      options: {
        jmespath: 'results[*].{name: name, options: options[*].label}',
      },
    },
  }),

  'hubspot/crm/company/list[latest]': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Latest Companies',
    description: 'List the latest companies in HubSpot CRM',
    tags: ['crm', 'hubspot', 'beta'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/companies/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'full-text search query',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'the maximum number of results to return',
          optional: true,
        }),
        after: field({
          name: 'after',
          description: 'the cursor to fetch the next page of results',
          optional: true,
        }),
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'archived',
                operator: 'EQ',
                value: false,
              },
            ],
          },
        ],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING',
          },
        ],
      },
    },
  }),

  'hubspot/crm/contact/list[latest]': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Latest Contacts',
    description: 'List the latest contacts in HubSpot CRM',
    tags: ['crm', 'hubspot', 'beta'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/contacts/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'full-text search query',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'the maximum number of results to return',
          optional: true,
        }),
        after: field({
          name: 'after',
          description: 'the cursor to fetch the next page of results',
          optional: true,
        }),
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'archived',
                operator: 'EQ',
                value: false,
              },
            ],
          },
        ],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING',
          },
        ],
      },
    },
  }),

  'hubspot/crm/deal/list[latest]': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'List Latest Deals',
    description: 'List the latest deals in HubSpot CRM',
    tags: ['crm', 'hubspot', 'beta'],
    secret: '@platform/hubspot',
    instruction: {
      method: 'POST',
      url: 'https://api.hubapi.com',
      path: ['/crm/v3/objects/deals/search'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'full-text search query',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          default: 10,
          description: 'the maximum number of results to return',
          optional: true,
        }),
        after: field({
          name: 'after',
          description: 'the cursor to fetch the next page of results',
          optional: true,
        }),
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'archived',
                operator: 'EQ',
                value: false,
              },
            ],
          },
        ],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING',
          },
        ],
      },
    },
  }),

  // ===========================
  // SQL Query
  // ===========================

  'hubspot/crm/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Execute HubSpot SQL Query',
    description:
      'Execute a simple SQL query in HubSpot. Known tables include crm.campaign, crm.company, crm.contact, crm.lead, crm.deal, crm.goal, crm.product, crm.ticket. Joining tables and other complex queries are not supported.',
    tags: ['crm', 'hubspot', 'sql', 'beta'],
    path: '/api/auxiliary/skillset/ability/hubspot/sql',
    secret: '@platform/hubspot',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select, insert, update, delete are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // ===========================
  // Generic API Call
  // ===========================

  'hubspot/crm/api/call': createFetchTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Call Hubspot API',
    description:
      'Make a generic API call to Hubspot. This is a flexible template that can be used to call any Hubspot API endpoint by specifying the method, URL, and request body.',
    tags: ['hubspot', 'api', 'call', 'generic'],
    secret: '@platform/hubspot',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Hubspot API endpoint to call',
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

  // ===========================
  // Pack Templates
  // ===========================

  'pack/hubspot': createPackTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Install HubSpot CRM Tools',
    description:
      'Installs HubSpot CRM tools into the conversation. You can manage contacts, companies, deals, and tickets with full CRUD operations.',
    tags: ['crm', 'hubspot', 'pack'],
    secret: '@platform/hubspot',
    instruction: {
      abilities: [
        'hubspot/crm/contact/create',
        'hubspot/crm/contact/fetch',
        'hubspot/crm/contact/list',
        'hubspot/crm/contact/update',
        'hubspot/crm/contact/delete',
        'hubspot/crm/contact/search',
        'hubspot/crm/company/create',
        'hubspot/crm/company/fetch',
        'hubspot/crm/company/list',
        'hubspot/crm/company/search',
        'hubspot/crm/company/update',
        'hubspot/crm/company/delete',
        'hubspot/crm/deal/create',
        'hubspot/crm/deal/fetch',
        'hubspot/crm/deal/list',
        'hubspot/crm/deal/update',
        'hubspot/crm/deal/delete',
        'hubspot/crm/deal/search',
        'hubspot/crm/ticket/create',
        'hubspot/crm/ticket/fetch',
        'hubspot/crm/ticket/list',
        'hubspot/crm/ticket/update',
        'hubspot/crm/ticket/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/hubspot[read-only]': createPackTemplate({
    provider: 'hubspot',
    icon: '@logo/hubspot.com',
    name: 'Install HubSpot CRM Search Tools',
    description:
      'Installs read-only HubSpot CRM tools into the conversation. You can list and retrieve contacts, companies, deals, and tickets without modification.',
    tags: ['crm', 'hubspot', 'pack'],
    secret: '@platform/hubspot',
    instruction: {
      abilities: [
        'hubspot/crm/contact/fetch',
        'hubspot/crm/contact/list',
        'hubspot/crm/contact/search',
        'hubspot/crm/company/fetch',
        'hubspot/crm/company/list',
        'hubspot/crm/company/search',
        'hubspot/crm/deal/fetch',
        'hubspot/crm/deal/list',
        'hubspot/crm/deal/search',
        'hubspot/crm/ticket/fetch',
        'hubspot/crm/ticket/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
