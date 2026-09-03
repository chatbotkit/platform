/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  doBotApply,
  doBotAsk,
  doBotCall,
  doBotList,
  launch,
} from '@/lib/action.exec.bot'
import {
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_RESULT,
  TAG_TOKEN,
} from '@/lib/conversation.tag'
import { getSessionForUserId } from '@/lib/user.session'

jest.mock('@/prisma/client', () => {
  const originalModule = jest.requireActual('@/prisma/client')

  return {
    ...originalModule,

    __esModule: true,

    default: mockDeep(),
  }
})

jest.mock('@/lib/bot.access', () => ({
  canUseBot: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getLocalSessionClient: jest.fn(),
  getUserClient: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextContact: jest.fn(),
  getContextConversation: jest.fn(),
  getContextNamespace: jest.fn(),
  getContextUser: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const mockDebugResult = { log: jest.fn() }
  const mockDebug = jest.fn(() => mockDebugResult)

  return {
    __esModule: true,
    default: mockDebug,
    debug: mockDebug,
  }
})

jest.mock('@/lib/user.session', () => ({
  getSessionForUserId: jest.fn(async (userId) => ({
    id: 'session-id',
    user: { id: userId },
  })),
}))

jest.mock('@/pages/api/v1/conversation/complete', () => ({
  __esModule: true,
  default: jest.fn(async () => new Response()),
}))

const mockGetLocalSessionClient =
  jest.requireMock('@/lib/cbk.sdk').getLocalSessionClient
const mockGetUserClient = jest.requireMock('@/lib/cbk.sdk').getUserClient
const mockConversationStream = jest.fn()
const mockConversationComplete = jest.fn(() => ({
  stream: mockConversationStream,
}))
const {
  getContextBot,
  getContextContact,
  getContextConversation,
  getContextNamespace,
  getContextUser,
} = jest.requireMock('@/lib/context.store')
const { fastGetUserById } = jest.requireMock('@/lib/user.get')
const { accountLimitsOk } = jest.requireMock('@/lib/limit.core')

beforeEach(() => {
  mockReset(prisma)
  jest.clearAllMocks()
  mockConversationComplete.mockClear()
  mockConversationStream.mockReset()
  mockGetLocalSessionClient.mockResolvedValue({
    conversation: {
      complete: mockConversationComplete,
    },
  })
  getContextBot.mockReturnValue(null)
  getContextConversation.mockReturnValue(null)
  getContextUser.mockReturnValue(null)
})

describe('doBotAsk', () => {
  const mockBot = { id: 'bot-123', name: 'Test Bot' }

  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      blueprintId: 'bp-123',
      skillsetId: 'ss-123',
      abilityId: 'ab-123',
    },
  }

  const mockUser = { id: 'user-123', email: 'test@example.com' }

  const mockSink = { push: jest.fn() }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(mockUser)
    accountLimitsOk.mockResolvedValue(true)
    getContextContact.mockReturnValue(null)
    getContextNamespace.mockReturnValue(null)
  })

  test('should pass contactId to complete when context contact exists', async () => {
    const contact = {
      id: 'contact-456',
      name: 'Contact Ask',
      description: 'Ask contact',
      email: 'ask@example.com',
      phone: '+10000000001',
      nick: 'asky',
      fingerprint: 'fingerprint-ask-1',
    }

    getContextContact.mockReturnValue(contact)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-123',
        contactId: {
          name: 'Contact Ask',
          description: 'Ask contact',
          email: 'ask@example.com',
          phone: '+10000000001',
          nick: 'asky',
          fingerprint: 'fingerprint-ask-1',
        },
      }),
    )

    expect(mockConversationStream).toHaveBeenCalledWith({
      abortSignal: undefined,
    })
  })

  test('should pass namespace to complete when context namespace exists', async () => {
    const namespace = 'test-namespace'

    getContextNamespace.mockReturnValue(namespace)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-123',
        namespace: namespace,
      })
    )
  })

  test('should pass both contactId and namespace to complete when both exist', async () => {
    const contact = {
      id: 'contact-789',
      name: 'Contact Ask Namespace',
      description: 'Ask namespace contact',
      email: 'ask-ns@example.com',
      phone: '+10000000002',
      nick: 'askns',
      fingerprint: 'fingerprint-ask-2',
    }
    const namespace = 'my-namespace'

    getContextContact.mockReturnValue(contact)
    getContextNamespace.mockReturnValue(namespace)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-123',
        contactId: {
          name: 'Contact Ask Namespace',
          description: 'Ask namespace contact',
          email: 'ask-ns@example.com',
          phone: '+10000000002',
          nick: 'askns',
          fingerprint: 'fingerprint-ask-2',
        },
        namespace: namespace,
      })
    )
  })

  test('should pass null contactId when context contact is null', async () => {
    getContextContact.mockReturnValue(null)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-123',
        contactId: undefined,
      })
    )
  })

  test('should pass null namespace when context namespace is null', async () => {
    getContextNamespace.mockReturnValue(null)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-123',
        namespace: undefined,
      })
    )
  })

  test('should return accumulated token text when no result is emitted', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_TOKEN, data: { token: 'Hello' } }
      yield { type: TAG_TOKEN, data: { token: ' bot' } }
    })

    const result = await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Hello bot',
      messages: [],
      debugMessages: [],
    })
  })

  test('should prefer final result text over accumulated tokens', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_TOKEN, data: { token: 'Draft' } }
      yield { type: TAG_RESULT, data: { text: 'Final answer' } }
    })

    const result = await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Final answer',
      messages: [],
      debugMessages: [],
    })
  })

  test('should keep bot messages as debug messages and use bot text as result', async () => {
    const botMessage = { type: 'bot', text: 'Message answer' }
    const activityMessage = { type: 'activity', text: 'Working' }

    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_MESSAGE, data: activityMessage }
      yield { type: TAG_MESSAGE, data: botMessage }
    })

    const result = await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Message answer',
      messages: [],
      debugMessages: [activityMessage, botMessage],
    })
    expect(mockSink.push).not.toHaveBeenCalled()
  })

  test('should return no response when the bot stream is empty', async () => {
    mockConversationStream.mockImplementation(async function* () {})

    const result = await doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'No response',
      messages: [],
      debugMessages: [],
    })
  })

  test('should return token limit error when account limits fail', async () => {
    accountLimitsOk.mockResolvedValue(false)

    await expect(
      doBotAsk({
        bot: mockBot,
        input: 'Hello bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).resolves.toEqual({
      error: 'You have reached your token limit.',
    })

    expect(mockConversationComplete).not.toHaveBeenCalled()
  })

  test('should throw when the caller user cannot be found', async () => {
    fastGetUserById.mockResolvedValue(null)

    await expect(
      doBotAsk({
        bot: mockBot,
        input: 'Hello bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).rejects.toThrow('User not found')

    expect(mockConversationComplete).not.toHaveBeenCalled()
  })

  test('should propagate non-timeout stream exceptions', async () => {
    const streamError = new Error('stream failed')

    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_TOKEN, data: { token: 'Partial' } }

      throw streamError
    })

    await expect(
      doBotAsk({
        bot: mockBot,
        input: 'Hello bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).rejects.toThrow('stream failed')
  })

  test('should abort and return abort when timeout is exceeded', async () => {
    jest.useFakeTimers()

    mockConversationStream.mockImplementation(async function* (callOptions) {
      await new Promise((resolve) => {
        callOptions.abortSignal.addEventListener('abort', resolve, {
          once: true,
        })
      })
    })

    const resultPromise = doBotAsk({
      bot: mockBot,
      input: 'Hello bot',
      params: { timeout: 25 },
      options: mockOptions,
      sink: mockSink,
    })

    await jest.advanceTimersByTimeAsync(25)

    await expect(resultPromise).resolves.toEqual({
      result: 'abort',
      messages: [],
      debugMessages: [],
    })

    expect(mockConversationStream).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: expect.any(AbortSignal),
      })
    )

    jest.useRealTimers()
  })
})

