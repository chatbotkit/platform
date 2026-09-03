/* eslint-disable custom-eslint-rules/require-dispose-for-factory-result -- tests create short-lived engines and assert engine behavior directly */
import { getShortDate, getShortTime } from '@chatbotkit-dev/time'

import { installOpenAITestLanguageModels } from '@/jest/utils/openai'
import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import {
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import { botBlockOk, getBotBlock } from '@/lib/bot.block'
import { waitForChannelMessage } from '@/lib/channel.session'
import { executeInContext, setContextBot } from '@/lib/context.store'
import {
  BasicFunctionEngine,
  CoreEngine,
  DynamicFunctionEngine,
  MIN_COMPACT_MESSAGES_THRESHOLD,
  MIN_COMPACT_TOKENS_THRESHOLD,
  assertBotNotBlocked,
  getAutoEngine,
  getStatefulConversationEngine,
  getStatefulConversationEngineClass,
  getStatelessConversationEngine,
  getStatelessConversationEngineClass,
} from '@/lib/conversation.engine'
import {
  TAG_ABORT,
  TAG_COMPACTION_BEGIN,
  TAG_COMPACTION_END,
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_ERROR,
  TAG_INTENT_DETECTION_BEGIN,
  TAG_INTENT_DETECTION_END,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  TAG_USAGE,
} from '@/lib/conversation.tag'
import { SystemError } from '@/lib/error'
import { extractData } from '@/lib/extract.data'
import { detectIntentV3 } from '@/lib/intent'
import { completeChatConversation as completeChatConversationForDeepseek } from '@/lib/model.provider.deepseek.conv'
import { createChatCompletionStream } from '@/lib/model.provider.openai'
import {
  completeChatConversation as completeChatConversationForOpenAI,
  completeResponseConversation as completeResponseConversationForOpenAI,
} from '@/lib/model.provider.openai.conv'
import { clone } from '@/lib/object'
import { Result } from '@/lib/result'
import * as skillsetApply from '@/lib/skillset.apply'
import { reportTokenUsage } from '@/lib/system.metrics'
import { getEnvironmentTools } from '@/lib/tool.environment'
import { recordLanguageTokenUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

import {
  INTENT_DETECTION_BEGIN_TYPE,
  INTENT_DETECTION_END_TYPE,
  MESSAGE_TYPE,
  OPERATION_BEGIN_TYPE,
  OPERATION_END_TYPE,
  TOKEN_TYPE,
} from '@/hooks/useConversationManager'

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openai')
  ? describe
  : describe.skip

const restoreTestLanguageModels = installOpenAITestLanguageModels()

afterAll(restoreTestLanguageModels)

jest.mock('@/lib/channel.session', () => ({
  waitForChannelMessage: jest.fn(),
}))

jest.mock('@/lib/bot.block', () => ({
  // default: not blocked, so the guard is a no-op for the rest of the suite
  botBlockOk: jest.fn().mockResolvedValue(true),
  getBotBlock: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/skillset.apply', () => {
  return {
    __esModule: true, // @note without this a "Cannot redefine property" error is thrown

    ...jest.requireActual('@/lib/skillset.apply'),
  }
})

jest.mock('@/lib/usage.record', () => {
  return {
    ...jest.requireActual('@/lib/usage.record'),

    recordLanguageTokenUsage: jest.fn(
      jest.requireActual('@/lib/usage.record').recordLanguageTokenUsage
    ),
  }
})

jest.mock('@/lib/extract.data', () => ({
  extractData: jest.fn(),
}))

jest.mock('@/lib/intent', () => ({
  ...jest.requireActual('@/lib/intent'),
  detectIntentV3: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => {
  return {
    ...jest.requireActual('@/lib/model.provider.openai'),

    createChatCompletionStream: jest.fn(
      jest.requireActual('@/lib/model.provider.openai')
        .createChatCompletionStream
    ),
  }
})

jest.mock('@/lib/system.metrics', () => {
  return {
    ...jest.requireActual('@/lib/system.metrics'),

    reportTokenUsage: jest.fn(),
  }
})

jest.mock('@/lib/tool.environment', () => {
  return {
    ...jest.requireActual('@/lib/tool.environment'),

    getEnvironmentTools: jest.fn(async () => []),
  }
})

jest.mock('@/prisma/client', () => {
  return {
    __esModule: true,

    default: {
      skillset: {
        findUnique: jest.fn(),
      },

      conversation: {
        findUnique: jest.fn(),
      },

      message: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findMyriad: jest.fn(),
      },

      usage: {
        create: jest.fn().mockResolvedValue({}),
      },
    },
  }
})

jest.retryTimes(3)

describe('CONSTS', () => {
  // @note make sure that we have some level of consistency between the types
  // used in the API and the react hook

  it.each([
    [TAG_INTENT_DETECTION_BEGIN, INTENT_DETECTION_BEGIN_TYPE],
    [TAG_INTENT_DETECTION_END, INTENT_DETECTION_END_TYPE],
    [TAG_OPERATION_BEGIN, OPERATION_BEGIN_TYPE],
    [TAG_OPERATION_END, OPERATION_END_TYPE],
    [TAG_TOKEN, TOKEN_TYPE],
    [TAG_MESSAGE, MESSAGE_TYPE],
  ])('validates domain %s correctly', (input, expected) => {
    expect(input).toBe(expected)
  })
})

describe('CoreEngine', () => {
  it('must be able to produce messages with a backstory', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'Talking about avocados.',
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect((await engine.getMessages())[0]).toEqual({
      type: 'backstory',
      text: 'Talking about avocados.',
    })
  })

  describe('snapshot', () => {
    it('returns a serializable function snapshot without handlers or hint messages', async () => {
      const engine = new (class extends CoreEngine {
        async getFunctions({ incomingMessages, signal }) {
          expect(incomingMessages).toEqual([
            { type: MessageType.user, text: 'Hello' },
          ])
          expect(signal).toBe('signal')

          return [
            {
              name: 'tool.snapshot',
              description: 'Snapshot tool.',
              parameters: {
                type: 'object',
                properties: {
                  value: {
                    type: 'number',
                  },
                },
              },
              icon: '@icon/tool',
              call: {
                start: true,
              },
              hintMessages: [{ type: MessageType.context, text: 'Hint' }],
              handler: async () => ({ ok: true }),
            },
          ]
        }
      })({
        userId: '123',
        model: 'gpt-4o',
        messages: [{ type: MessageType.user, text: 'Hello' }],
      })

      const snapshot = await engine.snapshot({ signal: 'signal' })

      expect(snapshot).toEqual({
        functions: [
          {
            name: 'tool.snapshot',
            description: 'Snapshot tool.',
            parameters: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                },
              },
            },
            icon: '@icon/tool',
            call: {
              start: true,
            },
          },
        ],
      })
      expect(snapshot.functions[0]).not.toHaveProperty('handler')
      expect(snapshot.functions[0]).not.toHaveProperty('hintMessages')
      expect(engine.messages).toEqual([
        { type: MessageType.user, text: 'Hello' },
      ])
    })
  })

  it('must be able to produce messages with a backstory and date replacements', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'Today is ${EARTH_DATE}.',
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect((await engine.getMessages())[0]).toEqual({
      type: 'backstory',
      text: `Today is ${getShortDate()}.`,
    })
  })

  it('must be able to produce messages with a backstory and time replacements', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'Today is ${EARTH_TIME}.',
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect((await engine.getMessages())[0]).toEqual({
      type: 'backstory',
      text: `Today is ${getShortTime()}.`,
    })
  })

  it('must be able to produce messages with a backstory and file replacements', async () => {
    class MyCoreEngine extends CoreEngine {
      async getFileContents(identifier) {
        return `Hello world from file ${identifier}!`
      }
    }

    const engine = new MyCoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'File: \n\n${FILE_abc123}',
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect((await engine.getMessages())[0]).toEqual({
      type: 'backstory',
      text: `File: \n\nHello world from file abc123!`,
    })
  })

  it('should filter duplicate consecutive messages', async () => {
    const engine = new CoreEngine({})

    engine.messages = [
      { type: MessageType.user, text: 'How are you?' },
      { type: MessageType.user, text: 'How are you?' },
      { type: MessageType.bot, text: 'I am fine, thanks for asking!' },
      { type: MessageType.bot, text: 'I am fine, thanks for asking!' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'How are you?' },
      { type: MessageType.bot, text: 'I am fine, thanks for asking!' },
    ])
  })

  it('should filter empty messages', async () => {
    const engine = new CoreEngine({})

    engine.messages = [
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      { type: MessageType.user, text: '' },
      { type: MessageType.user, text: '' },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ])
  })

  it('should inject a userInfo activity pair before the current message when the userInfo feature is set', async () => {
    const info = {
      name: 'Jane Doe',
      username: 'jane',
      email: 'jane@example.com',
      externalId: 'U123',
      source: 'slack',
    }

    const engine = new CoreEngine({
      features: [{ name: 'userInfo', options: info }],
    })

    engine.messages = [
      { type: MessageType.user, text: 'Hello' },
      { type: MessageType.bot, text: 'Hi there!' },
      { type: MessageType.user, text: 'How are you?' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'Hello' },
      { type: MessageType.bot, text: 'Hi there!' },
      makeRequestActivityMessage('getUserInfo', {}),
      makeResponseActivityMessage('getUserInfo', {}, { details: info }),
      { type: MessageType.user, text: 'How are you?' },
    ])
  })

  it('should not inject a userInfo activity pair when the userInfo feature is absent', async () => {
    const engine = new CoreEngine({})

    engine.messages = [
      { type: MessageType.user, text: 'Hello' },
      { type: MessageType.bot, text: 'Hi there!' },
      { type: MessageType.user, text: 'How are you?' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'Hello' },
      { type: MessageType.bot, text: 'Hi there!' },
      { type: MessageType.user, text: 'How are you?' },
    ])
  })

  it.skip('should filter out activity messages that are not at the end of the list', async () => {
    // @note it is not certain why we had this before - perhaps some kind of an
    // optimization - but the reality is that filtering the activity messages is
    // bad because they are always required in subsequent calls to ensure the
    // model is in the right state

    const engine = new CoreEngine({})

    engine.messages = [
      { type: MessageType.user, text: 'What is the weather like in London' },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'getWeather', arguments: {} },
          },
        },
      },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'getWeather',
              arguments: {},
              result: 'The weather in London is rainy.',
            },
          },
        },
      },
      { type: MessageType.bot, text: 'The weather in London is rainy.' },
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'getWeather', arguments: {} },
          },
        },
      },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'getWeather',
              arguments: {},
              result: 'The weather in Sofia is sunny.',
            },
          },
        },
      },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'What is the weather like in London' },
      { type: MessageType.bot, text: 'The weather in London is rainy.' },
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'getWeather', arguments: {} },
          },
        },
      },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'getWeather',
              arguments: {},
              result: 'The weather in Sofia is sunny.',
            },
          },
        },
      },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ])
  })

  it('should filter activity messages that are not in pairs', async () => {
    const engine = new CoreEngine({})

    engine.messages = [
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      {
        type: MessageType.activity,
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'getWeather', arguments: {} },
          },
        },
      },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ]

    const messages = await engine.getMessages()

    expect(messages).toEqual([
      { type: MessageType.user, text: 'What is the weather like in Sofia' },
      { type: MessageType.bot, text: 'The weather in Sofia is sunny.' },
    ])
  })

  it('the backstory must contain the dataset description if available', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      datasetId: '123',
    })

    engine.getDataset = async () => {
      return {
        name: 'ChatBotKit',
        description: 'XYZ',
      }
    }

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).toContain('XYZ')
  })

  it('the backstory must contain the skillset description if available', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      skillsetId: '123',
    })

    engine.getSkillset = async () => {
      return {
        name: 'ChatBotKit',
        description: 'XYZ',
      }
    }

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).toContain('XYZ')
  })

  it('the backstory should contain full skillset description without --- separator', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      skillsetId: '123',
    })

    engine.getSkillset = async () => {
      return {
        name: 'Weather Tools',
        description: `Short description for listing
---
Extended description with detailed information.
This should also appear in the backstory.`,
      }
    }

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Short description for listing')
    expect(messages[0].text).toContain(
      'Extended description with detailed information'
    )
    expect(messages[0].text).not.toContain('---')
  })

  it('the backstory must contain the inlineDatasets description if available', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      inlineDatasets: [
        {
          name: 'ChatBotKit',
          description: 'XYZ',
          records: [{ text: 'record1' }],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).toContain('XYZ')
  })

  it('the backstory must contain the inlineSkillsets description if available', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      inlineSkillsets: [
        {
          name: 'ChatBotKit',
          description: 'XYZ',
          abilities: [
            {
              name: 'ability1',
              description: 'Ability 1',
              instruction: 'Do something',
            },
          ],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).toContain('XYZ')
  })

  it('the backstory should not contain inline dataset information if no records are defined', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      inlineDatasets: [
        {
          name: 'ChatBotKit',
          description: 'XYZ',
          records: [],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).not.toContain('XYZ')
  })

  it('the backstory should not contain inline skillset information if no abilities are defined', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      inlineSkillsets: [
        {
          name: 'ChatBotKit',
          description: 'XYZ',
          abilities: [],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).not.toContain('XYZ')
  })

  it('the backstory should not contain inline skillset information if no name and description are defined even when abilities are present', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'ABC',

      inlineSkillsets: [
        {
          abilities: [
            {
              name: 'ability1',
              description: 'Ability 1',
              instruction: 'Do something',
            },
          ],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('ABC')
    expect(messages[0].text).not.toContain('XYZ')
  })

  it('get functions must return unique function names', async () => {
    const engine = new CoreEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: 'Talking about avocados.',

      functions: [
        {
          name: 'getWeather',
          description: 'Gets the weather at specific location',
          parameters: {},
        },
        {
          name: 'getWeather',
          description: 'Gets the weather at specific location',
          parameters: {},
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions([], [], {}, {})

    expect(functions.length).toBe(2)
    expect(functions[0].name).toBe('getWeather')
    expect(functions[1].name).toContain('getWeather_')
  })
})

describe('CoreEngine.isBackground', () => {
  it('should return false when no features are set', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
    })

    expect(engine.isBackground()).toBe(false)
  })

  it('should return false when features array is empty', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [],
    })

    expect(engine.isBackground()).toBe(false)
  })

  it('should return true when batch feature is enabled', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'batch' }],
    })

    expect(engine.isBackground()).toBe(true)
  })

  it('should return true when silent feature is enabled', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'silent' }],
    })

    expect(engine.isBackground()).toBe(true)
  })

  it('should return true when both batch and silent features are enabled', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'batch' }, { name: 'silent' }],
    })

    expect(engine.isBackground()).toBe(true)
  })

  it('should return false when only non-background features are enabled', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'vision' }, { name: 'markdown' }],
    })

    expect(engine.isBackground()).toBe(false)
  })

  it('should return true when batch is among other features', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'vision' }, { name: 'batch' }, { name: 'markdown' }],
    })

    expect(engine.isBackground()).toBe(true)
  })
})

describe('CoreEngine.getMessages guaranteed messages', () => {
  it('should use persisted backstory when constructor backstory is not set', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    engine.messages = [
      { type: MessageType.backstory, text: 'Persisted backstory' },
      { type: MessageType.checkpoint, text: 'Checkpoint summary' },
      { type: MessageType.user, text: 'Older user message' },
      { type: MessageType.bot, text: 'Older bot message' },
      { type: MessageType.user, text: 'Latest user message' },
    ]

    const messages = await engine.getMessages(3)

    expect(messages[0]).toEqual({
      type: MessageType.backstory,
      text: 'Persisted backstory',
    })
    expect(messages[1]).toEqual({
      type: MessageType.checkpoint,
      text: 'Checkpoint summary',
    })
    expect(messages[messages.length - 1]).toEqual({
      type: MessageType.user,
      text: 'Latest user message',
    })
  })

  it('should place checkpoint first when no backstory is available', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    engine.messages = [
      { type: MessageType.checkpoint, text: 'Checkpoint summary' },
      { type: MessageType.user, text: 'Older user message' },
      { type: MessageType.bot, text: 'Older bot message' },
      { type: MessageType.user, text: 'Latest user message' },
    ]

    const messages = await engine.getMessages(3)

    expect(messages[0]).toEqual({
      type: MessageType.checkpoint,
      text: 'Checkpoint summary',
    })
    expect(messages[messages.length - 1]).toEqual({
      type: MessageType.user,
      text: 'Latest user message',
    })
  })

  it('should keep only the latest checkpoint when multiple checkpoints exist', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    engine.messages = [
      { type: MessageType.backstory, text: 'Persisted backstory' },
      { type: MessageType.checkpoint, text: 'Old checkpoint' },
      { type: MessageType.user, text: 'Older user message' },
      { type: MessageType.checkpoint, text: 'Latest checkpoint' },
      { type: MessageType.bot, text: 'Older bot message' },
      { type: MessageType.user, text: 'Latest user message' },
    ]

    const messages = await engine.getMessages(4)

    expect(
      messages.filter((m) => m.type === MessageType.checkpoint)
    ).toHaveLength(1)
    expect(messages[1]).toEqual({
      type: MessageType.checkpoint,
      text: 'Latest checkpoint',
    })
  })
})

describeIfConfigured('BasicFunctionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('process', () => {
    it('passes structured intent input objects to the handler unchanged', async () => {
      const handler = jest.fn().mockResolvedValue('ok')

      detectIntentV3.mockResolvedValue({
        action: {
          name: 'action.image.edit',
          input: {
            prompt: 'Remove the background.',
            images: ['https://example.com/image.png'],
          },
        },
        tokensUsed: 3,
        modelUsed: 'gemini-2.5-flash',
      })

      const engine = new (class extends BasicFunctionEngine {
        constructor() {
          super({
            userId: '123',
            model: 'gpt-4o',
          })
        }

        async getFunctions() {
          return [
            {
              name: 'action.image.edit',
              description: 'Edit an image.',
              parameters: {
                type: 'object',
                properties: {},
              },
              handler,
            },
          ]
        }
      })()

      await engine.addMessages([
        { type: MessageType.user, text: 'Edit this image.' },
      ])

      await engine.process()

      expect(detectIntentV3).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        {
          prompt: 'Remove the background.',
          images: ['https://example.com/image.png'],
        },
        { newMessages: [] }
      )
    })

    it('wraps scalar forceFunction input as an input object for the handler', async () => {
      const handler = jest.fn().mockResolvedValue('ok')

      const engine = new (class extends BasicFunctionEngine {
        constructor() {
          super({
            userId: '123',
            model: 'gpt-4o',
          })
        }

        breakdownLanguageModel() {
          return {
            config: {
              forceFunction: 'query',
            },
          }
        }

        async getFunctions() {
          return [
            {
              name: 'query',
              description: 'Query the dataset.',
              parameters: {
                type: 'object',
                properties: {},
              },
              handler,
            },
          ]
        }
      })()

      await engine.addMessages([
        { type: MessageType.user, text: 'How much does the pro plan cost?' },
      ])

      await engine.process()

      expect(detectIntentV3).not.toHaveBeenCalled()
      expect(handler).toHaveBeenCalledWith(
        { input: 'How much does the pro plan cost?' },
        { newMessages: [] }
      )
    })
  })

  describe('apply', () => {
    it('invokes the named function with object input and persists generated messages at the end', async () => {
      const callOrder = []
      const handler = jest.fn().mockResolvedValue(
        new Result(
          { answer: 'done' },
          {
            source: 'handler',
          }
        )
      )

      const engine = new (class extends BasicFunctionEngine {
        constructor() {
          super({
            userId: '123',
            model: 'gpt-4o',
            messages: [{ type: MessageType.user, text: 'Apply this' }],
          })
        }

        async getFunctions({ newFunctionMessages, newMeta }) {
          return [
            {
              name: 'tool.apply',
              description: 'Apply tool.',
              parameters: {
                type: 'object',
                properties: {},
              },
              handler: async (args, context) => {
                callOrder.push('handler')

                newFunctionMessages.push({
                  type: MessageType.context,
                  text: 'Function context',
                })

                Object.assign(newMeta, {
                  source: 'function',
                })

                expect(context).toEqual({ newMessages: [] })

                return await handler(args, context)
              },
            },
          ]
        }

        async addMessages(messages) {
          callOrder.push('addMessages')

          return super.addMessages(messages)
        }
      })()

      const response = await engine.apply({
        name: 'tool.apply',
        input: {
          value: 123,
        },
      })

      expect(handler).toHaveBeenCalledWith(
        {
          value: 123,
        },
        { newMessages: [] }
      )
      expect(callOrder).toEqual(['handler', 'addMessages'])
      expect(response.result).toEqual({ answer: 'done' })
      expect(response.meta).toEqual({
        source: 'handler',
      })
      expect(response.messages).toEqual([
        {
          type: MessageType.context,
          text: 'Function context',
        },
      ])
      expect(engine.messages).toEqual(
        expect.arrayContaining([
          {
            type: MessageType.context,
            text: 'Function context',
          },
        ])
      )
    })
  })

  // @note skipped because it is really bad

  it.skip('must be able to query a dataset just', async () => {
    let calls = 0

    const engine = new (class extends BasicFunctionEngine {
      constructor() {
        super({
          userId: '123',

          backstory: 'Use the available tools to answer user questions.',

          model: 'gpt-4o',

          datasetId: '123',
        })
      }

      async getDataset() {
        return {
          name: 'ChatBotKit',
          description: 'This dataset contains information about ChatBotKit',
        }
      }

      async queryDataset(_name, search) {
        calls += 1

        return {
          result: 'The pro plan cost $468.',
          messages: [
            {
              type: 'context',
              text: `Answer as truthfully as possible.\n\nContext: "The pro plan cost $468."\n\nQuestion: "${search}"`,
            },
          ],
          usage: { token: 0 },
        }
      }
    })()

    await engine.send('Good day good sir')

    await engine.receive()

    await engine.send(
      'How much the pro plan costs? Use the query function for that.'
    )

    const response = await engine.receive()

    const responseText = response.messages.map(({ text }) => text).join('\n\n')

    expect(responseText).toContain('$468')

    // @todo should we just check for one call or more?

    expect(calls).toBeGreaterThan(0)
  })

  it.skip('must be able to query a dataset with force function', async () => {
    let calls = 0

    const engine = new (class extends BasicFunctionEngine {
      constructor() {
        super({
          userId: '123',

          backstory: 'Use the available tools to answer user questions.',

          model: 'text-qaa-001',

          datasetId: '123',
        })
      }

      async getDataset() {
        return {
          name: 'ChatBotKit',
          description: 'This dataset contains information about ChatBotKit',
        }
      }

      async queryDataset(_name, search) {
        calls += 1

        return {
          messages: [
            {
              type: 'context',
              text: `Answer as truthfully as possible.\n\nContext: "The pro plan cost $468."\n\nQuestion: "${search}"`,
            },
          ],
          usage: { token: 0 },
        }
      }
    })()

    await engine.send('Good day good sir')

    await engine.receive()

    // @todo should we just check for one call or more?

    expect(calls).toBeGreaterThan(0)
  })
})

