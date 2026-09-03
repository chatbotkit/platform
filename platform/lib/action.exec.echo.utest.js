import { executeEchoAction } from '@/lib/action.exec.echo'
import { logEvent } from '@/lib/log'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}))

describe('executeEchoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return configured result when present in the echo action config', async () => {
      const input = 'result: configured output'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: 'configured output',
      })
    })

    it('should return the input as result', async () => {
      const input = 'Hello, world!'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
    })

    it('should handle empty string input', async () => {
      const input = ''
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: '',
      })
    })

    it('should handle complex object input', async () => {
      const input = { message: 'test', data: [1, 2, 3] }
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
    })

    it('should handle null input', async () => {
      const input = null
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: null,
      })
    })

    it('should handle undefined input', async () => {
      const input = undefined
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: undefined,
      })
    })

    it('should handle numeric input', async () => {
      const input = 42
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: 42,
      })
    })

    it('should handle boolean input', async () => {
      const input = true
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: true,
      })
    })

    it('should handle array input', async () => {
      const input = ['item1', 'item2', 'item3']
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
    })
  })

  describe('event logging', () => {
    it('should call logEvent with correct parameters', async () => {
      const input = 'test input'
      const params = { testParam: 'value' }

      const options = {
        userId: 'user-123',
        linkedResources: {},
        contextResources: {
          blueprintId: 'blueprint-456',
          skillsetId: 'skillset-789',
          abilityId: 'ability-012',
        },
      }

      await executeEchoAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: options.userId },
        type: 'action.echo',
        relations: {
          blueprintId: options.contextResources.blueprintId,
          skillsetId: options.contextResources.skillsetId,
          abilityId: options.contextResources.abilityId,
        },
        meta: {
          params,
        },
      })
    })

    it('should handle missing linkedResources gracefully', async () => {
      const input = 'test input'
      const params = { testParam: 'value' }
      const options = { userId: 'user-123' }

      await executeEchoAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: options.userId },
        type: 'action.echo',
        relations: {
          blueprintId: undefined,
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: {
          params,
        },
      })
    })

    it('should handle partial linkedResources', async () => {
      const input = 'test input'
      const params = { testParam: 'value' }

      const options = {
        userId: 'user-123',
        linkedResources: {},
        contextResources: {
          blueprintId: 'blueprint-456',
          // missing skillsetId and abilityId
        },
      }

      await executeEchoAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: options.userId },
        type: 'action.echo',
        relations: {
          blueprintId: 'blueprint-456',
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: {
          params,
        },
      })
    })

    it('should pass empty params when no params provided', async () => {
      const input = 'test input'
      const params = {}
      const options = { userId: 'user-123' }

      await executeEchoAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: options.userId },
        type: 'action.echo',
        relations: {
          blueprintId: undefined,
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: {
          params: {},
        },
      })
    })
  })

  describe('integration behavior', () => {
    it('should execute all operations and return correct result', async () => {
      const input = 'Complete test'
      const params = { mode: 'integration' }

      const options = {
        userId: 'user-456',
        linkedResources: {},
        contextResources: {
          blueprintId: 'bp-123',
          skillsetId: 'ss-456',
          abilityId: 'ab-789',
        },
      }

      const result = await executeEchoAction(input, params, options)

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-456' },
        type: 'action.echo',
        relations: {
          blueprintId: 'bp-123',
          skillsetId: 'ss-456',
          abilityId: 'ab-789',
        },
        meta: {
          params,
        },
      })

      expect(result).toEqual({
        result: input,
      })

      expect(logEvent).toHaveBeenCalledTimes(1)
    })

    it('should handle async operations correctly', async () => {
      const input = 'Async test'
      const params = {}
      const options = { userId: 'user-789' }

      logEvent.mockResolvedValueOnce(undefined)

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })

      expect(logEvent).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle very large string input', async () => {
      const input = 'a'.repeat(10000) // 10KB string
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
      expect(result.result).toHaveLength(10000)
    })

    it('should handle deeply nested object input', async () => {
      const input = {
        level1: {
          level2: {
            level3: {
              data: 'deep value',
              array: [1, 2, { nested: true }],
            },
          },
        },
      }

      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
      expect(result.result.level1.level2.level3.data).toBe('deep value')
    })

    it('should handle special characters in string input', async () => {
      const input = '特殊字符 🚀 \n\t\r"\'\\&<>'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
    })

    it('should handle function input', async () => {
      const input = () => 'test function'
      const params = {}
      const options = { userId: 'user-123' }

      const result = await executeEchoAction(input, params, options)

      expect(result).toEqual({
        result: input,
      })
      expect(typeof result.result).toBe('function')
    })
  })
})
