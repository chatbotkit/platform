import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'facebook/page/post': createFetchTemplate({
    provider: 'facebook',
    icon: '@logo/facebook.com',
    name: 'Post to Facebook Page',
    description: 'Post a message to a Facebook page',
    tags: ['facebook', 'page', 'post'],
    secret: '@facebook[page]',
    instruction: {
      method: 'POST',
      url: 'https://graph.facebook.com/v13.0/',
      path: [
        field({
          name: 'page_id',
          description: 'Facebook page ID',
        }),
        '/feed',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        message: field({
          name: 'message',
          description: 'Post content',
        }),
      },
    },
  }),

  'facebook/page/insights': createFetchTemplate({
    provider: 'facebook',
    icon: '@logo/facebook.com',
    name: 'Retrieve Facebook Page Insights',
    description: 'Retrieve insights for a Facebook page',
    tags: ['facebook', 'page', 'insights'],
    secret: '@facebook[page]',
    instruction: {
      method: 'GET',
      url: 'https://graph.facebook.com/v13.0/',
      path: [
        field({
          name: 'page_id',
          description: 'Facebook page ID',
        }),
        '/insights',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/api/call': createFetchTemplate({
    provider: 'facebook',
    icon: '@logo/facebook.com',
    name: 'Call Facebook API',
    description:
      'Make a generic API call to Facebook. This is a flexible template that can be used to call any Facebook API endpoint by specifying the method, URL, and request body.',
    tags: ['facebook', 'page', 'api', 'call', 'generic'],
    secret: '@facebook[page]',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Facebook API endpoint to call',
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