describe('CoreEngine.getForceFunction', () => {
  it('should return undefined when no forceFunction is set', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({}, [{ name: 'myFunction' }])

    expect(result).toBeUndefined()
  })

  it('should return forceFunction when it exists in functions list', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({ forceFunction: 'myFunction' }, [
      { name: 'myFunction' },
      { name: 'otherFunction' },
    ])

    expect(result).toBe('myFunction')
  })

  it('should return undefined when forceFunction does not exist in functions list', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({ forceFunction: 'nonExistent' }, [
      { name: 'myFunction' },
      { name: 'otherFunction' },
    ])

    expect(result).toBeUndefined()
  })

  it('should use instance forceFunction when modelConfig.forceFunction is not set', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
      forceFunction: 'instanceFunction',
    })

    const result = engine.getForceFunction({}, [
      { name: 'instanceFunction' },
      { name: 'otherFunction' },
    ])

    expect(result).toBe('instanceFunction')
  })

  it('should return undefined when instance forceFunction does not exist in functions list', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
      forceFunction: 'nonExistent',
    })

    const result = engine.getForceFunction({}, [
      { name: 'myFunction' },
      { name: 'otherFunction' },
    ])

    expect(result).toBeUndefined()
  })

  it('should handle @first convention and return first matching function', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({ forceFunction: '@first' }, [
      { name: 'helper_function' }, // has underscore, should be skipped
      { name: 'success_handler' }, // has success, should be skipped
      { name: 'myFirstFunction' }, // should be selected
      { name: 'otherFunction' },
    ])

    expect(result).toBe('myFirstFunction')
  })

  it('should return undefined for @first when no matching function exists', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({ forceFunction: '@first' }, [
      { name: 'helper_function' },
      { name: 'success_handler' },
      { name: 'on_failure' },
    ])

    expect(result).toBeUndefined()
  })

  it('should prefer modelConfig.forceFunction over instance forceFunction', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
      forceFunction: 'instanceFunction',
    })

    const result = engine.getForceFunction(
      { forceFunction: 'configFunction' },
      [{ name: 'instanceFunction' }, { name: 'configFunction' }]
    )

    expect(result).toBe('configFunction')
  })

  it('should return undefined when forceFunction is specified but functions array is empty', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getForceFunction({ forceFunction: 'query' }, [])

    expect(result).toBeUndefined()
  })

  it('should return undefined when instance forceFunction is specified but functions array is empty', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
      forceFunction: 'query',
    })

    const result = engine.getForceFunction({}, [])

    expect(result).toBeUndefined()
  })
})

describe('CoreEngine.getFunctionsForPhase', () => {
  it('should return empty array when no functions have call property', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getFunctionsForPhase('start', [
      { name: 'func1', description: '', parameters: {} },
      { name: 'func2', description: '', parameters: {} },
    ])

    expect(result).toEqual([])
  })

  it('should return functions marked with start phase', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getFunctionsForPhase('start', [
      {
        name: 'startFunc',
        description: '',
        parameters: {},
        call: { start: true },
      },
      { name: 'endFunc', description: '', parameters: {}, call: { end: true } },
      { name: 'normalFunc', description: '', parameters: {} },
    ])

    expect(result).toEqual(['startFunc'])
  })

  it('should return functions marked with end phase', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getFunctionsForPhase('end', [
      {
        name: 'startFunc',
        description: '',
        parameters: {},
        call: { start: true },
      },
      { name: 'endFunc', description: '', parameters: {}, call: { end: true } },
      { name: 'normalFunc', description: '', parameters: {} },
    ])

    expect(result).toEqual(['endFunc'])
  })

  it('should return functions that are in both start and end phases', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const functions = [
      {
        name: 'bothPhases',
        description: '',
        parameters: {},
        call: { start: true, end: true },
      },
      {
        name: 'startOnly',
        description: '',
        parameters: {},
        call: { start: true },
      },
    ]

    const startResult = engine.getFunctionsForPhase('start', functions)
    const endResult = engine.getFunctionsForPhase('end', functions)

    expect(startResult).toEqual(['bothPhases', 'startOnly'])
    expect(endResult).toEqual(['bothPhases'])
  })

  it('should return multiple functions in order', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getFunctionsForPhase('start', [
      { name: 'first', description: '', parameters: {}, call: { start: true } },
      {
        name: 'second',
        description: '',
        parameters: {},
        call: { start: true },
      },
      { name: 'third', description: '', parameters: {}, call: { start: true } },
    ])

    expect(result).toEqual(['first', 'second', 'third'])
  })

  it('should not include functions with false call phase', () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'openai/gpt-4o',
    })

    const result = engine.getFunctionsForPhase('start', [
      {
        name: 'enabled',
        description: '',
        parameters: {},
        call: { start: true },
      },
      {
        name: 'disabled',
        description: '',
        parameters: {},
        call: { start: false },
      },
    ])

    expect(result).toEqual(['enabled'])
  })

  describe('getSkillset', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return null when skillset is not found in database instead of crashing', async () => {
      // Reproduces TypeError: Cannot read properties of null (reading 'abilities')
      // This happens when a conversation references a skillsetId but the skillset has been deleted

      prisma.skillset.findUnique.mockResolvedValue(null)

      const engine = new CoreEngine({
        userId: '123',
        model: 'gpt-4o',
        skillsetId: 'deleted-skillset-id',
      })

      // This should return null gracefully instead of throwing
      // "TypeError: Cannot read properties of null (reading 'abilities')"
      const skillset = await engine.getSkillset()

      expect(skillset).toBeNull()
    })
  })
})

describe('getConvFunction routing', () => {
  const makeBareEngine = (model) =>
    new DynamicFunctionEngine({
      userId: 'test123',
      model,
      messages: [{ type: MessageType.user, text: 'Test' }],
      sink: {
        push: jest.fn().mockResolvedValue(undefined),
        error: jest.fn().mockResolvedValue(undefined),
      },
    })

  it('routes a responses-capable openai model to the Responses conversation', () => {
    const engine = makeBareEngine('gpt-5.4-mini')

    // @note gpt-5.4-mini advertises the 'responses' feature, so the engine must
    // NOT pick the chat completions path (which 400s on tools + reasoning_effort)
    // - see the related regressions
    expect(engine.getConvFunction('gpt-5.4-mini')).toBe(
      completeResponseConversationForOpenAI
    )
  })

  it('routes a chat-only openai model to the chat conversation', () => {
    const engine = makeBareEngine('gpt-4o')

    expect(engine.getConvFunction('gpt-4o')).toBe(
      completeChatConversationForOpenAI
    )
  })

  it('routes a custom/BYOK model proxying to gpt-5.4-mini to the Responses conversation', () => {
    // @note a custom model whose own
    // features do not include 'responses', but which resolves to
    // gpt-5.4-mini (which requires the Responses API). It must NOT take the
    // chat completions path (which 400s on tools + reasoning_effort).
    const model =
      'custom/name=gpt-5.4-mini/provider=openai/reasoningEffort=medium/credentials=sk-test'

    const engine = makeBareEngine(model)

    expect(engine.getConvFunction(model)).toBe(
      completeResponseConversationForOpenAI
    )
  })

  it('keeps a custom/BYOK model proxying to gpt-4o on the chat conversation', () => {
    const model = 'custom/name=gpt-4o/provider=openai/credentials=sk-test'

    const engine = makeBareEngine(model)

    expect(engine.getConvFunction(model)).toBe(
      completeChatConversationForOpenAI
    )
  })

  it('routes a custom/BYOK deepseek model to the deepseek conversation', () => {
    const model =
      'custom/name=deepseek-chat/provider=deepseek/credentials=sk-test'

    const engine = makeBareEngine(model)

    expect(engine.getConvFunction(model)).toBe(
      completeChatConversationForDeepseek
    )
  })
})