describe('doBotCall', () => {
  const mockBot = { id: 'bot-456', name: 'Call Bot' }

  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      blueprintId: 'bp-123',
      skillsetId: 'ss-123',
      abilityId: 'ab-123',
    },
  }

  const mockUser = { id: 'user-123', email: 'test@example.com' }

  const mockSink = { push: jest.fn() }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(mockUser)
    accountLimitsOk.mockResolvedValue(true)
    getContextContact.mockReturnValue(null)
    getContextNamespace.mockReturnValue(null)
  })

  test('should pass contactId to complete when context contact exists', async () => {
    const contact = {
      id: 'contact-call-123',
      name: 'Contact Call',
      description: 'Call contact',
      email: 'call@example.com',
      phone: '+10000000003',
      nick: 'cally',
      fingerprint: 'fingerprint-call-1',
    }

    getContextContact.mockReturnValue(contact)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-456',
        contactId: {
          name: 'Contact Call',
          description: 'Call contact',
          email: 'call@example.com',
          phone: '+10000000003',
          nick: 'cally',
          fingerprint: 'fingerprint-call-1',
        },
      }),
    )
  })

  test('should pass namespace to complete when context namespace exists', async () => {
    const namespace = 'call-namespace'

    getContextNamespace.mockReturnValue(namespace)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-456',
        namespace: namespace,
      })
    )
  })

  test('should pass both contactId and namespace to complete when both exist', async () => {
    const contact = {
      id: 'contact-call-456',
      name: 'Contact Call Namespace',
      description: 'Call namespace contact',
      email: 'call-ns@example.com',
      phone: '+10000000004',
      nick: 'callns',
      fingerprint: 'fingerprint-call-2',
    }
    const namespace = 'call-ns'

    getContextContact.mockReturnValue(contact)
    getContextNamespace.mockReturnValue(namespace)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-456',
        contactId: {
          name: 'Contact Call Namespace',
          description: 'Call namespace contact',
          email: 'call-ns@example.com',
          phone: '+10000000004',
          nick: 'callns',
          fingerprint: 'fingerprint-call-2',
        },
        namespace: namespace,
      })
    )
  })

  test('should pass null contactId when context contact is null', async () => {
    getContextContact.mockReturnValue(null)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-456',
        contactId: undefined,
      })
    )
  })

  test('should pass null namespace when context namespace is null', async () => {
    getContextNamespace.mockReturnValue(null)

    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        botId: 'bot-456',
        namespace: undefined,
      })
    )
  })

  test('should include batch feature in complete call', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Bot response' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockConversationComplete).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        extensions: {
          features: [{ name: 'batch' }],
        },
      })
    )
  })

  test('should return messages and debug messages from the bot stream', async () => {
    const activityMessage = { type: 'activity', text: 'Working' }
    const botMessage = { type: 'bot', text: 'Call answer' }

    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_MESSAGE, data: activityMessage }
      yield { type: TAG_MESSAGE, data: botMessage }
    })

    const result = await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Call answer',
      messages: [activityMessage, botMessage],
      debugMessages: [activityMessage, botMessage],
    })
  })

  test('should forward activity and operation events to the sink', async () => {
    const activityMessage = { type: 'activity', text: 'Working' }
    const operationBegin = { id: 'op-1', action: { name: 'lookup' } }
    const operationEnd = { id: 'op-1', action: { name: 'lookup' } }

    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_MESSAGE, data: activityMessage }
      yield { type: TAG_OPERATION_BEGIN, data: operationBegin }
      yield { type: TAG_OPERATION_END, data: operationEnd }
      yield { type: TAG_RESULT, data: { text: 'Done' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockSink.push).toHaveBeenCalledTimes(3)
    expect(mockSink.push).toHaveBeenNthCalledWith(
      1,
      TAG_MESSAGE,
      activityMessage
    )
    expect(mockSink.push).toHaveBeenNthCalledWith(
      2,
      TAG_OPERATION_BEGIN,
      operationBegin
    )
    expect(mockSink.push).toHaveBeenNthCalledWith(
      3,
      TAG_OPERATION_END,
      operationEnd
    )
  })

  test('should not forward bot messages to the sink', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_MESSAGE, data: { type: 'bot', text: 'Call answer' } }
    })

    await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(mockSink.push).not.toHaveBeenCalled()
  })

  test('should prefer final result text over accumulated call tokens', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: TAG_TOKEN, data: { token: 'Draft' } }
      yield { type: TAG_RESULT, data: { text: 'Final call answer' } }
    })

    const result = await doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Final call answer',
      messages: [],
      debugMessages: [],
    })
  })

  test('should return token limit error when account limits fail', async () => {
    accountLimitsOk.mockResolvedValue(false)

    await expect(
      doBotCall({
        bot: mockBot,
        input: 'Call this bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).resolves.toEqual({
      error: 'You have reached your token limit.',
    })

    expect(mockConversationComplete).not.toHaveBeenCalled()
  })

  test('should throw when the caller user cannot be found', async () => {
    fastGetUserById.mockResolvedValue(null)

    await expect(
      doBotCall({
        bot: mockBot,
        input: 'Call this bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).rejects.toThrow('User not found')

    expect(mockConversationComplete).not.toHaveBeenCalled()
  })

  test('should propagate non-timeout stream exceptions', async () => {
    mockConversationStream.mockImplementation(async function* () {
      throw new Error('call stream failed')
    })

    await expect(
      doBotCall({
        bot: mockBot,
        input: 'Call this bot',
        params: {},
        options: mockOptions,
        sink: mockSink,
      })
    ).rejects.toThrow('call stream failed')
  })

  test('should abort and return abort when timeout is exceeded', async () => {
    jest.useFakeTimers()

    mockConversationStream.mockImplementation(async function* (callOptions) {
      await new Promise((resolve) => {
        callOptions.abortSignal.addEventListener('abort', resolve, {
          once: true,
        })
      })
    })

    const resultPromise = doBotCall({
      bot: mockBot,
      input: 'Call this bot',
      params: { timeout: 25 },
      options: mockOptions,
      sink: mockSink,
    })

    await jest.advanceTimersByTimeAsync(25)

    await expect(resultPromise).resolves.toEqual({
      result: 'abort',
      messages: [],
      debugMessages: [],
    })

    expect(mockConversationStream).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: expect.any(AbortSignal),
      })
    )

    jest.useRealTimers()
  })
})

