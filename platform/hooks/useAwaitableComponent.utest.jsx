import useAwaitableComponent from './useAwaitableComponent'

import { act, renderHook } from '@testing-library/react'

describe('useAwaitableComponent', () => {
  describe('basic functionality', () => {
    it('should return initial state as idle', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [status] = result.current

      expect(status).toBe('idle')
    })

    it('should return array with 5 elements', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      expect(Array.isArray(result.current)).toBe(true)
      expect(result.current).toHaveLength(5)
    })

    it('should return status, execute, resolve, reject, and reset functions', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [status, execute, resolve, reject, reset] = result.current

      expect(typeof status).toBe('string')
      expect(typeof execute).toBe('function')
      expect(typeof resolve).toBe('function')
      expect(typeof reject).toBe('function')
      expect(typeof reset).toBe('function')
    })
  })

  describe('execute functionality', () => {
    it('should change status to awaiting when executed', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [, execute] = result.current

      act(() => {
        execute()
      })

      const [status] = result.current

      expect(status).toBe('awaiting')
    })

    it('should return a promise', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [, execute] = result.current

      let promise

      act(() => {
        promise = execute()
      })

      expect(promise).toBeInstanceOf(Promise)
    })
  })

  describe('resolve functionality', () => {
    it('should resolve the promise with value', async () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [, execute, resolve] = result.current

      let promise

      act(() => {
        promise = execute()
      })

      const testValue = { data: 'test' }

      act(() => {
        const [, , resolveFunc] = result.current

        resolveFunc(testValue)
      })

      const value = await promise

      expect(value).toEqual(testValue)
    })

    it('should change status to resolved', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('test')
      })

      await promise

      const [status] = result.current

      expect(status).toBe('resolved')
    })

    it('should throw error if not awaiting', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [, , resolve] = result.current

      expect(() => {
        act(() => {
          resolve('test')
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should handle resolve with undefined', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve()
      })

      const value = await promise

      expect(value).toBeUndefined()
    })

    it('should handle resolve with null', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve(null)
      })

      const value = await promise

      expect(value).toBeNull()
    })
  })

  describe('reject functionality', () => {
    it('should reject the promise with error', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      const testError = new Error('Test error')

      act(() => {
        const [, , , reject] = result.current

        reject(testError)
      })

      await expect(promise).rejects.toThrow('Test error')
    })

    it('should change status to rejected', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , , reject] = result.current

        reject(new Error('Test'))
      })

      try {
        await promise
      } catch {
        // Expected
      }

      const [status] = result.current

      expect(status).toBe('rejected')
    })

    it('should throw error if not awaiting', () => {
      const { result } = renderHook(() => useAwaitableComponent())
      const [, , , reject] = result.current

      expect(() => {
        act(() => {
          reject(new Error('Test'))
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should handle reject with string', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , , reject] = result.current

        reject('Error string')
      })

      await expect(promise).rejects.toBe('Error string')
    })
  })

  describe('reset functionality', () => {
    it('should reset status to idle', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        const [, execute] = result.current

        execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('test')
      })

      act(() => {
        const [, , , , reset] = result.current

        reset()
      })

      const [status] = result.current

      expect(status).toBe('idle')
    })

    it('should allow execution after reset', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        const [, execute] = result.current

        execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('first')
      })

      act(() => {
        const [, , , , reset] = result.current

        reset()
      })

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('second')
      })

      const value = await promise

      expect(value).toBe('second')
    })
  })

  describe('state transitions', () => {
    it('should transition idle -> awaiting -> resolved', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      expect(result.current[0]).toBe('idle')

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      expect(result.current[0]).toBe('awaiting')

      act(() => {
        const [, , resolve] = result.current

        resolve('test')
      })

      await promise

      expect(result.current[0]).toBe('resolved')
    })

    it('should transition idle -> awaiting -> rejected', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      expect(result.current[0]).toBe('idle')

      let promise

      act(() => {
        const [, execute] = result.current

        promise = execute()
      })

      expect(result.current[0]).toBe('awaiting')

      act(() => {
        const [, , , reject] = result.current

        reject(new Error('Test'))
      })

      try {
        await promise
      } catch {
        // Expected
      }

      expect(result.current[0]).toBe('rejected')
    })

    it('should transition resolved -> idle after reset', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        const [, execute] = result.current

        execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('test')
      })

      expect(result.current[0]).toBe('resolved')

      act(() => {
        const [, , , , reset] = result.current

        reset()
      })

      expect(result.current[0]).toBe('idle')
    })
  })

  describe('edge cases', () => {
    it('should handle multiple executions', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise1

      act(() => {
        const [, execute] = result.current

        promise1 = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('first')
      })

      await promise1

      act(() => {
        const [, , , , reset] = result.current

        reset()
      })

      let promise2

      act(() => {
        const [, execute] = result.current

        promise2 = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('second')
      })

      const value = await promise2

      expect(value).toBe('second')
    })

    it('should not affect previous promises after new execution', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let promise1

      act(() => {
        const [, execute] = result.current

        promise1 = execute()
      })

      act(() => {
        const [, , resolve] = result.current

        resolve('first')
      })

      const value1 = await promise1

      expect(value1).toBe('first')
    })
  })
})