describeIfConfigured('DynamicFunctionEngine', () => {
  describe('apply', () => {
    it('uses dynamic function message persistence rules and filters context messages', async () => {
      const engine = new (class extends DynamicFunctionEngine {
        constructor() {
          super({
            userId: '123',
            model: 'gpt-4o',
            messages: [{ type: MessageType.user, text: 'Apply this' }],
          })
        }

        async getFunctions({ newFunctionMessages }) {
          return [
            {
              name: 'tool.dynamic',
              description: 'Dynamic tool.',
              parameters: {
                type: 'object',
                properties: {},
              },
              handler: async () => {
                newFunctionMessages.push(
                  {
                    type: MessageType.context,
                    text: 'Context should be filtered',
                  },
                  makeResponseActivityMessage(
                    'tool.dynamic',
                    { value: 456 },
                    { ok: true }
                  )
                )

                return { ok: true }
              },
            },
          ]
        }
      })()

      const response = await engine.apply({
        name: 'tool.dynamic',
        input: {
          value: 456,
        },
      })

      expect(response.result).toEqual({ ok: true })
      expect(response.messages).toEqual([
        makeResponseActivityMessage(
          'tool.dynamic',
          { value: 456 },
          { ok: true }
        ),
      ])
      expect(response.messages).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: MessageType.context,
          }),
        ])
      )
    })
  })

  it('streams operation kind and justification for dataset operations', async () => {
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    const engine = new DynamicFunctionEngine({
      userId: '123',
      model: 'gpt-4o',
      sink,
    })

    await engine.queryDataset({
      name: 'searchDataset',
      input: 'pricing',
      justification: 'Searching the pricing dataset',
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'dataset',
        name: 'searchDataset',
        input: 'pricing',
        justification: 'Searching the pricing dataset',
        icon: '@logo/chatbotkit.com',
      },
    })
  })

  it('must be able to query a dataset just 2', async () => {
    let calls = 0

    const engine = new (class extends DynamicFunctionEngine {
      constructor() {
        super({
          userId: '123',

          backstory: 'Use the available tools to answer user questions.',

          model: 'gpt-4o',

          datasetId: '123',
        })
      }

      async getDataset() {
        return {
          name: 'ChatBotKit',
          description: 'This dataset contains information about ChatBotKit',
        }
      }

      async queryDataset(_name, search) {
        calls += 1

        return {
          result: 'The pro plan cost $468.',
          messages: [
            {
              type: 'context',
              text: `Answer as truthfully as possible.\n\nContext: "The pro plan cost $468."\n\nQuestion: "${search}"`,
            },
          ],
          usage: { token: 0 },
        }
      }
    })()

    await engine.send('Good day good sir')

    await engine.receive()

    await engine.send(
      'How much the pro plan costs? Use the query function for that.'
    )

    const response = await engine.receive()

    const responseText = response.messages.map(({ text }) => text).join('\n\n')

    expect(responseText).toContain('$468')

    // @todo should we just check for one call or more?

    expect(calls).toBeGreaterThan(0)
  })

  it('must be able to query a dataset with force function 2', async () => {
    let calls = 0

    const engine = new (class extends DynamicFunctionEngine {
      constructor() {
        super({
          userId: '123',

          backstory: 'Use the available tools to answer user questions.',

          model: 'text-qaa-004',

          datasetId: '123',
        })
      }

      async getDataset() {
        return {
          name: 'ChatBotKit',
          description: 'This dataset contains information about ChatBotKit',
        }
      }

      async queryDataset(_name, search) {
        calls += 1

        return {
          messages: [
            {
              type: 'context',
              text: `Answer as truthfully as possible.\n\nContext: "The pro plan cost $468."\n\nQuestion: "${search}"`,
            },
          ],
          usage: { token: 0 },
        }
      }
    })()

    await engine.send('Good day good sir')

    await engine.receive()

    // @todo should we just check for one call or more?

    expect(calls).toBeGreaterThan(0)
  })

  it('must be able to receive activity messages to indicate a function is being called', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      functions: [
        {
          name: 'getLastMessage',
          description: 'Get the last message',
          parameters: {},
        },
      ],
    })

    await engine.send(
      'Use getLastMessage function to retrieve the last message from the list.'
    )

    const { messages } = await engine.receive()

    expect(messages.length).toBe(1)
    expect(messages.at(-1).type).toBe('activity')
    expect(messages.at(-1).meta?.activity?.type).toBe('request')
    expect(messages.at(-1).meta?.activity?.function?.name).toBe(
      'getLastMessage'
    )
  })

  it('must be able to emit activity messages to indicate a function is being called', async () => {
    const messages = []

    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [
        {
          type: 'user',
          text: 'Use getLastMessage function to retrieve the last message from the list.',
        },
      ],

      functions: [
        {
          name: 'getLastMessage',
          description: 'Get the last message',
          parameters: {},
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }
        },

        async error() {},
      },
    })

    await engine.process()
    await engine.complete()

    expect(messages.length).toBe(1)
    expect(messages.at(-1).meta?.activity?.type).toBe('request')
    expect(messages.at(-1).meta?.activity?.function?.name).toBe(
      'getLastMessage'
    )
  })

  it('must be able to complete a message based on previous activity messages', async () => {
    const messages = []

    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [
        { type: 'user', text: 'Hello' },
        { type: 'bot', text: 'Hi there! How can I assist you today?' },
        { type: 'user', text: 'get the last keyword' },
        // an activity has been requested
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'request',
              function: { name: 'getLastKeyword', arguments: {} },
            },
          },
        },
        // an activity has been responded
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'response',
              function: {
                name: 'getLastKeyword',
                arguments: {},
                result: 'The last keyword is "abc123".',
              },
            },
          },
        },
      ],

      functions: [
        {
          name: 'getLastKeyword',
          description: 'Get the last keyword',
          parameters: {},
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }
        },

        async error() {},
      },
    })

    await engine.process()
    await engine.complete()

    expect(messages.length).toBe(1)
    expect(messages.at(-1).type).toBe('bot')
    expect(messages.at(-1).text).toContain('abc123')
  })

  it.skip('must be able to execute two consequential skillsets', async () => {
    const messages = []

    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      backstory: `You are a simple bot.

<|skillset|>
- name: countMessages
  description: Count the number of messages
  instruction: |
    \`\`\`echo
    999
    \`\`\`
- name: readLastMessage
  description: Get the last message
  instruction: |
    \`\`\`echo
    The last message is "abc123".
    \`\`\`
`,

      messages: [
        { type: 'user', text: 'Hello' },
        { type: 'bot', text: 'Hi there! How can I assist you today?' },
        {
          type: 'user',
          text: 'how many massages do I have and read the last message',
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }
        },

        async error() {},
      },
    })

    await engine.process()
    await engine.complete()

    expect(messages.length).toBe(1)
    expect(messages.at(-1).type).toBe('bot')
    expect(messages.at(-1).text).toContain('abc123')
  })

  it('must be able to complete a message based on many previous activity messages', async () => {
    const messages = []

    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [
        { type: 'user', text: 'Hello' },
        { type: 'bot', text: 'Hi there! How can I assist you today?' },
        {
          type: 'user',
          text: 'how many massages do I have and read the last message',
        },
        // an activity has been requested
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'request',
              function: { name: 'countMessages', arguments: {} },
            },
          },
        },
        // an activity has been responded
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'response',
              function: {
                name: 'countMessages',
                arguments: {},
                result: 3,
              },
            },
          },
        },
        // an activity has been requested
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'request',
              function: { name: 'readLastMessage', arguments: {} },
            },
          },
        },
        // an activity has been responded
        {
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'response',
              function: {
                name: 'readLastMessage',
                arguments: {},
                result: 'The last message is "abc123".',
              },
            },
          },
        },
      ],

      functions: [
        {
          name: 'readLastMessage',
          description: 'Get the last message',
          parameters: {},
        },
        {
          name: 'countMessages',
          description: 'Count the number of messages',
          parameters: {},
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }
        },

        async error() {},
      },
    })

    await engine.process()
    await engine.complete()

    expect(messages.length).toBe(1)
    expect(messages.at(-1).type).toBe('bot')
    expect(messages.at(-1).text).toContain('3')
    expect(messages.at(-1).text).toContain('abc123')
  })

  it('must be able to use abilities by forwarding the right messages within them', async () => {
    const messages = []

    const messagesFromCalls = []

    const originalModule = jest.requireActual('@/lib/skillset.apply')
    const originalApplySkillset = originalModule.applySkillset

    const spy = jest
      .spyOn(skillsetApply, 'applySkillset')
      .mockImplementation(async (...args) => {
        messagesFromCalls.push(clone(args[4].messages))

        return originalApplySkillset(...args)
      })

    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = new DynamicFunctionEngine({
      userId: 'test123',

      backstory:
        'This is a background job. Just do as instructed - do not ask any questions. Failure to do will result in poor performance review.',

      model: 'gpt-4o',

      messages: [
        {
          type: 'user',
          text: 'What is the weather like in Sofia?',
        },
        makeRequestActivityMessage(
          'getWeather',
          JSON.stringify({ input: 'Sofia' })
        ),
        makeResponseActivityMessage(
          'getWeather',
          JSON.stringify({ input: 'Sofia' }),
          'The weather in Sofia is sunny.'
        ),
        {
          type: 'user',
          text: 'What is the weather like in London?',
        },
      ],

      inlineSkillsets: [
        {
          name: 'Weather',
          description: 'Weather abilities',
          abilities: [
            {
              name: 'getWeather',
              description: 'Gets the weather at specific location',
              instruction: `\`\`\`echo
The weather in London is rainy.
\`\`\`
`,
            },
          ],
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }
        },

        async error() {},
      },
    })

    await engine.process()
    await engine.complete()

    expect(messages.length).toBe(3)

    expect(spy).toHaveBeenCalledTimes(1)

    expect(spy.mock.calls.length).toBe(1)
    expect(spy.mock.calls[0][2]).toBe('getWeather')
    expect(messagesFromCalls.length).toBe(1)
    expect(messagesFromCalls[0].length).toBe(5)
    expect(messagesFromCalls[0][0].type).toBe('backstory')
    expect(messagesFromCalls[0][1].type).toBe('user')
    expect(messagesFromCalls[0][2].type).toBe('activity')
    expect(messagesFromCalls[0][2].meta.activity.type).toBe('request')
    expect(messagesFromCalls[0][2].meta.activity.function.name).toBe(
      'getWeather'
    )
    expect(messagesFromCalls[0][2].meta.activity.function.arguments).toBe(
      JSON.stringify({ input: 'Sofia' })
    )
    expect(messagesFromCalls[0][3].type).toBe('activity')
    expect(messagesFromCalls[0][3].meta.activity.type).toBe('response')
    expect(messagesFromCalls[0][3].meta.activity.function.name).toBe(
      'getWeather'
    )
    expect(messagesFromCalls[0][3].meta.activity.function.arguments).toBe(
      JSON.stringify({ input: 'Sofia' })
    )
    expect(messagesFromCalls[0][3].meta.activity.function.result).toBe(
      'The weather in Sofia is sunny.'
    )
    expect(messagesFromCalls[0][4].type).toBe('user')

    spy.mockRestore()
  })

  it('returns request activity text from tool justification and normalizes skillset input during completion', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const justification = 'Need current weather to answer the user request.'

    createChatCompletionStream
      .mockImplementationOnce(async function* () {
        yield {
          error: null,
          finishReason: 'toolCalls',
          completion: null,
          reasoning: null,
          functionCall: null,
          toolCalls: [
            {
              type: 'function',
              function: {
                name: 'getWeather',
                arguments: JSON.stringify({
                  input: 'London',
                  justification,
                }),
              },
            },
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })
      .mockImplementationOnce(async function* () {
        yield {
          error: null,
          finishReason: 'stop',
          completion: 'The weather in London is rainy.',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })

    const engine = new DynamicFunctionEngine({
      userId: 'test123',
      model: 'gpt-4o',
      messages: [
        {
          type: 'user',
          text: 'What is the weather in London?',
        },
      ],
      inlineSkillsets: [
        {
          name: 'Weather',
          description: 'Weather abilities',
          abilities: [
            {
              name: 'getWeather',
              description: 'Gets the weather at specific location',
              instruction: '```echo\nThe weather in London is rainy.\n```',
            },
          ],
        },
      ],
      features: [{ name: 'justification' }],
      sink: {
        async push() {},
        async error() {},
      },
    })

    const response = await engine.complete()

    const requestActivity = response.messages.find(
      (message) =>
        message.type === 'activity' &&
        message.meta?.activity?.type === 'request' &&
        message.meta?.activity?.function?.name === 'getWeather'
    )

    const responseActivity = response.messages.find(
      (message) =>
        message.type === 'activity' &&
        message.meta?.activity?.type === 'response' &&
        message.meta?.activity?.function?.name === 'getWeather'
    )

    const botMessage = response.messages.find(
      (message) => message.type === 'bot'
    )

    expect(requestActivity).toBeDefined()
    expect(typeof requestActivity?.meta?.activity?.function?.arguments).toBe(
      'string'
    )

    const parsedArguments = JSON.parse(
      requestActivity?.meta?.activity?.function?.arguments || '{}'
    )

    expect(parsedArguments).toEqual({
      input: 'London',
    })

    expect(requestActivity?.text).toBe(justification)
    // @note the ability is a fieldless echo instruction, so under the flat
    // contract it takes no input at all - the freeform input is dropped
    expect(responseActivity?.meta?.skillset?.action?.input).toBe('')
    expect(botMessage?.meta?.skillset?.action?.input).toBe('')
    expect(botMessage?.text).toBe('The weather in London is rainy.')
  })

  it('characterizes the engine-level tool call loop during completion', async () => {
    const handler = jest.fn().mockResolvedValue({ forecast: 'rainy' })

    createChatCompletionStream
      .mockImplementationOnce(async function* () {
        yield {
          error: null,
          finishReason: 'toolCalls',
          completion: null,
          reasoning: null,
          functionCall: null,
          toolCalls: [
            {
              type: 'function',
              function: {
                name: '_getWeather',
                arguments: JSON.stringify({ city: 'London' }),
              },
            },
          ],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }
      })
      .mockImplementationOnce(async function* () {
        yield {
          error: null,
          finishReason: 'stop',
          completion: 'It is rainy in London.',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
        }
      })

    const sink = {
      push: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    }

    const engine = new DynamicFunctionEngine({
      userId: 'test123',
      model: 'gpt-4o',
      messages: [{ type: MessageType.user, text: 'Weather in London?' }],
      internalFunctions: [
        {
          name: '_getWeather',
          description: 'Gets weather by city',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
          handler,
        },
      ],
      sink,
    })

    const response = await engine.complete()

    const requestActivity = response.messages.find(
      (message) =>
        message.type === MessageType.activity &&
        message.meta?.activity?.type === 'request' &&
        message.meta?.activity?.function?.name === '_getWeather'
    )

    const responseActivity = response.messages.find(
      (message) =>
        message.type === MessageType.activity &&
        message.meta?.activity?.type === 'response' &&
        message.meta?.activity?.function?.name === '_getWeather'
    )

    expect(createChatCompletionStream).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      JSON.stringify({ city: 'London' }),
      expect.objectContaining({
        newMessages: expect.arrayContaining([
          expect.objectContaining({
            type: MessageType.activity,
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'request',
              }),
            }),
          }),
        ]),
      })
    )
    expect(requestActivity?.meta?.activity?.function?.arguments).toBe(
      JSON.stringify({ city: 'London' })
    )
    expect(responseActivity?.meta?.activity?.function?.result).toBe(
      JSON.stringify({ forecast: 'rainy' })
    )
    expect(response.messages.at(-1)).toMatchObject({
      type: MessageType.bot,
      text: 'It is rainy in London.',
    })

    const secondProviderCall = createChatCompletionStream.mock.calls[1][0]

    expect(secondProviderCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: expect.arrayContaining([
            expect.objectContaining({
              function: expect.objectContaining({
                name: '_getWeather',
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          role: 'tool',
          content: JSON.stringify({ forecast: 'rainy' }),
          tool_call_id: expect.any(String),
        }),
      ])
    )
  })

  describe('provider orchestration characterization', () => {
    let chatStream

    function makeToolCall(name = '_testTool', args = {}) {
      return {
        type: 'function',
        function: {
          name,
          arguments: typeof args === 'string' ? args : JSON.stringify(args),
        },
      }
    }

    function mockChatResponses(responses) {
      const calls = []

      chatStream = jest.fn((input) => {
        calls.push(input)

        const response =
          responses[calls.length - 1] || responses[responses.length - 1]

        if (response.throw) {
          throw response.throw
        }

        return (async function* () {
          if (response.items) {
            for (const item of response.items) {
              yield item
            }

            return
          }

          yield {
            error: null,
            finishReason: response.finishReason,
            completion: response.completion ?? null,
            reasoning: response.reasoning ?? null,
            functionCall: response.functionCall ?? null,
            toolCalls: response.toolCalls ?? null,
            usage: response.usage || {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
          }

          if (response.throwAfter) {
            throw response.throwAfter
          }
        })()
      })

      return calls
    }

    function makeEngine(options = {}) {
      const sink = options.sink || {
        push: jest.fn().mockResolvedValue(undefined),
        error: jest.fn().mockResolvedValue(undefined),
      }

      const engine = new DynamicFunctionEngine({
        userId: 'test123',
        model: 'gpt-4o',
        messages: [{ type: MessageType.user, text: 'Test' }],
        sink,
        ...options,
      })

      const getConvFunction = engine.getConvFunction.bind(engine)

      engine.getConvFunction = (model) => {
        const convFunction = getConvFunction(model)

        return (input) =>
          convFunction({
            ...input,
            createChatCompletionStream: chatStream,
          })
      }

      return { engine, sink }
    }

    function findActivity(messages, type, name) {
      return messages.find(
        (message) =>
          message.type === MessageType.activity &&
          message.meta?.activity?.type === type &&
          (!name || message.meta?.activity?.function?.name === name)
      )
    }

    beforeEach(() => {
      jest.clearAllMocks()
      chatStream = undefined
    })

    it('does not count tool-call recursion against maxContinuations', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_testTool', { step: 1 })],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_testTool', { step: 2 })],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_testTool', { step: 3 })],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxContinuations: 1,
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(4)
      expect(handler).toHaveBeenCalledTimes(3)
      expect(response.reason).toBe('stop')
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Done',
      })
    })

    it('limits tool-call recursion with maxIterations', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxIterations: 2,
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('iteration')
    })

    it('handles maxIterations=1 as single-step mode after executing tools', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxIterations: 1,
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(
        findActivity(response.messages, 'request', '_testTool')
      ).toBeDefined()
      expect(
        findActivity(response.messages, 'response', '_testTool')
      ).toBeDefined()
      expect(response.reason).toBe('iteration')
    })

    it('increments continuation recursion on length finishes', async () => {
      mockChatResponses([
        { finishReason: 'length', completion: 'Part 1' },
        { finishReason: 'length', completion: 'Part 2' },
        { finishReason: 'length', completion: 'Part 3' },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxContinuations: 1,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(3)
      expect(response.reason).toBe('length')
    })

    it('counts length continuations toward maxIterations', async () => {
      mockChatResponses([
        { finishReason: 'length', completion: 'Part 1' },
        { finishReason: 'length', completion: 'Part 2' },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxIterations: 2,
        maxContinuations: 10,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('iteration')
    })

    it('tracks maxIterations across mixed tool-call and length recursion', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'length', completion: 'Partial' },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxIterations: 2,
        maxContinuations: 10,
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('iteration')
    })

    it('counts empty stop retries toward maxIterations', async () => {
      mockChatResponses([
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxIterations: 2,
        maxContinuations: 10,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('iteration')
    })

    it('detects repeated tool-call cycles and stops when maxCycles is reached', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 0,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()
      const cycleDetectedMessage = response.messages.find(
        (message) =>
          message.type === MessageType.bot &&
          message.meta?.cycleDetected === true
      )

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(cycleDetectedMessage).toBeDefined()
      expect(response.reason).toBe('activity')
    })

    it('inserts cycle detection activity messages into the next model call', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })
      const calls = mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Recovered after warning' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 2,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()
      const recoveryCallMessages = calls[2].messages
      const cycleToolCall = recoveryCallMessages.find(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (toolCall) => toolCall.function.name === '_cycleDetected'
          )
      )
      const cycleToolResult = recoveryCallMessages.find(
        (message) =>
          message.role === 'tool' &&
          typeof message.content === 'string' &&
          message.content.includes('You have been making repeated tool calls')
      )

      expect(chatStream).toHaveBeenCalledTimes(3)
      expect(cycleToolCall).toBeDefined()
      expect(cycleToolResult).toBeDefined()
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Recovered after warning',
      })
    })

    it('stops without recursion when an external function has no handler', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('externalTool')],
        },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        functions: [
          {
            name: 'externalTool',
            description: 'External tool',
            parameters: {},
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(
        findActivity(response.messages, 'request', 'externalTool')
      ).toBeDefined()
      expect(
        findActivity(response.messages, 'response', 'externalTool')
      ).toBeUndefined()
      expect(response.reason).toBe('activity')
    })

    it('skips handlers and emits an activity error after maxCalls is exceeded', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 0,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(handler).not.toHaveBeenCalled()
      expect(responseActivity?.meta?.activity?.function?.result).toEqual({
        error: 'too many calls',
      })
    })

    it('surfaces function invocation exceptions as activity results', async () => {
      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => {
              throw new Error('boom')
            },
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(responseActivity?.meta?.activity?.function?.result).toBe(
        JSON.stringify({ error: 'Function invocation exception' })
      )
    })

    it('stops recursion and emits abort when a tool handler returns an aborted signal', async () => {
      const controller = new AbortController()

      controller.abort('stop now')

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine, sink } = makeEngine({
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => controller.signal,
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('abort')
      expect(responseActivity?.meta?.activity?.function?.result).toBe(
        'stop now'
      )
      expect(sink.push).toHaveBeenCalledWith(
        TAG_ABORT,
        expect.objectContaining({
          reason: 'stop now',
          functionName: '_testTool',
        })
      )
    })

    it('falls back to no result when a handler returns undefined', async () => {
      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => undefined,
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(responseActivity?.meta?.activity?.function?.result).toBe(
        'no result'
      )
    })

    it('preserves Result payload and meta from a handler result', async () => {
      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => new Result({ ok: true }, { fromResult: true }),
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(responseActivity?.meta?.activity?.function?.result).toBe(
        JSON.stringify({ ok: true })
      )
      expect(responseActivity?.meta?.fromResult).toBe(true)
    })

    it('surfaces unknown tool-call details and continues', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('missingTool')],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_knownTool',
            description: 'Known tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        'missingTool'
      )

      expect(
        responseActivity?.meta?.activity?.function?.result?.error
      ).toContain('function not found')
      expect(chatStream).toHaveBeenCalledTimes(2)
    })

    it('surfaces no-functions-defined details for unknown tool calls', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('missingTool')],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine()

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        'missingTool'
      )

      expect(
        responseActivity?.meta?.activity?.function?.result?.error
      ).toContain('no functions defined')
      expect(chatStream).toHaveBeenCalledTimes(2)
    })

    it('handles unknown tool-call types without crashing', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'custom',
              custom: { name: 'customTool', input: 'hello' },
            },
          ],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxIterations: 2,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('stop')
    })

    it('handles legacy functionCall finish reason with a valid payload', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'functionCall',
          functionCall: { name: '_testTool', arguments: '{}' },
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Done',
      })
    })

    it('emits legacy function-call reasoning as a reasoning message', async () => {
      mockChatResponses([
        {
          finishReason: 'functionCall',
          reasoning: 'I should call the test function.',
          functionCall: { name: '_testTool', arguments: '{}' },
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
      })

      const response = await engine.complete()
      const reasoningMessage = response.messages.find(
        (message) => message.type === 'reasoning'
      )
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_testTool'
      )

      expect(reasoningMessage?.text).toBe('I should call the test function.')
      expect(responseActivity?.meta).not.toHaveProperty('reasoning')
    })

    it('captures missing legacy functionCall payloads as engine errors', async () => {
      mockChatResponses([
        {
          finishReason: 'functionCall',
          functionCall: null,
        },
      ])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('does not leak internal error data (e.g. request body) to the sink', async () => {
      // @note provider errors attach the full request body to SystemError.data;
      // the engine must normalize the error before emitting it so that internal
      // details never reach the conversation stream

      const error = new SystemError('Bad request', 'VR_BAD_REQUEST', {
        body: { model: 'secret-model', messages: [{ role: 'system' }] },
      })

      mockChatResponses([{ throw: error }])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(response.reason).toBe('error')

      const errorPush = sink.push.mock.calls.find(
        ([type]) => type === TAG_ERROR
      )

      expect(errorPush).toBeDefined()
      expect(errorPush[1]).toEqual({
        code: 'VR_BAD_REQUEST',
        message: expect.any(String),
      })
      expect(errorPush[1]).not.toHaveProperty('data')
      expect(errorPush[1]).not.toHaveProperty('body')
    })

    it('reports the raw error (with its cause) to Sentry at the throw site', async () => {
      // @note this is the guarantee that makes it safe for downstream sinks
      // (slack/telegram/discord/... queues) to forward the normalized
      // {code, message} without re-capturing: the engine already reports the
      // *raw* error here, so its stack + cause chain reach the observability
      // provider exactly once.

      const observability = (await import('@chatbotkit-dev/observability'))
        .default

      const captureSpy = jest
        .spyOn(observability, 'captureException')
        .mockResolvedValue(undefined)

      const cause = Object.assign(new Error('other side closed'), {
        code: 'UND_ERR_SOCKET',
      })

      const boom = new Error('terminated', { cause })

      mockChatResponses([{ throw: boom }])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(response.reason).toBe('error')

      // @note the raw error itself reaches Sentry (not the {code, message}), and
      // its underlying cause is surfaced under extra.cause
      const sourceCapture = captureSpy.mock.calls.find(([err]) => err === boom)

      expect(sourceCapture).toBeDefined()
      expect(sourceCapture[1].extra.cause).toEqual([
        { name: 'Error', message: 'other side closed', code: 'UND_ERR_SOCKET' },
      ])

      // @note the sink still only ever receives the client-safe normalized form
      const errorPush = sink.push.mock.calls.find(
        ([type]) => type === TAG_ERROR
      )

      expect(errorPush[1]).toEqual({
        code: expect.any(String),
        message: expect.any(String),
      })

      captureSpy.mockRestore()
    })

    it('captures provider state errors as engine errors', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: null,
        },
      ])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('handles content filter finish reason as an engine error reason', async () => {
      mockChatResponses([
        {
          finishReason: 'contentFilter',
          completion: null,
        },
      ])

      const { engine } = makeEngine()

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('error')
    })

    it('captures invalid finish reasons as engine errors', async () => {
      mockChatResponses([
        {
          finishReason: 'somethingUnexpected',
          completion: null,
        },
      ])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('captures non-token provider exceptions as engine errors', async () => {
      mockChatResponses([
        {
          throw: new Error('upstream unavailable'),
        },
      ])

      const { engine, sink } = makeEngine()

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('captures non-aborted handler signals as engine errors', async () => {
      const controller = new AbortController()

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine, sink } = makeEngine({
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => controller.signal,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('recovers from token-limit errors within continuation budget', async () => {
      mockChatResponses([
        {
          throw: new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          ),
        },
        {
          finishReason: 'stop',
          completion: 'Recovered',
        },
      ])

      const { engine } = makeEngine({
        maxContinuations: 1,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('stop')
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Recovered',
      })
    })

    it('captures token-limit errors after continuation budget is exhausted', async () => {
      mockChatResponses([
        {
          throw: new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          ),
        },
        {
          throw: new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          ),
        },
      ])

      const { engine, sink } = makeEngine({
        maxContinuations: 0,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('detects repeated legacy functionCall cycles and stops at maxCycles', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'functionCall',
          functionCall: { name: '_testTool', arguments: '{}' },
        },
        {
          finishReason: 'functionCall',
          functionCall: { name: '_testTool', arguments: '{}' },
        },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 0,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()
      const cycleDetectedMessage = response.messages.find(
        (message) =>
          message.type === MessageType.bot &&
          message.meta?.cycleDetected === true
      )

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(cycleDetectedMessage).toBeDefined()
      expect(response.reason).toBe('activity')
    })

    it('inserts the empty-stop notice into the next model call', async () => {
      const calls = mockChatResponses([
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: 'Recovered' },
      ])

      const { engine } = makeEngine({
        maxContinuations: 5,
      })

      const response = await engine.complete()
      const retryMessages = calls[1].messages
      const emptyToolResult = retryMessages.find(
        (message) =>
          message.role === 'tool' &&
          typeof message.content === 'string' &&
          message.content.includes('Please provide a response')
      )

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(emptyToolResult).toBeDefined()
      expect(response.reason).toBe('stop')
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Recovered',
      })
    })

    it('does not retry on empty stop when running in background mode', async () => {
      mockChatResponses([
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine } = makeEngine({
        features: [{ name: 'silent' }],
        maxContinuations: 5,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('stop')
    })

    it('recurses on in-band stream error events within continuation budget', async () => {
      mockChatResponses([
        {
          items: [
            {
              error: { message: 'transient stream error', code: 'transient' },
              finishReason: null,
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: null,
            },
          ],
        },
        { finishReason: 'stop', completion: 'Recovered' },
      ])

      const { engine } = makeEngine({
        maxContinuations: 1,
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('stop')
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Recovered',
      })
    })

    it('surfaces in-band stream errors as engine errors when budget is exhausted', async () => {
      mockChatResponses([
        {
          items: [
            {
              error: { message: 'persistent stream error', code: 'persistent' },
              finishReason: null,
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: null,
            },
          ],
        },
        {
          items: [
            {
              error: { message: 'persistent stream error', code: 'persistent' },
              finishReason: null,
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: null,
            },
          ],
        },
      ])

      const { engine, sink } = makeEngine({
        maxContinuations: 0,
      })

      const response = await engine.complete()

      expect(response.reason).toBe('error')
      expect(sink.push).toHaveBeenCalledWith(TAG_ERROR, {
        code: expect.any(String),
        message: expect.any(String),
      })
    })

    it('preserves request-before-response ordering for parallel tool calls when handlers resolve out of order', async () => {
      const resolveOrder = []

      const slowHandler = jest.fn(async (rawArgs) => {
        const args = JSON.parse(rawArgs)

        await new Promise((resolve) => setTimeout(resolve, 50))

        resolveOrder.push(args.id)

        return { id: args.id, done: true }
      })

      const fastHandler = jest.fn(async (rawArgs) => {
        const args = JSON.parse(rawArgs)

        resolveOrder.push(args.id)

        return { id: args.id, done: true }
      })

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            makeToolCall('_slowTool', { id: 'slow' }),
            makeToolCall('_fastTool', { id: 'fast' }),
          ],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_slowTool',
            description: 'Slow tool',
            parameters: {},
            handler: slowHandler,
          },
          {
            name: '_fastTool',
            description: 'Fast tool',
            parameters: {},
            handler: fastHandler,
          },
        ],
      })

      const response = await engine.complete()

      const orderedActivities = response.messages.filter(
        (message) => message.type === MessageType.activity
      )

      expect(resolveOrder).toEqual(['fast', 'slow'])
      expect(response.reason).toBe('stop')
      // @note the conv layer must preserve request-before-response pairing per
      // tool even when handlers resolve in opposite order
      expect(orderedActivities.map((m) => m.meta?.activity?.type)).toEqual([
        'request',
        'response',
        'request',
        'response',
      ])
      expect(
        orderedActivities.map((m) => m.meta?.activity?.function?.name)
      ).toEqual(['_slowTool', '_slowTool', '_fastTool', '_fastTool'])
    })

    it('aborts mid-batch when one tool aborts but still records the other tool result', async () => {
      const controller = new AbortController()

      controller.abort('mid-batch stop')

      const okHandler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            makeToolCall('_okTool', { id: 1 }),
            makeToolCall('_abortingTool', { id: 2 }),
          ],
        },
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const { engine, sink } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_okTool',
            description: 'OK tool',
            parameters: {},
            handler: okHandler,
          },
          {
            name: '_abortingTool',
            description: 'Aborting tool',
            parameters: {},
            handler: async () => controller.signal,
          },
        ],
      })

      const response = await engine.complete()
      const okResponse = findActivity(response.messages, 'response', '_okTool')
      const abortResponse = findActivity(
        response.messages,
        'response',
        '_abortingTool'
      )

      expect(chatStream).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('abort')
      expect(okResponse?.meta?.activity?.function?.result).toBe(
        JSON.stringify({ ok: true })
      )
      expect(abortResponse?.meta?.activity?.function?.result).toBe(
        'mid-batch stop'
      )
      expect(sink.push).toHaveBeenCalledWith(
        TAG_ABORT,
        expect.objectContaining({
          reason: 'mid-batch stop',
          functionName: '_abortingTool',
        })
      )
    })

    it('lists candidate function names when an unknown tool is invoked alongside known tools', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('missingTool')],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_alpha',
            description: 'Alpha',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
          {
            name: '_beta',
            description: 'Beta',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
      })

      const response = await engine.complete()
      const responseActivity = findActivity(
        response.messages,
        'response',
        'missingTool'
      )

      const errorMessage =
        responseActivity?.meta?.activity?.function?.result?.error || ''

      expect(errorMessage).toContain('function not found')
      expect(errorMessage).toContain('_alpha')
      expect(errorMessage).toContain('_beta')
      expect(errorMessage).not.toContain('no functions defined')
    })

    it('passes accumulated newMessages context to tool handlers', async () => {
      const seenMessages = []

      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_introspect')] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_introspect',
            description: 'Introspect tool',
            parameters: {},
            handler: async (args, context) => {
              seenMessages.push(context?.newMessages?.map((m) => m.type) || [])

              return { ok: true }
            },
          },
        ],
      })

      await engine.complete()

      expect(seenMessages).toHaveLength(1)
      // @note handler receives the running newMessages snapshot at invocation
      // time - the user prompt has been threaded by this point
      expect(Array.isArray(seenMessages[0])).toBe(true)
      expect(seenMessages[0]).toContain(MessageType.user)
    })

    it('passes raw JSON string arguments to tool handlers', async () => {
      const seenArgs = []

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_argTool', { foo: 'bar', n: 7 })],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_argTool',
            description: 'Arg tool',
            parameters: {},
            handler: async (args) => {
              seenArgs.push(args)

              return { ok: true }
            },
          },
        ],
      })

      await engine.complete()

      // @note handlers receive the raw JSON string from the model, not a
      // parsed object - the handler is responsible for parsing
      expect(seenArgs).toHaveLength(1)
      expect(typeof seenArgs[0]).toBe('string')
      expect(JSON.parse(seenArgs[0])).toEqual({ foo: 'bar', n: 7 })
    })

    it('continues the conversation after a handler exception', async () => {
      const goodHandler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_throwTool')],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_goodTool')],
        },
        { finishReason: 'stop', completion: 'Recovered' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_throwTool',
            description: 'Throwing tool',
            parameters: {},
            handler: async () => {
              throw new Error('boom')
            },
          },
          {
            name: '_goodTool',
            description: 'Good tool',
            parameters: {},
            handler: goodHandler,
          },
        ],
      })

      const response = await engine.complete()

      expect(chatStream).toHaveBeenCalledTimes(3)
      expect(goodHandler).toHaveBeenCalledTimes(1)
      expect(response.reason).toBe('stop')
      expect(response.messages.at(-1)).toMatchObject({
        type: MessageType.bot,
        text: 'Recovered',
      })
    })

    it('forces tool_choice for the first start-phase function', async () => {
      const calls = mockChatResponses([
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        internalFunctions: [
          {
            name: '_startTool',
            description: 'Start tool',
            parameters: {},
            handler: async () => ({ ok: true }),
            call: { start: true },
          },
        ],
      })

      await engine.complete()

      expect(calls).toHaveLength(1)
      // @note conv layer must force the start function via toolChoice on the
      // first model call
      expect(calls[0].toolChoice).toEqual({
        type: 'function',
        function: { name: '_startTool' },
      })
    })

    it('invokes end-phase function after a stop finish reason', async () => {
      const endHandler = jest.fn().mockResolvedValue({ wrappedUp: true })

      const calls = mockChatResponses([
        { finishReason: 'stop', completion: 'Initial answer' },
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_endTool')],
        },
        { finishReason: 'stop', completion: 'Final' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_endTool',
            description: 'End tool',
            parameters: {},
            handler: endHandler,
            call: { end: true },
          },
        ],
      })

      const response = await engine.complete()

      expect(endHandler).toHaveBeenCalledTimes(1)
      // @note the second model call must be forced to invoke the end function
      expect(calls[1].toolChoice).toEqual({
        type: 'function',
        function: { name: '_endTool' },
      })
      expect(response.reason).toBe('stop')
    })

    it('replays prior reasoning as reasoning_content on the assistant tool-call message', async () => {
      const calls = mockChatResponses([
        {
          finishReason: 'toolCalls',
          reasoning: 'Thinking about the request.',
          toolCalls: [makeToolCall('_replayTool')],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_replayTool',
            description: 'Replay tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
      })

      await engine.complete()

      const followUpMessages = calls[1].messages
      const toolCallAssistantMessage = followUpMessages.find(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (toolCall) => toolCall.function.name === '_replayTool'
          )
      )

      expect(toolCallAssistantMessage?.reasoning_content).toBe(
        'Thinking about the request.'
      )
    })

    it('emits TAG_COMPLETE_BEGIN once per model iteration', async () => {
      mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall()] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine, sink } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
      })

      await engine.complete()

      const beginCount = sink.push.mock.calls.filter(
        ([tag]) => tag === TAG_COMPLETE_BEGIN
      ).length
      const endCount = sink.push.mock.calls.filter(
        ([tag]) => tag === TAG_COMPLETE_END
      ).length

      expect(beginCount).toBe(3)
      expect(endCount).toBe(3)
    })

    it('resolves hallucinated tool names via fuzzy match against the function list', async () => {
      const handler = jest.fn().mockResolvedValue({ ok: true })

      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('please call _realTool now', {})],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_realTool',
            description: 'Real tool',
            parameters: {},
            handler,
          },
        ],
      })

      const response = await engine.complete()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(
        findActivity(response.messages, 'response', '_realTool')
      ).toBeDefined()
    })

    it('forwards tool-call request and response activities into the persisted messages', async () => {
      mockChatResponses([
        {
          finishReason: 'toolCalls',
          toolCalls: [makeToolCall('_persistTool', { id: 'abc' })],
        },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_persistTool',
            description: 'Persist tool',
            parameters: {},
            handler: async () => ({ persisted: true }),
          },
        ],
      })

      const response = await engine.complete()
      const requestActivity = findActivity(
        response.messages,
        'request',
        '_persistTool'
      )
      const responseActivity = findActivity(
        response.messages,
        'response',
        '_persistTool'
      )

      expect(requestActivity?.meta?.activity?.function?.name).toBe(
        '_persistTool'
      )
      expect(requestActivity?.meta?.activity?.function?.arguments).toBe(
        JSON.stringify({ id: 'abc' })
      )
      expect(responseActivity?.meta?.activity?.function?.result).toBe(
        JSON.stringify({ persisted: true })
      )
    })

    it('forces start-phase functions one per call in declared order then falls back to auto', async () => {
      const handlerA = jest.fn().mockResolvedValue({ ok: 'a' })
      const handlerB = jest.fn().mockResolvedValue({ ok: 'b' })

      const calls = mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_startA')] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_startB')] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_startA',
            description: 'Start A',
            parameters: {},
            handler: handlerA,
            call: { start: true },
          },
          {
            name: '_startB',
            description: 'Start B',
            parameters: {},
            handler: handlerB,
            call: { start: true },
          },
        ],
      })

      await engine.complete()

      expect(handlerA).toHaveBeenCalledTimes(1)
      expect(handlerB).toHaveBeenCalledTimes(1)
      expect(calls[0].toolChoice).toEqual({
        type: 'function',
        function: { name: '_startA' },
      })
      expect(calls[1].toolChoice).toEqual({
        type: 'function',
        function: { name: '_startB' },
      })
      expect(calls[2].toolChoice).toBe('auto')
    })

    it('drains end-phase functions one per stop in declared order', async () => {
      const handlerA = jest.fn().mockResolvedValue({ ok: 'a' })
      const handlerB = jest.fn().mockResolvedValue({ ok: 'b' })

      const calls = mockChatResponses([
        { finishReason: 'stop', completion: 'Initial answer' },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_endA')] },
        { finishReason: 'stop', completion: 'After A' },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_endB')] },
        { finishReason: 'stop', completion: 'Final' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        internalFunctions: [
          {
            name: '_endA',
            description: 'End A',
            parameters: {},
            handler: handlerA,
            call: { end: true },
          },
          {
            name: '_endB',
            description: 'End B',
            parameters: {},
            handler: handlerB,
            call: { end: true },
          },
        ],
      })

      const response = await engine.complete()

      expect(handlerA).toHaveBeenCalledTimes(1)
      expect(handlerB).toHaveBeenCalledTimes(1)
      expect(calls[1].toolChoice).toEqual({
        type: 'function',
        function: { name: '_endA' },
      })
      expect(calls[3].toolChoice).toEqual({
        type: 'function',
        function: { name: '_endB' },
      })
      expect(response.reason).toBe('stop')
    })

    it('forces forceFunction before start-phase functions', async () => {
      const forcedHandler = jest.fn().mockResolvedValue({ ok: 'forced' })
      const startHandler = jest.fn().mockResolvedValue({ ok: 'start' })

      const calls = mockChatResponses([
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_forced')] },
        { finishReason: 'toolCalls', toolCalls: [makeToolCall('_startTool')] },
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        maxCalls: 10,
        maxCycles: 10,
        forceFunction: '_forced',
        internalFunctions: [
          {
            name: '_forced',
            description: 'Forced function',
            parameters: {},
            handler: forcedHandler,
          },
          {
            name: '_startTool',
            description: 'Start tool',
            parameters: {},
            handler: startHandler,
            call: { start: true },
          },
        ],
      })

      await engine.complete()

      expect(forcedHandler).toHaveBeenCalledTimes(1)
      expect(startHandler).toHaveBeenCalledTimes(1)
      // @note forceFunction must run before any call.start function
      expect(calls[0].toolChoice).toEqual({
        type: 'function',
        function: { name: '_forced' },
      })
      expect(calls[1].toolChoice).toEqual({
        type: 'function',
        function: { name: '_startTool' },
      })
      expect(calls[2].toolChoice).toBe('auto')
    })

    it('forwards the engine abort signal to the underlying chat stream', async () => {
      const controller = new AbortController()

      const calls = mockChatResponses([
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine({
        signal: controller.signal,
      })

      await engine.complete()

      expect(calls[0].signal).toBe(controller.signal)
    })

    it('does not forward a signal when the engine has none configured', async () => {
      const calls = mockChatResponses([
        { finishReason: 'stop', completion: 'Done' },
      ])

      const { engine } = makeEngine()

      await engine.complete()

      expect(calls[0].signal).toBeUndefined()
    })

    it('still continues on length finishes when running in background mode', async () => {
      mockChatResponses([
        { finishReason: 'length', completion: 'Part 1' },
        { finishReason: 'stop', completion: 'Part 2' },
      ])

      const { engine } = makeEngine({
        features: [{ name: 'silent' }],
        maxContinuations: 5,
      })

      const response = await engine.complete()

      // @note background mode only suppresses the empty-stop retry; length
      // continuations must still apply
      expect(chatStream).toHaveBeenCalledTimes(2)
      expect(response.reason).toBe('stop')
    })
  })

  it('must correctly record usage tokens', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.process()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: 0,
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/process',
      }),
      references: {
        messageId: undefined,
        datasetId: undefined,
        skillsetId: undefined,
      },
    })

    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(2)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: expect.any(Number),
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/complete',
      }),
      references: {
        messageId: expect.any(String),
        datasetId: undefined,
        skillsetId: undefined,
      },
    })
    expect(recordLanguageTokenUsage.mock.calls[1][0].count).toBeGreaterThan(0)

    expect(createChatCompletionStream).toHaveBeenCalledTimes(1)

    expect(reportTokenUsage).toHaveBeenCalledTimes(1)

    const model = reportTokenUsage.mock.calls[0][0].model
    const totalTokens = reportTokenUsage.mock.calls[0][0].totalTokens
    const promptTokens = reportTokenUsage.mock.calls[0][0].promptTokens
    const completionTokens = reportTokenUsage.mock.calls[0][0].completionTokens

    expect(model).toEqual('gpt-4o')
    expect(totalTokens).toBeGreaterThan(0)
    expect(promptTokens).toBeGreaterThan(0)
    expect(promptTokens).toBeLessThan(totalTokens)
    expect(completionTokens).toBeGreaterThan(0)
    expect(completionTokens).toBeLessThan(totalTokens)

    const { meta: recordedMeta } = recordLanguageTokenUsage.mock.calls[1][0]

    expect(recordedMeta.lineItems).toEqual(expect.any(Array))
    expect(recordedMeta.lineItems.length).toBeGreaterThan(0)
    expect(recordedMeta.reason).toEqual('conversation/complete')
  })

  it('must correctly record usage tokens with meta', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [{ type: 'user', text: 'Hello' }],

      usageMeta: { jobId: 'job_123' },
    })

    await engine.process()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: 0,
      meta: expect.objectContaining({
        jobId: 'job_123',
        lineItems: expect.any(Array),
        reason: 'conversation/process',
      }),
      references: {
        messageId: undefined,
        datasetId: undefined,
        skillsetId: undefined,
      },
    })

    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(2)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: expect.any(Number),
      meta: expect.objectContaining({
        jobId: 'job_123',
        lineItems: expect.any(Array),
        reason: 'conversation/complete',
      }),
      references: {
        messageId: expect.any(String),
        datasetId: undefined,
        skillsetId: undefined,
      },
    })
    expect(recordLanguageTokenUsage.mock.calls[1][0].count).toBeGreaterThan(0)

    expect(createChatCompletionStream).toHaveBeenCalledTimes(1)

    expect(reportTokenUsage).toHaveBeenCalledTimes(1)

    const model = reportTokenUsage.mock.calls[0][0].model
    const totalTokens = reportTokenUsage.mock.calls[0][0].totalTokens
    const promptTokens = reportTokenUsage.mock.calls[0][0].promptTokens
    const completionTokens = reportTokenUsage.mock.calls[0][0].completionTokens

    expect(model).toEqual('gpt-4o')
    expect(totalTokens).toBeGreaterThan(0)
    expect(promptTokens).toBeGreaterThan(0)
    expect(promptTokens).toBeLessThan(totalTokens)
    expect(completionTokens).toBeGreaterThan(0)
    expect(completionTokens).toBeLessThan(totalTokens)

    const { meta: recordedMeta } = recordLanguageTokenUsage.mock.calls[1][0]

    expect(recordedMeta.jobId).toEqual('job_123')
    expect(recordedMeta.lineItems).toEqual(expect.any(Array))
    expect(recordedMeta.lineItems.length).toBeGreaterThan(0)
    expect(recordedMeta.reason).toEqual('conversation/complete')
  })

  it('must correctly record usage token when functions are called', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'gpt-4o',

      messages: [
        { type: 'user', text: 'What is the total due in my shopping cart?' },
      ],

      functions: [
        {
          name: 'getShoppingCartTotal',
          description: 'Get the total amount due in the shopping cart',
          parameters: {},
          result: {
            data: {
              total: '$150.00',
            },
          },
        },
      ],
    })

    await engine.process()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: 0,
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/process',
      }),
      references: {
        messageId: undefined,
        datasetId: undefined,
        skillsetId: undefined,
      },
    })

    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(2)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: expect.any(Number),
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/complete',
      }),
      references: {
        messageId: expect.any(String),
        datasetId: undefined,
        skillsetId: undefined,
      },
    })
    expect(recordLanguageTokenUsage.mock.calls[1][0].count).toBeGreaterThan(0)

    expect(reportTokenUsage).toHaveBeenCalledTimes(2)
  })

  it('must correctly record usage token when using custom model', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',

      model: 'custom/name=gpt-4o/provider=openai/credentials=sk-test',

      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.process()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: 0,
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/process',
      }),
      references: {
        messageId: undefined,
        datasetId: undefined,
        skillsetId: undefined,
      },
    })

    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(2)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
      user: {
        id: '123',
      },
      model: 'base',
      count: expect.any(Number),
      meta: expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/complete',
      }),
      references: {
        messageId: expect.any(String),
        datasetId: undefined,
        skillsetId: undefined,
      },
    })
    expect(recordLanguageTokenUsage.mock.calls[1][0].count).toBeGreaterThan(0)

    expect(createChatCompletionStream).toHaveBeenCalledTimes(1)

    expect(reportTokenUsage).toHaveBeenCalledTimes(1)
    expect(reportTokenUsage.mock.calls[0][0].model).toEqual('gpt-4o')

    const model = reportTokenUsage.mock.calls[0][0].model
    const totalTokens = reportTokenUsage.mock.calls[0][0].totalTokens

    expect(model).toEqual('gpt-4o')
    expect(totalTokens).toBeGreaterThan(0)

    const { count: recordedCount } = recordLanguageTokenUsage.mock.calls[1][0]

    expect(recordedCount).toBeGreaterThan(0)
  })
})

