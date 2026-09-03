import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'cloudinary/resource/list': createFetchTemplate({
    provider: 'cloudinary',
    icon: '@logo/cloudinary.com',
    name: 'List Resources',
    description: 'List media assets from your Cloudinary account',
    tags: ['cloudinary', 'list', 'resources', 'media'],
    secret: '@cloudinary',
    instruction: {
      method: 'GET',
      url: 'https://api.cloudinary.com',
      path: [
        '/v1_1/',
        field({
          name: 'cloudName',
          description: 'Cloudinary cloud name',
          placeholder: true,
        }),
        '/resources/',
        field({
          name: 'resourceType',
          description: 'Resource type to list',
          enum: ['image', 'video', 'raw'],
          default: 'image',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        type: field({
          name: 'deliveryType',
          description: 'Delivery type filter',
          enum: ['upload', 'private', 'authenticated'],
          default: 'upload',
          optional: true,
        }),
        prefix: field({
          name: 'prefix',
          description: 'Filter assets by public ID prefix',
          optional: true,
        }),
        max_results: field({
          name: 'maxResults',
          description: 'Maximum number of results to return',
          type: 'number',
          default: 100,
          optional: true,
        }),
        tags: field({
          name: 'includeTags',
          description: 'Include tags in response',
          type: 'boolean',
          default: false,
          optional: true,
        }),
      },
    },
  }),

  'cloudinary/resource/fetch': createFetchTemplate({
    provider: 'cloudinary',
    icon: '@logo/cloudinary.com',
    name: 'Get Resource Details',
    description: 'Get detailed information about a specific media asset',
    tags: ['cloudinary', 'get', 'resource', 'details'],
    secret: '@cloudinary',
    instruction: {
      method: 'GET',
      url: 'https://api.cloudinary.com',
      path: [
        '/v1_1/',
        field({
          name: 'cloudName',
          description: 'Cloudinary cloud name',
          placeholder: true,
        }),
        '/resources/',
        field({
          name: 'resourceType',
          description: 'Resource type',
          enum: ['image', 'video', 'raw'],
          default: 'image',
          placeholder: true,
        }),
        '/',
        field({
          name: 'deliveryType',
          description: 'Delivery type',
          enum: ['upload', 'private', 'authenticated'],
          default: 'upload',
          placeholder: true,
        }),
        '/',
        field({
          name: 'publicId',
          description: 'Public ID of the asset, e.g., "folder/image"',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudinary/usage/fetch': createFetchTemplate({
    provider: 'cloudinary',
    icon: '@logo/cloudinary.com',
    name: 'Get Account Usage',
    description: 'Get current account usage details and limits',
    tags: ['cloudinary', 'usage', 'account', 'quota'],
    secret: '@cloudinary',
    instruction: {
      method: 'GET',
      url: 'https://api.cloudinary.com',
      path: [
        '/v1_1/',
        field({
          name: 'cloudName',
          description: 'Cloudinary cloud name',
          placeholder: true,
        }),
        '/usage',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudinary/api/call': createFetchTemplate({
    provider: 'cloudinary',
    icon: '@logo/cloudinary.com',
    name: 'Call Cloudinary API',
    description:
      'Make a generic API call to Cloudinary. This is a flexible template that can be used to call any Cloudinary API endpoint by specifying the method, URL, and request body.',
    tags: ['cloudinary', 'api', 'call', 'generic'],
    secret: '@cloudinary',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Cloudinary API endpoint to call',
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
