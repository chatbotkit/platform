/* eslint-disable react-hooks/exhaustive-deps */
import useAborter from './useAborter'

import { renderHook } from '@testing-library/react'

describe('AbortError', () => {
  let AbortError

  beforeAll(() => {
    const { result } = renderHook(() => useAborter())

    const aborter = result.current

    try {
      aborter.abort('test')
      aborter.assertNotAborted()
    } catch (error) {
      AbortError = error.constructor
    }
  })

  it('should create AbortError with correct name and message', () => {
    const error = new AbortError('test message')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AbortError')
    expect(error.message).toBe('test message')
  })

  it('should create AbortError with default message when none provided', () => {
    const error = new AbortError()

    expect(error.name).toBe('AbortError')
    expect(error.message).toBeUndefined()
  })

  it('should maintain correct prototype chain', () => {
    const error = new AbortError('test')

    expect(error instanceof Error).toBe(true)
    expect(error instanceof AbortError).toBe(true)
  })
})

describe('Aborter class', () => {
  let aborter

  beforeEach(() => {
    const { result } = renderHook(() => useAborter())

    aborter = result.current
  })

  describe('signal property', () => {
    it('should provide access to AbortController signal', () => {
      expect(aborter.signal).toBeInstanceOf(AbortSignal)
      expect(aborter.signal.aborted).toBe(false)
    })

    it('should return the same signal instance', () => {
      const signal1 = aborter.signal
      const signal2 = aborter.signal

      expect(signal1).toBe(signal2)
    })
  })

  describe('aborted property', () => {
    it('should return false when not aborted', () => {
      expect(aborter.aborted).toBe(false)
    })

    it('should return true when aborted', () => {
      aborter.abort()

      expect(aborter.aborted).toBe(true)
    })
  })

  describe('abort() method', () => {
    it('should abort the controller', () => {
      expect(aborter.aborted).toBe(false)

      aborter.abort()

      expect(aborter.aborted).toBe(true)
    })

    it('should abort with custom reason', () => {
      const customReason = 'custom abort reason'

      aborter.abort(customReason)

      expect(aborter.aborted).toBe(true)
      expect(aborter.signal.reason).toBe(customReason)
    })

    it('should do nothing when already aborted', () => {
      aborter.abort('first reason')

      const firstSignal = aborter.signal

      aborter.abort('second reason')

      expect(aborter.signal).toBe(firstSignal)
      expect(aborter.signal.reason).toBe('first reason')
    })

    it('should abort without reason', () => {
      aborter.abort()

      expect(aborter.aborted).toBe(true)
      expect(aborter.signal.reason).toBeInstanceOf(Error)
    })
  })

  describe('reset() method', () => {
    it('should create new AbortController after reset', () => {
      const originalSignal = aborter.signal

      aborter.reset()

      expect(aborter.signal).not.toBe(originalSignal)
      expect(aborter.aborted).toBe(false)
    })

    it('should abort current controller before resetting', () => {
      const originalSignal = aborter.signal

      aborter.reset('reset reason')

      expect(originalSignal.aborted).toBe(true)
      expect(originalSignal.reason).toBe('reset reason')
      expect(aborter.aborted).toBe(false)
    })

    it('should work when already aborted', () => {
      aborter.abort('initial abort')

      expect(aborter.aborted).toBe(true)

      aborter.reset()

      expect(aborter.aborted).toBe(false)
    })

    it('should reset without reason', () => {
      const originalSignal = aborter.signal

      aborter.reset()

      expect(originalSignal.aborted).toBe(true)
      expect(aborter.aborted).toBe(false)
    })
  })

  describe('assertNotAborted() method', () => {
    it('should not throw when not aborted', () => {
      expect(() => {
        aborter.assertNotAborted()
      }).not.toThrow()
    })

    it('should throw AbortError when aborted', () => {
      aborter.abort()

      expect(() => {
        aborter.assertNotAborted()
      }).toThrow(/operation was aborted/i)
    })

    it('should throw AbortError with custom reason', () => {
      const customReason = 'custom abort reason'

      aborter.abort(customReason)

      expect(() => {
        aborter.assertNotAborted()
      }).toThrow(customReason)
    })

    it('should throw error with correct name', () => {
      aborter.abort()

      try {
        aborter.assertNotAborted()

        fail('Should have thrown')
      } catch (error) {
        expect(error.name).toBe('AbortError')
      }
    })

    it('should use default message when no reason provided', () => {
      aborter.abort()

      try {
        aborter.assertNotAborted()

        fail('Should have thrown')
      } catch (error) {
        expect(error.message.toString()).toMatch(
          /operation was aborted|Operation aborted/i
        )
      }
    })
  })

  describe('isAbortError() method', () => {
    it('should return true for AbortError instances', () => {
      aborter.abort()

      try {
        aborter.assertNotAborted()

        fail('Should have thrown')
      } catch (error) {
        expect(aborter.isAbortError(error)).toBe(true)
      }
    })

    it('should return true for errors with AbortError name', () => {
      const fakeAbortError = new Error('fake abort')

      fakeAbortError.name = 'AbortError'

      expect(aborter.isAbortError(fakeAbortError)).toBe(true)
    })

    it('should return false for regular errors', () => {
      const regularError = new Error('regular error')

      expect(aborter.isAbortError(regularError)).toBe(false)
    })

    it('should return false for non-error objects', () => {
      expect(aborter.isAbortError({})).toBe(false)
      expect(aborter.isAbortError('string')).toBe(false)

      const nullResult = aborter.isAbortError(null)
      const undefinedResult = aborter.isAbortError(undefined)

      expect(nullResult).toBe(false)
      expect(undefinedResult).toBe(false)
    })

    it('should return false for other error types', () => {
      const typeError = new TypeError('type error')
      const rangeError = new RangeError('range error')

      expect(aborter.isAbortError(typeError)).toBe(false)
      expect(aborter.isAbortError(rangeError)).toBe(false)
    })
  })
})