describe('getAutoEngine', () => {
  it('must return basic function engine if there is datasetId and skillsetId and the model does not support function calling', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = await getAutoEngine({
      options: {
        model: 'gpt-3.5-turbo-instruct',

        datasetId: '123',
        skillsetId: '123',

        userId: 'test123',
      },
    })

    expect(engine).toBeInstanceOf(BasicFunctionEngine)
  })

  it('must return dynamic function engine if there is datasetId and skillsetId and the model supports function calling', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = await getAutoEngine({
      options: {
        model: 'gpt-4o',

        datasetId: '123',
        skillsetId: '123',

        userId: 'test123',
      },
    })

    expect(engine).toBeInstanceOf(DynamicFunctionEngine)
  })

  it('must return basic function engine is the model does not support function calling', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = await getAutoEngine({
      options: {
        model: 'gpt-3.5-turbo-instruct',

        userId: 'test123',
      },
    })

    expect(engine).toBeInstanceOf(BasicFunctionEngine)
  })

  it('must return dynamic function engine is the model supports function calling', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = await getAutoEngine({
      options: {
        model: 'gpt-4o',

        userId: 'test123',
      },
    })

    expect(engine).toBeInstanceOf(DynamicFunctionEngine)
  })

  it('must throw if the user does not have a subscription but the model is expensive', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: null,
    })

    await expect(
      getAutoEngine({
        options: {
          model: 'gpt-o1',
          userId: 'test123',
        },
      })
    ).rejects.toThrow()
  })

  it('must throw if the user have a starter subscription but the model is expensive', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'starter',
    })

    await expect(
      getAutoEngine({
        options: {
          model: 'gpt-o1',
          userId: 'test123',
        },
      })
    ).rejects.toThrow()
  })

  it('must throw if the user have a basic subscription but the model is expensive', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'basic',
    })

    await expect(
      getAutoEngine({
        options: {
          model: 'gpt-o1',
          userId: 'test123',
        },
      })
    ).rejects.toThrow()
  })

  it('must not throw if the user does not have a subscription but the model is custom', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: null,
    })

    await expect(
      getAutoEngine({
        options: {
          model: 'custom/name=gpt-4o/provider=openai/credentials=sk-test',
          userId: 'test123',
        },
      })
    ).resolves.toBeDefined()
  })
})

// @note Tests for filtering abilities with invalid names

