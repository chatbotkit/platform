import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'codeqr/qrcode/create': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Create QR Code',
    description:
      'Create a new QR code with customizable content, colors, and tracking options',
    tags: ['codeqr', 'qrcode', 'create', 'generate'],
    secret: '@codeqr',
    instruction: {
      method: 'POST',
      url: 'https://api.codeqr.io',
      path: ['/qrcodes'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        type: field({
          name: 'type',
          enum: ['url', 'text'],
          default: 'url',
          description: 'Type of QR code content',
        }),
        static: field({
          name: 'static',
          type: 'boolean',
          default: true,
          description:
            'True for static QR code (fixed content), false for dynamic (editable)',
        }),
        url: field({
          name: 'url',
          optional: true,
          description: 'The destination URL for the QR code (when type is url)',
        }),
        text: field({
          name: 'text',
          optional: true,
          description: 'Text content for the QR code (when type is text)',
        }),
        title: field({
          name: 'title',
          optional: true,
          description: 'Title for organizing the QR code',
        }),
        trackConversion: field({
          name: 'trackConversion',
          type: 'boolean',
          optional: true,
          description: 'Enable conversion tracking (dynamic QR codes only)',
        }),
        bgColor: field({
          name: 'bgColor',
          optional: true,
          description: 'Background color in hex format (e.g., #FFFFFF)',
        }),
        fgColor: field({
          name: 'fgColor',
          optional: true,
          description: 'Foreground color in hex format (e.g., #000000)',
        }),
        showLogo: field({
          name: 'showLogo',
          type: 'boolean',
          optional: true,
          description: 'Whether to display a logo in the QR code',
        }),
        src: field({
          name: 'logoUrl',
          optional: true,
          description: 'URL of the logo image to display in the QR code',
        }),
        comments: field({
          name: 'comments',
          optional: true,
          description: 'Comments or notes about the QR code',
        }),
        expiresAt: field({
          name: 'expiresAt',
          optional: true,
          description:
            'Expiration date in ISO 8601 format (dynamic QR codes only)',
        }),
        expiredUrl: field({
          name: 'expiredUrl',
          optional: true,
          description:
            'Redirect URL when QR code expires (dynamic QR codes only)',
        }),
      },
    },
  }),

  'codeqr/qrcode/list': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'List QR Codes',
    description: 'List all QR codes with pagination support',
    tags: ['codeqr', 'qrcode', 'list'],
    secret: '@codeqr',
    instruction: {
      method: 'GET',
      url: 'https://api.codeqr.io',
      path: ['/qrcodes'],
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'Page number for pagination',
        }),
      },
    },
  }),

  'codeqr/qrcode/fetch': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Get QR Code Info',
    description: 'Get detailed information about a specific QR code',
    tags: ['codeqr', 'qrcode', 'fetch', 'info'],
    secret: '@codeqr',
    instruction: {
      method: 'GET',
      url: 'https://api.codeqr.io',
      path: ['/qrcodes/info'],
      headers: {
        Authorization: secret(),
      },
      query: {
        id: field({
          name: 'qrcodeId',
          description: 'The unique ID of the QR code',
          placeholder: true,
        }),
      },
    },
  }),

  'codeqr/qrcode/delete': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Delete QR Code',
    description: 'Delete a specific QR code by its ID',
    tags: ['codeqr', 'qrcode', 'delete'],
    secret: '@codeqr',
    instruction: {
      method: 'DELETE',
      url: 'https://api.codeqr.io',
      path: [
        '/qrcodes/',
        field({
          name: 'qrcodeId',
          description: 'The unique ID of the QR code to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'codeqr/link/create': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Create Short Link',
    description: 'Create a shortened URL link with tracking capabilities',
    tags: ['codeqr', 'link', 'shortlink', 'create'],
    secret: '@codeqr',
    instruction: {
      method: 'POST',
      url: 'https://api.codeqr.io',
      path: ['/links'],
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        url: field({
          name: 'url',
          description: 'The destination URL to shorten',
        }),
        title: field({
          name: 'title',
          optional: true,
          description: 'Title for organizing the short link',
        }),
        trackConversion: field({
          name: 'trackConversion',
          type: 'boolean',
          optional: true,
          description: 'Enable conversion tracking',
        }),
        comments: field({
          name: 'comments',
          optional: true,
          description: 'Comments or notes about the short link',
        }),
        expiresAt: field({
          name: 'expiresAt',
          optional: true,
          description: 'Expiration date in ISO 8601 format',
        }),
        expiredUrl: field({
          name: 'expiredUrl',
          optional: true,
          description: 'Redirect URL when link expires',
        }),
      },
    },
  }),

  'codeqr/link/list': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'List Short Links',
    description: 'List all short links with pagination support',
    tags: ['codeqr', 'link', 'shortlink', 'list'],
    secret: '@codeqr',
    instruction: {
      method: 'GET',
      url: 'https://api.codeqr.io',
      path: ['/links'],
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          optional: true,
          default: 1,
          description: 'Page number for pagination',
        }),
      },
    },
  }),

  'codeqr/link/fetch': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Get Link Info',
    description: 'Get detailed information about a specific short link',
    tags: ['codeqr', 'link', 'shortlink', 'fetch', 'info'],
    secret: '@codeqr',
    instruction: {
      method: 'GET',
      url: 'https://api.codeqr.io',
      path: ['/links/info'],
      headers: {
        Authorization: secret(),
      },
      query: {
        id: field({
          name: 'linkId',
          description: 'The unique ID of the short link',
          placeholder: true,
        }),
      },
    },
  }),

  'codeqr/link/delete': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Delete Link',
    description: 'Delete a specific short link by its ID',
    tags: ['codeqr', 'link', 'shortlink', 'delete'],
    secret: '@codeqr',
    instruction: {
      method: 'DELETE',
      url: 'https://api.codeqr.io',
      path: [
        '/links/',
        field({
          name: 'linkId',
          description: 'The unique ID of the link to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'codeqr/api/call': createFetchTemplate({
    provider: 'codeqr',
    icon: '@logo/codeqr.io',
    name: 'Call Codeqr API',
    description:
      'Make a generic API call to Codeqr. This is a flexible template that can be used to call any Codeqr API endpoint by specifying the method, URL, and request body.',
    tags: ['codeqr', 'api', 'call', 'generic'],
    secret: '@codeqr',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Codeqr API endpoint to call',
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