describe('doBotApply', () => {
  const mockBot = { id: 'bot-apply-123', name: 'Apply Bot' }

  const mockOptions = {
    userId: 'user-123',
    contextResources: {
      blueprintId: 'bp-123',
      skillsetId: 'ss-123',
      abilityId: 'ab-123',
    },
    linkedResources: {
      botId: 'bot-apply-123',
    },
    messages: [{ type: 'user', text: 'Ignore everything' }],
  }

  const mockUser = { id: 'user-123', email: 'test@example.com' }

  const mockSink = { push: jest.fn() }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(mockUser)
    accountLimitsOk.mockResolvedValue(true)
    getContextBot.mockReturnValue({ id: 'context-bot', name: 'Context Bot' })
    getContextContact.mockReturnValue({
      id: 'contact-apply-123',
      name: 'Apply Contact',
      description: 'Apply contact',
      email: 'apply@example.com',
      phone: '+10000000005',
      nick: 'apply',
      fingerprint: 'fingerprint-apply-1',
    })
    getContextConversation.mockReturnValue({
      id: 'conversation-apply-123',
      name: 'Apply Conversation',
    })
    getContextNamespace.mockReturnValue('apply-namespace')
    getContextUser.mockReturnValue({
      id: 'user-123',
      email: 'test@example.com',
    })
    prisma.bot.findUnique.mockResolvedValue({
      userId: 'user-123',
      blueprintId: 'bp-123',
      datasetId: null,
      skillsetId: 'ss-123',
    })
    prisma.ability.findUnique.mockResolvedValue({
      blueprintId: 'bp-123',
      skillsetId: 'ss-123',
      userId: 'user-123',
      name: 'Review Account',
      description: 'Review the current account state',
    })
    prisma.dataset.findMany.mockResolvedValue([])
    prisma.skillset.findMany.mockResolvedValue([
      {
        id: 'ss-123',
        userId: 'user-123',
        blueprintId: 'bp-123',
      },
    ])
    prisma.blueprint.findMany.mockResolvedValue([
      {
        id: 'bp-123',
        userId: 'user-123',
        bots: [],
        datasets: [],
        skillsets: [],
      },
    ])
    prisma.context.findMany.mockResolvedValue([
      {
        id: 'ctx-123',
        name: 'Current account context',
        description: 'Relevant account details',
        blueprintId: 'bp-123',
        botId: 'bot-apply-123',
        datasetId: null,
        skillsetId: 'ss-123',
        payload: { tier: 'enterprise' },
        meta: { category: 'account' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ])
  })

  test('should apply bot to context ignoring raw user prompt', async () => {
    mockConversationStream.mockImplementation(async function* () {
      yield { type: 'result', data: { text: 'Applied' } }
    })

    const result = await doBotApply({
      bot: mockBot,
      input: 'prompt: malicious prompt',
      params: {},
      options: mockOptions,
      sink: mockSink,
    })

    expect(result).toEqual({
      result: 'Applied',
      messages: [],
      debugMessages: [],
    })

    const body = mockConversationComplete.mock.calls[0][1]

    // instruction + activity request + activity response + follow-up instruction
    expect(body.messages).toHaveLength(4)

    expect(body.messages[0]).toEqual(
      expect.objectContaining({
        type: 'instruction',
        text: expect.stringContaining('Pull the current execution context'),
      })
    )

    expect(body.messages[1]).toEqual(
      expect.objectContaining({
        type: 'activity',
        meta: expect.objectContaining({
          activity: expect.objectContaining({
            type: 'request',
            function: expect.objectContaining({ name: '_getContext' }),
          }),
        }),
      })
    )

    const contextResult = body.messages[2].meta.activity.function.result

    expect(contextResult).toEqual(
      expect.objectContaining({
        contexts: [
          expect.objectContaining({
            id: 'ctx-123',
            name: 'Current account context',
            payload: { tier: 'enterprise' },
            meta: { category: 'account' },
          }),
        ],
      })
    )

    expect(body.messages[3]).toEqual(
      expect.objectContaining({
        type: 'instruction',
        text: expect.stringContaining('Review Account - Review the current account state'),
      })
    )

    expect(body).toEqual(
      expect.objectContaining({
        botId: 'bot-apply-123',
        namespace: 'apply-namespace',
        contactId: expect.objectContaining({
          name: 'Apply Contact',
          description: 'Apply contact',
          email: 'apply@example.com',
          phone: '+10000000005',
          nick: 'apply',
          fingerprint: 'fingerprint-apply-1',
        }),
      })
    )

    expect(body.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'user',
          text: expect.stringContaining('malicious prompt'),
        }),
      ])
    )

    expect(prisma.ability.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'ab-123',
      },
      select: {
        blueprintId: true,
        skillsetId: true,
        userId: true,
        name: true,
        description: true,
      },
    })
    expect(prisma.bot.findUnique).toHaveBeenCalled()
    expect(prisma.context.findMany).toHaveBeenCalled()
  })

})

