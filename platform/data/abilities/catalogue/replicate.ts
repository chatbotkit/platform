import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'replicate/prediction/create': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'Create Replicate Prediction',
    description:
      'Create a new prediction to run an AI model on Replicate with custom inputs',
    tags: ['replicate', 'ai', 'prediction', 'machine-learning'],
    secret: '@replicate',
    instruction: {
      method: 'POST',
      url: 'https://api.replicate.com',
      path: ['/v1/predictions'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        version: field({
          name: 'version',
          description:
            'The model version ID to run e.g., from replicate.com/model-owner/model-name',
          placeholder: true,
        }),
        input: field({
          name: 'input',
          description:
            'JSON object with model inputs e.g., {"prompt": "a cat"} for text-to-image models',
        }),
        webhook: field({
          name: 'webhook',
          description: 'HTTPS URL to receive webhook when prediction completes',
          optional: true,
        }),
      },
    },
  }),

  'replicate/prediction/get': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'Get Replicate Prediction',
    description: 'Get the status and output of a specific prediction by its ID',
    tags: ['replicate', 'ai', 'prediction', 'status'],
    secret: '@replicate',
    instruction: {
      method: 'GET',
      url: 'https://api.replicate.com',
      path: [
        '/v1/predictions/',
        field({
          name: 'predictionId',
          description: 'The prediction ID to retrieve',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'replicate/prediction/cancel': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'Cancel Replicate Prediction',
    description:
      'Cancel a running prediction to stop processing and save resources',
    tags: ['replicate', 'ai', 'prediction', 'cancel'],
    secret: '@replicate',
    instruction: {
      method: 'POST',
      url: 'https://api.replicate.com',
      path: [
        '/v1/predictions/',
        field({
          name: 'predictionId',
          description: 'The prediction ID to cancel',
          placeholder: true,
        }),
        '/cancel',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'replicate/prediction/list': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'List Replicate Predictions',
    description:
      'List predictions you have created, with optional cursor-based pagination',
    tags: ['replicate', 'ai', 'prediction', 'list'],
    secret: '@replicate',
    instruction: {
      method: 'GET',
      url: 'https://api.replicate.com',
      path: ['/v1/predictions'],
      query: {
        cursor: field({
          name: 'cursor',
          description: 'Pagination cursor from previous response',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'replicate/model/get': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'Get Replicate Model',
    description:
      'Get details about a specific model including available versions and inputs',
    tags: ['replicate', 'ai', 'model', 'details'],
    secret: '@replicate',
    instruction: {
      method: 'GET',
      url: 'https://api.replicate.com',
      path: [
        '/v1/models/',
        field({
          name: 'modelOwner',
          description: 'The username of the model owner',
          placeholder: true,
        }),
        '/',
        field({
          name: 'modelName',
          description: 'The name of the model',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'replicate/api/call': createFetchTemplate({
    provider: 'replicate',
    icon: '@logo/replicate.com',
    name: 'Call Replicate API',
    description:
      'Make a generic API call to Replicate. This is a flexible template that can be used to call any Replicate API endpoint by specifying the method, URL, and request body.',
    tags: ['replicate', 'api', 'call', 'generic'],
    secret: '@replicate',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Replicate API endpoint to call',
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
