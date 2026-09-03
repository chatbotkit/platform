import useDebouncedInput from './useDebouncedInput'

import { act, renderHook } from '@testing-library/react'

describe('useDebouncedInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  describe('initial state', () => {
    it('should return empty string value by default', () => {
      const { result } = renderHook(() => useDebouncedInput())

      expect(result.current.value).toBe('')
    })

    it('should return provided defaultValue', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'initial' })
      )

      expect(result.current.value).toBe('initial')
    })

    it('should provide inputRef', () => {
      const { result } = renderHook(() => useDebouncedInput())

      expect(result.current.inputRef).toBeDefined()
      expect(result.current.inputRef.current).toBe(null)
    })

    it('should provide inputProps with required properties', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'test' })
      )

      expect(result.current.inputProps).toHaveProperty('ref')
      expect(result.current.inputProps).toHaveProperty('defaultValue', 'test')
      expect(result.current.inputProps).toHaveProperty('onChange')
      expect(typeof result.current.inputProps.onChange).toBe('function')
    })
  })

  describe('debounced onChange behavior', () => {
    it('should not update value immediately on change', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'new value' },
        })
      })

      // Value should not update immediately
      expect(result.current.value).toBe('')
    })

    it('should update value after delay', async () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'new value' },
        })
      })

      expect(result.current.value).toBe('')

      // Fast-forward past the delay
      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe('new value')
    })

    it('should reset timer on rapid changes', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      // First change
      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'first' },
        })
      })

      // Advance 200ms (less than delay)
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // Second change - should reset timer
      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'second' },
        })
      })

      // Advance another 200ms (400ms total, but only 200ms since last change)
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // Value should still be empty (timer was reset)
      expect(result.current.value).toBe('')

      // Advance to complete the delay
      act(() => {
        jest.advanceTimersByTime(100)
      })

      // Now value should be the final change
      expect(result.current.value).toBe('second')
    })

    it('should use default delay of 300ms', () => {
      const { result } = renderHook(() => useDebouncedInput())

      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'test' },
        })
      })

      // Advance 299ms - should not update yet
      act(() => {
        jest.advanceTimersByTime(299)
      })
      expect(result.current.value).toBe('')

      // Advance 1 more ms to reach 300ms
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(result.current.value).toBe('test')
    })

    it('should respect custom delay', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 500 }))

      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'test' },
        })
      })

      // Advance 300ms - should not update yet (using 500ms delay)
      act(() => {
        jest.advanceTimersByTime(300)
      })
      expect(result.current.value).toBe('')

      // Advance to 500ms
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(result.current.value).toBe('test')
    })
  })

  describe('setValue function', () => {
    it('should update value immediately', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      act(() => {
        result.current.setValue('immediate')
      })

      // Value should update immediately without waiting
      expect(result.current.value).toBe('immediate')
    })

    it('should update input element value if ref is attached', () => {
      const { result } = renderHook(() => useDebouncedInput())

      // Simulate attaching the ref to an input
      const mockInput = { value: '' }

      result.current.inputRef.current = mockInput

      act(() => {
        result.current.setValue('new value')
      })

      expect(mockInput.value).toBe('new value')
      expect(result.current.value).toBe('new value')
    })

    it('should cancel pending debounce timer', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      // Trigger onChange which starts a debounce
      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'debounced' },
        })
      })

      // setValue before debounce completes
      act(() => {
        result.current.setValue('immediate')
      })

      expect(result.current.value).toBe('immediate')

      // Let debounce timer complete - should not change value
      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe('immediate')
    })
  })

  describe('clear function', () => {
    it('should clear value immediately', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'initial' })
      )

      expect(result.current.value).toBe('initial')

      act(() => {
        result.current.clear()
      })

      expect(result.current.value).toBe('')
    })

    it('should clear input element value if ref is attached', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'initial' })
      )

      const mockInput = { value: 'initial' }

      result.current.inputRef.current = mockInput

      act(() => {
        result.current.clear()
      })

      expect(mockInput.value).toBe('')
      expect(result.current.value).toBe('')
    })

    it('should cancel pending debounce timer', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'initial' })
      )

      // Trigger onChange
      act(() => {
        result.current.inputProps.onChange({
          target: { value: 'pending' },
        })
      })

      // Clear before debounce completes
      act(() => {
        result.current.clear()
      })

      expect(result.current.value).toBe('')

      // Let debounce complete
      act(() => {
        jest.advanceTimersByTime(300)
      })

      // Value should remain cleared
      expect(result.current.value).toBe('')
    })
  })

  describe('inputProps stability', () => {
    it('should maintain stable inputProps reference', () => {
      const { result, rerender } = renderHook(() =>
        useDebouncedInput({ delay: 300 })
      )

      const initialInputProps = result.current.inputProps

      // Rerender without changing options
      rerender()

      expect(result.current.inputProps).toBe(initialInputProps)
    })

    it('should update inputProps when delay changes', () => {
      const { result, rerender } = renderHook(
        ({ delay }) => useDebouncedInput({ delay }),
        { initialProps: { delay: 300 } }
      )

      const initialOnChange = result.current.inputProps.onChange

      rerender({ delay: 500 })

      // onChange should be recreated with new delay
      expect(result.current.inputProps.onChange).not.toBe(initialOnChange)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string input', () => {
      const { result } = renderHook(() =>
        useDebouncedInput({ defaultValue: 'initial', delay: 300 })
      )

      act(() => {
        result.current.inputProps.onChange({
          target: { value: '' },
        })
      })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe('')
    })

    it('should handle whitespace-only input', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      act(() => {
        result.current.inputProps.onChange({
          target: { value: '   ' },
        })
      })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe('   ')
    })

    it('should handle special characters', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      const specialValue = '<script>alert("xss")</script>'

      act(() => {
        result.current.inputProps.onChange({
          target: { value: specialValue },
        })
      })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe(specialValue)
    })

    it('should handle unicode characters', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      const unicodeValue = '日本語 🎉 émojis'

      act(() => {
        result.current.inputProps.onChange({
          target: { value: unicodeValue },
        })
      })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe(unicodeValue)
    })

    it('should handle very long input', () => {
      const { result } = renderHook(() => useDebouncedInput({ delay: 300 }))

      const longValue = 'a'.repeat(10000)

      act(() => {
        result.current.inputProps.onChange({
          target: { value: longValue },
        })
      })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current.value).toBe(longValue)
    })
  })
})
