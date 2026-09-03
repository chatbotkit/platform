import {
  bot,
  createPackTemplate,
  createRatingCreateTemplate,
  createRatingDeleteTemplate,
  createRatingFetchTemplate,
  createRatingListTemplate,
  field,
  object,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit rating abilities.
 */
const abilities = {
  'rating/list': createRatingListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Ratings',
    description: 'List ratings scoped to the connected bot',
    tags: ['rating', 'list', 'beta'],
    commentary: `Lists ratings belonging to the connected bot. Use this when the
bot should review its own ratings without manually providing a bot ID.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      value: field({
        name: 'value',
        type: 'number',
        description: 'optional rating value to filter by',
        optional: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'rating/list[by-bot-id]': createRatingListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Ratings',
    description: 'List ratings with optional bot scoping',
    tags: ['rating', 'list', 'beta'],
    commentary: `Lists ratings across the account with an optional bot ID filter.
Use this when the current bot needs to inspect ratings for another accessible
bot.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'optional rating value to filter by',
        optional: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
  }),

  'rating/fetch': createRatingFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Rating',
    description: 'Fetch a rating scoped to the connected bot',
    tags: ['rating', 'fetch', 'beta'],
    commentary: `Fetches full details for a rating belonging to the connected
bot. Use this to inspect one rating in depth.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to fetch',
      }),
    },
    bot: '#bot',
  }),

  'rating/fetch[by-bot-id]': createRatingFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Rating',
    description: 'Fetch a rating with optional bot scoping',
    tags: ['rating', 'fetch', 'beta'],
    commentary: `Fetches a rating by ID with an optional bot ID filter. Use
this when the rating may belong to another accessible bot.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to fetch',
      }),
    },
  }),

  'rating/create': createRatingCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Rating',
    description: 'Create a rating for the connected bot',
    tags: ['rating', 'create', 'beta'],
    commentary: `Creates a structured rating linked to the connected bot and the
current conversation when available.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      name: field({
        name: 'name',
        description: 'optional name of the rating',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'optional description of the rating',
        optional: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'the numeric rating value',
        placeholder: true,
      }),
      reason: field({
        name: 'reason',
        description: 'optional reason for the rating',
        optional: true,
      }),
      conversationId: field({
        name: 'conversationId',
        description: 'optional conversation ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      messageId: field({
        name: 'messageId',
        description: 'optional message ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to store on the rating as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'rating/create[by-bot-id]': createRatingCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Rating',
    description: 'Create a rating with optional bot assignment',
    tags: ['rating', 'create', 'beta'],
    commentary: `Creates a rating with an optional bot ID. Use this when feedback
should be recorded against another accessible bot.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to assign',
        optional: true,
      }),
      name: field({
        name: 'name',
        description: 'optional name of the rating',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'optional description of the rating',
        optional: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'the numeric rating value',
        placeholder: true,
      }),
      reason: field({
        name: 'reason',
        description: 'optional reason for the rating',
        optional: true,
      }),
      conversationId: field({
        name: 'conversationId',
        description: 'optional conversation ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      messageId: field({
        name: 'messageId',
        description: 'optional message ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to store on the rating as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'rating/delete': createRatingDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Rating',
    description: 'Delete a rating scoped to the connected bot',
    tags: ['rating', 'delete', 'beta'],
    commentary: `Deletes a rating belonging to the connected bot. Use this to
remove an erroneous rating record.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to delete',
      }),
    },
    bot: '#bot',
  }),

  'rating/delete[by-bot-id]': createRatingDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Rating',
    description: 'Delete a rating with optional bot scoping',
    tags: ['rating', 'delete', 'beta'],
    commentary: `Deletes a rating with an optional bot ID filter. Use this when
the rating may belong to another accessible bot.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to delete',
      }),
    },
  }),

  'rating/list[contact]': createRatingListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Contact Ratings',
    description: 'List ratings for the current contact and connected bot',
    tags: ['rating', 'list', 'contact', 'beta'],
    commentary: `Lists ratings belonging to the current contact and connected
bot. Use this for contact-scoped feedback analysis.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      value: field({
        name: 'value',
        type: 'number',
        description: 'optional rating value to filter by',
        optional: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'rating/list[contact][by-bot-id]': createRatingListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Contact Ratings',
    description: 'List contact ratings with optional bot scoping',
    tags: ['rating', 'list', 'contact', 'beta'],
    commentary: `Lists ratings for the current contact with an optional bot ID
