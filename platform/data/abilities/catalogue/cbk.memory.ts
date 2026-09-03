import {
  createMemoryCreateTemplate,
  createMemoryDeleteTemplate,
  createMemoryListTemplate,
  createMemorySearchTemplate,
  createMemoryUpdateTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit memory abilities.
 */
const abilities = {
  // @note the context of these is all memories within the ChatBotKit account

  // @note fetch does not make sense for memories - they are simple text blobs
  // that should be searched or listed, not fetched individually by ID

  'memory/search': createMemorySearchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Search Memories',
    description: 'Search memories using specific search terms',
    tags: ['memory', 'search', 'alpha'],
    commentary: '**NOTE:** This ability searches memories within the account.',
    instruction: {
      '@scope': 'user',
      query: field({
        name: 'query',
        description: 'the search query',
        min: 1,
      }),
    },
  }),

  'memory/list': createMemoryListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Memories',
    description: 'List the most recent memories',
    tags: ['memory', 'list', 'alpha'],
    commentary: '**NOTE:** This ability lists memories within the account.',
    instruction: {
      '@scope': 'user',
    },
  }),

  'memory/create': createMemoryCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Memory',
    description: 'Create a new memory using the provided content',
    tags: ['memory', 'create', 'alpha'],
    commentary: '**NOTE:** This ability creates a memory within the account.',
    instruction: {
      '@scope': 'user',
      text: field({
        name: 'content',
        description: 'the content of the memory to create',
        min: 1,
      }),
    },
  }),

  'memory/update[by-id]': createMemoryUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Memory',
    description: 'Update an existing memory using the provided content',
    tags: ['memory', 'update', 'alpha'],
    commentary: '**NOTE:** This ability updates a memory within the account.',
    instruction: {
      '@scope': 'user',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to update',
        min: 1,
      }),
      text: field({
        name: 'content',
        description: 'the updated content of the memory',
        min: 1,
      }),
    },
  }),

  'memory/delete[by-id]': createMemoryDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Memory',
    description: 'Delete an existing memory',
    tags: ['memory', 'delete', 'alpha'],
    commentary: '**NOTE:** This ability deletes a memory within the account.',
    instruction: {
      '@scope': 'user',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to delete',
        min: 1,
      }),
    },
  }),

  // @note the context of these is all memories associated with a specific
  // contact

  'memory/search[contact]': createMemorySearchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Search Memories',
    description: 'Search memories using specific search terms',
    tags: ['memory', 'search', 'contact', 'beta'],
    commentary:
      '**NOTE:** This ability searches memories for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      query: field({
        name: 'query',
        description: 'the search query',
        min: 1,
      }),
    },
  }),

  'memory/list[contact]': createMemoryListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Memories',
    description: 'List the most recent memories',
    tags: ['memory', 'list', 'contact', 'beta'],
    commentary:
      '**NOTE:** This ability lists memories for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
    },
  }),

  'memory/create[contact]': createMemoryCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Memory',
    description: 'Create a new memory using the provided content',
    tags: ['memory', 'create', 'contact', 'beta'],
    commentary:
      '**NOTE:** This ability creates a memory for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      text: field({
        name: 'content',
        description: 'the content of the memory to create',
        min: 1,
      }),
    },
  }),

  'memory/update[contact][by-id]': createMemoryUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Memory',
    description: 'Update an existing memory using the provided content',
    tags: ['memory', 'update', 'contact', 'beta'],
    commentary:
      '**NOTE:** This ability updates a memory for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to update',
        min: 1,
      }),
      text: field({
        name: 'content',
        description: 'the updated content of the memory',
        min: 1,
      }),
    },
  }),

  'memory/delete[contact][by-id]': createMemoryDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Memory',
    description: 'Delete an existing memory',
    tags: ['memory', 'delete', 'contact', 'beta'],
    commentary:
      '**NOTE:** This ability deletes a memory for the contact in the conversational context.',
    instruction: {
      '@scope': 'contact',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to delete',
        min: 1,
      }),
    },
  }),

  // @note the context of these is all memories associated with a specific bot

  'memory/search[bot]': createMemorySearchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Search Memories',
    description: 'Search memories using specific search terms',
    tags: ['memory', 'search', 'bot', 'beta'],
    commentary: '**NOTE:** This ability searches memories for the bot itself.',
    instruction: {
      '@scope': 'bot',
      query: field({
        name: 'query',
        description: 'the search query',
        min: 1,
      }),
    },
  }),

  'memory/list[bot]': createMemoryListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Memories',
    description: 'List the most recent memories',
    tags: ['memory', 'list', 'bot', 'beta'],
    commentary: '**NOTE:** This ability lists memories for the bot itself.',
    instruction: {
      '@scope': 'bot',
    },
  }),

  'memory/create[bot]': createMemoryCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Memory',
    description: 'Create a new memory using the provided content',
    tags: ['memory', 'create', 'bot', 'beta'],
    commentary: '**NOTE:** This ability creates a memory for the bot itself.',
    instruction: {
      '@scope': 'bot',
      text: field({
        name: 'content',
        description: 'the content of the memory to create',
        min: 1,
      }),
    },
  }),

  'memory/update[bot][by-id]': createMemoryUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Memory',
    description: 'Update an existing memory using the provided content',
    tags: ['memory', 'update', 'bot', 'beta'],
    commentary: '**NOTE:** This ability updates a memory for the bot itself.',
    instruction: {
      '@scope': 'bot',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to update',
        min: 1,
      }),
      text: field({
        name: 'content',
        description: 'the updated content of the memory',
        min: 1,
      }),
    },
  }),

  'memory/delete[bot][by-id]': createMemoryDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Memory',
    description: 'Delete an existing memory',
    tags: ['memory', 'delete', 'bot', 'beta'],
    commentary: '**NOTE:** This ability deletes a memory for the bot itself.',
    instruction: {
      '@scope': 'bot',
      memoryId: field({
        name: 'memoryId',
        description: 'the ID of the memory to delete',
        min: 1,
      }),
    },
  }),

  'pack/memory': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Memory Tools',
    description:
      'Installs memory tools into the conversation. You can search, list, create, update, and delete durable memories within the account.',
    tags: ['memory', 'pack', 'alpha'],
    instruction: {
      abilities: [
        'memory/search',
        'memory/list',
        'memory/create',
        'memory/update[by-id]',
        'memory/delete[by-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
