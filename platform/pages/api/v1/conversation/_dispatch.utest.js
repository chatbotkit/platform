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

jest.mock('@/pages/api/v1/conversation/queue', () => ({
  COMPLETE_EVENT_TYPE: 'complete',
  sendEvent: jest.fn(),
}))

// mock complete to provide bodySchema
jest.mock('@/pages/api/v1/conversation/complete', () => ({
  bodySchema: jest.requireActual('@/lib/joi.handler').schema.object({
    messages: jest.requireActual('@/lib/joi.handler').schema.array(),
  }),
}))

describe('POST /api/v1/conversation/dispatch', () => {
  const {
    COMPLETE_EVENT_TYPE,
    sendEvent,
  } = require('@/pages/api/v1/conversation/queue')

  const mockSession = {
    user: { id: 'user_abc123' },
    valueOf() {
      return { userId: this.user.id }
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    sendEvent.mockResolvedValue(undefined)
  })

  describe('channelId generation', () => {
    it('should use provided channelId when supplied', async () => {
      const body = {
        channelId: 'client-provided-channel-id-0000000',
        messages: [],
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.channelId).toBe('client-provided-channel-id-0000000')

      expect(sendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: COMPLETE_EVENT_TYPE,
          payload: expect.objectContaining({
            channelId: 'client-provided-channel-id-0000000',
          }),
        })
      )
    })

    it('should generate a channelId when not supplied', async () => {
      const body = { messages: [] }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.channelId).toBe('generated-channel-id-0000000000')

      expect(sendEvent).toHaveBeenCalledWith(
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
    it('should queue the complete event with correct params', async () => {
      const body = { messages: [{ type: 'user', text: 'hello' }] }

      await handler({}, mockSession, body)

      expect(sendEvent).toHaveBeenCalledTimes(1)
      expect(sendEvent).toHaveBeenCalledWith(
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
      const body = { messages: [] }

      await handler({}, mockSession, body)

      const callArgs = sendEvent.mock.calls[0][0].payload

      expect(callArgs.historyLength).toBe(1000)
      expect(callArgs.historyExpireSeconds).toBe(60 * 60)
    })
  })

  describe('response', () => {
    it('should return 200 with the channelId', async () => {
      const body = { channelId: 'my-channel-id-000000000000000', messages: [] }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        channelId: 'my-channel-id-000000000000000',
      })
    })
  })
})