describe('bot owner session emulation', () => {
  const mockBot = {
    id: 'bot-owner-1',
    name: 'Owner Bot',
    userId: 'owner-user-1',
  }

  const mockOptions = { userId: 'caller-user-1' }
  const mockSink = { push: jest.fn() }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue({
      id: 'caller-user-1',
      email: 'caller@example.com',
    })
    accountLimitsOk.mockResolvedValue(true)
    getContextContact.mockReturnValue(null)
    getContextNamespace.mockReturnValue(null)
    getContextBot.mockReturnValue(null)
    getContextConversation.mockReturnValue(null)
    getContextUser.mockReturnValue(null)

    getSessionForUserId.mockImplementation(async (userId) => ({
      id: `session-for-${userId}`,
      user: { id: userId },
    }))

  })

  for (const [name, fn, extra] of [
    ['doBotAsk', doBotAsk, { input: 'hi', params: {} }],
    ['doBotCall', doBotCall, { input: 'hi', params: {} }],
    ['doBotApply', doBotApply, { input: '', params: {} }],
  ]) {
    describe(name, () => {
      beforeEach(() => {
        // @note doBotApply pulls additional context resources that need to
        // resolve cleanly; default mocks return null which is fine
        prisma.blueprint.findUnique.mockResolvedValue(null)
        prisma.ability.findUnique.mockResolvedValue(null)
      })

      test('resolves the bot owner session from bot.userId', async () => {
        mockConversationStream.mockImplementation(async function* () {
          yield { type: 'result', data: { text: 'ok' } }
        })

        await fn({ bot: mockBot, ...extra, options: mockOptions, sink: mockSink })

        expect(getSessionForUserId).toHaveBeenCalledWith('owner-user-1')
      })

      test('passes the owner session directly to the local client', async () => {
        mockConversationStream.mockImplementation(async function* () {
          yield { type: 'result', data: { text: 'ok' } }
        })

        await fn({ bot: mockBot, ...extra, options: mockOptions, sink: mockSink })

        expect(mockGetLocalSessionClient).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'session-for-owner-user-1',
            user: { id: 'owner-user-1' },
          }),
          expect.any(Function)
        )
      })

      test('uses getSessionForUserId(bot.userId) as the local client session', async () => {
        mockConversationStream.mockImplementation(async function* () {
          yield { type: 'result', data: { text: 'ok' } }
        })

        await fn({ bot: mockBot, ...extra, options: mockOptions, sink: mockSink })

        const sessionArg = mockGetLocalSessionClient.mock.calls[0][0]

        expect(sessionArg).toEqual({
          id: 'session-for-owner-user-1',
          user: { id: 'owner-user-1' },
        })
      })

      test('invokes complete after creating the local client', async () => {
        const callOrder = []

        mockGetLocalSessionClient.mockImplementation(async () => {
          callOrder.push('client:created')

          return {
            conversation: {
              complete: mockConversationComplete,
            },
          }
        })

        mockConversationComplete.mockImplementation(() => {
          callOrder.push('complete:invoked')

          return {
            stream: async function* () {
              yield { type: 'result', data: { text: 'ok' } }
            },
          }
        })

        mockConversationStream.mockImplementation(async function* () {
          yield { type: 'result', data: { text: 'ok' } }
        })

        await fn({ bot: mockBot, ...extra, options: mockOptions, sink: mockSink })

        expect(callOrder).toEqual([
          'client:created',
          'complete:invoked',
        ])
      })
    })
  }
})

