/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { compact } from './compact'

jest.mock('@/lib/scope.server', () => ({}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

const { getStatefulConversationEngine } = require('@/lib/conversation.engine')

describe('/api/v1/conversation/[conversationId]/compact', () => {
  const mockSession = {
    id: 'session_123',
    user: { id: 'user_123' },
  }

  let engine

  beforeEach(() => {
    jest.clearAllMocks()

    engine = {
      definitelyCompact: jest.fn().mockResolvedValue({
        message: { id: 'msg_checkpoint_1', text: 'A summary.' },
        usage: { token: 42 },
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    }

    getStatefulConversationEngine.mockResolvedValue(engine)
  })

  describe('basic functionality', () => {
    it('should create the engine for the conversation', async () => {
      await compact(mockSession, 'conv_789')

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv_789',
          options: expect.objectContaining({
            sessionId: 'session_123',
            userId: 'user_123',
          }),
        })
      )
    })

    it('should return the checkpoint id, text and usage', async () => {
      const result = await compact(mockSession, 'conv_789')

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'msg_checkpoint_1',
        text: 'A summary.',
        usage: { token: 42 },
      })
    })

    it('should return the conversation id and empty text when nothing to compact', async () => {
      engine.definitelyCompact.mockResolvedValue({
        message: null,
        usage: { token: 0 },
      })

      const result = await compact(mockSession, 'conv_789')

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({
        id: 'conv_789',
        text: '',
        usage: { token: 0 },
      })
    })

    it('should always dispose the engine', async () => {
      await compact(mockSession, 'conv_789')

      expect(engine.dispose).toHaveBeenCalledTimes(1)
    })

    it('should dispose the engine even when compaction throws', async () => {
      engine.definitelyCompact.mockRejectedValue(new Error('boom'))

      await expect(compact(mockSession, 'conv_789')).rejects.toThrow('boom')

      expect(engine.dispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('authorization', () => {
    it('should propagate not found / not authorized errors from the engine', async () => {
      getStatefulConversationEngine.mockRejectedValue(
        new Error('Conversation not found')
      )

      await expect(compact(mockSession, 'nonexistent_conv')).rejects.toThrow(
        'Conversation not found'
      )
    })
  })

  describe('handler routing', () => {
    it('should extract conversationId from URL params and create the engine', async () => {
      const req = { query: { conversationId: 'conv_789' } }

      await handler(req, mockSession)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv_789' })
      )
    })
  })
})
