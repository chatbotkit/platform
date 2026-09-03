/* eslint-disable @typescript-eslint/no-require-imports */
import { apply } from '@/pages/api/v1/conversation/[conversationId]/apply'

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

async function collectEvents(session, conversationId, body, options = {}) {
  const result = []

  for await (const event of apply(session, conversationId, body, options)) {
    result.push(event)
  }

  return result
}

describe('apply', () => {
  const { getStatefulConversationEngine } = require('@/lib/conversation.engine')

  const mockSession = {
    id: 'session-123',
    user: { id: 'user-123' },
    options: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates to stateful engine.apply with the requested function name and object input', async () => {
    const engine = {
      apply: jest.fn().mockResolvedValue({
        result: { ok: true },
        usage: { token: 11 },
        messages: [{ type: 'context', text: 'Applied' }],
        meta: { source: 'stateful-test' },
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    getStatefulConversationEngine.mockResolvedValue(engine)

    const events = await collectEvents(
      mockSession,
      'conv-123',
      {
        name: 'tool.apply',
        input: {
          value: 123,
        },
      },
      {
        abortSignal: 'signal',
      }
    )

    expect(engine.apply).toHaveBeenCalledWith({
      name: 'tool.apply',
      input: {
        value: 123,
      },
      signal: 'signal',
    })
    expect(engine.dispose).toHaveBeenCalledTimes(1)

    expect(events).toEqual([
      expect.objectContaining({
        type: 'result',
        data: {
          result: { ok: true },
          usage: { token: 11 },
          messages: [{ type: 'context', text: 'Applied' }],
          meta: { source: 'stateful-test' },
        },
      }),
    ])
  })
})