describe('launch', () => {
  const mockBot = { id: 'bot-123', name: 'Test Bot' }

  const mockOptions = {
    userId: 'user-123',
    sink: { push: jest.fn() },
  }

  const mockInput = 'Hello bot'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)
  })

  test('should throw error when no bots are selected', async () => {
    const params = {}

    const mockFn = jest.fn()

    await expect(
      launch(mockFn, { input: mockInput, params, options: mockOptions })
    ).rejects.toThrow('No bots where selected for this action')
  })

  test('should throw error when bot is not found', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

    const params = { botId: 'non-existent-bot' }

    const mockFn = jest.fn()

    await expect(
      launch(mockFn, { input: mockInput, params, options: mockOptions })
    ).rejects.toThrow('Bots not found: non-existent-bot')
  })

  test('should call doBotAsk with correct parameters for single bot', async () => {
    const params = { botId: 'bot-123' }

    const mockFn = jest.fn().mockResolvedValue({
      result: 'Bot response',
      messages: [],
      debugMessages: [],
    })

    await launch(mockFn, { input: mockInput, params, options: mockOptions })

    expect(mockFn).toHaveBeenCalledWith({
      bot: mockBot,
      input: mockInput,
      params,
      options: mockOptions,
      sink: expect.any(Object),
    })
  })

  test('should handle multiple bots when botIds is provided', async () => {
    const mockBot2 = { id: 'bot-456', name: 'Second Bot' }

    prisma.bot.findUniqueByIdentifier
      .mockResolvedValueOnce(mockBot)
      .mockResolvedValueOnce(mockBot2)

    const params = { botIds: 'bot-123,bot-456' }

    const mockFn = jest.fn().mockResolvedValue({
      result: 'Bot response',
      messages: [],
      debugMessages: [],
    })

    await launch(mockFn, { input: mockInput, params, options: mockOptions })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledTimes(2)
  })

  test('should merge results when multiple bots are used', async () => {
    const mockBot2 = { id: 'bot-456', name: 'Second Bot' }

    prisma.bot.findUniqueByIdentifier
      .mockResolvedValueOnce(mockBot)
      .mockResolvedValueOnce(mockBot2)

    const params = { botIds: 'bot-123,bot-456' }

    const mockFn = jest
      .fn()
      .mockResolvedValueOnce({
        result: 'Bot 1 response',
        messages: [{ type: 'bot', text: 'Hello from bot 1' }],
        debugMessages: [{ type: 'debug', text: 'Debug 1' }],
      })
      .mockResolvedValueOnce({
        result: 'Bot 2 response',
        messages: [{ type: 'bot', text: 'Hello from bot 2' }],
        debugMessages: [{ type: 'debug', text: 'Debug 2' }],
      })

    const result = await launch(mockFn, {
      input: mockInput,
      params,
      options: mockOptions,
    })

    expect(result).toEqual({
      result: ['Bot 1 response', 'Bot 2 response'],
      messages: [
        { type: 'bot', text: 'Hello from bot 1' },
        { type: 'bot', text: 'Hello from bot 2' },
      ],
      debugMessages: [
        { type: 'debug', text: 'Debug 1' },
        { type: 'debug', text: 'Debug 2' },
      ],
    })
  })

  test('should handle BOT_DEFAULT when provided in botId', async () => {
    const options = {
      userId: 'user-123',
      linkedResources: { botId: 'bot-123' },
      sink: { push: jest.fn() },
    }

    const params = { botId: '${BOT_DEFAULT}' }

    const mockFn = jest.fn().mockResolvedValue({
      result: 'Bot response',
      messages: [],
      debugMessages: [],
    })

    await launch(mockFn, { input: mockInput, params, options })

    expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
      { id: 'user-123' },
      'bot-123'
    )
  })

  test('should propagate sink events to options.sink', async () => {
    const params = { botId: 'bot-123' }

    const sinkEvent = { type: 'activity', data: { name: 'thinking' } }

    const mockFn = jest.fn().mockImplementation(async ({ sink }) => {
      await sink.push('activity', sinkEvent.data)

      return {
        result: 'Bot response',
        messages: [],
        debugMessages: [],
      }
    })

    await launch(mockFn, { input: mockInput, params, options: mockOptions })

    expect(mockOptions.sink.push).toHaveBeenCalledWith(
      'activity',
      sinkEvent.data
    )
  })

  test('should propagate sync events to options.sink in the correct order', async () => {
    const params = { botId: 'bot-123' }

    const syncEvents = [
      { type: 'sync', data: { step: 1 } },
      { type: 'sync', data: { step: 2 } },
    ]

    const mockFn = jest.fn().mockImplementation(async ({ sink }) => {
      for (const event of syncEvents) {
        await sink.push(event.type, event.data)
      }

      return {
        result: 'Bot response',
        messages: [],
        debugMessages: [],
      }
    })

    await launch(mockFn, { input: mockInput, params, options: mockOptions })

    expect(mockOptions.sink.push).toHaveBeenCalledTimes(syncEvents.length)

    syncEvents.forEach((event, index) => {
      expect(mockOptions.sink.push).toHaveBeenNthCalledWith(
        index + 1,
        event.type,
        event.data
      )
    })
  })
})

