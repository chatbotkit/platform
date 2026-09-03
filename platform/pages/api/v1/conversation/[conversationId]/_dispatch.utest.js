/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './dispatch'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'generated-channel-id-0000000000'),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/pages/api/v1/conversation/[conversationId]/queue', () => ({
  COMPLETE_EVENT_TYPE: 'complete',
  sendEvent: jest.fn(),
}))

// mock complete to provide bodySchema
jest.mock('@/pages/api/v1/conversation/[conversationId]/complete', () => ({
  bodySchema: jest.requireActual('@/lib/joi.handler').schema.object({
    text: jest.requireActual('@/lib/joi.handler').schema.string(),
  }),
}))

describe('POST /api/v1/conversation/{conversationId}/dispatch', () => {
  const {
    COMPLETE_EVENT_TYPE,
    sendEvent,
  } = require('@/pages/api/v1/conversation/[conversationId]/queue')

  const mockSession = {
    user: { id: 'user_abc123' },
    valueOf() {
      return { userId: this.user.id }
    },
  }

  const mockReq = { query: { conversationId: 'conv_xyz789' } }

  beforeEach(() => {
    jest.clearAllMocks()
    sendEvent.mockResolvedValue(undefined)
  })

  describe('channelId generation', () => {
    it('should use provided channelId when supplied', async () => {
      const body = {
        channelId: 'client-provided-channel-id-0000000',
        text: 'hello',
      }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.channelId).toBe('client-provided-channel-id-0000000')

      expect(sendEvent).toHaveBeenCalledWith(
        'conv_xyz789',
        expect.objectContaining({
          type: COMPLETE_EVENT_TYPE,
          payload: expect.objectContaining({
            channelId: 'client-provided-channel-id-0000000',
          }),
        })
      )
    })

    it('should generate a channelId when not provided', async () => {
      const body = { text: 'hello' }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.channelId).toBe('generated-channel-id-0000000000')

      expect(sendEvent).toHaveBeenCalledWith(
        'conv_xyz789',
        expect.objectContaining({
          type: COMPLETE_EVENT_TYPE,
          payload: expect.objectContaining({
            channelId: 'generated-channel-id-0000000000',
          }),
        })
      )
    })
  })

  describe('sendEvent call', () => {
    it('should pass conversationId as first argument', async () => {
      const body = { text: 'hello' }
      const req = { query: { conversationId: 'conv_specific123' } }

      await handler(req, mockSession, body)

      expect(sendEvent).toHaveBeenCalledWith(
        'conv_specific123',
        expect.any(Object)
      )
    })

    it('should queue the complete event with correct params', async () => {
      const body = { text: 'hello world' }

      await handler(mockReq, mockSession, body)

      expect(sendEvent).toHaveBeenCalledTimes(1)
      expect(sendEvent).toHaveBeenCalledWith(
        'conv_xyz789',
        expect.objectContaining({
          type: COMPLETE_EVENT_TYPE,
          payload: expect.objectContaining({
            session: mockSession.valueOf(),
            body,
            historyLength: 1000,
            historyExpireSeconds: 3600,
          }),
        })
      )
    })

    it('should set historyLength=1000 and historyExpireSeconds=3600 (1h)', async () => {
      const body = { text: 'hello' }

      await handler(mockReq, mockSession, body)

      const callArgs = sendEvent.mock.calls[0][1].payload

      expect(callArgs.historyLength).toBe(1000)
      expect(callArgs.historyExpireSeconds).toBe(60 * 60)
    })
  })

  describe('response', () => {
    it('should return 200 with the channelId', async () => {
      const body = { channelId: 'my-channel-id-000000000000000', text: 'hi' }

      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        channelId: 'my-channel-id-000000000000000',
      })
    })
  })
})
