import {
  getContextAppConfig,
  getContextAppSession,
  getSafeStore,
  getStore,
  runInAppContext,
} from './app.context'
import { getUserAppConfig } from './app.router.app.config'
import { getSoftAppSession } from './app.session'

// Mock external dependencies
jest.mock('./app.router.app.config', () => ({
  getUserAppConfig: jest.fn(),
}))

jest.mock('./app.session', () => ({
  getSoftAppSession: jest.fn(),
}))

describe('app.context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('runInAppContext', () => {
    it('should run function in new context when no context exists', async () => {
      const testFn = jest.fn(async (arg) => `result: ${arg}`)
      const wrapped = runInAppContext(testFn)

      const result = await wrapped('test')

      expect(result).toBe('result: test')
      expect(testFn).toHaveBeenCalledWith('test')
    })

    it('should reuse existing context when already in context', async () => {
      const testFn = jest.fn(async () => 'inner result')
      const wrapped = runInAppContext(testFn)

      // Run outer function that creates context
      const outerFn = runInAppContext(async () => {
        // Run inner function that should reuse context
        return await wrapped()
      })

      const result = await outerFn()

      expect(result).toBe('inner result')
      expect(testFn).toHaveBeenCalled()
    })

    it('should handle multiple arguments', async () => {
      const testFn = jest.fn(async (a, b, c) => a + b + c)
      const wrapped = runInAppContext(testFn)

      const result = await wrapped(1, 2, 3)

      expect(result).toBe(6)
      expect(testFn).toHaveBeenCalledWith(1, 2, 3)
    })

    it('should handle async errors', async () => {
      const error = new Error('Test error')
      const testFn = jest.fn(async () => {
        throw error
      })
      const wrapped = runInAppContext(testFn)

      await expect(wrapped()).rejects.toThrow('Test error')
    })

    it('should return the same wrapped function', () => {
      const testFn = async () => 'result'
      const wrapped = runInAppContext(testFn)

      expect(typeof wrapped).toBe('function')
      expect(wrapped).not.toBe(testFn)
    })
  })

  describe('getStore', () => {
    it('should throw error when called outside context', () => {
      expect(() => getStore()).toThrow('Store not found')
    })

    it('should return store when called inside context', async () => {
      const testFn = runInAppContext(async () => {
        const store = getStore()

        return store
      })

      const result = await testFn()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('meta')
      expect(typeof result.meta).toBe('object')
    })

    it('should initialize meta object if not present', async () => {
      const testFn = runInAppContext(async () => {
        const store = getStore()

        return store
      })

      const result = await testFn()

      expect(result.meta).toBeDefined()
      expect(typeof result.meta).toBe('object')
    })

    it('should preserve existing meta object', async () => {
      const testFn = runInAppContext(async () => {
        const store = getStore()

        store.meta.testKey = 'testValue'

        const store2 = getStore()

        return store2.meta
      })

      const result = await testFn()

      expect(result.testKey).toBe('testValue')
    })
  })

  describe('getSafeStore', () => {
    it('should return default store when called outside context', () => {
      const store = getSafeStore()

      expect(store).toBeDefined()
      expect(store).toHaveProperty('meta')
      expect(typeof store.meta).toBe('object')
    })

    it('should return actual store when called inside context', async () => {
      const testFn = runInAppContext(async () => {
        const store = getSafeStore()

        store.meta.testKey = 'testValue'

        return store
      })

      const result = await testFn()

      expect(result).toBeDefined()
      expect(result.meta.testKey).toBe('testValue')
    })

    it('should not throw error outside context', () => {
      expect(() => getSafeStore()).not.toThrow()
    })
  })

  describe('getContextAppConfig', () => {
    it('should fetch and cache config on first call', async () => {
      const mockConfig = { setting1: 'value1', setting2: 'value2' }

      getUserAppConfig.mockResolvedValue(mockConfig)

      const testFn = runInAppContext(async () => {
        const config = await getContextAppConfig('test-app')

        return config
      })

      const result = await testFn()

      expect(result).toEqual(mockConfig)
      expect(getUserAppConfig).toHaveBeenCalledWith('test-app')
      expect(getUserAppConfig).toHaveBeenCalledTimes(1)
    })

    it('should return cached config on subsequent calls', async () => {
      const mockConfig = { setting1: 'value1' }

      getUserAppConfig.mockResolvedValue(mockConfig)

      const testFn = runInAppContext(async () => {
        const config1 = await getContextAppConfig('test-app')
        const config2 = await getContextAppConfig('test-app')

        return { config1, config2 }
      })

      const result = await testFn()

      expect(result.config1).toEqual(mockConfig)
      expect(result.config2).toEqual(mockConfig)
      expect(getUserAppConfig).toHaveBeenCalledTimes(1)
    })

    it('should handle null config', async () => {
      getUserAppConfig.mockResolvedValue(null)

      const testFn = runInAppContext(async () => {
        return await getContextAppConfig('test-app')
      })

      const result = await testFn()

      expect(result).toBeNull()
    })

    it('should throw error when called outside context', async () => {
      await expect(getContextAppConfig('test-app')).rejects.toThrow(
        'Store not found'
      )
    })

    it('should cache different configs for different apps', async () => {
      getUserAppConfig.mockImplementation(async (app) => ({ app }))

      const testFn = runInAppContext(async () => {
        const config1 = await getContextAppConfig('app1')

        return config1
      })

      const result = await testFn()

      expect(result).toEqual({ app: 'app1' })
      expect(getUserAppConfig).toHaveBeenCalledWith('app1')
    })
  })

  describe('getContextAppSession', () => {
    it('should fetch and cache session on first call', async () => {
      const mockSession = { user: { id: '123', name: 'Test User' } }

      getSoftAppSession.mockResolvedValue(mockSession)

      const testFn = runInAppContext(async () => {
        const session = await getContextAppSession('test-app')

        return session
      })

      const result = await testFn()

      expect(result).toEqual(mockSession)
      expect(getSoftAppSession).toHaveBeenCalledWith('test-app', undefined)
      expect(getSoftAppSession).toHaveBeenCalledTimes(1)
    })

    it('should return cached session on subsequent calls', async () => {
      const mockSession = { user: { id: '123' } }

      getSoftAppSession.mockResolvedValue(mockSession)

      const testFn = runInAppContext(async () => {
        const session1 = await getContextAppSession('test-app')
        const session2 = await getContextAppSession('test-app')

        return { session1, session2 }
      })

      const result = await testFn()

      expect(result.session1).toEqual(mockSession)
      expect(result.session2).toEqual(mockSession)
      expect(getSoftAppSession).toHaveBeenCalledTimes(1)
    })

    it('should pass request object to getSoftAppSession', async () => {
      const mockSession = { user: { id: '123' } }
      const mockRequest = new Request('http://localhost/test')

      getSoftAppSession.mockResolvedValue(mockSession)

      const testFn = runInAppContext(async () => {
        return await getContextAppSession('test-app', mockRequest)
      })

      await testFn()

      expect(getSoftAppSession).toHaveBeenCalledWith('test-app', mockRequest)
    })

    it('should handle null session', async () => {
      getSoftAppSession.mockResolvedValue(null)

      const testFn = runInAppContext(async () => {
        return await getContextAppSession('test-app')
      })

      const result = await testFn()

      expect(result).toBeNull()
    })

    it('should throw error when called outside context', async () => {
      await expect(getContextAppSession('test-app')).rejects.toThrow(
        'Store not found'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle nested runInAppContext calls', async () => {
      const outerFn = runInAppContext(async () => {
        const store1 = getStore()

        store1.meta.outer = 'outer-value'

        const innerFn = runInAppContext(async () => {
          const store2 = getStore()

          return store2.meta.outer
        })

        return await innerFn()
      })

      const result = await outerFn()

      expect(result).toBe('outer-value')
    })

    it('should maintain separate contexts for parallel executions', async () => {
      const fn1 = runInAppContext(async () => {
        const store = getStore()

        store.meta.value = 'context1'
        await new Promise((resolve) => setTimeout(resolve, 10))

        return store.meta.value
      })

      const fn2 = runInAppContext(async () => {
        const store = getStore()

        store.meta.value = 'context2'
        await new Promise((resolve) => setTimeout(resolve, 10))

        return store.meta.value
      })

      const [result1, result2] = await Promise.all([fn1(), fn2()])

      expect(result1).toBe('context1')
      expect(result2).toBe('context2')
    })

    it('should handle store with all properties undefined', async () => {
      const testFn = runInAppContext(async () => {
        const store = getStore()

        expect(store.config).toBeUndefined()
        expect(store.session).toBeUndefined()
        expect(store.meta).toBeDefined()

        return true
      })

      const result = await testFn()

      expect(result).toBe(true)
    })
  })
})
