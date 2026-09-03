import {
  bot,
  createBotApplyTemplate,
  createBotAskTemplate,
  createBotBackstoryReadTemplate,
  createBotBackstoryWriteTemplate,
  createBotCallTemplate,
  createBotListTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit bot abilities.
 *
 * These abilities allow interacting with other bots - asking questions,
 * calling bots to perform actions, and listing available bots.
 */
const abilities = {
  /**
   * Asks another bot a question. The bot only sees the question without
   * any additional context.
   */
  'bot/ask': createBotAskTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Ask Bot',
    description: 'Ask another bot a question',
    tags: ['bot', 'ask'],
    bot: '#bot',
    instruction: {
      botId: bot(),
      prompt: field({
        name: 'question',
        description: 'the question to ask the bot',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will only see the question that is posed to it \
without any additional context. This is perfect for simpler situations where \
you want to get an answer without spending too much time and resources on the \
bot execution.`,
  }),

  /**
   * Asks another bot a question by specifying the bot ID dynamically.
   */
  'bot/ask[by-id]': createBotAskTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Ask Bot',
    description: 'Ask another bot a question',
    tags: ['bot', 'ask'],
    instruction: {
      botId: field({
        name: 'botId',
        description: 'the bot ID',
        placeholder: true,
      }),
      prompt: field({
        name: 'question',
        description: 'the question to ask the bot',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will only see the question that is posed to it \
without any additional context. This is perfect for simpler situations where \
you want to get an answer without spending too much time and resources on the \
bot execution.

_This is the dynamic version of the bot/ask ability that allows you to specify \
the bot ID that you want to ask._`,
  }),

  /**
   * Asks multiple bots a question.
   */
  'bot/ask[multi]': createBotAskTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Ask Multiple Bots',
    description: 'Ask multiple bots a question',
    tags: ['bot', 'ask', 'multi'],
    instruction: {
      botIds: field({
        name: 'ids',
        description: 'comma-separated list of bot IDs to ask',
        placeholder: true,
      }),
      prompt: field({
        name: 'question',
        description: 'the question to ask the bots',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bots will only see the question that is posed to them \
without any additional context. This is perfect for simpler situations where \
you want to get answers from multiple bots without spending too much time and \
resources on the bot execution.`,
  }),

  /**
   * Calls another bot to perform an action. The bot sees the full conversation
   * context and generates additional context based on the action.
   */
  'bot/call': createBotCallTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Call Bot',
    description: 'Call another bot to perform an action',
    tags: ['bot', 'call'],
    bot: '#bot',
    instruction: {
      botId: bot(),
      prompt: field({
        name: 'action',
        description: 'detailed description of the action to be performed',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will see the full conversation context as well as \
generate additional context based on the action that is being performed. This \
is perfect for more advanced use-cases where you want to get more detailed \
answers as well as perform more complex actions.`,
  }),

  /**
   * Calls another bot by specifying the bot ID dynamically.
   */
  'bot/call[by-id]': createBotCallTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Call Bot',
    description: 'Call another bot to perform an action',
    tags: ['bot', 'call'],
    instruction: {
      botId: field({
        name: 'botId',
        description: 'the bot ID',
        placeholder: true,
      }),
      prompt: field({
        name: 'action',
        description: 'detailed description of the action to be performed',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will see the full conversation context as well as \
generate additional context based on the action that is being performed. This \
is perfect for more advanced use-cases where you want to get more detailed \
answers as well as perform more complex actions.

_This is the dynamic version of the bot/call ability that allows you to \
specify the bot ID that you want to call._`,
  }),

  /**
   * Calls multiple bots to perform an action.
   */
  'bot/call[multi]': createBotCallTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Call Multiple Bots',
    description: 'Call multiple bots to perform an action',
    tags: ['bot', 'call', 'multi'],
    instruction: {
      botIds: field({
        name: 'ids',
        description: 'comma-separated list of bot IDs to call',
        placeholder: true,
      }),
      prompt: field({
        name: 'action',
        description: 'detailed description of the action to be performed',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bots will see the full conversation context as well as \
generate additional context based on the action that is being performed. This \
is perfect for more advanced use-cases where you want to get more detailed \
answers as well as perform more complex actions across multiple bots.`,
  }),

  /**
   * Applies another bot to the current visible execution context.
   */
  'bot/apply': createBotApplyTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Apply Bot',
    description: 'Apply another bot to the current context',
    tags: ['bot', 'apply', 'beta'],
    bot: '#bot',
    instruction: {
      botId: bot(),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will be applied to the current visible execution \
context. The linked resource context determine how it acts, without requiring \
the caller to supply free-form instructions.`,
  }),

  /**
   * Applies another bot by ID to the current visible execution context.
   */
  'bot/apply[by-id]': createBotApplyTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Apply Bot',
    description: 'Apply another bot to the current context',
    tags: ['bot', 'apply', 'beta'],
    instruction: {
      botId: field({
        name: 'botId',
        description: 'the bot ID',
        placeholder: true,
      }),
      timeout: field({
        name: 'timeout',
        description: 'optional timeout in milliseconds',
        type: 'number',
        max: 300_000,
        optional: true,
      }),
    },
    commentary: `The bot will be applied to the current visible execution \
context. The bot's name and description determine how it acts on the context, \
without requiring the caller to supply free-form instructions.

_This is the dynamic version of the bot/apply ability that allows you to \
specify the bot ID that you want to apply._`,
  }),

  /**
   * Lists all available bots for the current user account.
   */
  'bot/list': createBotListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Bots',
    description: 'List all available bots for the current user account',
    tags: ['bot', 'list', 'beta'],
    instruction: {
      take: field({
        name: 'take',
        description: 'optional limit on the number of bots to return',
        type: 'number',
        optional: true,
        default: 100,
      }),
    },
    commentary: `This ability returns a list of all bots that are available to \
the current user account. You can optionally specify a take parameter to \
restrict the number of bots returned. This is useful for discovering available \
bots before using them with other bot abilities like bot/ask or bot/call.

**NOTE:** You can use the blueprint related abilities to only list bots within \
the context of a specific blueprint.`,
  }),

  /**
   * Reads the backstory of a connected bot.
   */
  'bot/backstory/read': createBotBackstoryReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Bot Backstory',
    description: 'Read the backstory of a connected bot',
    tags: ['bot', 'backstory', 'read', 'beta'],
    bot: '#bot',
    instruction: {
      botId: bot(),
    },
    commentary: `This ability reads and returns the current backstory of the \
connected bot. Use this to inspect what instructions the bot currently has \
before deciding whether to write them.`,
  }),

  /**
   * Reads the backstory of a bot by specifying the bot ID dynamically.
   */
  'bot/backstory/read[by-id]': createBotBackstoryReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read Bot Backstory',
    description: 'Read the backstory of a bot by ID',
    tags: ['bot', 'backstory', 'read', 'beta'],
    instruction: {
      botId: field({
        name: 'botId',
        description: 'the bot ID',
        placeholder: true,
      }),
    },
    commentary: `This ability reads and returns the current backstory of a bot \
specified by ID. Use this to inspect what instructions a bot currently has \
before deciding whether to write them.

_This is the dynamic version of the bot/backstory/read ability that allows you \
to specify the bot ID._`,
  }),

  /**
   * Writes the backstory of a connected bot.
   */
  'bot/backstory/write': createBotBackstoryWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write Bot Backstory',
    description: 'Write the backstory of a connected bot',
    tags: ['bot', 'backstory', 'write', 'beta'],
    bot: '#bot',
    instruction: {
      botId: bot(),
      // @note key is 'content' to avoid collision with the 'backstory' routing segment
      content: field({
        name: 'content',
        description: 'the new backstory content for the bot',
      }),
    },
    commentary: `This ability writes the backstory of the connected bot with \
the provided content. Use this to update the bot's instructions or persona \
based on context gathered during the conversation.`,
  }),

  /**
   * Writes the backstory of a bot by specifying the bot ID dynamically.
   */
  'bot/backstory/write[by-id]': createBotBackstoryWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write Bot Backstory',
    description: 'Write the backstory of a bot by ID',
    tags: ['bot', 'backstory', 'write', 'beta'],
    instruction: {
      botId: field({
        name: 'botId',
        description: 'the bot ID',
        placeholder: true,
      }),
      // @note key is 'content' to avoid collision with the 'backstory' routing segment
      content: field({
        name: 'content',
        description: 'the new backstory content for the bot',
      }),
    },
    commentary: `This ability writes the backstory of a bot specified by ID \
with the provided content. Use this to update the bot's instructions or \
persona based on context gathered during the conversation.

_This is the dynamic version of the bot/backstory/write ability that allows \
you to specify the bot ID._`,
  }),

  /**
   * Installs bot backstory read and write abilities as a reprogramming pack.
   */
  'pack/bot/reprogramming': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Bot Reprogramming Tools',
    description:
      'Installs bot backstory read and write tools into the conversation. You \
can read the current backstory of the connected bot and overwrite it with new \
content.',
    tags: ['bot', 'backstory', 'reprogramming', 'pack', 'beta'],
    bot: '#bot',
    instruction: {
      abilities: [
        'bot/backstory/read',
        'bot/backstory/write',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
