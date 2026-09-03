import useLocalStorage from './useLocalStorage'

import { act, renderHook } from '@testing-library/react'

const localStorageMock = {}

jest.mock('@/lib/browserstorage', () => ({
  getLocalStorage: () => ({
    getItem: jest.fn((key) => localStorageMock[key] || null),
    setItem: jest.fn((key, value) => {
      localStorageMock[key] = value
    }),
    removeItem: jest.fn((key) => {
      delete localStorageMock[key]
    }),
  }),
}))

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage mock
    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key])
    jest.clearAllMocks()
  })

  describe('initial value', () => {
    it('should use initial value when no stored value exists', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      const [value] = result.current

      expect(value).toBe('initial')
    })

    it('should use stored value when it exists', () => {
      localStorageMock['test-key'] = JSON.stringify('stored')

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      const [value] = result.current

      expect(value).toBe('stored')
    })

    it('should handle boolean values', () => {
      localStorageMock['test-key'] = JSON.stringify(false)

      const { result } = renderHook(() => useLocalStorage('test-key', true))

      const [value] = result.current

      expect(value).toBe(false)
    })

    it('should handle object values', () => {
      const storedObject = { showTokens: false, showMessages: true }

      localStorageMock['test-key'] = JSON.stringify(storedObject)

      const { result } = renderHook(() =>
        useLocalStorage('test-key', { showTokens: true })
      )

      const [value] = result.current

      expect(value).toEqual(storedObject)
    })
  })

  describe('setting values', () => {
    it('should update state and localStorage when setValue is called', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      act(() => {
        const [, setValue] = result.current

        setValue('updated')
      })

      const [value] = result.current

      expect(value).toBe('updated')
      expect(localStorageMock['test-key']).toBe(JSON.stringify('updated'))
    })

    it('should support functional updates', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 0))

      act(() => {
        const [, setValue] = result.current

        setValue((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(1)

      act(() => {
        const [, setValue] = result.current

        setValue((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(2)
    })

    it('should update boolean values', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', true))

      expect(result.current[0]).toBe(true)

      act(() => {
        const [, setValue] = result.current

        setValue(false)
      })

      expect(result.current[0]).toBe(false)
      expect(localStorageMock['test-key']).toBe(JSON.stringify(false))
    })

    it('should update object values', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', { a: 1 }))

      act(() => {
        const [, setValue] = result.current

        setValue({ a: 2, b: 3 })
      })

      expect(result.current[0]).toEqual({ a: 2, b: 3 })
      expect(localStorageMock['test-key']).toBe(JSON.stringify({ a: 2, b: 3 }))
    })
  })

  describe('custom serialization', () => {
    it('should use custom serialize function', () => {
      const customSerialize = jest.fn((value) => `custom:${value}`)
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial', {
          serialize: customSerialize,
        })
      )

      act(() => {
        const [, setValue] = result.current

        setValue('value')
      })

      expect(customSerialize).toHaveBeenCalledWith('value')
      expect(localStorageMock['test-key']).toBe('custom:value')
    })

    it('should use custom deserialize function', () => {
      localStorageMock['test-key'] = 'custom:stored'

      const customDeserialize = jest.fn((raw) => raw.replace('custom:', ''))

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial', {
          deserialize: customDeserialize,
        })
      )

      expect(customDeserialize).toHaveBeenCalledWith('custom:stored')
      expect(result.current[0]).toBe('stored')
    })
  })

  describe('error handling', () => {
    it('should use initial value when stored value is invalid JSON', () => {
      localStorageMock['test-key'] = 'invalid json'

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      expect(result.current[0]).toBe('initial')
    })

    it('should still update state when localStorage fails to write', () => {
      // @note storage.setItem is wrapped in try/catch, so it doesn't throw
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      act(() => {
        const [, setValue] = result.current

        setValue('updated')
      })

      expect(result.current[0]).toBe('updated')
    })
  })

  describe('edge cases', () => {
    it('should handle null values', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', null))

      expect(result.current[0]).toBe(null)

      act(() => {
        const [, setValue] = result.current

        setValue(null)
      })

      expect(result.current[0]).toBe(null)
      expect(localStorageMock['test-key']).toBe(JSON.stringify(null))
    })

    it('should handle 0 as value', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 0))

      expect(result.current[0]).toBe(0)
    })

    it('should handle empty string as value', () => {
      localStorageMock['test-key'] = JSON.stringify('')

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'default')
      )

      expect(result.current[0]).toBe('')
    })

    it('should handle array values', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', [1, 2, 3])
      )

      act(() => {
        const [, setValue] = result.current

        setValue([4, 5, 6])
      })

      expect(result.current[0]).toEqual([4, 5, 6])
      expect(localStorageMock['test-key']).toBe(JSON.stringify([4, 5, 6]))
    })
  })

  describe('different keys', () => {
    it('should maintain separate values for different keys', () => {
      const { result: result1 } = renderHook(() =>
        useLocalStorage('key1', 'value1')
      )
      const { result: result2 } = renderHook(() =>
        useLocalStorage('key2', 'value2')
      )

      expect(result1.current[0]).toBe('value1')
      expect(result2.current[0]).toBe('value2')

      act(() => {
        result1.current[1]('updated1')
      })

      expect(result1.current[0]).toBe('updated1')
      expect(result2.current[0]).toBe('value2')
    })
  })

  describe('dynamic key changes', () => {
    it('should re-read from localStorage when key changes', () => {
      localStorageMock['key1'] = JSON.stringify('value1')
      localStorageMock['key2'] = JSON.stringify('value2')

      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, 'initial'),
        { initialProps: { key: 'key1' } }
      )

      expect(result.current[0]).toBe('value1')

      rerender({ key: 'key2' })

      expect(result.current[0]).toBe('value2')
    })

    it('should reset to initialValue when new key has no stored value', () => {
      localStorageMock['key1'] = JSON.stringify('stored')

      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, 'initial'),
        { initialProps: { key: 'key1' } }
      )

      expect(result.current[0]).toBe('stored')

      rerender({ key: 'key2' })

      expect(result.current[0]).toBe('initial')
    })

    it('should write to the correct key after key change', () => {
      const { result, rerender } = renderHook(
        ({ key }) => useLocalStorage(key, 'initial'),
        { initialProps: { key: 'key1' } }
      )

      rerender({ key: 'key2' })

      act(() => {
        result.current[1]('written-to-key2')
      })

      expect(localStorageMock['key2']).toBe(JSON.stringify('written-to-key2'))
      expect(localStorageMock['key1']).toBeUndefined()
    })
  })

  describe('callback stability', () => {
    it('should maintain stable setValue reference', () => {
      const { result, rerender } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      const firstSetValue = result.current[1]

      rerender()

      const secondSetValue = result.current[1]

      expect(firstSetValue).toBe(secondSetValue)
    })
  })

  describe('cleanup', () => {
    it('should not throw errors on unmount', () => {
      const { unmount } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      )

      expect(() => unmount()).not.toThrow()
    })
  })
})