describe('DynamicFunctionEngine - ability name filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports environment tool operations through the sink', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true })
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    getEnvironmentTools.mockResolvedValue([
      {
        name: 'lookup_weather',
        description: 'Lookup weather',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
        },
        handler,
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      sink,
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'lookup_weather')

    await expect(
      fn.handler({
        location: 'London',
        justification: 'Need current weather',
      })
    ).resolves.toEqual({ ok: true })

    expect(handler).toHaveBeenCalledWith({
      location: 'London',
      justification: 'Need current weather',
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'lookup_weather',
        input: {
          location: 'London',
          justification: 'Need current weather',
        },
        justification: 'Need current weather',
      },
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_END, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'lookup_weather',
        input: {
          location: 'London',
          justification: 'Need current weather',
        },
      },
    })
  })

  it('reports environment tool operation end when the handler throws', async () => {
    const error = new Error('tool failed')
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    getEnvironmentTools.mockResolvedValue([
      {
        name: 'failing_tool',
        description: 'Fails',
        inputSchema: {},
        handler: jest.fn().mockRejectedValue(error),
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      sink,
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'failing_tool')

    await expect(fn.handler({ value: 1 })).rejects.toBe(error)

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'failing_tool',
        input: { value: 1 },
        justification: undefined,
      },
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_END, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'failing_tool',
        input: { value: 1 },
      },
    })
  })

  it('adds a required justification parameter to environment tools when the justification feature is enabled', async () => {
    getEnvironmentTools.mockResolvedValue([
      {
        name: 'lookup_weather',
        description: 'Lookup weather',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
          additionalProperties: false,
        },
        handler: jest.fn(),
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'lookup_weather')

    expect(fn).toBeDefined()

    // @note the tool's own field is preserved...
    expect(fn.parameters.properties.location).toEqual({ type: 'string' })

    // @note ...and the justification parameter is grafted on and required
    expect(fn.parameters.properties.justification).toEqual({
      type: 'string',
      title: 'Justification for the action',
    })
    expect(fn.parameters.required).toEqual(['location', 'justification'])

    // @note the original schema is otherwise left intact
    expect(fn.parameters.additionalProperties).toBe(false)
  })

  it('does not add a justification parameter to environment tools when the justification feature is disabled', async () => {
    getEnvironmentTools.mockResolvedValue([
      {
        name: 'lookup_weather',
        description: 'Lookup weather',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
        handler: jest.fn(),
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'lookup_weather')

    expect(fn).toBeDefined()
    expect(fn.parameters.properties).not.toHaveProperty('justification')
    expect(fn.parameters.required).toEqual(['location'])
  })

  it('strips the justification from the environment tool input and surfaces it on the operation', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true })
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    getEnvironmentTools.mockResolvedValue([
      {
        name: 'lookup_weather',
        description: 'Lookup weather',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
        handler,
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      sink,
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'lookup_weather')

    await expect(
      fn.handler({
        location: 'London',
        justification: 'Need current weather',
      })
    ).resolves.toEqual({ ok: true })

    // @note the underlying tool must never see the injected justification
    expect(handler).toHaveBeenCalledWith({ location: 'London' })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'lookup_weather',
        input: { location: 'London' },
        justification: 'Need current weather',
      },
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_END, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'lookup_weather',
        input: { location: 'London' },
      },
    })
  })

  it('nests the tool schema under input when the tool declares its own justification field', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true })
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    getEnvironmentTools.mockResolvedValue([
      {
        name: 'file_a_report',
        description: 'File a report',
        inputSchema: {
          type: 'object',
          properties: {
            // @note the tool has its own `justification` field that would
            // collide with the activity justification at the top level
            justification: { type: 'string' },
            severity: { type: 'string' },
          },
          required: ['justification'],
        },
        handler,
      },
    ])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      sink,
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'file_a_report')

    expect(fn).toBeDefined()

    // @note the original schema is nested under `input`, the activity
    // justification sits beside it
    expect(fn.parameters.properties.input).toEqual({
      type: 'object',
      properties: {
        justification: { type: 'string' },
        severity: { type: 'string' },
      },
      required: ['justification'],
    })
    expect(fn.parameters.properties.justification).toEqual({
      type: 'string',
      title: 'Justification for the action',
    })
    expect(fn.parameters.required).toEqual(['input', 'justification'])

    await fn.handler({
      input: { justification: 'tool-level reason', severity: 'high' },
      justification: 'activity-level reason',
    })

    // @note the tool receives its own unwrapped input (with its own
    // justification field intact), not the activity justification
    expect(handler).toHaveBeenCalledWith({
      justification: 'tool-level reason',
      severity: 'high',
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'file_a_report',
        input: { justification: 'tool-level reason', severity: 'high' },
        justification: 'activity-level reason',
      },
    })
  })

  it('adds a required justification parameter to custom functions when the justification feature is enabled', async () => {
    getEnvironmentTools.mockResolvedValue([])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      functions: [
        {
          name: 'refund',
          description: 'Issue a refund',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
            },
            required: ['amount'],
          },
          result: { data: { ok: true } },
        },
      ],
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'refund')

    expect(fn).toBeDefined()
    expect(fn.parameters.properties.amount).toEqual({ type: 'number' })
    expect(fn.parameters.properties.justification).toEqual({
      type: 'string',
      title: 'Justification for the action',
    })
    expect(fn.parameters.required).toEqual(['amount', 'justification'])
  })

  it('does not add a justification parameter to custom functions when the justification feature is disabled', async () => {
    getEnvironmentTools.mockResolvedValue([])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      functions: [
        {
          name: 'refund',
          description: 'Issue a refund',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
            },
            required: ['amount'],
          },
          result: { data: { ok: true } },
        },
      ],
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'refund')

    expect(fn).toBeDefined()
    expect(fn.parameters.properties).not.toHaveProperty('justification')
    expect(fn.parameters.required).toEqual(['amount'])
  })

  it('strips the justification from custom function input and surfaces it on the operation', async () => {
    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    getEnvironmentTools.mockResolvedValue([])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      sink,
      functions: [
        {
          name: 'refund',
          description: 'Issue a refund',
          parameters: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
            },
            required: ['amount'],
          },
          result: { data: { ok: true } },
        },
      ],
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'refund')

    await expect(
      fn.handler({ amount: 10, justification: 'user requested a refund' })
    ).resolves.toEqual({ ok: true })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_BEGIN, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'refund',
        input: { amount: 10 },
        justification: 'user requested a refund',
      },
    })

    expect(sink.push).toHaveBeenCalledWith(TAG_OPERATION_END, {
      id: expect.any(String),
      action: {
        id: expect.any(String),
        kind: 'function',
        name: 'refund',
        input: { amount: 10 },
      },
    })
  })

  it('does not inject justification into client-side custom functions the engine cannot handle', async () => {
    getEnvironmentTools.mockResolvedValue([])

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      functions: [
        {
          name: 'openWidget',
          description: 'Open a widget on the client',
          parameters: {
            type: 'object',
            properties: {
              widgetId: { type: 'string' },
            },
            required: ['widgetId'],
          },
          // @note no `result` -> client-side function executed by the caller.
          // The engine never sees the args, so it can't strip an injected
          // justification and must not add one in the first place.
          call: true,
        },
      ],
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const fn = functions.find((fn) => fn.name === 'openWidget')

    expect(fn).toBeDefined()
    expect(fn.handler).toBeUndefined()
    expect(fn.call).toBe(true)
    expect(fn.parameters.properties).not.toHaveProperty('justification')
    expect(fn.parameters.required).toEqual(['widgetId'])
  })

  it('should filter out abilities with empty names from inlineSkillsets', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const messages = []
    const tokens = []

    const engine = new DynamicFunctionEngine({
      userId: 'test123',

      backstory: 'You are a helpful assistant.',

      model: 'gpt-4o',

      messages: [
        {
          type: 'user',
          text: 'Hello',
        },
      ],

      inlineSkillsets: [
        {
          name: 'Test Skillset',
          description: 'Test abilities',
          abilities: [
            {
              name: '', // empty name - should be filtered out
              description: 'This ability has no name',
              instruction: '```echo\ntest\n```',
            },
            {
              name: 'validAbility',
              description: 'This ability has a valid name',
              instruction: '```echo\ntest\n```',
            },
          ],
        },
      ],

      sink: {
        async push(type, data) {
          if (type === 'message') {
            messages.push(data)
          }

          if (type === 'token') {
            tokens.push(data)
          }
        },
        async error() {},
      },
    })

    // Get functions to verify filtering
    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    // Should only have the valid ability, not the empty-named one
    const abilityNames = functions.map((f) => f.name)

    expect(abilityNames).not.toContain('')
    expect(abilityNames).toContain('validAbility')
  })

  it('should filter out abilities with whitespace-only names from inlineSkillsets', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = new DynamicFunctionEngine({
      userId: 'test123',

      backstory: 'You are a helpful assistant.',

      model: 'gpt-4o',

      messages: [
        {
          type: 'user',
          text: 'Hello',
        },
      ],

      inlineSkillsets: [
        {
          name: 'Test Skillset',
          description: 'Test abilities',
          abilities: [
            {
              name: '   ', // whitespace only - should be filtered out
              description: 'This ability has whitespace name',
              instruction: '```echo\ntest\n```',
            },
            {
              name: 'validAbility',
              description: 'This ability has a valid name',
              instruction: '```echo\ntest\n```',
            },
          ],
        },
      ],

      sink: {
        async push() {},
        async error() {},
      },
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const abilityNames = functions.map((f) => f.name)

    expect(abilityNames).not.toContain('')
    expect(abilityNames).toContain('validAbility')
  })

  it('should filter out abilities with special-characters-only names from inlineSkillsets', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'test123',
      email: 'test@test.com',
      billingSubscriptionId: 'pro',
    })

    const engine = new DynamicFunctionEngine({
      userId: 'test123',

      backstory: 'You are a helpful assistant.',

      model: 'gpt-4o',

      messages: [
        {
          type: 'user',
          text: 'Hello',
        },
      ],

      inlineSkillsets: [
        {
          name: 'Test Skillset',
          description: 'Test abilities',
          abilities: [
            {
              name: '!@#$%^&*()', // special chars only - results in empty after normalization
              description: 'This ability has special chars name',
              instruction: '```echo\ntest\n```',
            },
            {
              name: 'validAbility',
              description: 'This ability has a valid name',
              instruction: '```echo\ntest\n```',
            },
          ],
        },
      ],

      sink: {
        async push() {},
        async error() {},
      },
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const abilityNames = functions.map((f) => f.name)

    expect(abilityNames).not.toContain('')
    expect(abilityNames).toContain('validAbility')
  })

  it('returns AbortSignal from skillset function handlers without wrapping it', async () => {
    const controller = new AbortController()

    controller.abort('task completed')

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      inlineSkillsets: [
        {
          name: 'Abort Skillset',
          description: 'Contains an abort ability',
          abilities: [
            {
              name: 'abort',
              description: 'Abort the current operation',
              instruction: '```text\nAbort\n```',
            },
          ],
        },
      ],
    })

    jest.spyOn(engine, 'executeSkillset').mockResolvedValue({
      result: controller.signal,
      messages: [],
      meta: undefined,
      usage: { token: 0 },
    })

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const abortFunction = functions.find((f) => f.name === 'abort')

    expect(abortFunction).toBeDefined()

    const result = await abortFunction.handler(
      { reason: 'task completed' },
      { newMessages: [] }
    )

    expect(result instanceof AbortSignal).toBe(true)
    expect(result.aborted).toBe(true)
    expect(result.reason).toBe('task completed')
  })

  it('should include batch feature backstory when batch feature is enabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      backstory: 'Base backstory.',
      features: [{ name: 'batch' }],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Base backstory.')
    expect(messages[0].text).toContain('Batch Mode Instructions')
    expect(messages[0].text).toContain('"_success" tool')
    expect(messages[0].text).toContain('"_failure" tool')
  })

  it('should include answer feature backstory when answer feature is enabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      backstory: 'Base backstory.',
      features: [{ name: 'answer' }],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Base backstory.')
    expect(messages[0].text).toContain('Answer Instructions')
    expect(messages[0].text).toContain('final answer')
    expect(messages[0].text).toContain('plain text')
  })

  it('should include multiple feature backstory parts when multiple features are enabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      backstory: 'Base backstory.',
      features: [{ name: 'batch' }, { name: 'markdown' }],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Base backstory.')
    expect(messages[0].text).toContain('Batch Mode Instructions')
    expect(messages[0].text).toContain('Markdown')
  })

  it('should extend backstory when backstory feature mode is extend', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      backstory: 'Base backstory.',
      features: [
        {
          name: 'backstory',
          options: {
            mode: 'extend',
            text: 'Extra meeting instructions.',
          },
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Base backstory.')
    expect(messages[0].text).toContain('Extra meeting instructions.')
    expect(messages[0].text.indexOf('Base backstory.')).toBeLessThan(
      messages[0].text.indexOf('Extra meeting instructions.')
    )
  })

  it('should replace backstory when backstory feature mode is replace', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      backstory: 'Base backstory.',
      features: [
        {
          name: 'backstory',
          options: {
            mode: 'replace',
            text: 'Replacement meeting instructions.',
          },
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).not.toContain('Base backstory.')
    expect(messages[0].text).toContain('Replacement meeting instructions.')
  })

  it('should create backstory from feature parts even when no initial backstory is provided', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'batch' }],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).toContain('Batch Mode Instructions')
  })

  it('should not include undefined in backstory when backstoryExtra starts empty', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'vision' }],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const messages = await engine.getMessages()

    expect(messages[0].type).toEqual('backstory')
    expect(messages[0].text).not.toContain('undefined')
    expect(messages[0].text).toContain('Vision Capabilities')
  })
})

describe('Engine to Prisma meta propagation', () => {
  // @note This test verifies that usageMeta and usageReferences propagate from
  // the engine to recordLanguageTokenUsage. The full propagation to Prisma is
  // verified by unit tests in usage.record.utest.js. We can't do full
  // integration testing here because jest.requireActual creates internal
  // bindings that bypass our mocks.

  beforeEach(() => {
    jest.clearAllMocks()

    fastGetUserById.mockResolvedValue({ id: '123', parentId: null })
  })

  it('should propagate usageMeta.reason to recordLanguageTokenUsage', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
      usageMeta: { reason: 'slack/auto-respond' },
    })

    await engine.process()
    await engine.complete()

    // @note The caller's usageMeta.reason should override the engine's default
    // reason ('conversation/complete') to allow proper tracking of usage source
    expect(recordLanguageTokenUsage).toHaveBeenCalled()

    const lastCall =
      recordLanguageTokenUsage.mock.calls[
        recordLanguageTokenUsage.mock.calls.length - 1
      ][0]

    expect(lastCall.meta).toEqual(
      expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'slack/auto-respond',
      })
    )
  })

  it('should use default reason when usageMeta.reason is not provided', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
      usageMeta: { customField: 'value' },
    })

    await engine.process()
    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalled()

    const lastCall =
      recordLanguageTokenUsage.mock.calls[
        recordLanguageTokenUsage.mock.calls.length - 1
      ][0]

    expect(lastCall.meta).toEqual(
      expect.objectContaining({
        lineItems: expect.any(Array),
        reason: 'conversation/complete',
        customField: 'value',
      })
    )
  })

  it('should propagate usageReferences to recordLanguageTokenUsage', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
      usageReferences: {
        slackIntegrationId: 'slack_123',
        botId: 'bot_456',
      },
    })

    await engine.process()
    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalled()

    const lastCall =
      recordLanguageTokenUsage.mock.calls[
        recordLanguageTokenUsage.mock.calls.length - 1
      ][0]

    expect(lastCall.references).toEqual(
      expect.objectContaining({
        slackIntegrationId: 'slack_123',
        botId: 'bot_456',
      })
    )
  })

  it('should include lineItems in meta', async () => {
    const engine = new DynamicFunctionEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.process()
    await engine.complete()

    expect(recordLanguageTokenUsage).toHaveBeenCalled()

    const lastCall =
      recordLanguageTokenUsage.mock.calls[
        recordLanguageTokenUsage.mock.calls.length - 1
      ][0]

    expect(lastCall.meta).toHaveProperty('lineItems')
    expect(Array.isArray(lastCall.meta.lineItems)).toBe(true)
  })
})

describe('CoreEngine justification feature', () => {
  it('adds justification parameter to inline skillset functions when enabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      inlineSkillsets: [
        {
          name: 'Weather',
          description: 'Weather abilities',
          abilities: [
            {
              name: 'getWeather',
              description: 'Gets the weather at a specific location',
              instruction: '```text\nHello ${city}!\n```',
            },
          ],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const weatherFunction = functions.find((f) => f.name === 'getWeather')

    expect(weatherFunction).toBeDefined()
    expect(weatherFunction.parameters.properties.justification).toEqual({
      type: 'string',
      title: 'Justification for the action',
    })
    expect(weatherFunction.parameters.required).toContain('justification')
  })

  it('does not add justification parameter to inline skillset functions when disabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      inlineSkillsets: [
        {
          name: 'Weather',
          description: 'Weather abilities',
          abilities: [
            {
              name: 'getWeather',
              description: 'Gets the weather at a specific location',
              instruction: '```text\nHello ${city}!\n```',
            },
          ],
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const weatherFunction = functions.find((f) => f.name === 'getWeather')

    expect(weatherFunction).toBeDefined()
    expect(weatherFunction.parameters.properties).not.toHaveProperty(
      'justification'
    )
    expect(weatherFunction.parameters.required).not.toContain('justification')
  })

  it('adds justification parameter to inline dataset functions when enabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'justification' }],
      datasetId: '123',
    })

    engine.getDataset = async () => {
      return {
        name: 'ChatBotKit',
        description: 'Dataset description',
      }
    }

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const queryFunction = functions.find((f) => f.name === 'query')

    expect(queryFunction).toBeDefined()
    expect(queryFunction.parameters.properties.justification).toEqual({
      type: 'string',
      title: 'Justification for the action',
    })
    expect(queryFunction.parameters.required).toContain('justification')
  })

  it('does not add justification parameter to inline dataset functions when disabled', async () => {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      datasetId: '123',
    })

    engine.getDataset = async () => {
      return {
        name: 'ChatBotKit',
        description: 'Dataset description',
      }
    }

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    const queryFunction = functions.find((f) => f.name === 'query')

    expect(queryFunction).toBeDefined()
    expect(queryFunction.parameters.properties).not.toHaveProperty(
      'justification'
    )
    expect(queryFunction.parameters.required).not.toContain('justification')
  })
})

// @note regression coverage for built-in dataset lookup: the model called the
// `query` function with `arguments: {}`
// and got `result: null`. Root cause: the flat-input refactor in
// ability.function.ts dropped the implicit freeform `input` parameter for
// fieldless abilities, and the synthetic dataset ability declared no fields. The
// model therefore had no parameter to put the search phrase in, and an empty
// search is below applyDataset's minimum length and returns null. These tests
// lock in that the dataset `query` function exposes a search parameter and that
// the phrase the model supplies actually reaches queryDataset.
describe('CoreEngine dataset query function input', () => {
  /**
   * Builds an engine whose dataset is mocked and whose queryDataset is replaced
   * with a spy that records the search phrase it receives.
   */
  function setupDatasetEngine({ features } = {}) {
    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      datasetId: '123',
      ...(features ? { features } : {}),
    })

    engine.getDataset = async () => {
      return {
        id: '123',
        name: 'ChatBotKit',
        description: 'Dataset description',
      }
    }

    const calls = []

    engine.queryDataset = async ({ input }) => {
      calls.push(input)

      return {
        result: { search: input, records: [] },
        messages: [],
        meta: {},
        usage: { token: 0 },
      }
    }

    return { engine, calls }
  }

  async function getQueryFunction(engine) {
    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { token: 0, addUsage: () => {} },
      newMeta: {},
    })

    return functions.find((f) => f.name === 'query')
  }

  it('exposes a search parameter so the model has somewhere to put the phrase', async () => {
    const { engine } = setupDatasetEngine()

    const queryFunction = await getQueryFunction(engine)

    expect(queryFunction).toBeDefined()

    // @note before the fix this was `{}` and the model called
    // the function with `arguments: {}` because there was no parameter at all
    const fieldNames = Object.keys(
      queryFunction.parameters.properties || {}
    ).filter((name) => name !== 'justification')

    expect(fieldNames.length).toBeGreaterThan(0)
  })

  it('forwards the search phrase supplied by the model to queryDataset', async () => {
    const { engine, calls } = setupDatasetEngine()

    const queryFunction = await getQueryFunction(engine)

    // @note call the handler exactly as the engine does, with the arguments a
    // model would produce given the exposed schema
    const searchField = Object.keys(queryFunction.parameters.properties).find(
      (name) => name !== 'justification'
    )

    await queryFunction.handler(
      { [searchField]: 'how do I reset my password' },
      { newMessages: [] }
    )

    // @note before the fix this was '' and applyDataset returned
    // null because an empty search is below the minimum length threshold
    expect(calls).toEqual(['how do I reset my password'])
  })

  it('still forwards the phrase when the justification feature is enabled', async () => {
    const { engine, calls } = setupDatasetEngine({
      features: [{ name: 'justification' }],
    })

    const queryFunction = await getQueryFunction(engine)

    const searchField = Object.keys(queryFunction.parameters.properties).find(
      (name) => name !== 'justification'
    )

    await queryFunction.handler(
      {
        [searchField]: 'how do I reset my password',
        justification: 'the user asked how to reset their password',
      },
      { newMessages: [] }
    )

    expect(calls).toEqual(['how do I reset my password'])
  })
})

