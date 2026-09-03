import {
  createPackTemplate,
  createSpaceCreateTemplate,
  createSpaceDeleteTemplate,
  createSpaceFetchTemplate,
  createSpaceListTemplate,
  createSpaceStorageCopyTemplate,
  createSpaceStorageDeleteTemplate,
  createSpaceStorageImportTemplate,
  createSpaceStorageLinkTemplate,
  createSpaceStorageListTemplate,
  createSpaceStorageMoveTemplate,
  createSpaceStorageReadTemplate,
  createSpaceStorageRwTemplate,
  createSpaceStorageSearchTemplate,
  createSpaceStorageWriteTemplate,
  createSpaceUpdateTemplate,
  field,
  space,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit space abilities.
 */
const abilities = {
  // @note the context of these is all spaces within the ChatBotKit account

  'space/list': createSpaceListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Spaces',
    description: 'List all spaces',
    tags: ['space', 'list', 'alpha'],
    commentary: '**NOTE:** This ability lists all spaces in the account.',
    instruction: {
      '@scope': 'user',
    },
  }),

  'space/create': createSpaceCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Space',
    description: 'Create a new space',
    tags: ['space', 'create', 'alpha'],
    commentary: '**NOTE:** This ability creates a space within the account.',
    instruction: {
      '@scope': 'user',
      name: field({
        name: 'name',
        description: 'the name of the space',
      }),
      description: field({
        name: 'description',
        description: 'an optional description of the space',
        optional: true,
      }),
    },
  }),

  'space/fetch[by-id]': createSpaceFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Space',
    description: 'Fetch details of a specific space',
    tags: ['space', 'fetch', 'alpha'],
    commentary: '**NOTE:** This ability fetches a space in the account by ID.',
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to fetch',
      }),
    },
  }),

  'space/update[by-id]': createSpaceUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Space',
    description: 'Update an existing space',
    tags: ['space', 'update', 'alpha'],
    commentary: '**NOTE:** This ability updates a space within the account.',
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the space',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'the updated description of the space',
        optional: true,
      }),
    },
  }),

  'space/delete[by-id]': createSpaceDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space',
    description: 'Delete an existing space',
    tags: ['space', 'delete', 'alpha'],
    commentary: '**NOTE:** This ability deletes a space within the account.',
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to delete',
      }),
    },
  }),

  // @note the context of these is all spaces associated with a specific contact

  'space/list[contact]': createSpaceListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Spaces',
    description: 'List all spaces',
    tags: ['space', 'list', 'contact', 'alpha'],
    commentary:
      '**NOTE:** This ability lists spaces for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
    },
  }),

  'space/fetch[contact][by-id]': createSpaceFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Space',
    description: 'Fetch details of a specific space',
    tags: ['space', 'fetch', 'contact', 'alpha'],
    commentary:
      '**NOTE:** This ability fetches a space for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to fetch',
      }),
    },
  }),

  'space/create[contact]': createSpaceCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Space',
    description: 'Create a new space',
    tags: ['space', 'create', 'contact', 'alpha'],
    commentary:
      '**NOTE:** This ability creates a space for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      name: field({
        name: 'name',
        description: 'the name of the space',
      }),
      description: field({
        name: 'description',
        description: 'an optional description of the space',
        optional: true,
      }),
    },
  }),

  'space/update[contact][by-id]': createSpaceUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Space',
    description: 'Update an existing space',
    tags: ['space', 'update', 'contact', 'alpha'],
    commentary:
      '**NOTE:** This ability updates a space for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the space',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'the updated description of the space',
        optional: true,
      }),
    },
  }),

  'space/delete[contact][by-id]': createSpaceDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space',
    description: 'Delete an existing space',
    tags: ['space', 'delete', 'contact', 'alpha'],
    commentary:
      '**NOTE:** This ability deletes a space for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to delete',
      }),
    },
  }),

  // @todo add [bot] scope variants for spaces if bots need to manage their own spaces

  'space/storage/list': createSpaceStorageListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Space Storage Files',
    description: 'List all files in a specific space directory',
    tags: ['space', 'storage', 'list'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'optional directory path to list files from',
        default: '.',
        optional: true,
      }),
      recursive: field({
        name: 'recursive',
        description: 'whether to list files recursively',
        type: 'boolean',
        optional: true,
        default: false,
      }),
    },
    space: '@space',
  }),

  'space/storage/read': createSpaceStorageReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Space Storage File',
    description:
      'Read the content of a file in a specific space directory. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads.',
    tags: ['space', 'storage', 'read'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'absolute path to the file to read',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start reading from (1-indexed, line 1 is the first line)',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end reading at, inclusive (1-indexed). Prefer reading at least 100 lines or more per request to minimize round trips',
        type: 'number',
        optional: true,
      }),
    },
    space: '@space',
  }),

  'space/storage/write': createSpaceStorageWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write Space Storage File',
    description:
      'Write content to a file in a specific space directory. Without line parameters, overwrites the entire file. With startLine only, inserts before that line. With startLine and endLine, replaces that range.',
    tags: ['space', 'storage', 'write'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'absolute path to the file to write',
      }),
      content: field({
        name: 'content',
        description: 'the content to write to the file',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start writing at (1-indexed). If only startLine is provided, content is inserted before this line. If both startLine and endLine are provided, lines in that range are replaced.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end writing at, inclusive (1-indexed). Used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
      }),
    },
    space: '@space',
  }),

  'space/storage/rw': createSpaceStorageRwTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read/Write Space Storage File',
    description:
      'Read or write content to a file in the space storage. Use mode "read" to read file contents, or mode "write" to write content. For write mode, without line parameters overwrites the entire file, with startLine only inserts before that line, with startLine and endLine replaces that range.',
    tags: ['space', 'storage', 'read', 'write'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'the path to the file to read or write',
      }),
      mode: field({
        name: 'mode',
        description:
          'the mode: "read" to read file contents, "write" to write content',
        enum: ['read', 'write'],
      }),
      content: field({
        name: 'content',
        description:
          'the content to write to the file (required for write mode)',
        optional: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start at (1-indexed). For read mode, limits the output. For write mode with only startLine, content is inserted before this line. For write mode with both startLine and endLine, lines in that range are replaced.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end at, inclusive (1-indexed). For read mode, limits the output. For write mode, used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
      }),
    },
    space: '@space',
  }),

  'space/storage/delete': createSpaceStorageDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space Storage File',
    description: 'Delete a file in a specific space directory',
    tags: ['space', 'storage', 'delete'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'the path to the file to delete',
      }),
    },
    space: '@space',
  }),

  'space/storage/move': createSpaceStorageMoveTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Move Space Storage File',
    description: 'Move or rename a file in a specific space directory',
    tags: ['space', 'storage', 'move'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'the path to the file to move',
      }),
      destinationPath: field({
        name: 'destinationPath',
        description: 'the destination path for the file',
      }),
    },
    space: '@space',
  }),

  'space/storage/copy': createSpaceStorageCopyTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Copy Space Storage File',
    description:
      'Copy a file to another location in a specific space directory',
    tags: ['space', 'storage', 'copy'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'the path to the file to copy',
      }),
      destinationPath: field({
        name: 'destinationPath',
        description: 'the destination path for the copied file',
      }),
    },
    space: '@space',
  }),

  'space/storage/search': createSpaceStorageSearchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Search Space Storage Files',
    description:
      'Search files in a specific space directory using specific terms',
    tags: ['space', 'storage', 'search', 'alpha'], // @todo it will be alpah until we implement it
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      query: field({
        name: 'query',
        description: 'the search query',
      }),
    },
    space: '@space',
  }),

  'space/storage/import': createSpaceStorageImportTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Import URL to Space Storage',
    description: 'Import a file from a URL into space storage',
    tags: ['space', 'storage', 'import'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      url: field({
        name: 'url',
        description: 'the URL to import from',
      }),
      path: field({
        name: 'path',
        description: 'the destination path in the space storage',
      }),
    },
    space: '@space',
  }),

  'space/storage/link': createSpaceStorageLinkTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Get Space Storage File Link',
    description:
      'Get a public link (presigned URL) to access a file in space storage',
    tags: ['space', 'storage', 'link'],
    commentary: '**NOTE:** You must link a space to use this ability.',
    instruction: {
      '@scope': 'user',
      spaceId: space(),
      path: field({
        name: 'path',
        description: 'the path to the file to get a link for',
      }),
    },
    space: '@space',
  }),

  // @todo add [contact] and [bot] scope variants for storage operations

  // @todo for the methods below we need to make it an option to provide a
  // scope to limit spaces to the specific user (default), blueprint or contact

  'space/storage/list[by-id]': createSpaceStorageListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Space Storage Files',
    description: 'List all files in a specific space directory',
    tags: ['space', 'storage', 'list'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to list files from',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'optional directory path to list files from',
        default: '.',
        optional: true,
      }),
      recursive: field({
        name: 'recursive',
        description: 'whether to list files recursively',
        type: 'boolean',
        optional: true,
        default: false,
      }),
    },
    commentary: `This is the same as 'List Space Storage Files' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/read[by-id]': createSpaceStorageReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Space Storage File',
    description:
      'Read the content of a file in a specific space directory. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads.',
    tags: ['space', 'storage', 'read'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to read files from',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to read',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start reading from (1-indexed, line 1 is the first line)',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end reading at, inclusive (1-indexed). Prefer reading at least 100 lines or more per request to minimize round trips',
        type: 'number',
        optional: true,
      }),
    },
    commentary: `This is the same as 'Read Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/write[by-id]': createSpaceStorageWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write Space Storage File',
    description:
      'Write content to a file in a specific space directory. Without line parameters, overwrites the entire file. With startLine only, inserts before that line. With startLine and endLine, replaces that range.',
    tags: ['space', 'storage', 'write'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to write files to',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to write',
      }),
      content: field({
        name: 'content',
        description: 'the content to write to the file',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start writing at (1-indexed). If only startLine is provided, content is inserted before this line. If both startLine and endLine are provided, lines in that range are replaced.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end writing at, inclusive (1-indexed). Used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
      }),
    },
    commentary: `This is the same as 'Write Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/rw[by-id]': createSpaceStorageRwTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read/Write Space Storage File',
    description:
      'Read or write content to a file in a specific space. Use mode "read" to read file contents, or mode "write" to write content. For write mode, without line parameters overwrites the entire file, with startLine only inserts before that line, with startLine and endLine replaces that range.',
    tags: ['space', 'storage', 'read', 'write'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to read or write files in',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to read or write',
      }),
      mode: field({
        name: 'mode',
        description:
          'the mode: "read" to read file contents, "write" to write content',
        enum: ['read', 'write'],
      }),
      content: field({
        name: 'content',
        description:
          'the content to write to the file (required for write mode)',
        optional: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start at (1-indexed). For read mode, limits the output. For write mode with only startLine, content is inserted before this line. For write mode with both startLine and endLine, lines in that range are replaced.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end at, inclusive (1-indexed). For read mode, limits the output. For write mode, used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
      }),
    },
    commentary: `This is the same as 'Read/Write Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/delete[by-id]': createSpaceStorageDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Space Storage File',
    description: 'Delete a file in a specific space directory',
    tags: ['space', 'storage', 'delete'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to delete files from',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to delete',
      }),
    },
    commentary: `This is the same as 'Delete Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/move[by-id]': createSpaceStorageMoveTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Move Space Storage File',
    description: 'Move or rename a file in a specific space directory',
    tags: ['space', 'storage', 'move'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to move files in',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to move',
      }),
      destinationPath: field({
        name: 'destinationPath',
        description: 'the destination path for the file',
      }),
    },
    commentary: `This is the same as 'Move Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/copy[by-id]': createSpaceStorageCopyTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Copy Space Storage File',
    description:
      'Copy a file to another location in a specific space directory',
    tags: ['space', 'storage', 'copy'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to copy files in',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to copy',
      }),
      destinationPath: field({
        name: 'destinationPath',
        description: 'the destination path for the copied file',
      }),
    },
    commentary: `This is the same as 'Copy Space Storage File' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/search[by-id]': createSpaceStorageSearchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Search Space Storage Files',
    description:
      'Search files in a specific space directory using specific terms',
    tags: ['space', 'storage', 'search'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to search files in',
        placeholder: true,
      }),
      query: field({
        name: 'query',
        description: 'the search query',
      }),
    },
    commentary: `This is the same as 'Search Space Storage Files' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/import[by-id]': createSpaceStorageImportTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Import URL to Space Storage',
    description: 'Import a file from a URL into space storage',
    tags: ['space', 'storage', 'import'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space to import into',
        placeholder: true,
      }),
      url: field({
        name: 'url',
        description: 'the URL to import from',
      }),
      path: field({
        name: 'path',
        description: 'the destination path in the space storage',
      }),
    },
    commentary: `This is the same as 'Import URL to Space Storage' but with the space ID provided dynamically via a parameter.`,
  }),

  'space/storage/link[by-id]': createSpaceStorageLinkTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Get Space Storage File Link',
    description:
      'Get a public link (presigned URL) to access a file in space storage',
    tags: ['space', 'storage', 'link'],
    instruction: {
      '@scope': 'user',
      spaceId: field({
        name: 'spaceId',
        description: 'the ID of the space',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description: 'the path to the file to get a link for',
      }),
    },
    commentary: `This is the same as 'Get Space Storage File Link' but with the space ID provided dynamically via a parameter.`,
  }),

  // --- Pack Abilities ---

  'pack/cbk/space/storage': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Space Storage Tools',
    description:
      'Installs space storage tools into the conversation. You can list, read, write, delete, move, copy, search, import, and link files in the linked space.',
    tags: ['space', 'storage', 'pack'],
    instruction: {
      abilities: [
        'space/storage/list',
        'space/storage/read',
        'space/storage/write',
        'space/storage/rw',
        'space/storage/delete',
        'space/storage/move',
        'space/storage/copy',
        'space/storage/search',
        'space/storage/import',
        'space/storage/link',
      ] satisfies (keyof typeof abilities)[],
    },
    space: '@space',
  }),

  'pack/cbk/space/storage[read-only]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Space Storage Read-Only Tools',
    description:
      'Installs read-only space storage tools into the conversation. You can list, read, search, and link files in the linked space without modification.',
    tags: ['space', 'storage', 'pack'],
    instruction: {
      abilities: [
        'space/storage/list',
        'space/storage/read',
        'space/storage/search',
        'space/storage/link',
      ] satisfies (keyof typeof abilities)[],
    },
    space: '@space',
  }),
}

// @todo add template to transfer between spaces

export default abilities
