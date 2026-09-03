import {
  createListPopTemplate,
  createListPushTemplate,
  createListReadTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit Redis list abilities.
 */
const abilities = {
  'list/push': createListPushTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Push To List',
    description:
      'Add an item to the start or end of a bot-scoped temporary Redis list.',
    tags: ['list', 'push', 'redis', 'beta'],
    commentary:
      '**NOTE:** This ability stores items in a bot-scoped Redis list. Lists expire after at most 48 hours.',
    instruction: {
      name: field({
        name: 'listName',
        description: 'stable name of the bot-scoped list',
        placeholder: true,
      }),
      item: field({
        name: 'item',
        description: 'item to add to the list',
      }),
      position: field({
        name: 'position',
        description: 'start to prepend, end to append',
        enum: ['start', 'end'],
        default: 'end',
      }),
    },
  }),

  'list/pop': createListPopTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Pop From List',
    description:
      'Remove and return an item from the start or end of a bot-scoped temporary Redis list.',
    tags: ['list', 'pop', 'redis', 'beta'],
    commentary:
      '**NOTE:** This ability removes one item from a bot-scoped Redis list. Lists expire after at most 48 hours.',
    instruction: {
      name: field({
        name: 'listName',
        description: 'stable name of the bot-scoped list',
        placeholder: true,
      }),
      position: field({
        name: 'position',
        description: 'start or end',
        enum: ['start', 'end'],
        default: 'start',
      }),
    },
  }),

  'list/read': createListReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read List',
    description:
      'Read items from the start or end of a bot-scoped temporary Redis list without removing them.',
    tags: ['list', 'read', 'redis', 'beta'],
    commentary:
      '**NOTE:** This ability reads a bot-scoped Redis list. Lists expire after at most 48 hours.',
    instruction: {
      name: field({
        name: 'listName',
        description: 'stable name of the bot-scoped list',
        placeholder: true,
      }),
      position: field({
        name: 'position',
        description: 'start or end',
        enum: ['start', 'end'],
        default: 'start',
      }),
      offset: field({
        name: 'offset',
        type: 'number',
        description: 'number of items to skip from the selected position',
        default: 0,
      }),
      limit: field({
        name: 'limit',
        type: 'number',
        description: 'maximum number of items to read',
        default: 100,
      }),
    },
  }),
}

export default abilities