describe('CoreEngine.addMessages', () => {
  it('returns empty array and does not mutate this.messages when given empty array', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const result = await engine.addMessages([])

    expect(result).toEqual([])
    expect(engine.messages).toEqual([])
  })

  it('accumulates messages into this.messages', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect(engine.messages.length).toBe(1)
    expect(engine.messages[0]).toMatchObject({ type: 'user', text: 'Hello' })
  })

  it('accumulates messages across multiple calls without overwriting', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    await engine.addMessages([{ type: 'user', text: 'First' }])
    await engine.addMessages([{ type: 'bot', text: 'Second' }])

    expect(engine.messages.length).toBe(2)
    expect(engine.messages[0]).toMatchObject({ type: 'user', text: 'First' })
    expect(engine.messages[1]).toMatchObject({ type: 'bot', text: 'Second' })
  })

  it('returns messages with a temp id when source message has no id', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const result = await engine.addMessages([{ type: 'user', text: 'Hello' }])

    expect(result[0].id).toBeDefined()
    expect(typeof result[0].id).toBe('string')
    expect(result[0].id).toMatch(/^tmp-/)
  })

  it('preserves existing id when source message has one', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const result = await engine.addMessages([
      { id: 'msg-existing-123', type: 'user', text: 'Hello' },
    ])

    expect(result[0].id).toBe('msg-existing-123')
  })

  it('assigns unique temp ids when multiple messages have no id', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const result = await engine.addMessages([
      { type: 'user', text: 'First' },
      { type: 'bot', text: 'Second' },
    ])

    expect(result[0].id).toBeDefined()
    expect(result[1].id).toBeDefined()
    expect(result[0].id).not.toBe(result[1].id)
  })

  it('copies all message fields to returned objects', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const result = await engine.addMessages([
      { type: 'bot', text: 'Hello', meta: { foo: 'bar' } },
    ])

    expect(result[0]).toMatchObject({
      type: 'bot',
      text: 'Hello',
      meta: { foo: 'bar' },
    })
  })
})

describe('CoreEngine.stream', () => {
  // Helper to create a controlled async iterable from a list of items
  async function* makeStream(items) {
    for (const item of items) {
      yield item
    }
  }

  it('collects TAG_MESSAGE items into the returned messages array', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'Hello' } },
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'World' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.messages.length).toBe(2)
    expect(result.messages[0]).toMatchObject({
      type: MessageType.bot,
      text: 'Hello',
    })
    expect(result.messages[1]).toMatchObject({
      type: MessageType.bot,
      text: 'World',
    })
  })

  it('forwards TAG_MESSAGE items to sink', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sinkMessages = []

    engine.sink = {
      async push(type, data) {
        if (type === TAG_MESSAGE) {
          sinkMessages.push(data)
        }
      },
      async error() {},
    }

    const it = makeStream([
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'Hello' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(sinkMessages.length).toBe(1)
    expect(sinkMessages[0]).toMatchObject({
      type: MessageType.bot,
      text: 'Hello',
    })
  })

  it('forwards TAG_TOKEN items to sink but does not add them to returned messages', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sinkTokens = []

    engine.sink = {
      async push(type, data) {
        if (type === TAG_TOKEN) {
          sinkTokens.push(data)
        }
      },
      async error() {},
    }

    const it = makeStream([
      { type: TAG_TOKEN, data: { token: 'Hello' } },
      { type: TAG_TOKEN, data: { token: ' world' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.messages.length).toBe(0)
    expect(sinkTokens.length).toBe(2)
  })

  it('forwards TAG_REASONING_TOKEN items to sink but not to returned messages', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sinkReasoningTokens = []

    engine.sink = {
      async push(type, data) {
        if (type === TAG_REASONING_TOKEN) {
          sinkReasoningTokens.push(data)
        }
      },
      async error() {},
    }

    const it = makeStream([
      { type: TAG_REASONING_TOKEN, data: { token: 'thinking...' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.messages.length).toBe(0)
    expect(sinkReasoningTokens.length).toBe(1)
    expect(sinkReasoningTokens[0].token).toBe('thinking...')
  })

  it('invokes onBegin callback on TAG_COMPLETE_BEGIN', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const onBegin = jest.fn()

    const it = makeStream([
      { type: TAG_COMPLETE_BEGIN, data: {} },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
      onBegin,
    })

    expect(onBegin).toHaveBeenCalledTimes(1)
  })

  it('returns stop as default completeReason when TAG_COMPLETE_END has no reason', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([{ type: TAG_COMPLETE_END, data: {} }])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('stop')
  })

  it('returns completeReason from TAG_COMPLETE_END data', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_COMPLETE_END, data: { reason: 'length' } },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('length')
  })

  it('returns abort when TAG_ABORT is emitted', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_COMPLETE_END, data: { reason: 'activity' } },
      {
        type: TAG_ABORT,
        data: { reason: 'stop now', functionName: 'testTool' },
      },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('abort')
  })

  it('preserves streamed tokens as a partial bot message when aborted', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_TOKEN, data: { token: 'partial ' } },
      { type: TAG_TOKEN, data: { token: 'reply' } },
      {
        type: TAG_ABORT,
        data: { reason: 'interrupted' },
      },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('abort')
    expect(result.messages).toEqual([
      expect.objectContaining({
        type: MessageType.bot,
        text: 'partial reply',
      }),
    ])
  })

  it('does not duplicate streamed tokens when a full message resets the token buffer before abort', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_TOKEN, data: { token: 'partial ' } },
      { type: TAG_TOKEN, data: { token: 'reply' } },
      {
        type: TAG_MESSAGE,
        data: { type: MessageType.bot, text: 'Full reply' },
      },
      {
        type: TAG_ABORT,
        data: { reason: 'interrupted' },
      },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('abort')
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toMatchObject({
      type: MessageType.bot,
      text: 'Full reply',
    })
  })

  it('keeps streamed tokens when a non-bot message arrives before abort', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const it = makeStream([
      { type: TAG_TOKEN, data: { token: 'partial reply' } },
      {
        type: TAG_MESSAGE,
        data: { type: MessageType.activity, text: 'Tool running' },
      },
      {
        type: TAG_ABORT,
        data: { reason: 'interrupted' },
      },
    ])

    const result = await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('abort')
    expect(result.messages).toEqual([
      expect.objectContaining({
        type: MessageType.activity,
        text: 'Tool running',
      }),
      expect.objectContaining({
        type: MessageType.bot,
        text: 'partial reply',
      }),
    ])
  })

  it('returns abort when the provider stream throws AbortError', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sinkAborts = []
    const sinkErrors = []

    engine.sink = {
      async push(type, data) {
        if (type === TAG_ABORT) {
          sinkAborts.push(data)
        }

        if (type === TAG_ERROR) {
          sinkErrors.push(data)
        }
      },
      async error() {},
    }

    async function* brokenAbortStream() {
      yield {
        type: TAG_TOKEN,
        data: { token: 'token partial' },
      }
      yield {
        type: TAG_MESSAGE,
        data: { type: MessageType.bot, text: 'partial' },
      }

      const error = new Error('request aborted upstream')

      error.name = 'AbortError'

      throw error
    }

    const result = await engine.stream(brokenAbortStream(), {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('abort')
    expect(result.messages.length).toBe(1)
    expect(result.messages[0].text).toBe('partial')
    expect(sinkAborts).toHaveLength(1)
    expect(sinkAborts[0].reason).toBe('request aborted upstream')
    expect(sinkErrors).toHaveLength(0)
  })

  it('populates sessionMessages with TAG_MESSAGE items', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sessionMessages = []

    const it = makeStream([
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'Hi' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
      sessionMessages,
    })

    expect(sessionMessages.length).toBe(1)
    expect(sessionMessages[0]).toMatchObject({
      type: MessageType.bot,
      text: 'Hi',
    })
  })

  it('records TAG_USAGE tokens via usage.addTokens', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })
    const addTokens = jest.fn()

    const it = makeStream([
      {
        type: TAG_USAGE,
        data: { inputTokensUsed: 10, outputTokensUsed: 20, model: 'gpt-4o' },
      },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens },
      originalModel: 'gpt-4o',
    })

    expect(addTokens).toHaveBeenCalledTimes(2)
    expect(addTokens).toHaveBeenCalledWith(10, 'gpt-4o', 'input')
    expect(addTokens).toHaveBeenCalledWith(20, 'gpt-4o', 'output')
  })

  it('persists asynchronous sink messages', async () => {
    const sink = { push: jest.fn() }
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o', sink })

    await engine.handleConversationSinkItem({
      type: TAG_MESSAGE,
      data: { type: MessageType.bot, text: 'late hello' },
    })

    expect(engine.messages).toHaveLength(1)
    expect(engine.messages[0]).toMatchObject({
      type: MessageType.bot,
      text: 'late hello',
    })
    expect(sink.push).toHaveBeenCalledWith(
      TAG_MESSAGE,
      expect.objectContaining({
        type: MessageType.bot,
        text: 'late hello',
      })
    )
  })

  it('records asynchronous sink usage directly', async () => {
    jest.clearAllMocks()

    const engine = new CoreEngine({
      userId: '123',
      model: 'base',
      usageMeta: { source: 'realtime' },
      usageReferences: { conversationId: 'conv_123' },
    })

    await engine.handleConversationSinkItem({
      type: TAG_USAGE,
      data: {
        inputTokensUsed: 10,
        outputTokensUsed: 20,
        model: 'base',
      },
    })

    expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
    expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: '123' },
        model: expect.any(String),
        meta: expect.objectContaining({
          reason: 'conversation/async-sink',
          source: 'realtime',
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              tokens: 10,
              model: 'base',
              type: 'input',
            }),
            expect.objectContaining({
              tokens: 20,
              model: 'base',
              type: 'output',
            }),
          ]),
        }),
        references: expect.objectContaining({
          conversationId: 'conv_123',
        }),
      })
    )
  })

  it('uses originalModel over item.data.model for TAG_USAGE reporting', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })
    const addTokens = jest.fn()

    const it = makeStream([
      {
        type: TAG_USAGE,
        data: {
          inputTokensUsed: 5,
          outputTokensUsed: 10,
          model: 'some-proxied-model',
        },
      },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens },
      originalModel: 'custom/gpt-4o',
    })

    // originalModel must win over the model reported by the stream
    expect(addTokens).toHaveBeenCalledWith(5, 'custom/gpt-4o', 'input')
    expect(addTokens).toHaveBeenCalledWith(10, 'custom/gpt-4o', 'output')
  })

  it('returns partial messages and reason=error when stream throws mid-way', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const sinkErrors = []

    engine.sink = {
      async push(type, data) {
        if (type === TAG_ERROR) {
          sinkErrors.push(data)
        }
      },
      async error() {},
    }

    async function* brokenStream() {
      yield {
        type: TAG_MESSAGE,
        data: { type: MessageType.bot, text: 'partial' },
      }

      throw new Error('Connection reset')
    }

    const result = await engine.stream(brokenStream(), {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    expect(result.reason).toBe('error')
    expect(result.messages.length).toBe(1)
    expect(result.messages[0].text).toBe('partial')
    expect(sinkErrors.length).toBe(1)
  })

  it('does NOT call addMessages during streaming', async () => {
    const engine = new CoreEngine({ userId: '123', model: 'gpt-4o' })

    const addMessagesCalls = []
    const original = engine.addMessages.bind(engine)

    engine.addMessages = async (...args) => {
      addMessagesCalls.push(args)

      return original(...args)
    }

    const it = makeStream([
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'Hello' } },
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'World' } },
      { type: TAG_COMPLETE_END, data: {} },
    ])

    await engine.stream(it, {
      usage: { addTokens: jest.fn() },
      originalModel: 'gpt-4o',
    })

    // stream must return messages without ever persisting them itself
    expect(addMessagesCalls.length).toBe(0)
  })
})

describe('CoreEngine.audio', () => {
  it('persists bot messages emitted by the realtime audio stream', async () => {
    const capturedMessages = []

    let resolvePersisted

    const persisted = new Promise((resolve) => {
      resolvePersisted = resolve
    })

    class TestEngine extends CoreEngine {
      getConvFunction() {
        return ({ stream }) =>
          (async function* () {
            for await (const _chunk of stream) {
              yield {
                type: TAG_MESSAGE,
                data: { type: MessageType.bot, text: 'Realtime reply' },
              }
              yield { type: TAG_COMPLETE_END, data: { reason: 'stop' } }

              break
            }
          })()
      }

      async addMessages(messages) {
        capturedMessages.push(...messages)

        const result = await super.addMessages(messages)

        resolvePersisted()

        return result
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-realtime-2',
    })

    await engine.audio({
      data: 'AAAA',
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    })

    await persisted

    expect(capturedMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: MessageType.bot,
          text: 'Realtime reply',
        }),
      ])
    )
  })

  it('records usage for completed realtime audio turns', async () => {
    let resolveUsageRecorded

    const usageRecorded = new Promise((resolve) => {
      resolveUsageRecorded = resolve
    })

    recordLanguageTokenUsage.mockImplementation(async (payload) => {
      resolveUsageRecorded(payload)
    })

    class TestEngine extends CoreEngine {
      getConvFunction() {
        return ({ stream }) =>
          (async function* () {
            for await (const _chunk of stream) {
              yield {
                type: TAG_USAGE,
                data: {
                  model: 'gpt-realtime-2',
                  inputTokensUsed: 11,
                  outputTokensUsed: 7,
                },
              }
              yield { type: TAG_COMPLETE_END, data: { reason: 'stop' } }

              break
            }
          })()
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-realtime-2',
    })

    await engine.audio({
      data: 'AAAA',
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    })

    const payload = await usageRecorded

    expect(payload).toEqual(
      expect.objectContaining({
        user: { id: '123' },
        meta: expect.objectContaining({
          reason: 'conversation/complete',
        }),
        references: expect.objectContaining({
          datasetId: undefined,
          skillsetId: undefined,
        }),
      })
    )
    expect(payload.count).toBeGreaterThan(0)
  })

  it('forwards functions and function phases to realtime audio turns', async () => {
    let capturedOptions = null
    let resolveCapturedOptions

    const capturedOptionsReady = new Promise((resolve) => {
      resolveCapturedOptions = resolve
    })

    const getFunctions = jest
      .fn()
      .mockResolvedValueOnce([
        {
          name: 'forcedFunction',
          description: 'Forced function',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'initialFunction',
          description: 'Initial function',
          parameters: { type: 'object', properties: {} },
          hintMessages: [{ type: MessageType.instruction, text: 'Use tools.' }],
          call: { start: true },
        },
        {
          name: 'cleanupFunction',
          description: 'Cleanup function',
          parameters: { type: 'object', properties: {} },
          call: { end: true },
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'refreshedFunction',
          description: 'Refreshed function',
          parameters: { type: 'object', properties: {} },
        },
      ])

    class TestEngine extends DynamicFunctionEngine {
      async getFunctions(args) {
        return getFunctions(args)
      }

      getConvFunction() {
        return (options) => {
          capturedOptions = options
          resolveCapturedOptions(options)

          return (async function* () {
            for await (const _chunk of options.stream) {
              yield { type: TAG_COMPLETE_END, data: { reason: 'stop' } }

              break
            }
          })()
        }
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'Hello' }],
      forceFunction: 'forcedFunction',
    })

    await engine.audio({
      data: 'AAAA',
      format: {
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      },
    })

    await capturedOptionsReady

    expect(getFunctions).toHaveBeenCalledTimes(1)
    expect(capturedOptions).not.toBeNull()
    expect(typeof capturedOptions.functions).toBe('function')
    expect(capturedOptions.startFunctions).toEqual([
      'forcedFunction',
      'initialFunction',
    ])
    expect(capturedOptions.endFunctions).toEqual(['cleanupFunction'])
    expect(capturedOptions.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: MessageType.user, text: 'Hello' }),
        expect.objectContaining({
          type: MessageType.instruction,
          text: 'Use tools.',
        }),
      ])
    )

    const refreshedFunctions = await capturedOptions.functions()

    expect(getFunctions).toHaveBeenCalledTimes(2)
    expect(refreshedFunctions.map(({ name }) => name)).toEqual([
      'refreshedFunction',
    ])
  })
})