describe('useAborter hook', () => {
  it('should return an Aborter instance', () => {
    const { result } = renderHook(() => useAborter())

    expect(result.current).toBeDefined()
    expect(typeof result.current.abort).toBe('function')
    expect(typeof result.current.reset).toBe('function')
    expect(typeof result.current.assertNotAborted).toBe('function')
    expect(typeof result.current.isAbortError).toBe('function')
    expect(result.current.signal).toBeInstanceOf(AbortSignal)
  })

  it('should return the same instance when dependencies are stable', () => {
    const { result, rerender } = renderHook(() => useAborter([]))
    const firstInstance = result.current

    rerender()

    expect(result.current).toBe(firstInstance)
  })

  it('should return new instance when dependencies change', () => {
    const { result, rerender } = renderHook(({ deps }) => useAborter(deps), {
      initialProps: { deps: ['a'] },
    })
    const firstInstance = result.current

    rerender({ deps: ['b'] })

    expect(result.current).not.toBe(firstInstance)
  })

  it('should work with no dependencies (default)', () => {
    const { result } = renderHook(() => useAborter())

    expect(result.current).toBeDefined()
    expect(result.current.aborted).toBe(false)
  })

  it('should work with empty dependencies array', () => {
    const { result, rerender } = renderHook(() => useAborter([]))
    const firstInstance = result.current

    rerender()

    expect(result.current).toBe(firstInstance)
  })

  it('should create new instance with different dependency values', () => {
    let deps = ['initial']

    const { result, rerender } = renderHook(() => useAborter(deps))
    const firstInstance = result.current

    deps = ['changed']

    rerender()

    expect(result.current).not.toBe(firstInstance)
  })

  it('should maintain separate abort states for different instances', () => {
    const { result: result1 } = renderHook(() => useAborter(['instance1']))
    const { result: result2 } = renderHook(() => useAborter(['instance2']))

    result1.current.abort()

    expect(result1.current.aborted).toBe(true)
    expect(result2.current.aborted).toBe(false)
  })
})

describe('useAborter integration scenarios', () => {
  it('should handle abort and reset cycle correctly', () => {
    const { result } = renderHook(() => useAborter())
    const aborter = result.current

    expect(aborter.aborted).toBe(false)

    aborter.abort('test abort')

    expect(aborter.aborted).toBe(true)
    expect(() => aborter.assertNotAborted()).toThrow('test abort')

    aborter.reset()

    expect(aborter.aborted).toBe(false)
    expect(() => aborter.assertNotAborted()).not.toThrow()
  })

  it('should work with async operations and abort signals', async () => {
    const { result } = renderHook(() => useAborter())
    const aborter = result.current

    const asyncOperation = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve('completed'), 100)

      aborter.signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Operation aborted'))
      })
    })

    setTimeout(() => aborter.abort(), 50)

    await expect(asyncOperation).rejects.toThrow('Operation aborted')

    expect(aborter.aborted).toBe(true)
  })

  it('should properly detect different abort error sources', () => {
    const { result } = renderHook(() => useAborter())
    const aborter = result.current

    aborter.abort()

    let internalAbortError

    try {
      aborter.assertNotAborted()
    } catch (error) {
      internalAbortError = error
    }

    const externalAbortError = new Error('external abort')

    externalAbortError.name = 'AbortError'

    const regularError = new Error('not an abort error')

    expect(aborter.isAbortError(internalAbortError)).toBe(true)
    expect(aborter.isAbortError(externalAbortError)).toBe(true)
    expect(aborter.isAbortError(regularError)).toBe(false)
  })

  it('should handle multiple abort calls with different reasons', () => {
    const { result } = renderHook(() => useAborter())
    const aborter = result.current

    aborter.abort('first reason')

    expect(aborter.aborted).toBe(true)
    expect(aborter.signal.reason).toBe('first reason')

    aborter.abort('second reason')

    expect(aborter.signal.reason).toBe('first reason')
  })

  it('should create fresh controller after reset', () => {
    const { result } = renderHook(() => useAborter())
    const aborter = result.current

    const originalSignal = aborter.signal
    const originalAborted = aborter.aborted

    aborter.abort('test')

    expect(aborter.aborted).toBe(true)

    aborter.reset('reset reason')

    expect(aborter.signal).not.toBe(originalSignal)
    expect(aborter.aborted).toBe(originalAborted)
    expect(originalSignal.aborted).toBe(true)
    expect(originalSignal.reason).toBe('test')
  })
})
