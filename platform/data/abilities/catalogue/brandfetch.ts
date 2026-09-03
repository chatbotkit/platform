import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'brandfetch/company/fetch': createFetchTemplate({
    provider: 'brandfetch',
    icon: '@logo/brandfetch.io',
    name: 'Get Company Brand Data',
    description:
      'Retrieve comprehensive brand information for a company including logos, colors, fonts, and social media links',
    tags: ['brandfetch', 'branding', 'company', 'logo'],
    secret: '@brandfetch',
    instruction: {
      method: 'GET',
      url: 'https://api.brandfetch.io',
      path: [
        '/v2/brands/',
        field({
          name: 'domain',
          description: 'Company domain name (e.g., apple.com)',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'brandfetch/logo/fetch': createFetchTemplate({
    provider: 'brandfetch',
    icon: '@logo/brandfetch.io',
    name: 'Get Company Logos',
    description:
      "Retrieve a company's logos and icons in various formats (PNG, SVG, JPG)",
    tags: ['brandfetch', 'logo', 'icon', 'image'],
    secret: '@brandfetch',
    instruction: {
      method: 'GET',
      url: 'https://api.brandfetch.io',
      path: [
        '/v2/brands/',
        field({
          name: 'domain',
          description: 'Company domain name (e.g., google.com)',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'brandfetch/colors/fetch': createFetchTemplate({
    provider: 'brandfetch',
    icon: '@logo/brandfetch.io',
    name: 'Get Company Brand Colors',
    description:
      "Retrieve a company's brand colors including hex codes and color types",
    tags: ['brandfetch', 'colors', 'branding', 'design'],
    secret: '@brandfetch',
    instruction: {
      method: 'GET',
      url: 'https://api.brandfetch.io',
      path: [
        '/v2/brands/',
        field({
          name: 'domain',
          description: 'Company domain name (e.g., facebook.com)',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'brandfetch/fonts/fetch': createFetchTemplate({
    provider: 'brandfetch',
    icon: '@logo/brandfetch.io',
    name: 'Get Company Brand Fonts',
    description:
      "Retrieve information about a company's brand typography and fonts",
    tags: ['brandfetch', 'fonts', 'typography', 'branding'],
    secret: '@brandfetch',
    instruction: {
      method: 'GET',
      url: 'https://api.brandfetch.io',
      path: [
        '/v2/brands/',
        field({
          name: 'domain',
          description: 'Company domain name (e.g., microsoft.com)',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'brandfetch/api/call': createFetchTemplate({
    provider: 'brandfetch',
    icon: '@logo/brandfetch.io',
    name: 'Call Brandfetch API',
    description:
      'Make a generic API call to Brandfetch. This is a flexible template that can be used to call any Brandfetch API endpoint by specifying the method, URL, and request body.',
    tags: ['brandfetch', 'api', 'call', 'generic'],
    secret: '@brandfetch',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Brandfetch API endpoint to call',
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