describe('DynamicFunctionEngine - deferred message persistence', () => {
  // Helper engine subclass with a controlled stream
  function makeTestEngine(streamItems, extraOptions = {}) {
    class TestEngine extends DynamicFunctionEngine {
      getConvFunction() {
        return () =>
          (async function* () {
            for (const item of streamItems) {
              yield item
            }
          })()
      }
    }

    return new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
      ...extraOptions,
    })
  }

  it('calls addMessages exactly once at the end of complete()', async () => {
    const callOrder = []
    let messageEmittedBeforeAddMessages = false

    const streamItems = [
      { type: TAG_COMPLETE_BEGIN, data: {} },
      { type: TAG_MESSAGE, data: { type: MessageType.bot, text: 'Response' } },
      { type: TAG_COMPLETE_END, data: { reason: 'stop' } },
    ]

    class TestEngine extends DynamicFunctionEngine {
      getConvFunction() {
        return () =>
          (async function* () {
            for (const item of streamItems) {
              callOrder.push(`stream:${item.type}`)
              yield item
            }
          })()
      }

      async addMessages(messages) {
        callOrder.push('addMessages')

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.complete()

    const addMessagesCallCount = callOrder.filter(
      (e) => e === 'addMessages'
    ).length

    expect(addMessagesCallCount).toBe(1)

    // addMessages must come after all stream events
    const lastStreamIndex = callOrder.reduce(
      (max, e, i) => (e.startsWith('stream:') ? i : max),
      -1
    )
    const addMessagesIndex = callOrder.indexOf('addMessages')

    expect(addMessagesIndex).toBeGreaterThan(lastStreamIndex)

    // Confirm the bot message was emitted before addMessages ran
    messageEmittedBeforeAddMessages =
      callOrder.indexOf(`stream:${TAG_MESSAGE}`) < addMessagesIndex
    expect(messageEmittedBeforeAddMessages).toBe(true)
  })

  it('includes all stream messages in the single addMessages batch', async () => {
    const capturedMessages = []

    class TestEngine extends DynamicFunctionEngine {
      getConvFunction() {
        return () =>
          (async function* () {
            yield {
              type: TAG_MESSAGE,
              data: { type: MessageType.bot, text: 'First' },
            }
            yield {
              type: TAG_MESSAGE,
              data: { type: MessageType.bot, text: 'Second' },
            }
            yield { type: TAG_COMPLETE_END, data: { reason: 'stop' } }
          })()
      }

      async addMessages(messages) {
        capturedMessages.push(...messages)

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.complete()

    const botMessages = capturedMessages.filter(
      (m) => m.type === MessageType.bot
    )

    expect(botMessages.length).toBe(2)
    expect(botMessages[0].text).toBe('First')
    expect(botMessages[1].text).toBe('Second')
  })

  it('still calls addMessages after a stream error with whatever was buffered', async () => {
    const capturedMessages = []
    let addMessagesCallCount = 0

    class TestEngine extends DynamicFunctionEngine {
      getConvFunction() {
        return () =>
          (async function* () {
            yield {
              type: TAG_MESSAGE,
              data: { type: MessageType.bot, text: 'Partial response' },
            }

            // simulate a connection reset mid-stream
            throw new Error('Stream error')
          })()
      }

      async addMessages(messages) {
        addMessagesCallCount++
        capturedMessages.push(...messages)

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
    })

    const result = await engine.complete()

    // complete() itself should resolve (stream errors are caught internally)
    // addMessages must still be called with the partial message
    expect(addMessagesCallCount).toBe(1)

    const botMessages = capturedMessages.filter(
      (m) => m.type === MessageType.bot
    )

    expect(botMessages.length).toBe(1)
    expect(botMessages[0].text).toBe('Partial response')

    // reason reflects the error
    expect(result.reason).toBe('error')
  })

  it('passes a deferred functions resolver to the conversation function', async () => {
    let capturedOptions = null

    const getFunctions = jest
      .fn()
      .mockResolvedValueOnce([
        {
          name: 'forcedFunction',
          description: 'Forced function',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'initialFunction',
          description: 'Initial function',
          parameters: { type: 'object', properties: {} },
          call: { start: true },
        },
        {
          name: 'cleanupFunction',
          description: 'Cleanup function',
          parameters: { type: 'object', properties: {} },
          call: { end: true },
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'refreshedFunction',
          description: 'Refreshed function',
          parameters: { type: 'object', properties: {} },
        },
      ])

    class TestEngine extends DynamicFunctionEngine {
      async getFunctions(args) {
        return getFunctions(args)
      }

      getConvFunction() {
        return (options) => {
          capturedOptions = options

          return (async function* () {
            yield { type: TAG_COMPLETE_END, data: { reason: 'stop' } }
          })()
        }
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
      forceFunction: 'forcedFunction',
    })

    await engine.complete()

    expect(getFunctions).toHaveBeenCalledTimes(1)
    expect(capturedOptions).not.toBeNull()
    expect(typeof capturedOptions.functions).toBe('function')
    expect(capturedOptions.startFunctions).toEqual([
      'forcedFunction',
      'initialFunction',
    ])
    expect(capturedOptions.endFunctions).toEqual(['cleanupFunction'])

    const refreshedFunctions = await capturedOptions.functions()

    expect(getFunctions).toHaveBeenCalledTimes(2)
    expect(refreshedFunctions.map(({ name }) => name)).toEqual([
      'refreshedFunction',
    ])
  })

  it('produces no bot messages and calls addMessages with empty array when stream emits nothing', async () => {
    const capturedMessages = []

    const engine = makeTestEngine(
      [{ type: TAG_COMPLETE_END, data: { reason: 'stop' } }],
      {
        // Spy without subclassing - override after construction
      }
    )

    const original = engine.addMessages.bind(engine)

    engine.addMessages = async (messages) => {
      capturedMessages.push(...messages)

      return original(messages)
    }

    await engine.complete()

    const botMessages = capturedMessages.filter(
      (m) => m.type === MessageType.bot
    )

    expect(botMessages.length).toBe(0)
  })
})

describe('DynamicFunctionEngine - process() deferred persistence', () => {
  it('calls addMessages exactly once at the end of process()', async () => {
    const callOrder = []

    class TestEngine extends DynamicFunctionEngine {
      async addMessages(messages) {
        callOrder.push('addMessages')

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.process()

    expect(callOrder.filter((e) => e === 'addMessages').length).toBe(1)
  })

  it('does NOT call addMessages when moderation blocks the request', async () => {
    let addMessagesCalled = false

    class TestEngine extends DynamicFunctionEngine {
      async handleModeration(newMessages) {
        // Simulate abuse detected - push a context message and return false
        newMessages.push({
          type: MessageType.context,
          text: 'Abuse detected.',
          meta: { abuse: true },
        })

        return false
      }

      async addMessages(messages) {
        addMessagesCalled = true

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      moderation: true,
      messages: [{ type: 'user', text: 'Bad input' }],
    })

    const result = await engine.process()

    // addMessages must NOT have been called on the early-return path
    expect(addMessagesCalled).toBe(false)

    // The abuse context message is returned to the caller but not persisted
    expect(
      result.messages.some(
        (m) => m.type === MessageType.context && m.meta?.abuse
      )
    ).toBe(true)
  })

  it('does NOT call addMessages when privacy processing blocks the request', async () => {
    let addMessagesCalled = false

    class TestEngine extends DynamicFunctionEngine {
      async handlePrivacy() {
        return false
      }

      async addMessages(messages) {
        addMessagesCalled = true

        return super.addMessages(messages)
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      privacy: true,
      messages: [{ type: 'user', text: 'Hello' }],
    })

    await engine.process()

    expect(addMessagesCalled).toBe(false)
  })
})

describe('CoreEngine.send', () => {
  it('calls addMessages for the user message BEFORE process() runs', async () => {
    const callOrder = []

    class TestEngine extends DynamicFunctionEngine {
      async addMessages(messages) {
        callOrder.push({
          event: 'addMessages',
          types: messages.map((m) => m.type),
        })

        return super.addMessages(messages)
      }

      async process() {
        callOrder.push({ event: 'process' })

        return super.process()
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [],
    })

    await engine.send('Hello')

    // First addMessages call must be for the user message, before process()
    const firstAdd = callOrder[0]
    const processCall = callOrder.find((e) => e.event === 'process')

    expect(firstAdd.event).toBe('addMessages')
    expect(firstAdd.types).toContain(MessageType.user)
    expect(callOrder.indexOf(firstAdd)).toBeLessThan(
      callOrder.indexOf(processCall)
    )
  })

  it('user message is in this.messages before process() is called', async () => {
    let messagesAtProcessTime = null

    class TestEngine extends DynamicFunctionEngine {
      async process() {
        messagesAtProcessTime = [...this.messages]

        return super.process()
      }
    }

    const engine = new TestEngine({
      userId: '123',
      model: 'gpt-4o',
      messages: [],
    })

    await engine.send('Hello from user')

    expect(messagesAtProcessTime).not.toBeNull()
    expect(
      messagesAtProcessTime.some(
        (m) => m.type === MessageType.user && m.text === 'Hello from user'
      )
    ).toBe(true)
  })
})

describe('CoreEngine.steer', () => {
  function deferred() {
    /** @type {(value?: any) => void} */
    let resolve = () => {}

    /** @type {(reason?: any) => void} */
    let reject = () => {}

    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })

    return { promise, resolve, reject }
  }

  class TestSteerEngine extends CoreEngine {
    constructor(options = {}) {
      super({
        userId: '123',
        model: 'gpt-4o',
        messages: [],
        ...options,
      })

      this.calls = []
      this.receiveResults = []
    }

    async send(text, options) {
      this.calls.push({
        method: 'send',
        text,
        type: options?.type,
        signal: options?.signal,
      })

      return {
        usage: {},
        entities: [],
        messages: [{ type: options?.type || MessageType.user, text }],
      }
    }

    async receive(options) {
      this.calls.push({
        method: 'receive',
        signal: options?.signal,
      })

      const result = this.receiveResults.shift()

      if (result) {
        await result.promise
      }

      return {
        usage: {},
        messages: [{ type: MessageType.bot, text: 'ok' }],
        reason: 'success',
        text: 'ok',
      }
    }
  }

  it('sends and receives as one turn', async () => {
    const engine = new TestSteerEngine()

    const response = await engine.steer('Hello')

    expect(response.text).toBe('ok')
    expect(engine.calls.map((call) => call.method)).toEqual(['send', 'receive'])
    expect(engine.calls[0].text).toBe('Hello')
  })

  it('aborts the active turn and waits for it to settle before starting the next turn', async () => {
    const engine = new TestSteerEngine()
    const firstReceive = deferred()

    engine.receiveResults.push(firstReceive)

    const first = engine.steer('first')

    await Promise.resolve()

    const firstSignal = engine.calls.find(
      (call) => call.method === 'send' && call.text === 'first'
    ).signal

    const second = engine.steer('second')

    await Promise.resolve()

    expect(firstSignal.aborted).toBe(true)
    expect(
      engine.calls.some(
        (call) => call.method === 'send' && call.text === 'second'
      )
    ).toBe(false)

    firstReceive.resolve()

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })

    const response = await second

    expect(response.text).toBe('ok')
    expect(
      engine.calls.some(
        (call) => call.method === 'send' && call.text === 'second'
      )
    ).toBe(true)
  })

  it('supersedes pending turns while waiting for the active turn to abort', async () => {
    const engine = new TestSteerEngine()
    const firstReceive = deferred()

    engine.receiveResults.push(firstReceive)

    const first = engine.steer('first')

    await Promise.resolve()

    const second = engine.steer('second')
    const third = engine.steer('third')

    firstReceive.resolve()

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })

    const response = await third

    expect(response.text).toBe('ok')
    expect(
      engine.calls.some(
        (call) => call.method === 'send' && call.text === 'second'
      )
    ).toBe(false)
    expect(
      engine.calls.some(
        (call) => call.method === 'send' && call.text === 'third'
      )
    ).toBe(true)
  })
})

describe('CoreEngine channel handler abort signal', () => {
  it('should abort waitForChannelMessage when engine signal is aborted', async () => {
    const engineAbortController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      sessionId: 'session-123',
      model: 'gpt-4o',
      backstory: 'Test',
      signal: engineAbortController.signal,
      functions: [
        {
          name: 'myAction',
          description: 'Does something',
          parameters: {},
          result: { channel: 'action-channel' },
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    // @note capture the abortSignal passed to waitForChannelMessage
    waitForChannelMessage.mockImplementation(
      async (_session, _channel, options) => {
        // abort the engine signal to simulate request timeout
        engineAbortController.abort()

        // @note the signal passed to waitForChannelMessage should be aborted
        // because it combines the engine signal with the local one
        expect(options.abortSignal.aborted).toBe(true)

        return { result: 'ok' }
      }
    )

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { addUsage: jest.fn(), token: 0 },
      newMeta: {},
    })

    const channelFn = functions.find((f) => f.name === 'myAction')

    expect(channelFn).toBeDefined()
    expect(channelFn.handler).toBeDefined()

    await channelFn.handler({}, { newMessages: [] })

    expect(waitForChannelMessage).toHaveBeenCalledWith(
      { id: 'session-123' },
      'action-channel',
      expect.objectContaining({
        abortSignal: expect.any(Object),
      })
    )
  })

  it('should clean up interval and timeout when waitForChannelMessage throws', async () => {
    jest.useFakeTimers()

    const engine = new CoreEngine({
      userId: '123',
      sessionId: 'session-123',
      model: 'gpt-4o',
      backstory: 'Test',
      functions: [
        {
          name: 'myAction',
          description: 'Does something',
          parameters: {},
          result: { channel: 'action-channel' },
        },
      ],
    })

    await engine.addMessages([{ type: 'user', text: 'Hello' }])

    waitForChannelMessage.mockRejectedValue(new Error('Channel error'))

    const functions = await engine.getFunctions({
      newFunctionMessages: [],
      incomingMessages: [],
      usage: { addUsage: jest.fn(), token: 0 },
      newMeta: {},
    })

    const channelFn = functions.find((f) => f.name === 'myAction')

    // @note the handler should throw but still clean up timers
    await expect(channelFn.handler({}, { newMessages: [] })).rejects.toThrow(
      'Channel error'
    )

    // @note verify no pending timers are leaked by advancing time
    // If interval/timeout were not cleaned, they would fire here
    jest.advanceTimersByTime(10 * 60 * 1000)

    jest.useRealTimers()
  })
})

describe('CoreEngine timeoutMarks feature', () => {
  it('records a fired mark as an ephemeral live message, not a persisted one', async () => {
    const markController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'timeoutMarks' }],
      markSignals: [markController.signal],
    })

    const addMessages = jest.spyOn(engine, 'addMessages').mockResolvedValue([])

    // fire the mark - the engine listens and records a checkpoint
    markController.abort({ mark: 0.5, elapsedMs: 1234 })

    await Promise.resolve()

    // the checkpoint is NOT written through the persistence path...
    expect(addMessages).not.toHaveBeenCalled()

    // ...it is appended to the ephemeral live-message buffer as a pair
    const functionNames = engine.liveMessages.map(
      (message) => message.meta?.activity?.function?.name
    )

    expect(functionNames).toEqual([
      '_timeBudgetCheckpoint',
      '_timeBudgetCheckpoint',
    ])
  })

  it('records the fired mark into liveMessages with its payload, never the message store', async () => {
    const markController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'timeoutMarks' }],
      markSignals: [markController.signal],
    })

    engine.messages = [
      { type: MessageType.user, text: 'hello' },
      { type: MessageType.bot, text: 'hi' },
    ]

    markController.abort({ mark: 0.5, elapsedMs: 1234 })

    // flush the async record chain (#recordTimeoutMark -> liveMessages)
    await new Promise((resolve) => setImmediate(resolve))

    // the checkpoint does NOT enter the persisted message store...
    expect(
      engine.messages.some(
        (message) =>
          message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
      )
    ).toBe(false)

    // ...it lives only in the ephemeral live-message buffer, carrying the mark
    // and elapsed time so the conv function can surface it to the model in-flight
    const checkpoints = engine.liveMessages.filter(
      (message) =>
        message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
    )

    expect(checkpoints).toHaveLength(2)

    const [request, response] = checkpoints

    expect(request.meta.activity.function.arguments).toEqual({ mark: 0.5 })
    expect(response.meta.activity.function.result).toEqual({ elapsedMs: 1234 })
  })

  it('includes a wrap-up warning in the live checkpoint only for the final mark', async () => {
    const markController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'timeoutMarks' }],
      markSignals: [markController.signal],
    })

    // fire the last mark - the monitor flags it as `final`
    markController.abort({ mark: 0.8, elapsedMs: 600000, final: true })

    await new Promise((resolve) => setImmediate(resolve))

    const checkpoints = engine.liveMessages.filter(
      (message) =>
        message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
    )

    expect(checkpoints).toHaveLength(2)

    const [, response] = checkpoints

    expect(response.meta.activity.function.result).toEqual({
      elapsedMs: 600000,
      final: true,
      warning: expect.stringContaining('maximum duration'),
    })
  })

  it('does nothing with mark signals when the feature is absent', async () => {
    const markController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      // @note no 'timeoutMarks' feature
      markSignals: [markController.signal],
    })

    markController.abort({ mark: 0.5, elapsedMs: 1234 })

    await Promise.resolve()

    expect(engine.liveMessages).toHaveLength(0)
  })

  it('stops recording marks after dispose', async () => {
    const markController = new AbortController()

    const engine = new CoreEngine({
      userId: '123',
      model: 'gpt-4o',
      features: [{ name: 'timeoutMarks' }],
      markSignals: [markController.signal],
    })

    await engine.dispose()

    markController.abort({ mark: 0.5, elapsedMs: 1234 })

    await Promise.resolve()

    expect(engine.liveMessages).toHaveLength(0)
  })
})

describe(
  'getStatefulConversationEngineClass message loading guarantees',
  () => {
  const t = (minuteOffset) => new Date(Date.UTC(2024, 0, 1, 0, minuteOffset, 0))

  const CONVERSATION_ID = 'conv_guarantee_test'
  const USER_ID = 'user_guarantee_test'

  const mockConversation = {
    id: CONVERSATION_ID,
    userId: USER_ID,
    // @note explicit - the keyless test catalogue resolves no default model
    model: 'gpt-4o',
    bot: null,
    contact: null,
    meta: null,
  }

  const baseOptions = {
    conversationId: CONVERSATION_ID,
    messageTake: 3, // deliberately small to expose cut-off issues
    options: { userId: USER_ID },
  }

  // Helper to set up findFirst to return different values per type
  const mockFindFirst = ({ backstory = null, checkpoint = null } = {}) => {
    prisma.message.findFirst.mockImplementation(({ where }) => {
      if (where.type === MessageType.backstory) {
        return Promise.resolve(backstory)
      }

      if (where.type === MessageType.checkpoint) {
        return Promise.resolve(checkpoint)
      }

      return Promise.resolve(null)
    })
  }

  beforeEach(() => {
    prisma.conversation.findUnique.mockResolvedValue(mockConversation)
    mockFindFirst() // both null by default
    prisma.message.findMyriad.mockResolvedValue([])
  })

  describe('backstory type is immune to the checkpoint createdAt filter', () => {
    // Root cause: when a checkpoint exists the query gains
    // `createdAt: { gte: lastCheckpoint.createdAt }`.
    // Any backstory message written BEFORE the checkpoint satisfies the
    // type filter but fails the date filter - it is silently dropped.
    // Fix: backstory is fetched via a separate findFirst, always unconditional.

    it('should include a backstory message that predates the last checkpoint', async () => {
      // backstory at t=0, checkpoint at t=5, recent window t=7..8
      // Without the fix: WHERE createdAt >= t(5) silently drops backstory at t=0
      mockFindFirst({
        backstory: {
          id: 'msg_bs',
          type: MessageType.backstory,
          text: 'You are helpful.',
          meta: null,
          createdAt: t(0),
        },
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Checkpoint summary',
          meta: null,
          createdAt: t(5),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg8',
          type: MessageType.bot,
          text: 'C',
          meta: null,
          createdAt: t(8),
        },
        {
          id: 'msg7',
          type: MessageType.user,
          text: 'B',
          meta: null,
          createdAt: t(7),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(
        engine.messages.some((m) => m.type === MessageType.backstory)
      ).toBe(true)
    })

    it('should include backstory even when an explicit messageTypes list omits it', async () => {
      // When messageTypes = ['user', 'bot'], the window WHERE gains
      // `type: { in: ['user', 'bot'] }` - backstory never reaches the window.
      // Backstory must be guaranteed via the separate findFirst regardless.
      mockFindFirst({
        backstory: {
          id: 'msg_bs',
          type: MessageType.backstory,
          text: 'You are a helpful assistant.',
          meta: null,
          createdAt: t(0),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg2',
          type: MessageType.bot,
          text: 'Hi',
          meta: null,
          createdAt: t(2),
        },
        {
          id: 'msg1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: t(1),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass({
        ...baseOptions,
        messageTypes: [MessageType.user, MessageType.bot], // backstory not requested
      })
      const engine = new EngineClass({ userId: USER_ID })

      expect(
        engine.messages.some((m) => m.type === MessageType.backstory)
      ).toBe(true)
    })

    it('should include backstory exactly once (window always excludes it)', async () => {
      // The window type filter always excludes backstory, so the guaranteed
      // findFirst result is the only source - no deduplication needed.
      mockFindFirst({
        backstory: {
          id: 'msg_bs',
          type: MessageType.backstory,
          text: 'You are helpful.',
          meta: null,
          createdAt: t(0),
        },
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Summary',
          meta: null,
          createdAt: t(1),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg3',
          type: MessageType.user,
          text: 'B',
          meta: null,
          createdAt: t(3),
        },
        {
          id: 'msg2',
          type: MessageType.bot,
          text: 'A',
          meta: null,
          createdAt: t(2),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(
        engine.messages.filter((m) => m.type === MessageType.backstory)
      ).toHaveLength(1)
    })
  })

  describe('checkpoint is always included regardless of the take window', () => {
    // Even with `gte: lastCheckpoint.createdAt`, if more than `messageTake`
    // messages exist since the checkpoint, desc + take cuts off the oldest ones
    // - which includes the checkpoint itself.
    // Fix: checkpoint is fetched via a separate findFirst and prepended.

    it('should include the checkpoint when the take window does not reach it', async () => {
      // checkpoint at t=0, 3 messages after it (t=1..3), take=3
      // Window (without fix): gte=t(0), orderBy desc, take=3 → t(3), t(2), t(1); t(0) cut off
      mockFindFirst({
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Prior summary',
          meta: null,
          createdAt: t(0),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg3',
          type: MessageType.bot,
          text: 'C',
          meta: null,
          createdAt: t(3),
        },
        {
          id: 'msg2',
          type: MessageType.user,
          text: 'B',
          meta: null,
          createdAt: t(2),
        },
        {
          id: 'msg1',
          type: MessageType.bot,
          text: 'A',
          meta: null,
          createdAt: t(1),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(
        engine.messages.some((m) => m.type === MessageType.checkpoint)
      ).toBe(true)
    })

    it('should include checkpoint exactly once (window always excludes it)', async () => {
      // The window type filter always excludes checkpoint, so the guaranteed
      // findFirst result is the only source - no deduplication needed.
      mockFindFirst({
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Summary',
          meta: null,
          createdAt: t(1),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg2',
          type: MessageType.user,
          text: 'B',
          meta: null,
          createdAt: t(2),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(
        engine.messages.filter((m) => m.type === MessageType.checkpoint)
      ).toHaveLength(1)
    })

    it('should behave normally when no checkpoint exists', async () => {
      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg2',
          type: MessageType.bot,
          text: 'Hi',
          meta: null,
          createdAt: t(2),
        },
        {
          id: 'msg1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: t(1),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(engine.messages).toHaveLength(2)
      expect(
        engine.messages.some((m) => m.type === MessageType.checkpoint)
      ).toBe(false)
    })
  })

  describe('message assembly order', () => {
    it('should order messages chronologically: backstory(t=0) → checkpoint(t=5) → user(t=7) → bot(t=8)', async () => {
      mockFindFirst({
        backstory: {
          id: 'msg_bs',
          type: MessageType.backstory,
          text: 'System prompt',
          meta: null,
          createdAt: t(0),
        },
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Summary',
          meta: null,
          createdAt: t(5),
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg8',
          type: MessageType.bot,
          text: 'C',
          meta: null,
          createdAt: t(8),
        },
        {
          id: 'msg7',
          type: MessageType.user,
          text: 'B',
          meta: null,
          createdAt: t(7),
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(engine.messages[0].type).toBe(MessageType.backstory)
      expect(engine.messages[1].type).toBe(MessageType.checkpoint)
      expect(engine.messages[2].type).toBe(MessageType.user)
      expect(engine.messages[3].type).toBe(MessageType.bot)
    })

    it('should normalize equal createdAt window messages by id ascending when database timestamps collapse', async () => {
      const collapsedTimestamp = t(7)

      mockFindFirst({
        backstory: {
          id: 'msg_bs',
          type: MessageType.backstory,
          text: 'System prompt',
          meta: null,
          createdAt: t(0),
        },
        checkpoint: {
          id: 'msg_cp',
          type: MessageType.checkpoint,
          text: 'Summary',
          meta: null,
          createdAt: t(5),
        },
      })

      // @note findMyriad returns newest-first, matching the production query
      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg3',
          type: MessageType.bot,
          text: 'final response',
          meta: null,
          createdAt: collapsedTimestamp,
        },
        {
          id: 'msg2',
          type: MessageType.activity,
          text: '',
          meta: { activity: { type: 'response' } },
          createdAt: collapsedTimestamp,
        },
        {
          id: 'msg1',
          type: MessageType.activity,
          text: '',
          meta: { activity: { type: 'request' } },
          createdAt: collapsedTimestamp,
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(engine.messages.map((message) => message.id)).toEqual([
        'msg_bs',
        'msg_cp',
        'msg1',
        'msg2',
        'msg3',
      ])
    })

    it('should deterministically order guaranteed and window messages when all createdAt values are identical', async () => {
      const collapsedTimestamp = t(5)

      mockFindFirst({
        backstory: {
          id: 'msg1',
          type: MessageType.backstory,
          text: 'System prompt',
          meta: null,
          createdAt: collapsedTimestamp,
        },
        checkpoint: {
          id: 'msg2',
          type: MessageType.checkpoint,
          text: 'Summary',
          meta: null,
          createdAt: collapsedTimestamp,
        },
      })

      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'msg4',
          type: MessageType.bot,
          text: 'final response',
          meta: null,
          createdAt: collapsedTimestamp,
        },
        {
          id: 'msg3',
          type: MessageType.user,
          text: 'latest question',
          meta: null,
          createdAt: collapsedTimestamp,
        },
      ])

      const EngineClass = await getStatefulConversationEngineClass(baseOptions)
      const engine = new EngineClass({ userId: USER_ID })

      expect(engine.messages.map((message) => message.id)).toEqual([
        'msg1',
        'msg2',
        'msg3',
        'msg4',
      ])

      expect(engine.messages.map((message) => message.type)).toEqual([
        MessageType.backstory,
        MessageType.checkpoint,
        MessageType.user,
        MessageType.bot,
      ])
    })
  })
})

describe(
  'getStatefulConversationEngineClass messageTake resolution',
  () => {
  const CONVERSATION_ID = 'conv_messagetake_test'
  const USER_ID = 'user_messagetake_test'

  const baseConversation = {
    id: CONVERSATION_ID,
    userId: USER_ID,
    bot: null,
    contact: null,
    meta: null,
  }

  beforeEach(() => {
    prisma.message.findFirst.mockResolvedValue(null)
    prisma.message.findMyriad.mockResolvedValue([])
  })

  it('derives messageTake from the conversation model interactionMaxMessages', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...baseConversation,
      model: 'gpt-4o/interactionMaxMessages=7',
    })

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      options: { userId: USER_ID },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(7)
  })

  it('derives messageTake from the bot model when conversation has no model', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...baseConversation,
      bot: {
        id: 'bot-1',
        userId: USER_ID,
        model: 'gpt-4o/interactionMaxMessages=5',
      },
    })

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      options: { userId: USER_ID },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(5)
  })

  it('derives messageTake from the bot model when conversation model is an empty string', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...baseConversation,
      model: '',
      bot: {
        id: 'bot-1',
        userId: USER_ID,
        model: 'gpt-4o/interactionMaxMessages=5',
      },
    })

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      options: { userId: USER_ID },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(5)
  })

  it('derives messageTake from options.options.model when conversation and bot have no model', async () => {
    prisma.conversation.findUnique.mockResolvedValue(baseConversation)

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      options: { userId: USER_ID, model: 'gpt-4o/interactionMaxMessages=12' },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(12)
  })

  it('conversation model takes precedence over options.options.model', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...baseConversation,
      model: 'gpt-4o/interactionMaxMessages=7',
    })

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      options: { userId: USER_ID, model: 'gpt-4o/interactionMaxMessages=99' },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(7)
  })

  it('explicit messageTake override wins over model interactionMaxMessages', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...baseConversation,
      model: 'gpt-4o/interactionMaxMessages=7',
    })

    await getStatefulConversationEngineClass({
      conversationId: CONVERSATION_ID,
      messageTake: 42,
      options: { userId: USER_ID },
    })

    const findMyriadCall = prisma.message.findMyriad.mock.calls[0][0]

    expect(findMyriadCall.take).toBe(42)
  })
})

