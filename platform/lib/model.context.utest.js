import {
  getModelStore,
  getSafeModelStore,
  runInModelContext,
  wrapInModelContext,
} from './model.context'

describe('model.context', () => {
  describe('wrapInModelContext', () => {
    it('should wrap a function and execute it in model context', async () => {
      const mockFn = jest.fn(async (arg1, arg2) => arg1 + arg2)
      const wrappedFn = wrapInModelContext(mockFn)

      const result = await wrappedFn(5, 10)

      expect(result).toBe(15)
      expect(mockFn).toHaveBeenCalledWith(5, 10)
    })

    it('should provide model store to wrapped function', async () => {
      let capturedStore

      const mockFn = jest.fn(async () => {
        capturedStore = getSafeModelStore()

        return 'success'
      })

      const wrappedFn = wrapInModelContext(mockFn)
      const result = await wrappedFn()

      expect(result).toBe('success')
      expect(capturedStore).toBeDefined()
      expect(typeof capturedStore).toBe('object')
    })

    it('should handle async functions correctly', async () => {
      const mockFn = jest.fn(
        async (delay) =>
          new Promise((resolve) => setTimeout(() => resolve('done'), delay))
      )

      const wrappedFn = wrapInModelContext(mockFn)
      const result = await wrappedFn(10)

      expect(result).toBe('done')
      expect(mockFn).toHaveBeenCalledWith(10)
    })

    it('should preserve function arguments', async () => {
      const mockFn = jest.fn(async (a, b, c, d) => ({ a, b, c, d }))
      const wrappedFn = wrapInModelContext(mockFn)

      const result = await wrappedFn('arg1', 'arg2', 'arg3', 'arg4')

      expect(result).toEqual({
        a: 'arg1',
        b: 'arg2',
        c: 'arg3',
        d: 'arg4',
      })
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', 'arg4')
    })

    it('should handle errors thrown by wrapped function', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Test error')
      })

      const wrappedFn = wrapInModelContext(mockFn)

      await expect(wrappedFn()).rejects.toThrow('Test error')
      expect(mockFn).toHaveBeenCalled()
    })

    it('should return a new wrapped function on each call', () => {
      const mockFn = jest.fn(async () => 'result')

      const wrapped1 = wrapInModelContext(mockFn)
      const wrapped2 = wrapInModelContext(mockFn)

      expect(wrapped1).not.toBe(wrapped2)
      expect(typeof wrapped1).toBe('function')
      expect(typeof wrapped2).toBe('function')
    })

    it('should handle functions with no arguments', async () => {
      const mockFn = jest.fn(async () => 'no-args')
      const wrappedFn = wrapInModelContext(mockFn)

      const result = await wrappedFn()

      expect(result).toBe('no-args')
      expect(mockFn).toHaveBeenCalledWith()
    })
  })

  describe('runInModelContext', () => {
    it('should execute function in model context with arguments', async () => {
      const mockFn = jest.fn(async (x, y) => x * y)

      const result = await runInModelContext(mockFn, 6, 7)

      expect(result).toBe(42)
      expect(mockFn).toHaveBeenCalledWith(6, 7)
    })

    it('should provide model store to executed function', async () => {
      let capturedStore

      const mockFn = jest.fn(async () => {
        capturedStore = getSafeModelStore()

        return 'success'
      })

      const result = await runInModelContext(mockFn)

      expect(result).toBe('success')
      expect(capturedStore).toBeDefined()
      expect(typeof capturedStore).toBe('object')
    })

    it('should handle functions with multiple arguments', async () => {
      const mockFn = jest.fn(async (a, b, c) => [a, b, c].join('-'))

      const result = await runInModelContext(mockFn, 'one', 'two', 'three')

      expect(result).toBe('one-two-three')
      expect(mockFn).toHaveBeenCalledWith('one', 'two', 'three')
    })

    it('should handle errors thrown during execution', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Execution error')
      })

      await expect(runInModelContext(mockFn)).rejects.toThrow('Execution error')
    })

    it('should work with synchronous return values', async () => {
      const mockFn = jest.fn(async () => 123)

      const result = await runInModelContext(mockFn)

      expect(result).toBe(123)
    })
  })

  describe('getModelStore', () => {
    it('should throw error when called outside model context', () => {
      expect(() => getModelStore()).toThrow('Model store not found')
    })

    it('should return store when called inside model context', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        expect(store).toBeDefined()
        expect(typeof store).toBe('object')
      })
    })

    it('should return same store within same context', async () => {
      await runInModelContext(async () => {
        const store1 = getModelStore()
        const store2 = getModelStore()

        expect(store1).toBe(store2)
      })
    })

    it('should throw error with correct message', () => {
      try {
        getModelStore()
        // eslint-disable-next-line no-undef
        fail('Should have thrown error')
      } catch (error) {
        expect(error.message).toBe('Model store not found')
        expect(error).toBeInstanceOf(Error)
      }
    })
  })

  describe('getSafeModelStore', () => {
    it('should return empty object when called outside model context', () => {
      const store = getSafeModelStore()

      expect(store).toBeDefined()
      expect(store).toEqual({})
      expect(typeof store).toBe('object')
    })

    it('should return store when called inside model context', async () => {
      await runInModelContext(async () => {
        const store = getSafeModelStore()

        expect(store).toBeDefined()
        expect(typeof store).toBe('object')
      })
    })

    it('should never throw error', () => {
      expect(() => getSafeModelStore()).not.toThrow()

      runInModelContext(async () => {
        expect(() => getSafeModelStore()).not.toThrow()
      })
    })

    it('should return same store within same context', async () => {
      await runInModelContext(async () => {
        const store1 = getSafeModelStore()
        const store2 = getSafeModelStore()

        expect(store1).toBe(store2)
      })
    })

    it('should return empty object with correct type', () => {
      const store = getSafeModelStore()

      expect(Array.isArray(store)).toBe(false)
      expect(store).not.toBeNull()
      expect(typeof store).toBe('object')
    })
  })

  describe('nested context execution', () => {
    it('should handle nested wrapped function calls', async () => {
      const innerFn = jest.fn(async (x) => x * 2)
      const outerFn = jest.fn(async (x) => {
        const wrapped = wrapInModelContext(innerFn)

        return await wrapped(x)
      })

      const wrappedOuter = wrapInModelContext(outerFn)
      const result = await wrappedOuter(5)

      expect(result).toBe(10)
      expect(outerFn).toHaveBeenCalledWith(5)
      expect(innerFn).toHaveBeenCalledWith(5)
    })

    it('should maintain store access in nested contexts', async () => {
      await runInModelContext(async () => {
        const outerStore = getSafeModelStore()

        await runInModelContext(async () => {
          const innerStore = getSafeModelStore()

          expect(outerStore).toBeDefined()
          expect(innerStore).toBeDefined()
        })
      })
    })
  })

  describe('error propagation', () => {
    it('should propagate synchronous errors from wrapped functions', async () => {
      const mockFn = jest.fn(() => {
        throw new Error('Sync error')
      })

      const wrappedFn = wrapInModelContext(mockFn)

      await expect(wrappedFn()).rejects.toThrow('Sync error')
    })

    it('should propagate async errors from wrapped functions', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Async error')
      })

      const wrappedFn = wrapInModelContext(mockFn)

      await expect(wrappedFn()).rejects.toThrow('Async error')
    })

    it('should propagate errors from runInModelContext', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Run error')
      })

      await expect(runInModelContext(mockFn)).rejects.toThrow('Run error')
    })
  })
})
