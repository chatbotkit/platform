import useAwaitableComponent from './useAwaitableComponent'

import { act, renderHook } from '@testing-library/react'

describe('useAwaitableComponent', () => {
  describe('initialization', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [status] = result.current

      expect(status).toBe('idle')
    })

    it('should return array with 5 elements', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      expect(result.current).toHaveLength(5)
    })

    it('should return correct function types', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [status, handleExecute, handleResolve, handleReject, handleReset] =
        result.current

      expect(typeof status).toBe('string')
      expect(typeof handleExecute).toBe('function')
      expect(typeof handleResolve).toBe('function')
      expect(typeof handleReject).toBe('function')
      expect(typeof handleReset).toBe('function')
    })
  })

  describe('execute functionality', () => {
    it('should change status to awaiting when execute is called', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [, handleExecute] = result.current

      let executePromise

      act(() => {
        executePromise = handleExecute()
      })

      const [status] = result.current

      expect(status).toBe('awaiting')
      expect(executePromise).toBeInstanceOf(Promise)
    })

    it('should return a promise from execute', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [, handleExecute] = result.current

      let executeResult

      act(() => {
        executeResult = handleExecute()
      })

      expect(executeResult).toBeInstanceOf(Promise)
    })
  })

  describe('resolve functionality', () => {
    it('should resolve promise with value when handleResolve is called', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      const testValue = 'test-value'

      act(() => {
        result.current[2](testValue)
      })

      const resolvedValue = await executePromise

      expect(resolvedValue).toBe(testValue)
    })

    it('should change status to resolved after resolving', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        result.current[1]()
      })

      act(() => {
        result.current[2]('value')
      })

      const [status] = result.current

      expect(status).toBe('resolved')
    })

    it('should throw error when resolving from non-awaiting state', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [, , handleResolve] = result.current

      expect(() => {
        act(() => {
          handleResolve('value')
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should resolve with undefined if no value provided', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[2]()
      })

      const resolvedValue = await executePromise

      expect(resolvedValue).toBeUndefined()
    })

    it('should resolve with null', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[2](null)
      })

      const resolvedValue = await executePromise

      expect(resolvedValue).toBeNull()
    })

    it('should resolve with object', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      const testObject = { key: 'value', nested: { data: 123 } }

      act(() => {
        result.current[2](testObject)
      })

      const resolvedValue = await executePromise

      expect(resolvedValue).toEqual(testObject)
    })
  })

  describe('reject functionality', () => {
    it('should reject promise with error when handleReject is called', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      const testError = new Error('test-error')

      act(() => {
        result.current[3](testError)
      })

      await expect(executePromise).rejects.toThrow('test-error')
    })

    it('should change status to rejected after rejecting', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('error'))
      })

      // Catch the rejection to prevent unhandled promise rejection
      executePromise.catch(() => {})

      const [status] = result.current

      expect(status).toBe('rejected')
    })

    it('should throw error when rejecting from non-awaiting state', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [, , , handleReject] = result.current

      expect(() => {
        act(() => {
          handleReject(new Error('error'))
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should reject with string error', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3]('string error')
      })

      await expect(executePromise).rejects.toBe('string error')
    })

    it('should reject with undefined', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3](undefined)
      })

      await expect(executePromise).rejects.toBeUndefined()
    })
  })

  describe('reset functionality', () => {
    it('should reset status to idle from resolved state', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        result.current[1]()
      })

      act(() => {
        result.current[2]('value')
      })

      act(() => {
        result.current[4]()
      })

      const [status] = result.current

      expect(status).toBe('idle')
    })

    it('should reset status to idle from rejected state', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('error'))
      })

      // Catch the rejection to prevent unhandled promise rejection
      executePromise.catch(() => {})

      act(() => {
        result.current[4]()
      })

      const [status] = result.current

      expect(status).toBe('idle')
    })

    it('should allow execute after reset', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      // First execution
      act(() => {
        result.current[1]()
      })

      act(() => {
        result.current[2]('first')
      })

      // Reset
      act(() => {
        result.current[4]()
      })

      // Second execution
      let secondPromise

      act(() => {
        secondPromise = result.current[1]()
      })

      act(() => {
        result.current[2]('second')
      })

      const result2 = await secondPromise

      expect(result2).toBe('second')
    })

    it('should reset from idle state without error', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      const [, , , , handleReset] = result.current

      expect(() => {
        act(() => {
          handleReset()
        })
      }).not.toThrow()

      const [status] = result.current

      expect(status).toBe('idle')
    })
  })

  describe('state transitions', () => {
    it('should prevent resolve after already resolved', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        result.current[1]()
      })

      act(() => {
        result.current[2]('first')
      })

      expect(() => {
        act(() => {
          result.current[2]('second')
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should prevent reject after already resolved', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      act(() => {
        result.current[1]()
      })

      act(() => {
        result.current[2]('value')
      })

      expect(() => {
        act(() => {
          result.current[3](new Error('error'))
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should prevent resolve after already rejected', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('error'))
      })

      // Catch the rejection to prevent unhandled promise rejection
      executePromise.catch(() => {})

      expect(() => {
        act(() => {
          result.current[2]('value')
        })
      }).toThrow('Awaitable component is not awaiting.')
    })

    it('should prevent reject after already rejected', () => {
      const { result } = renderHook(() => useAwaitableComponent())

      let executePromise

      act(() => {
        executePromise = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('first'))
      })

      // Catch the rejection to prevent unhandled promise rejection
      executePromise.catch(() => {})

      expect(() => {
        act(() => {
          result.current[3](new Error('second'))
        })
      }).toThrow('Awaitable component is not awaiting.')
    })
  })

  describe('multiple execution cycles', () => {
    it('should support multiple execute-resolve cycles', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      // First cycle
      let promise1

      act(() => {
        promise1 = result.current[1]()
      })

      act(() => {
        result.current[2]('first')
      })

      const result1 = await promise1

      expect(result1).toBe('first')

      // Reset
      act(() => {
        result.current[4]()
      })

      // Second cycle
      let promise2

      act(() => {
        promise2 = result.current[1]()
      })

      act(() => {
        result.current[2]('second')
      })

      const result2 = await promise2

      expect(result2).toBe('second')
    })

    it('should support multiple execute-reject cycles', async () => {
      const { result } = renderHook(() => useAwaitableComponent())

      // First cycle
      let promise1

      act(() => {
        promise1 = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('first'))
      })

      await expect(promise1).rejects.toThrow('first')

      // Reset
      act(() => {
        result.current[4]()
      })

      // Second cycle
      let promise2

      act(() => {
        promise2 = result.current[1]()
      })

      act(() => {
        result.current[3](new Error('second'))
      })

      await expect(promise2).rejects.toThrow('second')
    })
  })
})