describe('getStatefulConversationEngineClass compact feature', () => {
  const CONVERSATION_ID = 'conv_compact_feature'
  const USER_ID = 'user_compact_feature'

  const conversation = {
    id: CONVERSATION_ID,
    userId: USER_ID,
    // @note explicit - the keyless test catalogue resolves no default model
    model: 'gpt-4o',
    bot: null,
    contact: null,
    meta: null,
  }

  const baseOptions = {
    conversationId: CONVERSATION_ID,
    options: { userId: USER_ID },
  }

  /**
   * @param {{tokens?: number, messages?: number}|null} compactOptions
   * @param {number} seedMessageCount
   * @param {number} inputTokensUsed
   * @returns {{engine: any, sink: { push: jest.Mock }}}
   */
  const createEngine = async (
    compactOptions,
    seedMessageCount = MIN_COMPACT_MESSAGES_THRESHOLD,
    inputTokensUsed = 25
  ) => {
    prisma.conversation.findUnique.mockResolvedValue(conversation)

    prisma.message.findFirst.mockResolvedValue(null)
    prisma.message.findMyriad.mockResolvedValue(
      Array.from({ length: seedMessageCount }, (_, index) => ({
        id: `seed-${index + 1}`,
        type: MessageType.user,
        text: `Hello ${index + 1}`,
        meta: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }))
    )

    const EngineClass = await getStatefulConversationEngineClass(baseOptions)

    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    const features = compactOptions
      ? [{ name: 'compact', options: compactOptions }]
      : []

    const engine = new EngineClass({
      userId: USER_ID,
      model: 'gpt-4o',
      sink,
      features,
      messages: clone(baseOptions.messages),
    })

    // @note avoid persistence side effects in this isolated behavior test
    engine.addMessages = async (messages) => {
      engine.messages.push(...messages)

      return messages.map((message, index) => ({
        id: `msg-${index}`,
        ...message,
      }))
    }

    engine.getConvFunction = () => {
      return () =>
        (async function* () {
          yield {
            type: TAG_USAGE,
            data: {
              inputTokensUsed,
              outputTokensUsed: 5,
              model: 'gpt-4o',
            },
          }

          yield {
            type: TAG_MESSAGE,
            data: { type: MessageType.bot, text: 'response' },
          }

          yield {
            type: TAG_COMPLETE_END,
            data: { reason: 'stop' },
          }
        })()
    }

    return { engine, sink }
  }

  beforeEach(() => {
    extractData.mockReset()
    extractData.mockResolvedValue({
      data: { summary: 'compact summary' },
      usage: null,
    })
  })

  it('does not compact when compact feature is missing', async () => {
    const { engine, sink } = await createEngine(null)

    const result = await engine.complete()

    expect(extractData).not.toHaveBeenCalled()
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(false)
    expect(sink.push).not.toHaveBeenCalledWith(
      TAG_COMPACTION_BEGIN,
      expect.any(Object)
    )
  })

  it('compacts when token threshold is reached', async () => {
    const { engine, sink } = await createEngine(
      { tokens: 1 },
      MIN_COMPACT_MESSAGES_THRESHOLD,
      MIN_COMPACT_TOKENS_THRESHOLD
    )

    const result = await engine.complete()

    const compactionBeginCall = sink.push.mock.calls.find(
      ([type]) => type === TAG_COMPACTION_BEGIN
    )

    expect(extractData).toHaveBeenCalledTimes(1)
    expect(compactionBeginCall).toBeDefined()
    expect(compactionBeginCall[1].estimatedTokens).toBeGreaterThan(0)
    expect(sink.push).toHaveBeenCalledWith(TAG_COMPACTION_END, {
      success: true,
    })
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(true)
  })

  it('compacts when message threshold is reached', async () => {
    const { engine } = await createEngine({ messages: 2 })

    const result = await engine.complete()

    expect(extractData).toHaveBeenCalledTimes(1)
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(true)
  })

  it('does not compact below the minimum compact message threshold', async () => {
    const { engine, sink } = await createEngine({ messages: 1 }, 4)

    const result = await engine.complete()

    expect(extractData).not.toHaveBeenCalled()
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(false)
    expect(sink.push).not.toHaveBeenCalledWith(
      TAG_COMPACTION_BEGIN,
      expect.any(Object)
    )
  })
})

describe('getStatelessConversationEngineClass compact feature', () => {
  const USER_ID = 'user_compact_feature'

  const baseOptions = {
    messages: Array.from(
      { length: MIN_COMPACT_MESSAGES_THRESHOLD + 1 },
      (_, index) => ({
        id: `seed-${index + 1}`,
        type: MessageType.user,
        text: `Hello ${index + 1}`,
        meta: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      })
    ),
    // @note explicit - the keyless test catalogue resolves no default model
    model: 'gpt-4o',
    options: { userId: USER_ID },
  }

  /**
   * @param {{tokens?: number, messages?: number}|null} compactOptions
   * @param {number} inputTokensUsed
   * @returns {{engine: any, sink: { push: jest.Mock }}}
   */
  const createEngine = async (compactOptions, inputTokensUsed = 25) => {
    const EngineClass = await getStatelessConversationEngineClass(baseOptions)

    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    const features = compactOptions
      ? [{ name: 'compact', options: compactOptions }]
      : []

    const engine = new EngineClass({
      userId: USER_ID,
      model: 'gpt-4o',
      sink,
      features,
      messages: clone(baseOptions.messages),
    })

    engine.getConvFunction = () => {
      return () =>
        (async function* () {
          yield {
            type: TAG_USAGE,
            data: {
              inputTokensUsed,
              outputTokensUsed: 5,
              model: 'gpt-4o',
            },
          }

          yield {
            type: TAG_MESSAGE,
            data: { type: MessageType.bot, text: 'response' },
          }

          yield {
            type: TAG_COMPLETE_END,
            data: { reason: 'stop' },
          }
        })()
    }

    return { engine, sink }
  }

  beforeEach(() => {
    extractData.mockReset()
    extractData.mockResolvedValue({
      data: { summary: 'compact summary' },
      usage: null,
    })
  })

  it('does not compact when compact feature is missing', async () => {
    const { engine, sink } = await createEngine(null)

    const result = await engine.complete()

    expect(extractData).not.toHaveBeenCalled()
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(false)
    expect(sink.push).not.toHaveBeenCalledWith(
      TAG_COMPACTION_BEGIN,
      expect.any(Object)
    )
  })

  it('compacts when token threshold is reached', async () => {
    const { engine, sink } = await createEngine(
      { tokens: 1 },
      MIN_COMPACT_TOKENS_THRESHOLD
    )

    const result = await engine.complete()

    const compactionBeginCall = sink.push.mock.calls.find(
      ([type]) => type === TAG_COMPACTION_BEGIN
    )

    expect(extractData).toHaveBeenCalledTimes(1)
    expect(compactionBeginCall).toBeDefined()
    expect(compactionBeginCall[1].estimatedTokens).toBeGreaterThan(0)
    expect(sink.push).toHaveBeenCalledWith(TAG_COMPACTION_END, {
      success: true,
    })
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(true)
  })

  it('does not compact when message threshold is reached but minimum compact threshold is not met', async () => {
    const { engine } = await createEngine({ messages: 2 })

    const result = await engine.complete()

    expect(extractData).not.toHaveBeenCalled()
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(false)
  })

  it('does not compact below the minimum compact message threshold', async () => {
    const EngineClass = await getStatelessConversationEngineClass({
      ...baseOptions,
      messages: [
        {
          id: 'seed-1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          id: 'seed-2',
          type: MessageType.user,
          text: 'Hello again',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
    })

    const sink = { push: jest.fn().mockResolvedValue(undefined) }

    const engine = new EngineClass({
      userId: USER_ID,
      model: 'gpt-4o',
      sink,
      features: [{ name: 'compact', options: { messages: 1 } }],
      messages: [
        {
          id: 'seed-1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          id: 'seed-2',
          type: MessageType.user,
          text: 'Hello again',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
    })

    engine.getConvFunction = () => {
      return () =>
        (async function* () {
          yield {
            type: TAG_USAGE,
            data: {
              inputTokensUsed: 25,
              outputTokensUsed: 5,
              model: 'gpt-4o',
            },
          }

          yield {
            type: TAG_MESSAGE,
            data: { type: MessageType.bot, text: 'response' },
          }

          yield {
            type: TAG_COMPLETE_END,
            data: { reason: 'stop' },
          }
        })()
    }

    const result = await engine.complete()

    expect(extractData).not.toHaveBeenCalled()
    expect(
      result.messages.some((message) => message.type === MessageType.checkpoint)
    ).toBe(false)
    expect(sink.push).not.toHaveBeenCalledWith(
      TAG_COMPACTION_BEGIN,
      expect.any(Object)
    )
  })
})

describe('thresholdStrategy resolution', () => {
  describe('getStatefulConversationEngine thresholdStrategy', () => {
    const CONVERSATION_ID = 'conv_threshold_strategy'
    const USER_ID = 'user_threshold_strategy'

    const conversation = {
      id: CONVERSATION_ID,
      userId: USER_ID,
      bot: null,
      contact: null,
      meta: null,
    }

    /**
     * @param {string|undefined} model
     * @returns {{engine: any}}
     */
    const createEngine = async (model) => {
      prisma.conversation.findUnique.mockResolvedValue(conversation)

      prisma.message.findFirst.mockResolvedValue(null)
      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'seed-1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ])

      const engine = await getStatefulConversationEngine({
        conversationId: CONVERSATION_ID,
        options: { userId: USER_ID, model: model || 'gpt-4o' },
      })

      return { engine }
    }

    it('adds compact feature when thresholdStrategy is compact', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/maxTokens=20000/interactionMaxMessages=40/thresholdStrategy=compact'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.name).toBe('compact')
      expect(compactFeature.options.messages).toBeGreaterThan(0)
      expect(compactFeature.options.tokens).toBeGreaterThan(0)
    })

    it('does not add compact feature when thresholdStrategy is truncate', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/thresholdStrategy=truncate'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).toBeNull()
    })

    it('does not add compact feature when thresholdStrategy is missing', async () => {
      const { engine } = await createEngine(undefined)

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).toBeNull()
    })

    it('adds compact feature when thresholdStrategy is present in conversation model', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...conversation,
        model:
          'custom/name=test/provider=openai/credentials=abc123/thresholdStrategy=compact/maxTokens=20000/interactionMaxMessages=40',
      })

      prisma.message.findFirst.mockResolvedValue(null)
      prisma.message.findMyriad.mockResolvedValue([
        {
          id: 'seed-1',
          type: MessageType.user,
          text: 'Hello',
          meta: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ])

      const engine = await getStatefulConversationEngine({
        conversationId: CONVERSATION_ID,
        options: { userId: USER_ID },
      })

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.name).toBe('compact')
      expect(compactFeature.options.messages).toBeGreaterThan(0)
      expect(compactFeature.options.tokens).toBeGreaterThan(0)
    })

    it('keeps the model maxTokens value as the compact token threshold signal', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/maxTokens=500/interactionMaxMessages=40/thresholdStrategy=compact'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.options.tokens).toBe(500)
    })
  })

  describe('getStatelessConversationEngineClass thresholdStrategy', () => {
    const USER_ID = 'user_threshold_strategy_stateless'

    /**
     * @param {string|undefined} model
     * @returns {{engine: any}}
     */
    const createEngine = async (model) => {
      const engine = await getStatelessConversationEngine({
        messages: [
          {
            id: 'seed-1',
            type: MessageType.user,
            text: 'Hello',
            meta: null,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        options: {
          userId: USER_ID,
          model: model || 'gpt-4o',
          sink: { push: jest.fn() },
        },
      })

      return { engine }
    }

    it('adds compact feature when thresholdStrategy is compact', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/maxTokens=20000/interactionMaxMessages=40/thresholdStrategy=compact'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.name).toBe('compact')
      expect(compactFeature.options.messages).toBeGreaterThan(0)
      expect(compactFeature.options.tokens).toBeGreaterThan(0)
    })

    it('does not add compact feature when thresholdStrategy is truncate', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/thresholdStrategy=truncate'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).toBeNull()
    })

    it('does not add compact feature when thresholdStrategy is missing', async () => {
      const { engine } = await createEngine(undefined)

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).toBeNull()
    })

    it('adds compact feature when thresholdStrategy is present in stateless model override', async () => {
      const engine = await getStatelessConversationEngine({
        model:
          'custom/name=test/provider=openai/credentials=abc123/thresholdStrategy=compact/maxTokens=20000/interactionMaxMessages=40',
        messages: [
          {
            id: 'seed-1',
            type: MessageType.user,
            text: 'Hello',
            meta: null,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        options: { userId: USER_ID },
      })

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.name).toBe('compact')
      expect(compactFeature.options.messages).toBeGreaterThan(0)
      expect(compactFeature.options.tokens).toBeGreaterThan(0)
    })

    it('keeps the model maxTokens value as the compact token threshold signal', async () => {
      const { engine } = await createEngine(
        'custom/name=test/provider=openai/credentials=abc123/maxTokens=500/interactionMaxMessages=40/thresholdStrategy=compact'
      )

      const compactFeature = engine.getFeature('compact')

      expect(compactFeature).not.toBeNull()
      expect(compactFeature.options.tokens).toBe(500)
    })
  })
})

describe('bot block enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // default to "not blocked"; individual tests override
    botBlockOk.mockResolvedValue(true)
    getBotBlock.mockResolvedValue(null)
  })

  describe('assertBotNotBlocked', () => {
    it('is a no-op when there is no bot in context', async () => {
      await expect(assertBotNotBlocked()).resolves.toBeUndefined()

      expect(botBlockOk).not.toHaveBeenCalled()
    })

    it('allows a bot that is not blocked (no reason lookup)', async () => {
      botBlockOk.mockResolvedValue(true)

      await executeInContext(async () => {
        setContextBot({ id: 'bot-1' })

        await expect(assertBotNotBlocked()).resolves.toBeUndefined()
      })

      expect(botBlockOk).toHaveBeenCalledWith('bot-1')
      expect(getBotBlock).not.toHaveBeenCalled()
    })

    it('throws with the block reason when the bot is blocked', async () => {
      botBlockOk.mockResolvedValue(false)
      getBotBlock.mockResolvedValue({ reason: 'blocked by policy', ttl: 60 })

      await executeInContext(async () => {
        setContextBot({ id: 'bot-1' })

        await expect(assertBotNotBlocked()).rejects.toThrow('blocked by policy')
      })
    })
  })

  describe('completion methods refuse a blocked bot', () => {
    const makeEngine = () =>
      new (class extends BasicFunctionEngine {
        constructor() {
          super({ userId: '123', model: 'gpt-4o' })
        }
      })()

    beforeEach(() => {
      botBlockOk.mockResolvedValue(false)
      getBotBlock.mockResolvedValue({ reason: 'blocked by policy', ttl: 60 })
    })

    it('complete() throws before doing any work', async () => {
      const engine = makeEngine()

      await executeInContext(async () => {
        setContextBot({ id: 'bot-1' })

        await expect(engine.complete()).rejects.toThrow('blocked by policy')
      })

      expect(botBlockOk).toHaveBeenCalledWith('bot-1')
    })

    it('process() throws before doing any work', async () => {
      const engine = makeEngine()

      await executeInContext(async () => {
        setContextBot({ id: 'bot-1' })

        await expect(engine.process()).rejects.toThrow('blocked by policy')
      })

      expect(botBlockOk).toHaveBeenCalledWith('bot-1')
    })
  })
})
