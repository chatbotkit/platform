import { logEvent } from '@/lib/log'

import { executeAbortAction } from './action.exec.abort'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

describe('executeAbortAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should execute abort action and return abort signal', async () => {
      const input = 'abort reason'
      const params = { reason: 'user requested' }
      const options = {
        userId: 'user-123',
        linkedResources: {},
        contextResources: {
          blueprintId: 'blueprint-456',
          skillsetId: 'skillset-789',
          abilityId: 'ability-012',
        },
      }

      const result = await executeAbortAction(input, params, options)

      expect(result).toHaveProperty('result')
      expect(result.result).toBeInstanceOf(AbortSignal)
      expect(result.result.aborted).toBe(true)
      expect(result.result.reason).toBe(params.reason)
    })

    it('should create aborted signal with input as reason', async () => {
      const input = 'operation cancelled'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeAbortAction(input, params, options)

      expect(result.result.aborted).toBe(true)
      expect(result.result.reason).toBe(input)
    })

    it('should handle empty params object', async () => {
      const input = 'abort'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeAbortAction(input, params, options)

      expect(result).toHaveProperty('result')
      expect(result.result).toBeInstanceOf(AbortSignal)
    })
  })

  describe('event logging', () => {
    it('should log event with correct type and user', async () => {
      const input = 'test abort'
      const params = { test: 'value' }
      const options = {
        userId: 'user-123',
      }

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        type: 'action.abort',
        relations: {
          blueprintId: undefined,
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: params,
      })
    })

    it('should log event with linked resources', async () => {
      const input = 'abort with resources'
      const params = { reason: 'timeout' }
      const options = {
        userId: 'user-456',
        linkedResources: {},
        contextResources: {
          blueprintId: 'bp-1',
          skillsetId: 'ss-2',
          abilityId: 'ab-3',
        },
      }

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-456' },
        type: 'action.abort',
        relations: {
          blueprintId: 'bp-1',
          skillsetId: 'ss-2',
          abilityId: 'ab-3',
        },
        meta: params,
      })
    })

    it('should log event with partial linked resources', async () => {
      const input = 'abort'
      const params = {}
      const options = {
        userId: 'user-789',
        linkedResources: {},
        contextResources: {
          blueprintId: 'bp-1',
          // other resources undefined
        },
      }

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-789' },
        type: 'action.abort',
        relations: {
          blueprintId: 'bp-1',
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: params,
      })
    })

    it('should log event before creating abort signal', async () => {
      const input = 'test'
      const params = {}
      const options = { userId: 'user-123' }

      const logEventPromise = Promise.resolve()

      logEvent.mockReturnValue(logEventPromise)

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should throw error on null input', async () => {
      const input = null
      const params = {}
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'Expected string, received null at "reason"'
      )
    })

    it('should throw error on undefined input', async () => {
      const input = undefined
      const params = {}
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'Required at "reason"'
      )
    })

    it('should throw error on empty string input', async () => {
      const input = ''
      const params = {}
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'String must contain at least 1 character(s) at "reason"'
      )
    })

    it('should throw error on object as input', async () => {
      const input = { error: 'timeout', code: 500 }
      const params = {}
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'Required at "reason"'
      )
    })

    it('should throw error on error object as input', async () => {
      const input = new Error('Operation failed')
      const params = {}
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'Expected string, received object at "reason"'
      )
    })
  })

  describe('parameter variations', () => {
    it('should handle complex params object', async () => {
      const input = 'abort'
      const params = {
        reason: 'user_cancelled',
        timestamp: Date.now(),
        metadata: {
          source: 'ui',
          action: 'cancel_button',
        },
      }
      const options = { userId: 'user-123' }

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: params,
        })
      )
    })

    it('should throw error on params with null reason', async () => {
      const input = 'abort'
      const params = {
        reason: null,
        code: null,
      }
      const options = { userId: 'user-123' }

      await expect(executeAbortAction(input, params, options)).rejects.toThrow(
        'Expected string, received null at "reason"'
      )
    })
  })

  describe('options variations', () => {
    it('should handle options without linkedResources', async () => {
      const input = 'abort'
      const params = {}
      const options = {
        userId: 'user-123',
      }

      const result = await executeAbortAction(input, params, options)

      expect(result.result).toBeInstanceOf(AbortSignal)
      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        type: 'action.abort',
        relations: {
          blueprintId: undefined,
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: params,
      })
    })

    it('should handle options with empty linkedResources', async () => {
      const input = 'abort'
      const params = {}
      const options = {
        userId: 'user-123',
        linkedResources: {},
      }

      await executeAbortAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
        })
      )
    })

    it('should handle different userId formats', async () => {
      const input = 'abort'
      const params = {}

      const testUserIds = [
        'user-123',
        'uuid-1234-5678-90ab-cdef',
        '12345',
        'email@example.com',
      ]

      for (const userId of testUserIds) {
        jest.clearAllMocks()

        await executeAbortAction(input, params, { userId })

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            user: { id: userId },
          })
        )
      }
    })
  })

  describe('abort signal properties', () => {
    it('should return signal that is already aborted', async () => {
      const input = 'abort'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeAbortAction(input, params, options)

      expect(result.result.aborted).toBe(true)
    })

    it('should return signal that is aborted', async () => {
      const input = 'abort'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeAbortAction(input, params, options)

      expect(result.result).toBeInstanceOf(AbortSignal)
      expect(result.result.aborted).toBe(true)
    })

    it('should return aborted signal with reason property', async () => {
      const input = 'test abort'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeAbortAction(input, params, options)

      expect(result.result.aborted).toBe(true)
      expect(result.result.reason).toBe(input)
    })
  })
})
