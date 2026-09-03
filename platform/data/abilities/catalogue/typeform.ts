import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Typeform abilities.
 */
const abilities = {
  'typeform/form/list': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'List Forms',
    description: 'Retrieve a list of forms from your Typeform account',
    tags: ['typeform', 'forms', 'list'],
    secret: '@platform/typeform',
    instruction: {
      method: 'GET',
      url: 'https://api.typeform.com',
      path: ['/forms'],
      query: {
        search: field({
          name: 'search',
          description: 'search query to filter forms',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number for pagination',
          optional: true,
          default: 1,
        }),
        page_size: field({
          name: 'pageSize',
          type: 'number',
          description: 'number of forms per page (max 200)',
          optional: true,
          default: 10,
        }),
        workspace_id: field({
          name: 'workspaceId',
          description: 'workspace ID to filter forms',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'typeform/form/fetch': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'Get Form',
    description: 'Retrieve details of a specific form by ID',
    tags: ['typeform', 'form', 'get'],
    secret: '@platform/typeform',
    instruction: {
      method: 'GET',
      url: 'https://api.typeform.com',
      path: ['/forms/', field({ name: 'formId', description: 'the form ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'typeform/form/create': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'Create Form',
    description: 'Create a new form in your Typeform account',
    tags: ['typeform', 'form', 'create'],
    secret: '@platform/typeform',
    instruction: {
      method: 'POST',
      url: 'https://api.typeform.com',
      path: ['/forms'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({ name: 'title', description: 'the form title' }),
        workspace: field({
          name: 'workspaceHref',
          description: 'workspace URL for the form',
          optional: true,
        }),
      },
    },
  }),

  'typeform/form/delete': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'Delete Form',
    description: 'Delete a form from your Typeform account',
    tags: ['typeform', 'form', 'delete'],
    secret: '@platform/typeform',
    instruction: {
      method: 'DELETE',
      url: 'https://api.typeform.com',
      path: [
        '/forms/',
        field({ name: 'formId', description: 'the form ID to delete' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'typeform/response/list': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'List Responses',
    description: 'Retrieve responses submitted to a specific form',
    tags: ['typeform', 'responses', 'list'],
    secret: '@platform/typeform',
    instruction: {
      method: 'GET',
      url: 'https://api.typeform.com',
      path: [
        '/forms/',
        field({ name: 'formId', description: 'the form ID' }),
        '/responses',
      ],
      query: {
        page_size: field({
          name: 'pageSize',
          type: 'number',
          description: 'number of responses per page (max 1000)',
          optional: true,
          default: 25,
        }),
        since: field({
          name: 'since',
          description:
            'limit to responses submitted since this date (ISO 8601 format or timestamp)',
          optional: true,
        }),
        until: field({
          name: 'until',
          description:
            'limit to responses submitted until this date (ISO 8601 format or timestamp)',
          optional: true,
        }),
        completed: field({
          name: 'completed',
          type: 'boolean',
          description: 'limit to completed responses only',
          optional: true,
        }),
        query: field({
          name: 'query',
          description: 'search query to filter responses',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'typeform/api/call': createFetchTemplate({
    provider: 'typeform',
    icon: '@logo/typeform.com',
    name: 'Call Typeform API',
    description:
      'Make a generic API call to Typeform. This is a flexible template that can be used to call any Typeform API endpoint by specifying the method, URL, and request body.',
    tags: ['typeform', 'api', 'call', 'generic'],
    secret: '@platform/typeform',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Typeform API endpoint to call',
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
