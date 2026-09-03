import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'figma/file/fetch': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Get Figma File',
    description:
      'Get metadata and content from a Figma file including document structure, canvas, and components',
    tags: ['figma', 'design', 'file'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/files/',
        field({
          name: 'key',
          description: 'The Figma file key from the URL',
          placeholder: true,
        }),
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/file/images': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Export Figma Images',
    description:
      'Export images from specific nodes in a Figma file with customizable format and scale',
    tags: ['figma', 'design', 'export', 'image'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/images/',
        field({
          name: 'key',
          description: 'The Figma file key',
          placeholder: true,
        }),
      ],
      query: {
        ids: field({
          name: 'nodeIds',
          description: 'Comma-separated list of node IDs to export',
          placeholder: true,
        }),
        format: field({
          name: 'format',
          description: 'Image format',
          enum: ['jpg', 'png', 'svg', 'pdf'],
          default: 'png',
          optional: true,
          placeholder: true,
        }),
        scale: field({
          name: 'scale',
          description: 'Scale factor for export',
          type: 'number',
          default: 1,
          optional: true,
          placeholder: true,
        }),
      },
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/file/comments/list': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'List File Comments',
    description:
      'Get all comments from a Figma file to review feedback and discussions',
    tags: ['figma', 'design', 'comments', 'feedback'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/files/',
        field({
          name: 'key',
          description: 'The Figma file key',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/file/comments/create': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Post File Comment',
    description:
      'Post a new comment to a Figma file to provide feedback or start a discussion',
    tags: ['figma', 'design', 'comments', 'feedback'],
    secret: '@platform/figma',
    instruction: {
      method: 'POST',
      url: 'https://api.figma.com',
      path: [
        '/v1/files/',
        field({
          name: 'key',
          description: 'The Figma file key',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        'X-Figma-Token': secret(),
        'Content-Type': 'application/json',
      },
      body: {
        message: field({
          name: 'message',
          description: 'The comment text',
          placeholder: true,
        }),
        client_meta: field({
          name: 'position',
          description:
            'Optional position data as JSON with x, y coordinates and node_id',
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),

  'figma/team/projects/list': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'List Team Projects',
    description:
      'Get all projects within a Figma team to browse available design work',
    tags: ['figma', 'design', 'team', 'projects'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/teams/',
        field({
          name: 'teamId',
          description: 'The team ID',
          placeholder: true,
        }),
        '/projects',
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/project/files/list': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'List Project Files',
    description:
      'Get all files within a Figma project to see available designs',
    tags: ['figma', 'design', 'project', 'files'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/projects/',
        field({
          name: 'projectId',
          description: 'The project ID',
          placeholder: true,
        }),
        '/files',
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/file/components': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Get File Components',
    description:
      'Get metadata for all components in a Figma file to understand the design system',
    tags: ['figma', 'design', 'components', 'design-system'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/files/',
        field({
          name: 'key',
          description: 'The Figma file key',
          placeholder: true,
        }),
        '/components',
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/file/styles': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Get File Styles',
    description:
      'Get metadata for all styles in a Figma file to understand the design tokens',
    tags: ['figma', 'design', 'styles', 'design-system'],
    secret: '@platform/figma',
    instruction: {
      method: 'GET',
      url: 'https://api.figma.com',
      path: [
        '/v1/files/',
        field({
          name: 'key',
          description: 'The Figma file key',
          placeholder: true,
        }),
        '/styles',
      ],
      headers: {
        'X-Figma-Token': secret(),
      },
    },
  }),

  'figma/api/call': createFetchTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Call Figma API',
    description:
      'Make a generic API call to Figma. This is a flexible template that can be used to call any Figma API endpoint by specifying the method, URL, and request body.',
    tags: ['figma', 'api', 'call', 'generic'],
    secret: '@platform/figma',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Figma API endpoint to call',
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

  'pack/figma': createPackTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Install Figma Tools',
    description:
      'Installs Figma tools into the conversation. You can fetch files, images, comments, projects, components, and styles.',
    tags: ['figma', 'pack', 'beta'],
    secret: '@platform/figma',
    instruction: {
      abilities: [
        'figma/file/fetch',
        'figma/file/images',
        'figma/file/comments/list',
        'figma/file/comments/create',
        'figma/team/projects/list',
        'figma/project/files/list',
        'figma/file/components',
        'figma/file/styles',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/figma[read-only]': createPackTemplate({
    provider: 'figma',
    icon: '@logo/figma.com',
    name: 'Install Figma Search Tools',
    description:
      'Installs read-only Figma tools into the conversation. You can fetch files, images, comments, and project information without modification.',
    tags: ['figma', 'pack', 'beta'],
    secret: '@platform/figma',
    instruction: {
      abilities: [
        'figma/file/fetch',
        'figma/file/images',
        'figma/file/comments/list',
        'figma/team/projects/list',
        'figma/project/files/list',
        'figma/file/components',
        'figma/file/styles',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
