/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './callback'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChainableMock = () => {
    const mock = {
      required: () => mock,
      optional: () => mock,
      allow: () => mock,
      valid: () => mock,
      min: () => mock,
      max: () => mock,
      describe: () => ({ keys: {} }),
    }

    return mock
  }

  const mockSchema = {
    object: (fields) => ({
      ...createChainableMock(),
      describe: () => ({ keys: fields || {} }),
    }),
    string: () => createChainableMock(),
    number: () => createChainableMock(),
    boolean: () => createChainableMock(),
    array: () => createChainableMock(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (schema, fn) => fn,
  }
})

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

jest.mock('@/pages/api/v1/conversation/[conversationId]/queue', () => ({
  sendEvent: jest.fn(),
}))

describe('/api/v1/conversation/[conversationId]/callback', () => {
  const mockSendEvent =
    require('@/pages/api/v1/conversation/[conversationId]/queue').sendEvent

  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockStream = {
    result: jest.fn().mockResolvedValue(undefined),
  }

  const mockReq = {
    query: {
      conversationId: 'conv_abc123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSendEvent.mockResolvedValue(undefined)
    mockStream.result.mockResolvedValue(undefined)
  })

  describe('bodySchema', () => {
    it('should be defined as empty object schema', () => {
      expect(bodySchema).toBeDefined()

      const description = bodySchema.describe()

      expect(description.keys).toEqual({})
    })
  })

  describe('basic functionality', () => {
    it('should handle callback request successfully', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_abc123')

      const body = {}

      await handler(mockReq, mockStream, mockSession, body)

      expect(requiredUrlParam).toHaveBeenCalledWith(mockReq, 'conversationId')
      expect(mockSendEvent).toHaveBeenCalledWith('conv_abc123', {
        type: 'callback',
        payload: {
          body: {},
        },
      })
      expect(mockStream.result).toHaveBeenCalledWith({
        id: 'conv_abc123',
      })
    })

    it('should extract conversationId from request', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_xyz789')

      const body = {}

      await handler(mockReq, mockStream, mockSession, body)

      expect(requiredUrlParam).toHaveBeenCalledWith(mockReq, 'conversationId')
      expect(mockSendEvent).toHaveBeenCalledWith(
        'conv_xyz789',
        expect.any(Object)
      )
      expect(mockStream.result).toHaveBeenCalledWith({
        id: 'conv_xyz789',
      })
    })
  })

  describe('event sending', () => {
    it('should send callback event to queue with correct structure', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_123')

      const body = { custom: 'data' }

      await handler(mockReq, mockStream, mockSession, body)

      expect(mockSendEvent).toHaveBeenCalledWith('conv_123', {
        type: 'callback',
        payload: {
          body: { custom: 'data' },
        },
      })
    })

    it('should send event before streaming result', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_abc')

      const callOrder = []

      mockSendEvent.mockImplementation(() => {
        callOrder.push('sendEvent')

        return Promise.resolve()
      })
      mockStream.result.mockImplementation(() => {
        callOrder.push('result')

        return Promise.resolve()
      })

      await handler(mockReq, mockStream, mockSession, {})

      expect(callOrder).toEqual(['sendEvent', 'result'])
    })

    it('should handle empty body in callback payload', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_empty')

      await handler(mockReq, mockStream, mockSession, {})

      expect(mockSendEvent).toHaveBeenCalledWith('conv_empty', {
        type: 'callback',
        payload: {
          body: {},
        },
      })
    })
  })

  describe('streaming response', () => {
    it('should stream result with conversation id', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_stream123')

      await handler(mockReq, mockStream, mockSession, {})

      expect(mockStream.result).toHaveBeenCalledWith({
        id: 'conv_stream123',
      })
    })

    it('should complete streaming after event is sent', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_complete')

      await handler(mockReq, mockStream, mockSession, {})

      expect(mockSendEvent).toHaveBeenCalled()
      expect(mockStream.result).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle missing conversationId', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockImplementation(() => {
        throw new Error('Missing required parameter: conversationId')
      })

      await expect(
        handler(mockReq, mockStream, mockSession, {})
      ).rejects.toThrow('Missing required parameter: conversationId')
    })

    it('should handle sendEvent failure', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_fail')
      mockSendEvent.mockRejectedValue(new Error('Queue unavailable'))

      await expect(
        handler(mockReq, mockStream, mockSession, {})
      ).rejects.toThrow('Queue unavailable')
    })

    it('should handle stream result failure', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_stream_fail')
      mockStream.result.mockRejectedValue(new Error('Stream error'))

      await expect(
        handler(mockReq, mockStream, mockSession, {})
      ).rejects.toThrow('Stream error')
    })
  })

  describe('edge cases', () => {
    it('should handle conversation IDs with special characters', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')
      const specialId = 'conv_abc-123_xyz'

      requiredUrlParam.mockReturnValue(specialId)

      await handler(mockReq, mockStream, mockSession, {})

      expect(mockSendEvent).toHaveBeenCalledWith(specialId, expect.any(Object))
      expect(mockStream.result).toHaveBeenCalledWith({
        id: specialId,
      })
    })

    it('should handle body with nested data', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_nested')

      const complexBody = {
        level1: {
          level2: {
            data: 'value',
          },
        },
      }

      await handler(mockReq, mockStream, mockSession, complexBody)

      expect(mockSendEvent).toHaveBeenCalledWith('conv_nested', {
        type: 'callback',
        payload: {
          body: complexBody,
        },
      })
    })

    it('should handle body with arrays', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_array')

      const bodyWithArray = {
        items: [1, 2, 3],
      }

      await handler(mockReq, mockStream, mockSession, bodyWithArray)

      expect(mockSendEvent).toHaveBeenCalledWith('conv_array', {
        type: 'callback',
        payload: {
          body: bodyWithArray,
        },
      })
    })
  })

  describe('session handling', () => {
    it('should work with valid session', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_session')

      await handler(mockReq, mockStream, mockSession, {})

      expect(mockSendEvent).toHaveBeenCalled()
      expect(mockStream.result).toHaveBeenCalled()
    })

    it('should accept session with different user id', async () => {
      const { requiredUrlParam } = require('@/lib/query.get')

      requiredUrlParam.mockReturnValue('conv_other_user')

      const otherSession = {
        user: {
          id: 'user_xyz',
        },
      }

      await handler(mockReq, mockStream, otherSession, {})

      expect(mockSendEvent).toHaveBeenCalled()
      expect(mockStream.result).toHaveBeenCalled()
    })
  })
})
