/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { compact } from './compact'

jest.mock('@/lib/scope.server', () => ({}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatelessConversationEngine: jest.fn(),
}))

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/context.store', () => ({
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/namespace.safe', () => ({
  getSafeNamespace: jest.fn((_user, namespace) => namespace),
}))

const { getStatelessConversationEngine } = require('@/lib/conversation.engine')
const { isTrustedSession } = require('@/lib/audience.helpers')
const { setContextNamespace } = require('@/lib/context.store')

describe('/api/v1/conversation/compact', () => {
  const mockSession = {
    id: 'session_123',
    user: { id: 'user_123' },
  }

  let engine

  beforeEach(() => {
    jest.clearAllMocks()

    engine = {
      definitelyCompact: jest.fn().mockResolvedValue({
        message: { id: 'msg_1', type: 'checkpoint', text: 'A summary.' },
        usage: { token: 42 },
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    getStatelessConversationEngine.mockResolvedValue(engine)
  })

  it('returns the checkpoint text and usage', async () => {
    const result = await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
    })

    expect(result).toEqual({ text: 'A summary.', usage: { token: 42 } })
    expect(engine.definitelyCompact).toHaveBeenCalledTimes(1)
  })

  it('returns empty text when there is nothing to compact', async () => {
    engine.definitelyCompact.mockResolvedValue({
      message: null,
      usage: { token: 0 },
    })

    const result = await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
    })

    expect(result).toEqual({ text: '', usage: { token: 0 } })
  })

  it('passes the bot configuration and messages to the engine', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there!' },
    ]

    await compact(mockSession, {
      botId: 'bot_abc',
      backstory: 'You are helpful',
      model: 'gpt-test',
      datasetId: 'dataset_1',
      skillsetId: 'skillset_1',
      privacy: true,
      moderation: true,
      messages,
    })

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bot_abc',
        backstory: 'You are helpful',
        model: 'gpt-test',
        datasetId: 'dataset_1',
        skillsetId: 'skillset_1',
        privacy: true,
        moderation: true,
        messages,
        options: expect.objectContaining({
          sessionId: 'session_123',
          userId: 'user_123',
        }),
      })
    )
  })

  it('always disposes the engine', async () => {
    await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
    })

    expect(engine.dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes the engine even when compaction throws', async () => {
    engine.definitelyCompact.mockRejectedValue(new Error('boom'))

    await expect(
      compact(mockSession, { messages: [{ type: 'user', text: 'Hello' }] })
    ).rejects.toThrow('boom')

    expect(engine.dispose).toHaveBeenCalledTimes(1)
  })

  it('resolves and sets the namespace when provided', async () => {
    await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
      namespace: 'ns_1',
    })

    expect(setContextNamespace).toHaveBeenCalledWith('ns_1')
  })

  it('does not apply inline extensions for untrusted sessions', async () => {
    isTrustedSession.mockReturnValue(false)

    await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
      extensions: {
        datasets: [{ name: 'd', description: 'x', records: [{ text: 't' }] }],
      },
    })

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          inlineDatasets: undefined,
        }),
      })
    )
  })

  it('applies inline extensions for trusted sessions', async () => {
    isTrustedSession.mockReturnValue(true)

    const datasets = [{ name: 'd', description: 'x', records: [{ text: 't' }] }]

    await compact(mockSession, {
      messages: [{ type: 'user', text: 'Hello' }],
      extensions: { datasets },
    })

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          inlineDatasets: datasets,
        }),
      })
    )
  })
})
