/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { apply } from '@/pages/api/v1/conversation/apply'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatelessConversationEngine: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/namespace.safe', () => ({
  getSafeNamespace: jest.fn((user, ns) => ns),
}))

jest.mock('@/lib/namespace.attachment', () => ({
  uploadNamespaceAttachmentFromURL: jest.fn(),
  makeNamespaceAttachmentUploadActivityMessages: jest.fn(() => []),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(() => 10 * 1024 * 1024),
}))

jest.mock('@/lib/stream', () => ({
  withStreamContinuity: (fn) => fn,
}))

jest.mock('@/schemas/contactId', () => () => {
  const schema = jest.requireActual('@/lib/joi.schema').default

  return schema
    .alternatives()
    .try(schema.string().allow(null, ''), schema.object())
})

jest.mock('@/schemas/messages', () => {
  const schema = jest.requireActual('@/lib/joi.schema').default

  return { __esModule: true, default: schema.array() }
})

async function collectEvents(session, body, options = {}) {
  const result = []

  for await (const event of apply(session, body, options)) {
    result.push(event)
  }

  return result
}

describe('apply', () => {
  const {
    getStatelessConversationEngine,
  } = require('@/lib/conversation.engine')

  const mockSession = {
    id: 'session-123',
    user: { id: 'user-123' },
    options: {},
  }

  const baseBody = {
    name: 'tool.apply',
    input: {
      value: 123,
    },
    messages: [{ type: 'user', text: 'hello' }],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates to engine.apply with the requested function name and object input', async () => {
    const engine = {
      apply: jest.fn().mockResolvedValue({
        result: { ok: true },
        messages: [{ type: 'context', text: 'Applied' }],
        usage: {
          token: 7,
        },
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    getStatelessConversationEngine.mockResolvedValue(engine)

    const events = await collectEvents(mockSession, baseBody, {
      abortSignal: 'signal',
    })

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
          messages: [{ type: 'context', text: 'Applied' }],
          usage: {
            token: 7,
          },
        },
      }),
    ])
  })
})