describe('doBotList', () => {
  const mockOptions = {
    userId: 'user-123',
  }

  const mockCbk = {
    bot: {
      list: jest.fn().mockReturnValue({
        stream: jest.fn(),
      }),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetUserClient.mockResolvedValue(mockCbk)
  })

  test('should return all bots when no take is specified', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1' },
      { id: 'bot-2', name: 'Bot 2' },
      { id: 'bot-3', name: 'Bot 3' },
    ]

    mockCbk.bot.list().stream.mockImplementation(async function* () {
      for (const bot of mockBots) {
        yield { data: bot }
      }
    })

    const result = await doBotList({
      input: '',
      params: {}, // No take parameter
      options: mockOptions,
    })

    expect(result).toEqual({
      result: mockBots,
      messages: [],
    })

    expect(mockGetUserClient).toHaveBeenCalledWith({ id: 'user-123' })
    expect(mockCbk.bot.list().stream).toHaveBeenCalled()
  })

  test('should return limited number of bots when take is specified', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1' },
      { id: 'bot-2', name: 'Bot 2' },
      { id: 'bot-3', name: 'Bot 3' },
      { id: 'bot-4', name: 'Bot 4' },
    ]

    mockCbk.bot.list().stream.mockImplementation(async function* () {
      for (const bot of mockBots) {
        yield { data: bot }
      }
    })

    const result = await doBotList({
      input: '',
      params: { take: 2 },
      options: mockOptions,
    })

    expect(result).toEqual({
      result: mockBots.slice(0, 2),
      messages: [],
    })
  })

  test('should return empty array when no bots exist', async () => {
    mockCbk.bot.list().stream.mockImplementation(async function* () {
      // empty generator
    })

    const result = await doBotList({
      input: '{}', // Empty YAML object - no take specified
      params: {},
      options: mockOptions,
    })

    expect(result).toEqual({
      result: [],
      messages: [],
    })
  })

  test('should handle errors gracefully', async () => {
    const error = new Error('SDK Error')

    mockGetUserClient.mockRejectedValue(error)

    const result = await doBotList({
      input: '{}', // Empty YAML object - no take specified
      params: {},
      options: mockOptions,
    })

    expect(result).toEqual({
      error: 'Failed to list bots: SDK Error',
      result: [],
      messages: [],
    })
  })

  test('should throw error for invalid take parameter', async () => {
    await expect(
      doBotList({
        input: '',
        params: { take: 'invalid' },
        options: mockOptions,
      })
    ).rejects.toThrow('Expected number, received nan')
  })

  test('should parse take from input when provided as YAML', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1' },
      { id: 'bot-2', name: 'Bot 2' },
      { id: 'bot-3', name: 'Bot 3' },
    ]

    mockCbk.bot.list().stream.mockImplementation(async function* () {
      for (const bot of mockBots) {
        yield { data: bot }
      }
    })

    const result = await doBotList({
      input: 'take: 2',
      params: {},
      options: mockOptions,
    })

    expect(result).toEqual({
      result: mockBots.slice(0, 2),
      messages: [],
    })
  })

  test('should coerce string numbers to number type', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1' },
      { id: 'bot-2', name: 'Bot 2' },
      { id: 'bot-3', name: 'Bot 3' },
    ]

    mockCbk.bot.list().stream.mockImplementation(async function* () {
      for (const bot of mockBots) {
        yield { data: bot }
      }
    })

    const result = await doBotList({
      input: '',
      params: { take: '2' }, // Pass string number via params, should be coerced
      options: mockOptions,
    })

    expect(result).toEqual({
      result: mockBots.slice(0, 2),
      messages: [],
    })
  })
})

describe('executeBotAction with list operation', () => {
  const mockOptions = {
    userId: 'user-123',
  }

  const mockCbk = {
    bot: {
      list: jest.fn().mockReturnValue({
        stream: jest.fn(),
      }),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetUserClient.mockResolvedValue(mockCbk)
  })

  test('should execute list operation correctly', async () => {
    const mockBots = [
      { id: 'bot-1', name: 'Bot 1' },
      { id: 'bot-2', name: 'Bot 2' },
    ]

    mockCbk.bot.list().stream.mockImplementation(async function* () {
      for (const bot of mockBots) {
        yield { data: bot }
      }
    })

    const { executeBotAction } = await import('@/lib/action.exec.bot')

    const result = await executeBotAction(
      'take: 1', // input (take as YAML)
      { list: true }, // params
      mockOptions // options
    )

    expect(result).toEqual({
      result: [mockBots[0]], // Should return only 1 bot due to take: 1
      messages: [],
    })
  })
})