filter.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'optional rating value to filter by',
        optional: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
  }),

  'rating/fetch[contact]': createRatingFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Contact Rating',
    description: 'Fetch a rating for the current contact and connected bot',
    tags: ['rating', 'fetch', 'contact', 'beta'],
    commentary: `Fetches full details for a rating belonging to the current
contact and connected bot.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to fetch',
      }),
    },
    bot: '#bot',
  }),

  'rating/fetch[contact][by-bot-id]': createRatingFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Contact Rating',
    description: 'Fetch a contact rating with optional bot scoping',
    tags: ['rating', 'fetch', 'contact', 'beta'],
    commentary: `Fetches a contact-scoped rating with an optional bot filter.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to fetch',
      }),
    },
  }),

  'rating/create[contact]': createRatingCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Contact Rating',
    description: 'Create a rating for the current contact and connected bot',
    tags: ['rating', 'create', 'contact', 'beta'],
    commentary: `Creates a rating for the current contact, linked to the
connected bot and current conversation when available.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      name: field({
        name: 'name',
        description: 'optional name of the rating',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'optional description of the rating',
        optional: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'the numeric rating value',
        placeholder: true,
      }),
      reason: field({
        name: 'reason',
        description: 'optional reason for the rating',
        optional: true,
      }),
      conversationId: field({
        name: 'conversationId',
        description: 'optional conversation ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      messageId: field({
        name: 'messageId',
        description: 'optional message ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to store on the rating as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'rating/create[contact][by-bot-id]': createRatingCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Contact Rating',
    description: 'Create a contact rating with optional bot assignment',
    tags: ['rating', 'create', 'contact', 'beta'],
    commentary: `Creates a contact-scoped rating with an optional bot ID.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to assign',
        optional: true,
      }),
      name: field({
        name: 'name',
        description: 'optional name of the rating',
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'optional description of the rating',
        optional: true,
      }),
      value: field({
        name: 'value',
        type: 'number',
        description: 'the numeric rating value',
        placeholder: true,
      }),
      reason: field({
        name: 'reason',
        description: 'optional reason for the rating',
        optional: true,
      }),
      conversationId: field({
        name: 'conversationId',
        description: 'optional conversation ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      messageId: field({
        name: 'messageId',
        description: 'optional message ID to associate with the rating',
        optional: true,
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to store on the rating as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'rating/delete[contact]': createRatingDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Contact Rating',
    description: 'Delete a rating for the current contact and connected bot',
    tags: ['rating', 'delete', 'contact', 'beta'],
    commentary: `Deletes a rating belonging to the current contact and connected
bot.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to delete',
      }),
    },
    bot: '#bot',
  }),

  'rating/delete[contact][by-bot-id]': createRatingDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Contact Rating',
    description: 'Delete a contact rating with optional bot scoping',
    tags: ['rating', 'delete', 'contact', 'beta'],
    commentary: `Deletes a contact-scoped rating with an optional bot ID filter.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      ratingId: field({
        name: 'ratingId',
        description: 'the ID of the rating to delete',
      }),
    },
  }),

  'pack/rating': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Rating Tools',
    description:
      'Installs rating tools scoped to the connected bot. You can list, create, fetch, and delete ratings.',
    tags: ['rating', 'pack', 'beta'],
    instruction: {
      abilities: [
        'rating/list',
        'rating/create',
        'rating/fetch',
        'rating/delete',
      ] satisfies (keyof typeof abilities)[],
    },
    bot: '#bot',
  }),

  'pack/rating[by-bot-id]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Rating Tools',
    description:
      'Installs rating tools with dynamic bot scoping so ratings can be managed across accessible bots.',
    tags: ['rating', 'pack', 'beta'],
    instruction: {
      abilities: [
        'rating/list[by-bot-id]',
        'rating/create[by-bot-id]',
        'rating/fetch[by-bot-id]',
        'rating/delete[by-bot-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/rating[contact]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Contact Rating Tools',
    description:
      'Installs rating tools scoped to the current contact and connected bot. Each contact can only access their own ratings.',
    tags: ['rating', 'contact', 'pack', 'beta'],
    instruction: {
      abilities: [
        'rating/list[contact]',
        'rating/create[contact]',
        'rating/fetch[contact]',
        'rating/delete[contact]',
      ] satisfies (keyof typeof abilities)[],
    },
    bot: '#bot',
  }),

  'pack/rating[contact][by-bot-id]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Contact Rating Tools',
    description:
      'Installs contact rating tools with dynamic bot scoping so a contact can work across accessible bots.',
    tags: ['rating', 'contact', 'pack', 'beta'],
    instruction: {
      abilities: [
        'rating/list[contact][by-bot-id]',
        'rating/create[contact][by-bot-id]',
        'rating/fetch[contact][by-bot-id]',
        'rating/delete[contact][by-bot-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
